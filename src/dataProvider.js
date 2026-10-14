// src/dataProvider.js — 数据提供方抽象层（零依赖，仅 Node 内置模块）
// 设计目标：分析方法与数据来源解耦。默认 auto（Wind 主用 → akshare 兜底 → local 演示保底）。
//   - local  : 演示种子数据（清晰标注为示例）
//   - wind   : 经 Hermes Agent 的 Wind MCP Skill 拉取真实数据（S 级）
//   - akshare: Python 开源数据兜底（B/C 级）
//   - auto   : 链式降级，优先真实数据，保证服务不中断
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { callHermes, extractJSON, hermesConfig: HC } = require('./hermesClient');
const config = require('./config');

const CACHE_DIR = path.join(config.DATA_DIR, 'cache');
try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (e) {}
const CACHE_TTL = 24 * 3600 * 1000; // 24h

function cacheKey(source, ticker) { return path.join(CACHE_DIR, `${source}_${ticker}.json`); }
function cacheGet(source, ticker) {
  try {
    const f = cacheKey(source, ticker);
    if (!fs.existsSync(f)) return null;
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (Date.now() - (j._cachedAt || 0) > CACHE_TTL) return null;
    return j;
  } catch (e) { return null; }
}
function cacheSet(source, ticker, data) {
  try { fs.writeFileSync(cacheKey(source, ticker), JSON.stringify(Object.assign({ _cachedAt: Date.now() }, data))); } catch (e) {}
}

// 主题反查：根据 ticker 在 themes.json 中定位主题/行业（Wind 未返回时兜底）
function resolveTheme(ticker) {
  for (const t of (config.themes.themes || [])) {
    if ((t.tickers || []).includes(ticker)) return { theme: t.name, industry: '' };
  }
  return { theme: '', industry: '' };
}

// ---------- 本地适配器（演示种子数据） ----------
const localAdapter = {
  type: 'local',
  async getThemeTickers() {
    return (config.themes.themes || []).map(t => ({
      key: t.key, name: t.name, description: t.description, tickers: t.tickers || [],
    }));
  },
  async getStock(ticker) {
    const p = path.join(config.DATA_DIR, 'stocks', `${ticker}.json`);
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  },
  async getAllStocks() {
    const dir = path.join(config.DATA_DIR, 'stocks');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; }
    }).filter(Boolean);
  },
  async getMacroSnapshot() {
    const p = path.join(config.DATA_DIR, 'macro', 'snapshot.json');
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  },
};

// ---------- Wind 适配器（经 Hermes + Wind MCP） ----------
// ---------- Wind 适配器（直接调用 Wind CLI，绕过 Hermes 以免 LLM 循环挂起） ----------
// 实测：Hermes 在复杂取数 prompt 下会循环/挂起（达 240s 超时后回退），而 Wind CLI 直接返回
// 结构化 JSON 表（content[0].text → data.data[].columns/rows），9s 内稳定返回真实数据。
// 因此「数据层」直连 CLI；Hermes 仅保留用于「自然语言语义解析」（nlIntake.parseIntent）。
const WIND_CLI_NODE = process.execPath;
const WIND_SKILL_DIR = (HC.windMcpSkillPath || '').replace(/[\\/]+$/, '');
const WIND_API_KEY_VAL = HC.windApiKey || '';

function num(v) { const n = parseFloat(v); return (v === undefined || v === null || isNaN(n)) ? undefined : n; }

// 调 Wind CLI：写参数文件 → node scripts/cli.mjs call <server> <tool> @scripts/request-*.json
// 返回 stdout 原始字符串（或 null）。cwd 必须切到 skill 目录，WIND_API_KEY 经 env 注入。
function callWindCli(serverType, toolName, params, timeoutMs = 60000) {
  return new Promise((resolve) => {
    if (!WIND_SKILL_DIR) { resolve(null); return; }
    const reqFile = `request_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.json`;
    const reqPath = path.join(WIND_SKILL_DIR, 'scripts', reqFile);
    try { fs.writeFileSync(reqPath, JSON.stringify(params), 'utf8'); }
    catch (e) { resolve(null); return; }
    const env = Object.assign({}, process.env, {
      WIND_API_KEY: WIND_API_KEY_VAL, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8',
    });
    execFile(WIND_CLI_NODE, ['scripts/cli.mjs', 'call', serverType, toolName, '@scripts/' + reqFile],
      { cwd: WIND_SKILL_DIR, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, windowsHide: true, env },
      (err, stdout) => {
        try { fs.unlinkSync(reqPath); } catch (e) {}
        if (err) { resolve(null); return; }
        resolve(stdout || '');
      });
  });
}

