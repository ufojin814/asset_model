// server.js — 原生 Node.js HTTP 服务（零依赖）
// 提供三大研究板块 API + 自然语言入口（NL 解析经 Hermes）+ 研究资料库浏览 + 静态前端托管。
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const { getProvider, resolveWindCode, searchWindStocks } = require('./src/dataProvider');
const { analyzeMacro, summarizeMacro } = require('./src/macroAnalyzer');
const { selectStocks, selectByTickers } = require('./src/stockSelector');
const { deepResearch } = require('./src/deepResearch');
const { saveReport, listReports, getReport, stats } = require('./src/researchDB');
const { parseIntent, getAliasMap } = require('./src/nlIntake');
const { isoStamp } = require('./src/utils');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJSON(res, obj, code = 200) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(b);
}
function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

// ---------- 报告构建（落库用） ----------
function buildMacroMarkdown(macro) {
  const L = [`# 宏观研判报告`, '', `> 生成时间：${isoStamp()} ｜ 框架：多因子加权信号 + 概率化解释（潜变量正态模型）`, ''];
  L.push('## 因子原始信号（raw，+1=扩张/利好风险资产）');
  L.push('| 因子 | 信号 |');
  L.push('|------|------|');
  const rd = macro.raw;
  for (const [k, v] of Object.entries(rd)) L.push(`| ${k} | ${v.toFixed(3)} |`);
  L.push('');
  L.push('## 大类资产概率研判（看涨/震荡/看跌）');
  for (const [aKey, aCfg] of Object.entries(macro.assets)) {
    L.push(`### ${aCfg.label}`);
    L.push('| 期限 | 倾斜度T | 看涨 | 震荡 | 看跌 | 结论 | 研判依据（主因） |');
    L.push('|------|--------|------|------|------|------|------------------|');
    for (const h of ['short', 'mid', 'long']) {
      const h2 = aCfg.byHorizon[h];
      const basis = (h2.explain.factors || []).map(f => `${f.label}(${f.bull ? '利好' : '利空'}${f.bull ? '+' : '−'}${Math.abs(f.contrib).toFixed(2)})`).join('；');
      L.push(`| ${h2.label} | ${h2.tilt} | ${(h2.probs.看涨 * 100).toFixed(1)}% | ${(h2.probs.震荡 * 100).toFixed(1)}% | ${(h2.probs.看跌 * 100).toFixed(1)}% | ${h2.stance} | ${basis} |`);
    }
    L.push('');
  }
  L.push('## 研判摘要'); L.push(summarizeMacro(macro)); L.push('');
  L.push('---'); L.push('*方法论与学术支撑见 docs/方法论与学术支撑.md。概率为多因子信号聚合的透明解释，非预测承诺。*');
  return L.join('\n');
}
function buildSelectionMarkdown(sel) {
  const L = [`# 选股研究报告 · ${sel.theme}`, '', `> 生成时间：${isoStamp()} ｜ 权重：基本面${sel.weights.fundamental}/技术面${sel.weights.technical}/消息面${sel.weights.sentiment}`, `> ${sel.description || ''}`, ''];
  L.push(`主题内共 ${sel.count} 只标的，排名前 ${sel.top.length} 如下：`);
  L.push('');
  sel.ranked.forEach((s, i) => {
    const tag = i < sel.top.length ? '【入选】' : '';
    L.push(`### ${i + 1}. ${tag}${s.name}（${s.ticker}）  统一评分 ${s.scores.unified}`);
    L.push(`- 基本面 ${s.scores.fundamental} / 技术面 ${s.scores.technical} / 消息面 ${s.scores.sentiment}`);
    L.push(`- 雷达维度：财务健康 ${s.radar.财务健康}｜安全边际 ${s.radar.安全边际}｜估值吸引力 ${s.radar.估值吸引力}｜价格动量 ${s.radar.价格动量}｜低波质量 ${s.radar.低波质量}｜消息情绪 ${s.radar.消息情绪}`);
    L.push(`- 结论：${s.conclusion}`);
    if (s.news && s.news.length) L.push(`- 近期消息：${s.news.slice(0, 3).map(n => n.title).join('；')}`);
    L.push('');
  });
  L.push('## 复制清单（代码\\t名称）');
  L.push('```');
  L.push(sel.copyList);
  L.push('```');
  L.push('');
  L.push('---'); L.push('*评分方法学与学术支撑见 docs/方法论与学术支撑.md。*');
  return L.join('\n');
}

