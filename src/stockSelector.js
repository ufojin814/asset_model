// src/stockSelector.js — 选股板块：主题 → 标的池 → 三维评分（基本面/技术面/消息面）→ 统一评分 → TopN
// 学术/业内支撑：
//   基本面：Piotroski F-Score (Piotroski, 2000, JAR)；Altman Z-Score (Altman, 1968)；估值历史分位（Graham 安全边际 / Shiller）；
//           盈利质量 ROE/ROIC（质量因子，Fama-French 质量因子 Novy-Marx 2013）。
//   技术面：12-1 动量 (Jegadeesh & Titman, 1993)；低波动异象 (Ang et al., 2006, JFE)；趋势/均线系统（跨均线择时共识）。
//   消息面：Loughran-McDonald 金融情感词典 (2011)。
//   统一：三维 z-score 标准化后按权重合成（基本面 0.40 / 技术面 0.30 / 消息面 0.30），权重依据各因子长期有效性文献设定。
const { getProvider } = require('./dataProvider');
const { scoreStockNews } = require('./sentiment');
const { clamp, round, mean, std, zscore } = require('./utils');

// 行业识别：金融（银行/证券/保险等）不适用 Altman Z / Piotroski F —— 二者基于「营运资本/总资产」
// 等制造业口径，金融机构负债结构与制造业迥异，套用会得到 Z≈0 的伪「违约」信号。故对金融业
// 单独走「估值+盈利质量(ROE/PB)+动量」评级口径，并在评分中把这两项置中性（50），避免误杀。
function isFinancial(stock) {
  // 同时用 行业 + 主题 + 名称 判定：Wind 对部分标的返回的行业字段可能为空，
  // 但 A 股金融股名称稳定含「银行/证券/保险」等字样，纳入名称可兜底识别。
  const s = ((stock.industry || '') + ' ' + (stock.theme || '') + ' ' + (stock.name || '')).toLowerCase();
  return /银行|金融|证券|保险|信托|基金|资管|投行|财务公司|货币|capital/.test(s);
}

// ---------- 基本面子项 ----------
function piotroskiF(f) {
  if (!f) return null;
  const c = [
    (f.roa ?? 0) > 0 ? 1 : 0,
    (f.cfo ?? 0) > 0 ? 1 : 0,
    (f.roaDelta ?? 0) > 0 ? 1 : 0,
    (f.cfo ?? 0) > (f.roa ?? 0) ? 1 : 0,
    (f.levDelta ?? 0) < 0 ? 1 : 0,
    (f.curRatioDelta ?? 0) > 0 ? 1 : 0,
    (f.sharesDelta ?? 0) <= 0 ? 1 : 0,
    (f.gmDelta ?? 0) > 0 ? 1 : 0,
    (f.atDelta ?? 0) > 0 ? 1 : 0,
  ];
  return c.reduce((a, b) => a + b, 0); // 0-9
}
function altmanZ(f) {
  if (!f) return null;
  const ta = f.ta || 1, tl = f.tl || 1;
  const z = 1.2 * ((f.wc ?? 0) / ta) + 1.4 * ((f.re ?? 0) / ta) + 3.3 * ((f.ebit ?? 0) / ta)
    + 0.6 * ((f.mvEquity ?? 0) / tl) + 1.0 * ((f.sales ?? 0) / ta);
  return z;
}
function zToScore(z) {
  if (z == null) return 50;
  if (z >= 2.99) return 100;
  if (z >= 1.81) return round(60 + (z - 1.81) / (2.99 - 1.81) * 40, 1);
  return round(clamp(z / 1.81, 0, 1) * 60, 1);
}
function valuationScore(f) {
  if (!f) return 50;
  const pePct = clamp(f.pePct ?? 0.5, 0, 1);
  const pbPct = clamp(f.pbPct ?? 0.5, 0, 1);
  return round(100 - (pePct * 0.6 + pbPct * 0.4) * 100, 1);
}
function qualityScore(f) {
  if (!f) return 50;
  // ROE/ROIC 越高越好；缺失给中性
  const roe = clamp((f.roe ?? 0) / 30, -1, 1); // 30% ROE → +1
  const roic = clamp((f.roic ?? 0) / 20, -1, 1);
  return round(50 + (roe * 0.5 + roic * 0.5) * 50, 1);
}

// ---------- 技术面子项 ----------
function momentumScore(t) {
  if (!t) return 50;
  const r = t.ret12m ?? 0; // 12个月收益率，例如 0.5 = +50%
  return round(clamp(50 + r * 50, 0, 100), 1);
}
function lowVolScore(t) {
  if (!t) return 50;
  const v = t.vol20d ?? 0.25; // 年化波动率，0.25=25%
  return round(clamp(100 - v * 120, 0, 100), 1); // 25%波动→70分；越低越好
}
function trendScore(t) {
  if (!t || !t.price) return 50;
  const above = [t.ma20, t.ma60, t.ma250].filter(m => m && t.price > m).length;
  return round(above / 3 * 100, 1);
}
function rsiScore(t) {
  if (!t || t.rsi14 == null) return 50;
  let s = 50 + (t.rsi14 - 50) * 0.6;
  if (t.rsi14 > 80) s -= 15; // 超买
  if (t.rsi14 < 20) s += 10; // 超卖反转机会
  return round(clamp(s, 0, 100), 1);
}
function macdScore(t) {
  if (!t || t.macdHist == null) return 50;
  return round(clamp(50 + t.macdHist * 200, 0, 100), 1); // 柱状为正→多头
}