// 将 Wind CLI 输出合并为 {列名: 值}；unit 为 '%' 的数值自动 ÷100 转小数比。
function parseWindCli(stdout) {
  if (!stdout) return null;
  const text = stdout.trim();
  let outer;
  try { outer = JSON.parse(text); }
  catch (e) {
    // 容错：CLI 可能输出多行 JSON，取最后一个非空行再试
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    try { outer = JSON.parse(lines[lines.length - 1]); } catch (e2) { return null; }
  }
  if (outer.isError || !outer.content || !outer.content[0] || !outer.content[0].text) return null;
  let inner;
  try { inner = JSON.parse(outer.content[0].text); } catch (e) { return null; }
  // 兼容两种返回结构：
  //  - 行情快照类（get_stock_price_indicators）：inner.data 本身是单表 {columns,rows}
  //  - 财务/技术类：inner.data.data 是表数组 [{columns,rows}, ...]
  let tables = [];
  if (inner.data && Array.isArray(inner.data.data)) tables = inner.data.data;
  else if (inner.data && Array.isArray(inner.data.columns)) tables = [inner.data];
  else if (Array.isArray(inner.data)) tables = inner.data;
  const merged = {};
  for (const tbl of tables) {
    const cols = tbl.columns || [];
    const rows = tbl.rows || [];
    if (!rows.length) continue;
    const row = rows[0];
    cols.forEach((c, i) => {
      let v = row[i];
      if (c.unit === '%' && v !== '' && v !== null && v !== undefined) {
        const n = parseFloat(v); v = isNaN(n) ? v : n / 100;
      }
      merged[c.name] = v;
    });
  }
  return Object.keys(merged).length ? merged : null;
}

// 从新闻原始输出提取标题列表（多表、多行）
function extractWindNews(stdout) {
  if (!stdout) return [];
  const text = stdout.trim();
  let outer;
  try { outer = JSON.parse(text); }
  catch (e) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    try { outer = JSON.parse(lines[lines.length - 1]); } catch (e2) { return []; }
  }
  if (outer.isError || !outer.content || !outer.content[0] || !outer.content[0].text) return [];
  let inner;
  try { inner = JSON.parse(outer.content[0].text); } catch (e) { return []; }
  let tables = [];
  if (inner.data && Array.isArray(inner.data.data)) tables = inner.data.data;
  else if (inner.data && Array.isArray(inner.data.columns)) tables = [inner.data];
  else if (Array.isArray(inner.data)) tables = inner.data;
  const out = [];
  for (const tbl of tables) {
    const cols = tbl.columns || [];
    const ti = cols.findIndex(c => /title|标题|新闻|名称/.test(c.name));
    (tbl.rows || []).forEach(r => {
      if (ti >= 0 && r[ti]) out.push({ title: String(r[ti]), content: '', pubDate: '', source: '', authorityWeight: 60 });
    });
  }
  return out.slice(0, 5);
}

function pick(obj, keys) {
  if (!obj) return undefined;
  for (const k of keys) { if (obj[k] !== undefined && obj[k] !== '' && obj[k] !== null) return obj[k]; }
  return undefined;
}

// Wind 工具返回的列名随提问措辞变化（如「历史每日市盈率」「RSI_14」「MA_20」「最新市盈率在历史中的分位」），
// 故用「关键词谓词」做模糊匹配，而不是精确列名。
function fuzzyPick(obj, preds) {
  if (!obj) return undefined;
  for (const pred of preds) {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v !== '' && v !== null && v !== undefined && pred(k)) return v;
    }
  }
  return undefined;
}