// ---------- 自然语言入口 ----------
async function handleNLThemes(text, topN) {
  const intent = await parseIntent(text);
  const themeKeys = intent.themes || [];
  const concepts = intent.concepts || [];
  if (!themeKeys.length && !concepts.length) return { ok: false, error: '未能从输入识别出主题板块或概念', intent };

  const themes = [];
  const saved = [];
  const seenKey = new Set();
  const allThemeMeta = await getProvider().getThemeTickers();

  // 1) 已知主题键（来自 config/themes.json）
  for (const themeKey of themeKeys) {
    if (seenKey.has(themeKey)) continue;
    seenKey.add(themeKey);
    const sel = await selectStocks(themeKey, { topN: topN || 3 });
    if (sel.ok) {
      const md = buildSelectionMarkdown(sel);
      const s = saveReport({ type: 'selection', ticker: themeKey, title: `选股 ${sel.theme}`, markdown: md, meta: { topN: topN || 3, count: sel.count, fromNL: true } });
      sel.saved = s.entry;
      themes.push(sel);
      saved.push(s.entry);
    } else {
      themes.push({ themeKey, ok: false, error: sel.error });
    }
  }

  // 2) 自由概念：若命中某已知主题（key/名称）则按主题处理；否则经 Wind search_stocks 兜底
  for (const concept of concepts) {
    if (seenKey.has('concept:' + concept)) continue;
    const lc = String(concept).toLowerCase();
    const matchedTheme = allThemeMeta.find(t =>
      t.key === concept || t.name === concept ||
      t.key.toLowerCase().includes(lc) || lc.includes(t.key.toLowerCase()) ||
      t.name.toLowerCase().includes(lc) || lc.includes(t.name.toLowerCase()));
    if (matchedTheme && !seenKey.has(matchedTheme.key)) {
      seenKey.add(matchedTheme.key);
      const sel = await selectStocks(matchedTheme.key, { topN: topN || 3 });
      if (sel.ok) {
        const md = buildSelectionMarkdown(sel);
        const s = saveReport({ type: 'selection', ticker: matchedTheme.key, title: `选股 ${sel.theme}`, markdown: md, meta: { topN: topN || 3, count: sel.count, fromNL: true } });
        sel.saved = s.entry;
        themes.push(sel);
        saved.push(s.entry);
        continue;
      }
    }
    // Wind 概念兜底：自然语言反查标的池
    seenKey.add('concept:' + concept);
    let tickers = null;
    try { tickers = await searchWindStocks(`筛选A股${concept}概念相关股票，取前8只`, 8); } catch (e) { tickers = null; }
    if (tickers && tickers.length) {
      const sel = await selectByTickers(concept, 'concept:' + concept, `Wind 概念筛选：${concept}`, tickers, { topN: topN || 3 });
      if (sel.ok) {
        const md = buildSelectionMarkdown(sel);
        const s = saveReport({ type: 'selection', ticker: 'concept:' + concept, title: `选股 ${sel.theme}`, markdown: md, meta: { topN: topN || 3, count: sel.count, fromNL: true, concept: true } });
        sel.saved = s.entry;
        themes.push(sel);
        saved.push(s.entry);
      } else {
        themes.push({ themeKey: concept, ok: false, error: sel.error });
      }
    } else {
      themes.push({ themeKey: concept, ok: false, error: `Wind 未筛选出「${concept}」相关标的（可尝试更具体的概念名）` });
    }
  }

  return { ok: true, intent, themes, saved };
}

async function handleNLDeep(text) {
  const intent = await parseIntent(text);
  if (!intent.tickers.length) return { ok: false, error: '未能从输入识别出股票标的', intent };
  const alias = getAliasMap();
  const resolved = intent.tickers.map(t => {
    const s = String(t).match(/^(\d{6}\.(?:SH|SZ))$/i);
    if (s) return { raw: t, code: s[1].toUpperCase(), name: alias.codeToName[s[1].toUpperCase()] || s[1] };
    if (alias.nameToCode[t]) return { raw: t, code: alias.nameToCode[t], name: t };
    const partial = Object.keys(alias.nameToCode).find(n => n.includes(t) || t.includes(n));
    if (partial) return { raw: t, code: alias.nameToCode[partial], name: partial };
    return { raw: t, code: null, name: t };
  });
  // 本地/演示集未命中的名称（如「中国卫通」）→ 经 Wind 解析为标准代码
  for (const r of resolved) {
    if (!r.code) {
      try {
        const wc = await resolveWindCode(r.raw);
        if (wc) { r.code = wc.code; r.name = wc.name || r.raw; r.resolvedBy = 'wind'; }
      } catch (e) { /* 解析失败保持 code=null，后续按未命中处理 */ }
    }
  }
  const tasks = resolved.map(async r => {
    if (!r.code) return { ...r, ok: false, error: '无法解析为已知标的代码（演示数据集中无此标的，且 Wind 亦未匹配）' };
    const dr = await deepResearch(r.code); // deepResearch 内部已落库
    return { ...r, ok: dr.ok, rating: dr.rating, markdown: dr.markdown, json: dr.json, error: dr.error };
  });
  const results = await Promise.all(tasks);
  return { ok: true, intent, results };
}