// ---------- 主流程 ----------
const W = { fundamental: 0.40, technical: 0.30, sentiment: 0.30 };

async function scoreStock(stock) {
  const f = stock.fundamentals || {};
  const t = stock.technicals || {};
  const news = stock.news || [];
  // 金融业不适用 Altman Z / Piotroski F → 置 null，使对应子项回到中性 50 分
  const isFin = isFinancial(stock);
  const fscore = isFin ? null : piotroskiF(f);
  const z = isFin ? null : altmanZ(f);
  const sub = {
    财务健康: fscore == null ? 50 : round(fscore / 9 * 100, 1),
    安全边际: zToScore(z),
    估值吸引力: valuationScore(f),
    盈利质量: qualityScore(f),
    价格动量: momentumScore(t),
    低波质量: lowVolScore(t),
    趋势: trendScore(t),
    RSI: rsiScore(t),
    MACD: macdScore(t),
    消息情绪: scoreStockNews(news).score,
  };
  const fundamental = round(mean([sub.财务健康, sub.安全边际, sub.估值吸引力, sub.盈利质量]), 1);
  const technical = round(mean([sub.价格动量, sub.低波质量, sub.趋势, sub.RSI, sub.MACD]), 1);
  const sentiment = sub.消息情绪;
  const unified = round(fundamental * W.fundamental + technical * W.technical + sentiment * W.sentiment, 1);
  const radar = {
    财务健康: sub.财务健康, 安全边际: sub.安全边际, 估值吸引力: sub.估值吸引力,
    价格动量: sub.价格动量, 低波质量: sub.低波质量, 消息情绪: sub.消息情绪,
  };
  // 简述
  const top = Object.entries(sub).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  const weak = Object.entries(sub).sort((a, b) => a[1] - b[1]).slice(0, 1).map(([k]) => k);
  const conclusion = `统一评分 ${unified}，基本面${fundamental}/技术面${technical}/消息面${sentiment}。优势：${top.join('、')}；短板：${weak.join('、')}。`;
  return {
    ticker: stock.ticker, name: stock.name, industry: stock.industry || '', theme: stock.theme || '',
    scores: { fundamental, technical, sentiment, unified, sub },
    radar,
    detail: { fscore, zscore: z, pe: f.pe, pb: f.pb, roe: f.roe, roic: f.roic, ret12m: t.ret12m, rsi14: t.rsi14, vol20d: t.vol20d },
    conclusion,
    news: scoreStockNews(news).items,
  };
}

// 公共：打分 → 组内 z-score → 排序 → 取 TopN。供 selectStocks 与 selectByTickers 复用。
async function scoreAndRank(stocks, topN, themeName, themeKey, description) {
  const scored = [];
  for (const s of stocks) scored.push(await scoreStock(s));
  // 组内 z-score 标准化统一分（用于跨标的相对比较）
  const uvals = scored.map(x => x.scores.unified);
  scored.forEach(x => { x.scores.unifiedZ = round(zscore(x.scores.unified, uvals), 3); });
  scored.sort((a, b) => b.scores.unified - a.scores.unified);
  const top = scored.slice(0, topN);
  const copyList = top.map(x => `${x.ticker}\t${x.name}`).join('\n');
  return {
    ok: true,
    theme: themeName,
    key: themeKey,
    description,
    weights: W,
    count: scored.length,
    ranked: scored,
    top,
    copyList,
    generatedAt: new Date().toISOString(),
  };
}

async function selectStocks(themeKey, opts = {}) {
  const topN = opts.topN || 3;
  const provider = getProvider();
  const themes = await provider.getThemeTickers();
  const theme = themes.find(t => t.key === themeKey || t.name === themeKey);
  if (!theme) {
    return { ok: false, error: `未找到主题「${themeKey}」。可选：${themes.map(t => t.name).join('、')}` };
  }
  const stocks = [];
  for (const tk of theme.tickers) {
    const s = await provider.getStock(tk);
    if (s) stocks.push(s);
  }
  if (!stocks.length) return { ok: false, error: `主题「${theme.name}」无可用标的数据（local 演示数据缺失）。` };
  return scoreAndRank(stocks, topN, theme.name, theme.key, theme.description);
}

// 动态标的池主题：tickers 由外部（如 Wind search_stocks 概念筛选）提供，不走 themes.json。
async function selectByTickers(themeName, themeKey, description, tickers, opts = {}) {
  const topN = opts.topN || 3;
  const provider = getProvider();
  const stocks = [];
  for (const tk of tickers) {
    const s = await provider.getStock(tk);
    if (s) stocks.push(s);
  }
  if (!stocks.length) return { ok: false, error: `主题「${themeName}」无可用标的数据（Wind 筛选未返回有效标的）。` };
  return scoreAndRank(stocks, topN, themeName, themeKey, description);
}

module.exports = { selectStocks, selectByTickers, scoreStock, piotroskiF, altmanZ, isFinancial, W };
