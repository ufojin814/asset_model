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
      const topN = (th.top || []).length;
      const ranked = th.ranked || th.top || [];
      let rows = '', radarDims = null;
      ranked.forEach((s, idx) => {
        const isTop = idx < topN;
        rows += `<div class="stock-row"><div class="stock-rank ${isTop ? 'r-top' : ''}">${idx + 1}</div>
          <div class="stock-main"><div class="stock-name">${s.name}${isTop ? ' <span class="pick-tag">入选</span>' : ''}</div><div class="stock-code">${s.ticker}</div></div>
          <div class="score-bar"><i style="width:${Math.min(100, s.scores.unified)}%"></i></div>
          <div class="score-num">${s.scores.unified}</div></div>`;
        if (idx === 0) radarDims = s.radar;
      });
      card.innerHTML = `<h3><i class="fas fa-layer-group" style="color:var(--brand)"></i> ${th.theme}</h3>
        <p class="theme-desc">${th.description || ''} ｜ 共 ${th.count} 只，全部展示（前 ${topN} 只入选）</p>
        <div class="stock-grid"><div>${rows}</div><div class="radar-wrap"><canvas></canvas></div></div>
        <div style="margin-top:12px"><button class="btn" data-copy="${encodeURIComponent(th.copyList || '')}"><i class="fas fa-copy"></i> 复制清单</button></div>`;
      box.appendChild(card);
      if (radarDims) {
        const dims = [
          { label: '财务健康', value: radarDims['财务健康'] }, { label: '安全边际', value: radarDims['安全边际'] },
          { label: '估值吸引', value: radarDims['估值吸引力'] }, { label: '价格动量', value: radarDims['价格动量'] },
          { label: '低波质量', value: radarDims['低波质量'] }, { label: '消息情绪', value: radarDims['消息情绪'] },
        ];
        drawRadar($('canvas', card), dims);
      }
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
      const tier = (r.rating && r.rating.tier) || 'T5';
      const tierName = (r.rating && r.rating.tierName) || '';
      card.innerHTML = `<div class="report-head"><div><div class="rn">${r.name || r.code}</div><div class="rc">${r.code}</div></div>
        <span class="tier-badge ${TIER_COLOR[tier] || 'tier-T5'}">${tier} ${tierName}</span></div>
        <div class="md">${renderMarkdown(r.markdown)}</div>`;
      box.appendChild(card);
    });
  } catch (e) { box.innerHTML = '<div class="empty">请求异常：' + e.message + '</div>'; }
  finally { $('#btnDeep').disabled = false; }
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