// ---------- API 处理 ----------
async function handleApi(req, res, url) {
  const q = url.searchParams;
  if (url.pathname === '/api/health') return sendJSON(res, { ok: true, ts: Date.now(), dataProvider: config.dataProvider, hermes: 'ready' });

  if (url.pathname === '/api/themes') {
    const themes = await getProvider().getThemeTickers();
    return sendJSON(res, { ok: true, themes });
  }

  if (url.pathname === '/api/macro' && req.method === 'GET') {
    const snap = await getProvider().getMacroSnapshot();
    if (!snap) return sendJSON(res, { ok: false, error: '缺失宏观快照 data/macro/snapshot.json' }, 400);
    const macro = analyzeMacro(snap);
    const md = buildMacroMarkdown(macro);
    const saved = saveReport({ type: 'macro', ticker: '', title: `宏观研判 ${new Date().toISOString().slice(0, 10)}`, markdown: md });
    return sendJSON(res, { ok: true, macro, saved: saved.entry });
  }

  if (url.pathname === '/api/select' && req.method === 'GET') {
    const theme = q.get('theme');
    if (!theme) return sendJSON(res, { ok: false, error: '缺少 theme 参数' }, 400);
    const topN = parseInt(q.get('topN') || '3', 10);
    const sel = await selectStocks(theme, { topN });
    if (!sel.ok) return sendJSON(res, sel, 400);
    const md = buildSelectionMarkdown(sel);
    const saved = saveReport({ type: 'selection', ticker: theme, title: `选股 ${sel.theme}`, markdown: md, meta: { topN, count: sel.count } });
    sel.saved = saved.entry;
    return sendJSON(res, sel);
  }

  if (url.pathname === '/api/deep' && req.method === 'GET') {
    const ticker = q.get('ticker');
    if (!ticker) return sendJSON(res, { ok: false, error: '缺少 ticker 参数' }, 400);
    const r = await deepResearch(ticker);
    if (!r.ok) return sendJSON(res, r, 400);
    return sendJSON(res, r);
  }

  // —— 自然语言入口 ——
  if (url.pathname === '/api/nl-themes' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req) || '{}'); } catch (e) {}
    if (!body.text || !body.text.trim()) return sendJSON(res, { ok: false, error: '缺少 text 字段' }, 400);
    const r = await handleNLThemes(body.text, body.topN || 3);
    return sendJSON(res, r, r.ok ? 200 : 400);
  }

  if (url.pathname === '/api/nl-deep' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(await readBody(req) || '{}'); } catch (e) {}
    if (!body.text || !body.text.trim()) return sendJSON(res, { ok: false, error: '缺少 text 字段' }, 400);
    const r = await handleNLDeep(body.text);
    return sendJSON(res, r, r.ok ? 200 : 400);
  }

  if (url.pathname === '/api/kb' && req.method === 'GET') {
    const type = q.get('type') || undefined;
    const ticker = q.get('ticker') || undefined;
    return sendJSON(res, { ok: true, stats: stats(), entries: listReports({ type, ticker, limit: 200 }) });
  }
  if (url.pathname.startsWith('/api/kb/') && req.method === 'GET') {
    const file = decodeURIComponent(url.pathname.replace('/api/kb/', ''));
    const content = getReport(file);
    if (!content) return sendJSON(res, { ok: false, error: '未找到' }, 404);
    return sendJSON(res, { ok: true, file, content });
  }

  return sendJSON(res, { ok: false, error: 'unknown api' }, 404);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    // 静态文件
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.join(__dirname, 'public', p);
    if (!file.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end('forbidden'); }
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return sendFile(res, file);
    // SPA 回退
    return sendFile(res, path.join(__dirname, 'public', 'index.html'));
  } catch (e) {
    sendJSON(res, { ok: false, error: e.message }, 500);
  }
});

server.listen(config.port, () => {
  console.log(`[asset_model] 服务已启动: http://localhost:${config.port}  (数据提供方: ${config.dataProvider})`);
});

module.exports = server;
