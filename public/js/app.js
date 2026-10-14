// public/js/app.js — 前端交互（原生 JS，零依赖）
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const API = '';

const ASSET_META = {
  stock: { label: '股票', color: '#2f5bea' },
  bond: { label: '债券', color: '#0ea5b7' },
  realestate: { label: '房地产', color: '#e08a1e' },
  gold: { label: '黄金', color: '#c8972f' },
};
const TIER_COLOR = { T1: 'tier-T1', T2: 'tier-T2', T3: 'tier-T3', T4: 'tier-T4', T5: 'tier-T5' };
const RADAR_COLORS = ['#2f5bea', '#0ea5b7', '#e08a1e', '#c8972f', '#7c5cff', '#15936a', '#d83a3a', '#3aa0ff'];
const TYPE_COLOR = { macro: '#2f5bea', selection: '#7c5cff', deep: '#0ea5b7' };

// ---------- 工具 ----------
function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2600);
}
async function api(path, opts) {
  const r = await fetch(API + path, opts);
  return r.json();
}
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function pct(x) { return (x * 100).toFixed(1) + '%'; }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('已复制到剪贴板'); }
  catch (e) { toast('复制失败：' + e.message, true); }
}

// ---------- Markdown 渲染（轻量） ----------
function renderMarkdown(md) {
  if (!md) return '';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  let h = '', i = 0, inCode = false, codeBuf = [];
  const flushCode = () => { if (codeBuf.length) { h += '<pre><code>' + esc(codeBuf.join('\n')) + '</code></pre>'; codeBuf = []; } };
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (inCode) { flushCode(); inCode = false; } else { inCode = true; }
      i++; continue;
    }
    if (inCode) { codeBuf.push(line); i++; continue; }
    const m = line.match(/^(#{1,4})\s+(.*)$/);
    if (m) { h += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; continue; }
    if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[-:\s|]+\|\s*$/.test(lines[i + 1])) {
      const head = line.split('|').slice(1, -1).map(c => c.trim());
      i += 2; const rows = [];
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) { rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim())); i++; }
      h += '<table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
      continue;
    }
    if (/^\s*>\s?/.test(line)) { h += '<blockquote>' + inline(line.replace(/^\s*>\s?/, '')) + '</blockquote>'; i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++; }
      h += '<ul>' + items.join('') + '</ul>'; continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; }
      h += '<ol>' + items.join('') + '</ol>'; continue;
    }
    if (line.trim() === '') { i++; continue; }
    h += '<p>' + inline(line) + '</p>'; i++;
  }
  flushCode();
  return h;
}
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

