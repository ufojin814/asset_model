// src/macroAnalyzer.js — 宏观研判板块
// 方法论：基于多因子加权信号 + 概率化解释（潜变量正态模型）。
// 每个因子的 raw 信号语义见 config/macro-indicators.json；权重含方向符号。
// 所有因子均有学术支撑（见 factorDocs）。概率分布由倾斜度 T 与 horizon 的 sigma 映射，
// sigma 随 horizon 增大表示预测不确定性上升（forecasting cone of uncertainty）。
const config = require('./config');
const { clamp, round } = require('./utils');

// 标准正态 CDF（Abramowitz-Stegun 7.1.26 近似）
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  let p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

// 各因子的 raw 信号计算（统一语义：+1=扩张/利好风险资产，具体见 JSON _comment）
function computeRaw(s) {
  const raw = {};
  // 股债性价比 ERP = 盈利收益率 - 10Y国债
  const erp = (s.earningsYield ?? 0.045) - (s.y10 ?? 2.1) / 100;
  raw.erp = clamp((erp - 0.03) / 0.03, -1, 1); // ERP 6%→+1, 0%→-1
  // 估值分位（越高越贵）
  raw.valuation = clamp((s.valuationPercentile ?? 0.5 - 0.5) * 2, -1, 1); // pct 1→+1(贵)
  // 收益率曲线斜率 10Y-2Y（bp）
  const spread = (s.y10 ?? 2.1) - (s.y2 ?? 1.6);
  raw.yield_curve = clamp(spread / 200, -1, 1); // 倒挂→负值
  // 增长动能
  const growth = clamp((s.pmi ?? 50 - 50) / 5, -1, 1) * 0.6 + clamp(((s.gdpYoY ?? 5) - 5) / 3, -1, 1) * 0.4;
  raw.growth = clamp(growth, -1, 1);
  // 流动性宽松度（利率更低、RRR更低、M2/社融更高 → +1）
  const liq = (
    ((7 - (s.policyRate ?? 1.5)) / 4) +
    ((12 - (s.reserveRatio ?? 7)) / 8) +
    (((s.m2YoY ?? 8) - 8) / 4) +
    (((s.socialFinancingYoY ?? 9) - 9) / 4)
  ) / 4;
  raw.liquidity = clamp(liq, -1, 1);
  // 信用利差（窄=+1 风险偏好高）
  raw.credit_spread = clamp(-((s.creditSpread ?? 280) - 200) / 400, -1, 1);
  // 黄金实际利率（低实际利率=+1）：实际利率≈10Y-通胀
  const realRate = (s.y10 ?? 2.1) - (s.cpiYoY ?? 0.5);
  raw.gold_real_rate = clamp(-realRate / 3, -1, 1);
  // 通胀（+1=高通胀）
  raw.inflation_real = clamp((s.cpiYoY ?? 0.5) / 3, -1, 1);
  // 地缘政治（+1=紧张度高）
  raw.geopolitics = clamp(((s.geoIndex ?? 50) - 50) / 50, -1, 1);
  // 科技突破（+1=强）
  raw.tech = clamp(((s.techIndex ?? 50) - 50) / 50, -1, 1);
  // 房地产政策（+1=宽松）
  raw.re_policy = clamp(((s.rePolicyEasing ?? 50) - 50) / 50, -1, 1);
  return raw;
}

// horizon 对因子权重的调节：长期更重估值/曲线（均值回归），短期更重增长/流动性
const HORIZON_MOD = {
  short: { growth: 1.2, liquidity: 1.2, valuation: 0.8, yield_curve: 0.85 },
  mid:   { valuation: 1.0, yield_curve: 1.0 },
  long:  { valuation: 1.3, yield_curve: 1.25, tech: 1.4, growth: 0.9 },
};

function assetTilt(assetKey, raw, horizonKey) {
  const cfg = config.macroModel.assets[assetKey];
  const mod = HORIZON_MOD[horizonKey] || {};
  let num = 0, den = 0;
  const contrib = {};
  for (const [f, w] of Object.entries(cfg.factors)) {
    const m = mod[f] ?? 1;
    const eff = w * m;
    contrib[f] = round(eff * raw[f], 4);
    num += eff * raw[f];
    den += Math.abs(eff);
  }
  const tilt = den === 0 ? 0 : num / den; // ∈[-1,1]
  return { tilt: round(tilt, 4), contrib };
}

// 生成某期限「研判依据 + 结论」的可读解释：
// 取对倾斜度贡献绝对值最大的前 3 个因子，区分利好（贡献>0）/利空（贡献<0），
// 结合 factorDocs 的中文标签，供前端直接渲染「研判依据」与「结论」。
function buildHorizonExplain(contrib) {
  const docs = config.macroModel.factorDocs || {};
  const entries = Object.entries(contrib)
    .map(([f, v]) => ({ f, v, label: (docs[f] && docs[f].label) || f }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const top = entries.slice(0, 3);
  return {
    factors: top.map(e => ({ label: e.label, contrib: round(e.v, 3), bull: e.v > 0 })),
  };
}

function tiltToProbs(tilt, sigma) {
  const pBull2 = normCdf(tilt / sigma); // bull vs bear 两分类
  const neutralShare = clamp(sigma - 0.30, 0, 0.45);
  const pBull = round(pBull2 * (1 - neutralShare), 4);
  const pBear = round((1 - pBull2) * (1 - neutralShare), 4);
  const pNeutral = round(neutralShare, 4);
  // 调试：保证和为1
  const sum = pBull + pBear + pNeutral;
  return { 看涨: pBull / sum, 震荡: pNeutral / sum, 看跌: pBear / sum };
}

// 主入口
function analyzeMacro(snapshot, opts = {}) {
  const raw = computeRaw(snapshot || {});
  const horizons = config.macroModel.horizons;
  const assets = config.macroModel.assets;
  const result = { generatedAt: new Date().toISOString(), raw, horizons: {}, assets: {} };
  for (const [aKey, aCfg] of Object.entries(assets)) {
    result.assets[aKey] = { label: aCfg.label, byHorizon: {} };
    for (const [hKey, hCfg] of Object.entries(horizons)) {
      const { tilt, contrib } = assetTilt(aKey, raw, hKey);
      const probs = tiltToProbs(tilt, hCfg.sigma);
      const stance = probs.看涨 >= 0.45 ? '看涨' : probs.看跌 >= 0.45 ? '看跌' : '震荡';
      const explain = buildHorizonExplain(contrib);
      result.assets[aKey].byHorizon[hKey] = {
        label: hCfg.label, windows: hCfg.windows,
        tilt, probs, stance, contrib, explain,
      };
    }
  }
  return result;
}

// 生成可读研判文本（供报告与前端）
function summarizeMacro(macro) {
  const lines = [];
  for (const [aKey, aCfg] of Object.entries(macro.assets)) {
    const parts = ['短期', '中期', '长期'].map(h => {
      const h2 = aCfg.byHorizon[h === '短期' ? 'short' : h === '中期' ? 'mid' : 'long'];
      const p = h2.probs;
      const top = Object.entries(p).sort((a, b) => b[1] - a[1])[0];
      return `${h}(${h2.stance} ${(top[1] * 100).toFixed(0)}%)`;
    });
    lines.push(`【${aCfg.label}】${parts.join(' / ')}`);
  }
  return lines.join('\n');
}

module.exports = { analyzeMacro, summarizeMacro, computeRaw };
