// tests/smoke.js — 三板块 + 研究资料库 冒烟测试（零依赖）
// 运行：node tests/smoke.js
const assert = require('assert');
const { analyzeMacro } = require('../src/macroAnalyzer');
const { selectStocks } = require('../src/stockSelector');
const { deepResearch } = require('../src/deepResearch');
const { getProvider } = require('../src/dataProvider');
const { stats } = require('../src/researchDB');

(async () => {
  let pass = 0;
  const ok = (name, cond) => { assert.ok(cond, name); console.log('  ✓', name); pass++; };

  // 宏观
  const snap = await getProvider().getMacroSnapshot();
  ok('宏观快照加载', !!snap);
  const m = analyzeMacro(snap);
  ok('宏观含四类资产', ['stock','bond','realestate','gold'].every(k => m.assets[k]));
  for (const a of Object.values(m.assets)) {
    for (const h of Object.values(a.byHorizon)) {
      const s = h.probs; const sum = s.看涨 + s.震荡 + s.看跌;
      ok(`${a.label}/${h.label} 概率和≈1`, Math.abs(sum - 1) < 1e-6);
    }
  }

  // 选股
  for (const theme of ['optical_comm','semiconductor','commercial_space','gold','bank']) {
    const sel = await selectStocks(theme, { topN: 3 });
    ok(`选股[${theme}]成功`, sel.ok && sel.top.length > 0);
    ok(`选股[${theme}]Top3含雷达维度`, sel.top[0] && Object.keys(sel.top[0].radar).length === 6);
    ok(`选股[${theme}]含复制清单`, !!sel.copyList);
  }

  // 深度研究
  const d = await deepResearch('300308.SZ');
  ok('深度研究成功', d.ok);
  ok('深度研究含八节结构', d.markdown.includes('八维度') && d.markdown.includes('五情景'));
  ok('深度研究已落库', !!d.json.saved);
  ok('评级为T1-T5', /^T[1-5]$/.test(d.json.rating.tier));

  // 资料库
  const st = stats();
  ok('资料库有记录', st.total > 0);

  console.log(`\n全部通过：${pass} 项 ✅`);
})().catch(e => { console.error('测试失败：', e.message); process.exit(1); });
