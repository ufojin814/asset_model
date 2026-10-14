// tests/smoke_nl.js — 自然语言入口端到端冒烟测试（零依赖，但需运行中的服务）
// 前提：先在另一个终端 `node server.js`（默认 dataProvider=auto，Hermes→Wind→akshare→local 降级链）
// 运行：node tests/smoke_nl.js   （会真实调用 Hermes 解析 + 拉取 Wind 数据，较慢，约 1-3 分钟）
// 失败排查：① 服务是否启动 ② 本机 Hermes 是否可用（hermes --version）③ config/hermes.json 的 windApiKey 是否正确
const assert = require('assert');
const http = require('http');

const HOST = '127.0.0.1';
const PORT = process.env.PORT || 3300;
const TIMEOUT = 300000;

function get(p) {
  return new Promise((res, rej) => {
    const req = http.get({ host: HOST, port: PORT, path: p, timeout: TIMEOUT }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res({ code: r.statusCode, body: d }));
    });
    req.on('error', rej); req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}
function post(p, obj) {
  return new Promise((res, rej) => {
    const data = JSON.stringify(obj);
    const req = http.request({ host: HOST, port: PORT, path: p, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: TIMEOUT }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res({ code: r.statusCode, body: d }));
    });
    req.on('error', rej); req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(data); req.end();
  });
}

(async () => {
  let pass = 0;
  const ok = (name, cond) => { assert.ok(cond, name); console.log('  ✓', name); pass++; };

  // 1) 健康检查
  const h = JSON.parse((await get('/api/health')).body);
  ok('服务健康 & Hermes 就绪', h.ok && h.hermes === 'ready');

  // 2) 自然语言 → 多主题选股（Hermes 解析主题 + 各主题 Wind 拉真实数据）
  console.log('  …调用 /api/nl-themes（光通信 + 芯片半导体，较慢）');
  const th = await post('/api/nl-themes', { text: '分析光通信和芯片半导体板块，哪个更值得配置', topN: 3 });
  const jt = JSON.parse(th.body);
  ok('NL-THEMES 成功', jt.ok === true);
  ok('NL-THEMES 至少识别出 1 个主题', (jt.intent.themes || []).length >= 1);
  ok('NL-THEMES 返回主题板块含 Top 标的', Array.isArray(jt.themes) && jt.themes.length >= 1);
  (jt.themes || []).forEach(s => {
    ok(`  主题[${s.theme || s.themeKey}] 含 top 列表`, Array.isArray(s.top) && s.top.length > 0);
  });

  // 3) 自然语言 → 多标的深度研究（Hermes 解析标的 + 每只 Wind 真实数据 + Serenity 报告）
  console.log('  …调用 /api/nl-deep（招商银行 + 兴业银行，真实 Wind 数据，较慢）');
  const t = Date.now();
  const dp = await post('/api/nl-deep', { text: '对招商银行和兴业银行做深度研究' });
  const k = JSON.parse(dp.body);
  console.log(`  NL-DEEP 耗时 ${((Date.now() - t) / 1000).toFixed(0)}s`);
  ok('NL-DEEP 成功', k.ok === true);
  ok('NL-DEEP 识别出至少 1 只标的', (k.intent.tickers || []).length >= 1);
  ok('NL-DEEP 返回逐只深度结果', Array.isArray(k.results) && k.results.length >= 1);
  (k.results || []).forEach(r => {
    ok(`  深度[${r.name || r.code}] 生成报告`, r.ok === true && (r.markdown || '').length > 200);
    ok(`  深度[${r.name || r.code}] 含评级`, r.rating && /^T[1-5]$/.test(r.rating.tier));
    console.log(`    - ${r.name || r.code}  tier=${r.rating && r.rating.tier}  source=${r.source || (r.json && r.json._source)}  mdLen=${(r.markdown || '').length}`);
  });

  console.log(`\nNL 端到端冒烟测试全部通过：${pass} 项 ✅`);
})().catch(e => { console.error('NL 测试失败：', e.message); process.exit(1); });