async function fetchWindStock(ticker) {
  const cached = cacheGet('wind', ticker);
  if (cached) return cached;
  if (!WIND_SKILL_DIR || !WIND_API_KEY_VAL) return null;
  const [basicR, priceR, techR, fundR, newsR] = await Promise.all([
    callWindCli('stock_data', 'get_stock_basicinfo', { question: `查询${ticker}的基本档案，包括简称、所属行业` }),
    callWindCli('stock_data', 'get_stock_price_indicators', { windcode: ticker, indexes: '最新成交价,PE(TTM),PB,5日涨跌幅,20日涨跌幅,60日涨跌幅,年初至今涨跌幅,52周最高价,52周最低价' }),
    callWindCli('stock_data', 'get_stock_technicals', { question: `查询${ticker}的RSI(14)、MACD、MA20、MA60、MA250、20日年化波动率、Beta值` }),
    callWindCli('stock_data', 'get_stock_fundamentals', { question: `查询${ticker}的ROE、ROIC、营业收入增速、净利润增速、PE历史分位、PB历史分位` }),
    callWindCli('financial_docs', 'get_financial_news', { query: `${ticker} 最近财经新闻` }),
  ]);
  const price = parseWindCli(priceR);
  const tech = parseWindCli(techR);
  const fund = parseWindCli(fundR);
  const basic = parseWindCli(basicR);
  if (!price && !tech && !fund) return null; // 三层全部失败 → 触发 akshare/local 兜底

  const stock = {
    ticker,
    name: String(pick(basic, ['证券简称', '名称', 'name']) || ticker),
    theme: '',
    industry: String(pick(basic, ['所属WIND行业明细', '行业', 'industry']) || ''),
    _demo: false,
    _source: 'wind',
    _fetchedAt: new Date().toISOString(),
    fundamentals: {
      pe: num(fuzzyPick(fund, [k => /市盈率/.test(k) && !/分位/.test(k)])),
      pb: num(fuzzyPick(fund, [k => /市净率/.test(k) && !/分位/.test(k)])),
      ps: null,
      pePct: num(fuzzyPick(fund, [k => /市盈率/.test(k) && /分位/.test(k)])),
      pbPct: num(fuzzyPick(fund, [k => /市净率/.test(k) && /分位/.test(k)])),
      roe: num(fuzzyPick(fund, [k => /净资产收益率|ROE/i.test(k)])),
      roic: num(fuzzyPick(fund, [k => /投入资本回报率|ROIC/i.test(k)])),
      revGrowth: num(fuzzyPick(fund, [k => /营业收入.*同比增长|营收.*增速|营业收入_同比增长/.test(k)])),
      profitGrowth: num(fuzzyPick(fund, [k => /净利润.*同比增长|净利润_同比增长/.test(k)])),
      roa: null, cfo: null, roaDelta: null, cfoMinusRoa: null, levDelta: null,
      curRatioDelta: null, sharesDelta: null, gmDelta: null, atDelta: null,
      wc: null, re: null, ebit: null, mvEquity: null, sales: null, ta: null,
      tl: null, equity: null,
    },
    technicals: {
      price: num(fuzzyPick(price, [k => /最新成交价|收盘价/.test(k)])),
      ma20: num(fuzzyPick(tech, [k => /MA_?20\b/i.test(k) && !/周期/.test(k)])),
      ma60: num(fuzzyPick(tech, [k => /MA_?60\b/i.test(k) && !/周期/.test(k)])),
      ma250: num(fuzzyPick(tech, [k => /MA_?250\b/i.test(k) && !/周期/.test(k)])),
      rsi14: num(fuzzyPick(tech, [k => /RSI/i.test(k) && !/周期/.test(k)])),
      macdHist: num(fuzzyPick(tech, [k => /MACD/i.test(k)])),
      ret12m: num(fuzzyPick(price, [k => /年初至今涨跌幅|近1年|52周|250日/.test(k)])),
      ret1m: num(fuzzyPick(price, [k => /20日涨跌幅|近20日/.test(k)])),
      vol20d: num(fuzzyPick(tech, [k => /年化波动率/.test(k)])),
      beta: num(fuzzyPick(tech, [k => /BETA/i.test(k)])),
    },
    news: extractWindNews(newsR),
  };
  cacheSet('wind', ticker, stock);
  return stock;
}

