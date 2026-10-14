// tests/smoke.js — 三板块 + 研究资料库 + NL 语义解析 冒烟测试（零依赖）
// 运行：node tests/smoke.js
// 说明：核心三板块测试强制使用 local 演示提供方，保证确定性、零网络依赖；
//       NL 语义解析（Hermes 自然语言入口）端到端测试见 tests/smoke_nl.js（需运行中的服务 + Hermes + Wind）。
const assert = require('assert');

// 强制局部提供方，使核心测试不触发 Wind/akshare 网络调用，保证可复现、可秒级跑完
process.env.AM_DATAPROVIDER = 'local';

const { analyzeMacro } = require('../src/macroAnalyzer');
const { selectStocks } = require('../src/stockSelector');
const { deepResearch } = require('../src/deepResearch');
const { getProvider } = require('../src/dataProvider');
const { stats } = require('../src/researchDB');
const { heuristicParse, getAliasMap } = require('../src/nlIntake');

(async () => {
  let pass = 0;
  const ok = (name, cond) => { assert.ok(cond, name); console.log('  ✓', name); pass++; };

  // 宏观
  const snap = await getProvider().getMacroSnapshot();
  ok('宏观快照加载', !!snap);
  const m = analyzeMacro(snap);
  ok('宏观含四类资产', ['stock', 'bond', 'realestate', 'gold'].every(k => m.assets[k]));
  for (const a of Object.values(m.assets)) {
    for (const h of Object.values(a.byHorizon)) {
      const s = h.probs; const sum = s.看涨 + s.震荡 + s.看跌;
      ok(`${a.label}/${h.label} 概率和≈1`, Math.abs(sum - 1) < 1e-6);
    }
  }

  // 选股
  for (const theme of ['optical_comm', 'semiconductor', 'commercial_space', 'gold', 'bank']) {
    const sel = await selectStocks(theme, { topN: 3 });
    ok(`选股[${theme}]成功`, sel.ok && sel.top.length > 0);
    ok(`选股[${theme}]Top3含雷达维度`, sel.top[0] && Object.keys(sel.top[0].radar).length === 6);
    ok(`选股[${theme}]含最大优势/风险点(具体表述)`, sel.top[0] && sel.top[0].best && sel.top[0].worst && sel.top[0].best.text && sel.top[0].worst.text);
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

  // NL 语义解析（确定性：直接用启发式兜底层，不触发 Hermes 远程调用）
  // 校验「自然语言 → 主题/标的映射」这一关键环节的映射逻辑
  const p1 = heuristicParse('分析光通信和芯片半导体板块，重点关注招商银行和兴业银行');
  ok('NL识别主题: 光通信(optical_comm)', p1.themes.includes('optical_comm'));
  ok('NL识别主题: 芯片半导体(semiconductor)', p1.themes.includes('semiconductor'));
  ok('NL识别标的: 招商银行(600036.SH)', p1.tickers.includes('600036.SH'));
  ok('NL识别标的: 兴业银行(601166.SH)', p1.tickers.includes('601166.SH'));
  const p2 = heuristicParse('对 600519.SH 做深度研究');
  ok('NL识别代码: 600519.SH', p2.tickers.includes('600519.SH'));
  const p3 = heuristicParse('随便聊两句');
  ok('NL空意图返回空结构(不抛错)', Array.isArray(p3.themes) && Array.isArray(p3.tickers));

  // 主题识别回归：用户原话「芯片，养老，医疗，电力，ai，银行」（迭代五修复：此前只识别到芯片/银行/光通信）
  const p4 = heuristicParse('芯片，养老，医疗，电力，ai，银行');
  const want = ['semiconductor', 'pension', 'medical', 'power', 'ai', 'bank'];
  ok('NL识别全部 6 个概念板块(不丢不增)', want.every(k => p4.themes.includes(k)) && p4.themes.length === 6);
  ok('NL未误加 光通信(optical_comm)', !p4.themes.includes('optical_comm'));

  console.log(`\n核心冒烟测试全部通过：${pass} 项 ✅`);
  console.log('（NL 端到端 / Hermes 解析 / 真实 Wind 数据测试见 tests/smoke_nl.js）');
})().catch(e => { console.error('测试失败：', e.message); process.exit(1); });
