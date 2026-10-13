// src/sentiment.js — 消息面情绪打分（Loughran-McDonald 金融情感词典风格）
// 学术支撑：Loughran & McDonald (2011), "When Is a Liability Not a Liability? Textual Analysis of
// Financial Contracts", Journal of Finance. 金融文本中负面词密度显著高于通用文本，需专用词典。
// 本模块内置精简中文/英文金融情感词表，并可加载 config/sentiment_dict.json 扩展。
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { clamp, round } = require('./utils');

const DEFAULT_POS = ['增长','超预期','创新高','回暖','扩张','中标','获批','增持','回购','利好','上调','提速','放量','突破','拐点','景气','订单饱满','产能利用率提升','利润高增','分红','扭亏','困境反转','复苏','宽松','扩产','涨价','需求旺盛','份额提升'];
const DEFAULT_NEG = ['下滑','亏损','下调','减持','质押','诉讼','处罚','暴雷','商誉减值','存货跌价','应收账款高','现金流紧张','债务违约','停产','降价','需求疲软','产能过剩','竞争加剧','被否','问询','立案','风险','承压','回落','收紧','放缓','破发','破净','警惕','利空','减值','退坡'];

let DICT = { positive: DEFAULT_POS, negative: DEFAULT_NEG };
(function loadDict() {
  try {
    const p = path.join(config.CONFIG_DIR, 'sentiment_dict.json');
    if (fs.existsSync(p)) {
      const d = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (d.positive) DICT.positive = Array.from(new Set([...DEFAULT_POS, ...d.positive]));
      if (d.negative) DICT.negative = Array.from(new Set([...DEFAULT_NEG, ...d.negative]));
    }
  } catch (e) {}
})();

function scoreText(text) {
  if (!text) return { polarity: 0, pos: 0, neg: 0 };
  const t = String(text);
  let pos = 0, neg = 0;
  for (const w of DICT.positive) if (t.includes(w)) pos++;
  for (const w of DICT.negative) if (t.includes(w)) neg++;
  const polarity = (pos + neg) === 0 ? 0 : (pos - neg) / (pos + neg);
  return { polarity: clamp(polarity, -1, 1), pos, neg };
}

// 单条新闻打分（含时效衰减，参考参考项目的 6 维重要性评分思路简化）
function scoreNewsItem(item, now = Date.now()) {
  const text = [item.title, item.content, item.summary].filter(Boolean).join(' ');
  const { polarity, pos, neg } = scoreText(text);
  const pub = item.pubDate ? new Date(item.pubDate).getTime() : 0;
  const hours = pub ? (now - pub) / 3600000 : 9999;
  const timeDecay = Math.max(0.4, 1 - 0.004 * hours); // 每小时衰减 0.4%
  const authority = (item.authorityWeight != null) ? clamp(item.authorityWeight / 100, 0, 1) : 0.6;
  // 综合得分：极性 × 时效 × 权威，映射到 0~100（50 为中性）
  const raw = 50 + polarity * 50 * timeDecay * (0.5 + 0.5 * authority);
  return { polarity, pos, neg, timeDecay, authority, score: round(clamp(raw, 0, 100), 1), hours };
}

// 聚合单只股票的消息面得分
function scoreStockNews(news = [], now = Date.now()) {
  if (!news.length) return { score: 50, count: 0, pos: 0, neg: 0, polarity: 0, items: [] };
  const scored = news.map(n => ({ ...n, _s: scoreNewsItem(n, now) }));
  let wSum = 0, acc = 0, pos = 0, neg = 0;
  for (const it of scored) {
    const w = it._s.timeDecay * (0.5 + 0.5 * it._s.authority);
    wSum += w; acc += it._s.score * w; pos += it._s.pos; neg += it._s.neg;
  }
  const score = wSum ? acc / wSum : 50;
  const polarity = (pos + neg) ? (pos - neg) / (pos + neg) : 0;
  const items = scored.sort((a, b) => b._s.score - a._s.score).slice(0, 5)
    .map(it => ({ title: it.title, score: it._s.score, polarity: it._s.polarity, pubDate: it.pubDate, source: it.source }));
  return { score: round(score, 1), count: news.length, pos, neg, polarity: round(polarity, 3), items };
}

module.exports = { scoreText, scoreNewsItem, scoreStockNews, DICT };
