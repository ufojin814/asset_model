// src/utils.js — 统计与通用工具
// 所有量化函数均为确定性、可复现实现，便于审计与复现。

function mean(arr) {
  if (!arr || !arr.length) return 0;
  const v = arr.filter(x => Number.isFinite(x));
  return v.reduce((a, b) => a + b, 0) / (v.length || 1);
}

function std(arr) {
  if (!arr || arr.length < 2) return 0;
  const v = arr.filter(x => Number.isFinite(x));
  const m = mean(v);
  const s = v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1);
  return Math.sqrt(s);
}

// z-score：单个值相对序列的标准化
function zscore(x, arr) {
  const s = std(arr);
  if (s === 0) return 0;
  return (x - mean(arr)) / s;
}

// 历史分位（0~1）：x 在序列中的百分位排名（含自身）
function percentileRank(x, arr) {
  if (!arr || !arr.length) return 0.5;
  const v = arr.filter(y => Number.isFinite(y));
  const below = v.filter(y => y <= x).length;
  return below / v.length;
}

// 将任意值夹在 [lo, hi]
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

// 安全除法
function safeDiv(a, b, dflt = 0) {
  if (!b || b === 0) return dflt;
  return a / b;
}

function round(x, n = 2) {
  const f = 10 ** n;
  return Math.round((x + Number.EPSILON) * f) / f;
}

// 把概率分布归一化为 1（softmax 风格，输入为各档"得分"）
function softmaxNormalize(scores, temperature = 1) {
  const keys = Object.keys(scores);
  const exps = keys.map(k => Math.exp((scores[k] - Math.max(...keys.map(k2 => scores[k2]))) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  const out = {};
  keys.forEach((k, i) => { out[k] = round(exps[i] / sum, 4); });
  return out;
}

// 时间戳 YYYY-MM-DDTHH-MM-SS（用于文件名，避免冒号在 Windows 文件名非法）
function fileStamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

// 可视化时间戳 YYYY-MM-DD HH:MM:SS
function isoStamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// 日期 YYYY-MM-DD
function dateStamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 生成安全文件名片段
function safeKey(s) {
  return String(s).replace(/[^\w一-龥.-]+/g, '_');
}

module.exports = {
  mean, std, zscore, percentileRank, clamp, safeDiv, round,
  softmaxNormalize, fileStamp, isoStamp, dateStamp, safeKey,
};