const windAdapter = {
  type: 'wind',
  getThemeTickers: localAdapter.getThemeTickers,
  getMacroSnapshot: localAdapter.getMacroSnapshot,
  getStock: fetchWindStock,
};

// ---------- akshare 适配器（Python 开源，兜底） ----------
function fetchAkshareStock(ticker) {
  const code = ticker.split('.')[0];
  const py = `
import sys, json
try:
    import akshare as ak
except Exception as e:
    print(json.dumps({"_error": "akshare_not_installed"})); sys.exit(0)
try:
    info = ak.stock_individual_info_em(symbol="${code}")
    d = {r[0]: r[1] for r in info.values.tolist()} if hasattr(info,'values') else {}
    name = d.get('股票简称','${code}')
    hist = ak.stock_zh_a_hist(symbol="${code}", period="daily", adjust="qfq")
    price = float(hist['收盘'].iloc[-1]) if hist is not None and len(hist) else None
    ret12m = float((hist['收盘'].iloc[-1]/hist['收盘'].iloc[-250]-1)) if hist is not None and len(hist)>=250 else None
    ind = ak.stock_a_indicator_lg(symbol="${code}")
    pe = float(ind['市盈率'].iloc[-1]) if ind is not None and len(ind) else None
    pb = float(ind['市净率'].iloc[-1]) if ind is not None and len(ind) else None
    out = {"name":name,"industry":"","theme":"","fundamentals":{"pe":pe,"pb":pb,"roe":None,"roic":None},"technicals":{"price":price,"ret12m":ret12m},"news":[]}
    print(json.dumps(out, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"_error": str(e)}))
`;
  return new Promise((resolve) => {
    const pythonExe = process.env.AM_PYTHON || 'python';
    const { execFile } = require('child_process');
    execFile(pythonExe, ['-c', py], { timeout: 60000, maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        const j = JSON.parse((stdout || '').trim().split('\n').pop());
        if (j._error) return resolve(null);
        const th = resolveTheme(ticker);
        const stock = {
          ticker, name: j.name || ticker, theme: j.theme || th.theme || '', industry: j.industry || th.industry || '',
          _demo: false, _source: 'akshare', _fetchedAt: new Date().toISOString(),
          fundamentals: j.fundamentals || {}, technicals: j.technicals || {}, news: Array.isArray(j.news) ? j.news : [],
        };
        cacheSet('akshare', ticker, stock);
        resolve(stock);
      } catch (e) { resolve(null); }
    });
  });
}

const akshareAdapter = {
  type: 'akshare',
  getThemeTickers: localAdapter.getThemeTickers,
  getMacroSnapshot: localAdapter.getMacroSnapshot,
  getStock: fetchAkshareStock,
};

// ---------- auto 适配器（链式降级：wind → akshare → local） ----------
const autoAdapter = {
  type: 'auto',
  getThemeTickers: localAdapter.getThemeTickers,
  getMacroSnapshot: localAdapter.getMacroSnapshot,
  async getStock(ticker) {
    let s = await fetchWindStock(ticker);
    if (s) return s;
    s = await fetchAkshareStock(ticker);
    if (s) return s;
    const local = await localAdapter.getStock(ticker);
    if (local) local._source = 'local-demo-fallback';
    return local; // 可能为 null（演示集无此标的）
  },
};

const registry = { local: localAdapter, wind: windAdapter, akshare: akshareAdapter, auto: autoAdapter };

function getProvider(type = config.dataProvider) {
  return registry[type] || localAdapter;
}

module.exports = { getProvider, localAdapter, windAdapter, akshareAdapter, autoAdapter, resolveTheme };
