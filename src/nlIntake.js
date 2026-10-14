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

// 概念 → 触发词 / Wind 查询短语映射。键名若等于某主题 key，则命中时归为「已知主题」；
// 否则视为「自由概念」，交给 Wind search_stocks 兜底。heuristicParse 与 Hermes 解析共用，
// 避免此前按描述词子串盲匹配（"AI" 误中光通信）的噪声。
const CONCEPT_MAP = {
  optical_comm: { triggers: ['光通信', '光模块', 'cpo', '光芯片'], q: '光通信' },
  semiconductor: { triggers: ['半导体', '芯片', '集成电路', 'ic'], q: '半导体芯片' },
  commercial_space: { triggers: ['商业航天', '卫星', '航天', '卫星互联网'], q: '商业航天' },
  gold: { triggers: ['黄金', '贵金属', '金矿', '金银'], q: '黄金' },
  bank: { triggers: ['银行'], q: '银行' },
  medical: { triggers: ['医疗', '医药', '健康', '生物', '创新药', '中药', '医疗器械', '制药'], q: '医疗医药' },
  pension: { triggers: ['养老', '银发'], q: '养老' },
  power: { triggers: ['电力', '发电', '水电', '核电', '绿电', '火电'], q: '电力' },
  ai: { triggers: ['人工智能', 'ai', '智能'], q: '人工智能' },
  newenergy: { triggers: ['新能源', '光伏', '锂电', '储能', '电动车', '电池'], q: '新能源' },
  // —— 以下为自由概念（无对应主题，走 Wind 兜底）——
  '低空经济': { triggers: ['低空', 'evtol', '飞行汽车'], q: '低空经济' },
  '机器人': { triggers: ['机器人', '人形机器人'], q: '机器人' },
  '自动驾驶': { triggers: ['自动驾驶', '智能驾驶'], q: '自动驾驶' },
  '元宇宙': { triggers: ['元宇宙', 'vr', 'ar'], q: '元宇宙' },
  '消费': { triggers: ['消费', '白酒', '食品饮料', '零售'], q: '消费' },
  '军工': { triggers: ['军工', '国防', '兵器'], q: '军工' },
};
const THEME_KEYS = new Set((config.themes.themes || []).map(t => t.key));

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
  const lower = text.toLowerCase();
  const themes = [], concepts = [], seen = new Set();
  // 受控概念匹配：命中主题键→主题；否则→自由概念（交 Wind 兜底）
  for (const [key, cfg] of Object.entries(CONCEPT_MAP)) {
    const hit = cfg.triggers.some(t => lower.includes(t.toLowerCase()));
    if (!hit) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    if (THEME_KEYS.has(key)) themes.push(key);
    else concepts.push(key);
  }
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
  return { themes: uniqThemes, concepts: [...new Set(concepts)], tickers: uniqTickers, fallback: true };
}

/**
 * 解析自然语言意图。
 * @param {string} text 用户输入
 * @returns {Promise<{themes:string[], tickers:string[], fallback:boolean, raw?:string}>}
 */
async function parseIntent(text) {
  if (!text || !text.trim()) return { themes: [], tickers: [], concepts: [], fallback: false };
  const tCands = getThemeCandidates();
  const themeList = tCands.map(t => `- ${t.key} : ${t.name}（${t.description || ''}）`).join('\n');
  const prompt = `你是「资产配置与股票配置研究平台」的语义解析器。用户会输入一句自然语言（可能是主题板块需求，也可能是带有多只股票的分析请求）。

可选主题板块候选（只能从下面这些 key 里选）：
${themeList}

请完成三件事：
1) 识别用户意图涉及的「主题板块」，输出其 key 数组（可多个，无则空数组）。候选 key 仅限上面列出的这些。
2) 识别用户提到的所有「具体股票标的」，输出股票代码（如 600519.SH、000858.SZ）或中文名称（如 贵州茅台、招商银行）；若没有任何具体标的则空数组。
3) 识别用户提到的所有「自由概念/行业短语」（即上面候选 key 列表里没有、但属于某个行业或题材的表述，如「养老」「低空经济」「机器人」），输出其原样短语数组；若无则空数组。

只返回如下 JSON，不要任何解释：
{"themes":["key1","key2"],"tickers":["股票代码或名称",...],"concepts":["概念短语1","概念短语2"]}

用户输入：
${text}`;

  try {
    const r = await callHermesJSON(prompt, { timeout: 180000 });
    if (r.success && r.data && (Array.isArray(r.data.themes) || Array.isArray(r.data.tickers) || Array.isArray(r.data.concepts))) {
      const themes = (r.data.themes || []).filter(k => tCands.some(t => t.key === k));
      const tickers = (r.data.tickers || []).map(String);
      const concepts = (r.data.concepts || []).map(String);
      // 若 Hermes 返回为空但文本里明显有主题/标的/概念，用兜底补充
      const h = heuristicParse(text);
      const mergedThemes = [...new Set([...themes, ...h.themes])];
      const mergedTickers = [...new Set([...tickers, ...h.tickers])];
      const mergedConcepts = [...new Set([...concepts, ...h.concepts])];
      return { themes: mergedThemes, concepts: mergedConcepts, tickers: mergedTickers, fallback: false, raw: r.output };
    }
    // 解析失败，回退
    return heuristicParse(text);
  } catch (e) {
    return heuristicParse(text);
  }
}

module.exports = { parseIntent, heuristicParse, getThemeCandidates, getAliasMap };
