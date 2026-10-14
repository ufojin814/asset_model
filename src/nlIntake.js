// src/nlIntake.js — 自然语言语义解析层
// 输入自然语言/段落 → 调 Hermes 拆成 { themes:[themeKey...], tickers:[名称或代码...] }
// Hermes 不可用时回退到关键词/正则兜底，保证服务不中断。
const fs = require('fs');
const path = require('path');
const { callHermesJSON } = require('./hermesClient');
const config = require('./config');

// 主题候选（来自 config/themes.json）
function getThemeCandidates() {
  return (config.themes.themes || []).map(t => ({
    key: t.key, name: t.name, description: t.description || ''
  }));
}

// 构建股票 名称->代码 / 代码->名称 映射（来自 data/stocks/*.json，仅用于兜底识别）
let _aliasMap = null;
function getAliasMap() {
  if (_aliasMap) return _aliasMap;
  _aliasMap = { nameToCode: {}, codeToName: {} };
  const dir = path.join(config.DATA_DIR, 'stocks');
  try {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          // 演示种子用 ticker 字段，真实 Wind 数据用 code 字段；兜底用文件名
          const code = d.ticker || d.code || f.replace(/\.json$/, '');
          if (!code) continue;
          _aliasMap.codeToName[code] = d.name || code;
          if (d.name) _aliasMap.nameToCode[d.name] = code;
        } catch (e) {}
      }
    }
  } catch (e) {}
  return _aliasMap;
}

// 正则兜底：识别 6 位数字 + .SH/.SZ 代码
const CODE_RE = /\b(\d{6}\.(?:SH|SZ))\b/g;

function heuristicParse(text) {
  const themes = [];
  const tCands = getThemeCandidates();
  const lower = text.toLowerCase();
  for (const t of tCands) {
    const kw = (t.name + ' ' + (t.description || '')).toLowerCase();
    // 名称或描述里的关键词命中即算该主题
    const tokens = kw.split(/[\s,，、/]+/).filter(Boolean);
    if (tokens.some(tok => tok.length >= 2 && lower.includes(tok))) themes.push(t.key);
  }
  // 去重
  const uniqThemes = [...new Set(themes)];

  const tickers = [];
  const alias = getAliasMap();
  // 1) 直接代码
  let m; CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(text)) !== null) tickers.push(m[1].toUpperCase());
  // 2) 已知名称
  for (const name of Object.keys(alias.nameToCode)) {
    if (text.includes(name)) tickers.push(alias.nameToCode[name]);
  }
  const uniqTickers = [...new Set(tickers)];
  return { themes: uniqThemes, tickers: uniqTickers, fallback: true };
}

/**
 * 解析自然语言意图。
 * @param {string} text 用户输入
 * @returns {Promise<{themes:string[], tickers:string[], fallback:boolean, raw?:string}>}
 */
async function parseIntent(text) {
  if (!text || !text.trim()) return { themes: [], tickers: [], fallback: false };
  const tCands = getThemeCandidates();
  const themeList = tCands.map(t => `- ${t.key} : ${t.name}（${t.description || ''}）`).join('\n');
  const prompt = `你是「资产配置与股票配置研究平台」的语义解析器。用户会输入一句自然语言（可能是主题板块需求，也可能是带有多只股票的分析请求）。

可选主题板块候选（只能从下面这些 key 里选）：
${themeList}

请完成两件事：
1) 识别用户意图涉及的「主题板块」，输出其 key 数组（可多个，无则空数组）。
2) 识别用户提到的所有「具体股票标的」，输出股票代码（如 600519.SH、000858.SZ）或中文名称（如 贵州茅台、招商银行）；若没有任何具体标的则空数组。

只返回如下 JSON，不要任何解释：
{"themes":["key1","key2"],"tickers":["股票代码或名称",...]}

用户输入：
${text}`;

  try {
    const r = await callHermesJSON(prompt, { timeout: 180000 });
    if (r.success && r.data && (Array.isArray(r.data.themes) || Array.isArray(r.data.tickers))) {
      const themes = (r.data.themes || []).filter(k => tCands.some(t => t.key === k));
      const tickers = (r.data.tickers || []).map(String);
      // 若 Hermes 返回为空但文本里明显有主题/标的，用兜底补充
      const h = heuristicParse(text);
      const mergedThemes = [...new Set([...themes, ...h.themes])];
      const mergedTickers = [...new Set([...tickers, ...h.tickers])];
      return { themes: mergedThemes, tickers: mergedTickers, fallback: false, raw: r.output };
    }
    // 解析失败，回退
    return heuristicParse(text);
  } catch (e) {
    return heuristicParse(text);
  }
}

module.exports = { parseIntent, heuristicParse, getThemeCandidates, getAliasMap };