// ---------- 雷达图（Canvas） ----------
function drawRadar(canvas, dims) {
  const dpr = window.devicePixelRatio || 1;
  const size = 200;
  canvas.width = size * dpr; canvas.height = size * dpr;
  canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const cx = size / 2, cy = size / 2, R = size / 2 - 28;
  const n = dims.length;
  ctx.clearRect(0, 0, size, size);
  // 网格
  for (let g = 1; g <= 4; g++) {
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const a = -Math.PI / 2 + k * 2 * Math.PI / n;
      const r = R * g / 4;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#eef1f7'; ctx.lineWidth = 1; ctx.stroke();
  }
  // 轴 + 标签
  ctx.fillStyle = '#5a667e'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  dims.forEach((d, k) => {
    const a = -Math.PI / 2 + k * 2 * Math.PI / n;
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.strokeStyle = '#eef1f7'; ctx.stroke();
    const lx = cx + (R + 14) * Math.cos(a), ly = cy + (R + 14) * Math.sin(a);
    ctx.fillText(d.label, lx, ly + 3);
  });
  // 数据多边形
  ctx.beginPath();
  dims.forEach((d, k) => {
    const a = -Math.PI / 2 + k * 2 * Math.PI / n;
    const r = R * Math.max(0, Math.min(100, d.value)) / 100;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(47,91,234,.18)'; ctx.fill();
  ctx.strokeStyle = '#2f5bea'; ctx.lineWidth = 2; ctx.stroke();
  dims.forEach((d, k) => {
    const a = -Math.PI / 2 + k * 2 * Math.PI / n;
    const r = R * Math.max(0, Math.min(100, d.value)) / 100;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 2 * Math.PI); ctx.fillStyle = '#2f5bea'; ctx.fill();
  });
}

// ---------- 宏观研判 ----------
async function runMacro() {
  const grid = $('#macroGrid'); grid.innerHTML = '<div class="loading"><div class="spinner"></div>正在生成宏观研判…</div>';
  try {
    const d = await api('/api/macro');
    if (!d.ok) { grid.innerHTML = '<div class="empty">' + (d.error || '生成失败') + '</div>'; return; }
    const A = d.macro.assets;
    grid.innerHTML = '';
    for (const key of Object.keys(A)) {
      const a = A[key]; const meta = ASSET_META[key] || { label: a.label, color: '#2f5bea' };
      const card = el('div', 'asset-card');
      const stanceColor = s => s === '看涨' ? 'stance-up' : s === '看跌' ? 'stance-down' : 'stance-mid';
      let hz = '';
      for (const hk of ['short', 'mid', 'long']) {
        const h = a.byHorizon[hk]; const p = h.probs;
        const chips = (h.explain && h.explain.factors || []).map(f =>
          `<span class="factor-chip ${f.bull ? 'bull' : 'bear'}">${f.label} ${f.bull ? '+' : '−'}${Math.abs(f.contrib).toFixed(2)}</span>`).join('');
        hz += `<div class="horizon"><div class="hz-top"><span class="hz-label">${h.label} · ${h.windows}</span><span class="hz-stance ${stanceColor(h.stance)}">${h.stance} · 看涨 ${pct(p['看涨'])}</span></div>
          <div class="bar"><span class="seg bull" style="width:${p['看涨'] * 100}%"></span><span class="seg mid" style="width:${p['震荡'] * 100}%"></span><span class="seg bear" style="width:${p['看跌'] * 100}%"></span></div>
          <div class="hz-explain"><span class="hz-explain-label">研判依据：</span>${chips}<span class="hz-concl">结论：<b>${h.stance}</b></span></div></div>`;
      }
      card.innerHTML = `<div class="asset-head"><span class="asset-name">${meta.label}</span><span class="asset-tag" style="background:${meta.color}">四资产研判</span></div>${hz}`;
      grid.appendChild(card);
    }
  } catch (e) { grid.innerHTML = '<div class="empty">请求异常：' + e.message + '</div>'; }
}

// ---------- 主题选股（NL） ----------
async function runSelection() {
  const text = $('#selInput').value.trim();
  if (!text) { toast('请先输入研究需求', true); return; }
  const box = $('#selResult'); box.innerHTML = '<div class="loading"><div class="spinner"></div>Hermes 正在解析意图并筛选标的…</div>';
  $('#btnSel').disabled = true;
  try {
    const d = await api('/api/nl-themes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, topN: 3 }) });
    if (!d.ok) { box.innerHTML = '<div class="empty">' + (d.error || '解析失败') + (d.intent ? '<br>识别到的主题：' + (d.intent.themes || []).join('、') : '') + '</div>'; return; }
    box.innerHTML = '';
    if (!d.themes.length) { box.innerHTML = '<div class="empty">未能从输入识别出主题板块，请换种说法。</div>'; return; }
    d.themes.forEach(th => {
      if (!th.ok) { box.appendChild(el('div', 'empty', '主题「' + (th.themeKey || '') + '」无数据：' + (th.error || ''))); return; }
      const card = el('div', 'theme-card');
      const top = th.top || [];
      const topN = top.length;
      // 仅展示入选标的；每只标的独立雷达 + 直观优劣势（不堆叠、不共享图）
      let blocks = '';
      top.forEach((s, idx) => {
        const adv = s.best && s.best.text ? s.best.text : '';
        const rsk = s.worst && s.worst.text ? s.worst.text : '';
        blocks += `<div class="sel-stock">
          <div class="ss-head">
            <div class="ss-rank">${idx + 1}</div>
            <div class="ss-id"><div class="stock-name">${s.name} <span class="pick-tag">入选</span></div><div class="stock-code">${s.ticker}</div></div>
            <div class="score-bar"><i style="width:${Math.min(100, s.scores.unified)}%"></i></div>
            <div class="score-num">${s.scores.unified}</div>
          </div>
          <div class="ss-body">
            <div class="stock-tags"><span class="adv">▲ 最大优势 · ${adv}</span><span class="risk">▼ 最大风险 · ${rsk}</span></div>
            <div class="ss-radar"><canvas></canvas></div>
          </div>
        </div>`;
      });
      card.innerHTML = `<h3><i class="fas fa-layer-group" style="color:var(--brand)"></i> ${th.theme}</h3>
        <p class="theme-desc">${th.description || ''} ｜ 入选 ${topN} 只</p>
        <div class="sel-stocks">${blocks}</div>
        <div style="margin-top:12px"><button class="btn" data-copy="${encodeURIComponent(th.copyList || '')}"><i class="fas fa-copy"></i> 复制清单</button></div>`;
      box.appendChild(card);
      // 每只入选标的独立绘制六维雷达（不堆叠到同一坐标系）
      const canvases = $$('.ss-radar canvas', card);
      top.forEach((s, idx) => {
        if (!canvases[idx]) return;
        const dims = [
          { label: '财务健康', value: s.radar['财务健康'] }, { label: '安全边际', value: s.radar['安全边际'] },
          { label: '估值吸引力', value: s.radar['估值吸引力'] }, { label: '价格动量', value: s.radar['价格动量'] },
          { label: '低波质量', value: s.radar['低波质量'] }, { label: '消息情绪', value: s.radar['消息情绪'] },
        ];
        drawRadar(canvases[idx], dims);
      });
    });
    $$('[data-copy]', box).forEach(b => b.onclick = () => copyText(decodeURIComponent(b.dataset.copy)));
  } catch (e) { box.innerHTML = '<div class="empty">请求异常：' + e.message + '</div>'; }
  finally { $('#btnSel').disabled = false; }
}

// ---------- 深度研究（NL，多股） ----------
async function runDeep() {
  const text = $('#deepInput').value.trim();
  if (!text) { toast('请先输入研究内容', true); return; }
  const box = $('#deepResult'); box.innerHTML = '<div class="loading"><div class="spinner"></div>Hermes 正在识别所有目标股票并行深度研究…</div>';
  $('#btnDeep').disabled = true;
  try {
    const d = await api('/api/nl-deep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!d.ok) { box.innerHTML = '<div class="empty">' + (d.error || '解析失败') + '</div>'; return; }
    box.innerHTML = '';
    if (!d.results || !d.results.length) { box.innerHTML = '<div class="empty">未能从输入识别到股票标的，请列出具体股票代码或名称。</div>'; return; }
    d.results.forEach(r => {
      const card = el('div', 'report-card');
      if (!r.ok) {
        card.innerHTML = `<div class="report-head"><div><div class="rn">${r.name || r.raw || '未知'}</div></div><span class="tier-badge tier-T5">未分析</span></div>
          <div class="md"><p style="color:#d83a3a">${r.error || '无法解析标的'}</p></div>`;
        box.appendChild(card); return;
      }
      card.innerHTML = renderDeepReport(r);
      box.appendChild(card);
      // 六维雷达（由结构化 json 渲染，后台仍以 markdown 标准格式存储）
      const sub = (r.json && r.json.scores && r.json.scores.sub) || {};
      const radarDims = ['财务健康', '安全边际', '估值吸引力', '价格动量', '低波质量', '消息情绪'].map(k => ({ label: k, value: sub[k] || 0 }));
      const canvas = $('.deep-radar canvas', card);
      if (canvas) drawRadar(canvas, radarDims);
      // 原始 Markdown 折叠
      const rawBtn = $('[data-raw]', card);
      if (rawBtn) rawBtn.onclick = () => { const rv = $('.deep-raw', card); if (rv) rv.classList.toggle('hidden'); };
    });
  } catch (e) { box.innerHTML = '<div class="empty">请求异常：' + e.message + '</div>'; }
  finally { $('#btnDeep').disabled = false; }
}

// ---------- 深度研究：精美展示页（数据来自后端结构化 json，后台仍以 markdown 标准格式存储） ----------
function esc2(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function tierRankColor(t) { return TIER_COLOR[t] || 'tier-T5'; }

function renderDeepReport(r) {
  const j = r.json || {};
  const rating = r.rating || {};
  const tier = rating.tier || 'T5';
  const pool = rating.pool || '';
  const scores = j.scores || {};
  const sub = scores.sub || {};
  const val = j.valuation || {};
  const fals = j.falsification || [];
  const nodes = j.nodes || [];
  const unified = scores.unified || 0;
  const C = 2 * Math.PI * 52;
  const off = C * (1 - Math.min(100, unified) / 100);

  const subOrder = ['财务健康', '安全边际', '估值吸引力', '盈利质量', '价格动量', '低波质量', '趋势', 'RSI', 'MACD', '消息情绪'];
  const dimBars = subOrder.map(k => {
    const v = sub[k];
    if (v == null) return '';
    const cls = v >= 70 ? 'good' : v >= 50 ? 'mid' : 'bad';
    return `<div class="dim-row"><span class="dim-name">${k}</span><span class="dim-track"><i class="dim-fill ${cls}" style="width:${v}%"></i></span><span class="dim-val">${v}</span></div>`;
  }).join('');

  const sevCls = { '致命': 'f-sev-fatal', '严重': 'f-sev-high', '一般': 'f-sev-mid', '轻微': 'f-sev-low', '无': 'f-sev-none' };
  const falsRows = fals.map(f => `<div class="fals-row"><span class="fals-badge ${sevCls[f.level] || 'f-sev-mid'}">${f.level}</span><span class="fals-point">${esc2(f.point)}</span><span class="fals-ev">${esc2(f.evidence)}</span></div>`).join('');

  const gateCls = { '通过': 'g-ok', '熔断': 'g-fail', '返工': 'g-warn' };
  const gateRows = nodes.map(n => `<div class="gate-row"><span class="gate-dot ${gateCls[n[1]] || 'g-ok'}"></span><span class="gate-name">${esc2(n[0])}</span><span class="gate-st ${gateCls[n[1]] || 'g-ok'}">${esc2(n[1])}</span><span class="gate-basis">${esc2(n[2])}</span></div>`).join('');

  const scenRows = (val.scenarios || []).map(s => {
    const up = s.upside || 0;
    const cls = up >= 0 ? 'good' : 'bad';
    return `<div class="scen-row"><span class="scen-name">${esc2(s.name)}</span>
      <span class="scen-track"><i class="scen-fill ${cls}" style="width:${Math.min(100, Math.abs(up))}%"></i></span>
      <span class="scen-up ${cls}">${up >= 0 ? '+' : ''}${up}%</span>
      <span class="scen-price">${s.targetPrice}</span>
      <span class="scen-p">${Math.round((s.p || 0) * 100)}%</span></div>`;
  }).join('');

  const headline = (val.weightedUpside != null) ? `概率加权目标价 <b>${val.weightedTarget}</b>（加权上行空间 ${val.weightedUpside >= 0 ? '+' : ''}${val.weightedUpside}%）` : '';
  const concl = j.conclusion || (r.markdown ? '' : '');

  return `
  <div class="deep-hero">
    <div class="deep-id"><div class="dn">${esc2(r.name || r.code)}</div><div class="dc">${esc2(r.code || '')}</div></div>
    <div class="deep-ring-wrap">
      <svg viewBox="0 0 120 120" class="deep-ring">
        <circle cx="60" cy="60" r="52" class="ring-bg"></circle>
        <circle cx="60" cy="60" r="52" class="ring-fg" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"></circle>
      </svg>
      <div class="deep-ring-num"><b>${unified}</b><span>统一评分</span></div>
    </div>
    <span class="tier-badge ${tierRankColor(tier)} deep-tier">${tier} · ${pool}</span>
  </div>

  <div class="deep-stats">
    <div class="dstat"><b>${scores.fundamental != null ? scores.fundamental : '—'}</b><span>基本面</span></div>
    <div class="dstat"><b>${scores.technical != null ? scores.technical : '—'}</b><span>技术面</span></div>
    <div class="dstat"><b>${scores.sentiment != null ? scores.sentiment : '—'}</b><span>消息面</span></div>
    <div class="dstat"><b>${j.macroScore != null ? j.macroScore : '—'}</b><span>宏观评分</span></div>
  </div>

  <div class="deep-grid">
    <div class="deep-section">
      <div class="ds-title"><i class="fas fa-chart-pie"></i> 六维对比雷达</div>
      <div class="deep-radar"><canvas></canvas></div>
    </div>
    <div class="deep-section">
      <div class="ds-title"><i class="fas fa-layer-group"></i> 十维度评分</div>
      <div class="dim-list">${dimBars}</div>
    </div>
  </div>

  <div class="deep-section">
    <div class="ds-title"><i class="fas fa-project-diagram"></i> 节点门禁状态（Serenity 串行门禁）</div>
    <div class="gate-list">${gateRows}</div>
  </div>

  <div class="deep-section">
    <div class="ds-title"><i class="fas fa-balance-scale"></i> 五情景估值建模</div>
    <div class="scen-head"><span class="scen-name">情景</span><span class="scen-track"></span><span class="scen-up">空间</span><span class="scen-price">目标价</span><span class="scen-p">概率</span></div>
    ${scenRows}
    <div class="scen-foot">${headline}</div>
  </div>

  <div class="deep-section">
    <div class="ds-title"><i class="fas fa-shield-alt"></i> 基本面反向证伪</div>
    <div class="fals-list">${falsRows}</div>
  </div>

  <div class="deep-concl">
    <div class="dc-title"><i class="fas fa-flag-checkered"></i> 最终结论</div>
    <div class="dc-tier">投资评级 <b>${tier}</b>（${pool}）｜ 统一评分 ${unified}</div>
    <div class="dc-body">${esc2(concl)}</div>
  </div>

  <div class="deep-raw-toggle"><button class="btn" data-raw="${encodeURIComponent(r.markdown || '')}"><i class="fas fa-file-alt"></i> 查看原始 Markdown 报告</button></div>
  <div class="deep-raw hidden"><div class="md">${renderMarkdown(r.markdown || '')}</div></div>
  `;
}

// ---------- 研究资料库 ----------
async function loadKB() {
  const grid = $('#kbGrid'); grid.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const d = await api('/api/kb');
    if (!d.ok) { grid.innerHTML = '<div class="empty">加载失败</div>'; return; }
    const entries = d.entries || [];
    if (!entries.length) { grid.innerHTML = '<div class="empty">暂无研究报告。</div>'; return; }
    grid.innerHTML = '';
    entries.forEach(e => {
      const item = el('div', 'kb-item');
      const color = TYPE_COLOR[e.type] || '#2f5bea';
      item.innerHTML = `<span class="kb-type" style="background:${color}">${e.type}</span>
        <div class="kb-title">${e.title || e.file}</div>
        <div class="kb-meta">${e.ticker || ''} · ${e.ts || ''}</div>`;
      item.onclick = () => viewKB(e.file);
      grid.appendChild(item);
    });
  } catch (e) { grid.innerHTML = '<div class="empty">请求异常：' + e.message + '</div>'; }
}
async function viewKB(file) {
  const view = $('#kbView'); view.classList.remove('hidden'); view.innerHTML = '<div class="loading"><div class="spinner"></div>加载报告…</div>';
  const d = await api('/api/kb/' + encodeURIComponent(file));
  if (d.ok) view.innerHTML = '<div class="md">' + renderMarkdown(d.content) + '</div>';
  else view.innerHTML = '<div class="empty">读取失败</div>';
  view.scrollIntoView({ behavior: 'smooth' });
}

// ---------- 数据源检测 ----------
async function checkSource() {
  try {
    const d = await api('/api/health');
    const dp = d.dataProvider || 'local';
    const real = dp === 'auto' || dp === 'wind' || dp === 'akshare';
    $('#srcName').textContent = '数据源：' + (real ? '真实数据 (' + dp + ')' : '演示数据');
    $('#srcState').textContent = 'Hermes · Wind' + (real ? ' · 已接入' : '');
    $('#srcDot').className = 'agent-dot ' + (real ? 'online' : 'checking');
    $('#dpPill').innerHTML = '<i class="fas fa-database"></i> ' + (real ? '真实数据 · ' + dp : '演示数据');
  } catch (e) {
    $('#srcName').textContent = '数据源：离线';
    $('#srcDot').className = 'agent-dot offline';
  }
}

// ---------- 标签切换 ----------
const PAGE_META = {
  macro: ['宏观研判', '多因子信号聚合 · 股/债/房地产/黄金 短中长三档概率'],
  selection: ['主题选股', '自然语言描述需求，Hermes 自动拆分主题并筛选标的'],
  deep: ['深度研究', '自然语言段落，Hermes 识别全部目标股票并逐一深入'],
  kb: ['研究资料库', '所有研究结论按 类型_标的_时间戳 落盘，可回溯'],
};
function switchPage(p) {
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === p));
  $$('.page').forEach(s => s.classList.add('hidden'));
  $('#page-' + p).classList.remove('hidden');
  $('#pageTitle').textContent = PAGE_META[p][0];
  $('#pageSub').textContent = PAGE_META[p][1];
  if (p === 'kb') loadKB();
}

// ---------- 绑定 ----------
$('#btnMacro').onclick = runMacro;
$('#btnSel').onclick = runSelection;
$('#btnDeep').onclick = runDeep;
$('#btnKb').onclick = loadKB;
$$('.nav-item').forEach(n => n.onclick = () => switchPage(n.dataset.page));
checkSource();
