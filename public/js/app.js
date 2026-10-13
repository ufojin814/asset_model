// public/js/app.js — 前端交互
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const API = '';

// ---------- Tab ----------
$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.panel').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $('#tab-' + t.dataset.tab).classList.add('active');
}));

// ---------- 宏观研判 ----------
async function loadThemes() {
  const r = await fetch(API + '/api/themes').then(x => x.json());
  if (!r.ok) return;
  const sel = $('#theme-select');
  sel.innerHTML = r.themes.map(t => `<option value="${t.key}">${t.name}（${t.description}）</option>`).join('');
}
async function runMacro() {
  $('#macro-result').innerHTML = '<div class="card">加载中…</div>';
  const r = await fetch(API + '/api/macro').then(x => x.json());
  if (!r.ok) { $('#macro-result').innerHTML = `<div class="card" style="color:#dc2626">${r.error}</div>`; return; }
  $('#macro-dp').textContent = '数据提供方: ' + (r.macro ? 'local' : '') + ' · 已落库 ' + (r.saved?.file || '');
  const m = r.macro;
  let html = '<div class="card"><h2>因子原始信号（raw，+1=扩张/利好风险资产）</h2><table><tr><th>因子</th><th>信号</th></tr>';
  for (const [k, v] of Object.entries(m.raw)) html += `<tr><td>${k}</td><td>${v.toFixed(3)}</td></tr>`;
  html += '</table></div>';
  for (const [aKey, aCfg] of Object.entries(m.assets)) {
    html += `<div class="card"><h2>${aCfg.label}</h2><table><tr><th>期限</th><th>倾斜度T</th><th>看涨</th><th>震荡</th><th>看跌</th><th>结论</th></tr>`;
    for (const h of ['short', 'mid', 'long']) {
      const h2 = aCfg.byHorizon[h];
      const cls = h2.stance === '看涨' ? 'up' : h2.stance === '看跌' ? 'down' : 'mid';
      html += `<tr><td>${h2.label}</td><td>${h2.tilt}</td><td>${(h2.probs.看涨*100).toFixed(1)}%</td><td>${(h2.probs.震荡*100).toFixed(1)}%</td><td>${(h2.probs.看跌*100).toFixed(1)}%</td><td><span class="tag ${cls}">${h2.stance}</span></td></tr>`;
    }
    html += '</table></div>';
  }
  $('#macro-result').innerHTML = html;
}

// ---------- 主题选股 ----------
async function runSelect() {
  const theme = $('#theme-select').value;
  const topN = $('#topn').value || 3;
  $('#select-result').innerHTML = '<div class="card">加载中…</div>';
  const r = await fetch(API + `/api/select?theme=${encodeURIComponent(theme)}&topN=${topN}`).then(x => x.json());
  if (!r.ok) { $('#select-result').innerHTML = `<div class="card" style="color:#dc2626">${r.error}</div>`; return; }
  let html = '';
  r.top.forEach((s, i) => {
    html += `<div class="stock-card"><h3>${i+1}. ${s.name}（${s.ticker}） <span class="pill">统一评分 ${s.scores.unified}</span></h3>`;
    html += `<div class="radar-wrap"><canvas id="radar-${i}" width="240" height="240"></canvas>`;
    html += `<div><table><tr><th>维度</th><th>评分</th></tr>`;
    html += `<tr><td>基本面</td><td>${s.scores.fundamental}</td></tr><tr><td>技术面</td><td>${s.scores.technical}</td></tr><tr><td>消息面</td><td>${s.scores.sentiment}</td></tr></table>`;
    html += `<div style="margin-top:6px">${bar('财务健康',s.radar.财务健康)}${bar('安全边际',s.radar.安全边际)}${bar('估值吸引力',s.radar.估值吸引力)}${bar('价格动量',s.radar.价格动量)}${bar('低波质量',s.radar.低波质量)}${bar('消息情绪',s.radar.消息情绪)}</div></div></div>`;
    html += `<p style="color:#374151">${s.conclusion}</p>`;
    if (s.news && s.news.length) html += `<p class="hint">近期消息：${s.news.slice(0,3).map(n=>n.title).join('；')}</p>`;
    html += `</div>`;
  });
  html += `<div class="card"><h2>复制清单（代码\\t名称）</h2><div class="copy-box" id="copylist">${r.copyList}</div><button class="btn" onclick="copyText('copylist')">复制</button></div>`;
  $('#select-result').innerHTML = html;
  r.top.forEach((s, i) => drawRadar($('#radar-' + i), ['财务健康','安全边际','估值吸引力','价格动量','低波质量','消息情绪'], [s.radar.财务健康,s.radar.安全边际,s.radar.估值吸引力,s.radar.价格动量,s.radar.低波质量,s.radar.消息情绪]));
}
function bar(label, v) {
  return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:12px"><span style="width:70px">${label}</span><span class="bar"><i style="width:${v}%"></i></span><span>${v}</span></div>`;
}

// ---------- 深度研究 ----------
async function runDeep(ticker) {
  ticker = ticker || $('#ticker-input').value.trim();
  if (!ticker) return;
  $('#deep-result').innerHTML = '<div class="card">加载中…</div>';
  const r = await fetch(API + `/api/deep?ticker=${encodeURIComponent(ticker)}`).then(x => x.json());
  if (!r.ok) { $('#deep-result').innerHTML = `<div class="card" style="color:#dc2626">${r.error}</div>`; return; }
  $('#deep-result').innerHTML = `<div class="card"><h2>${r.name}（${r.ticker}）深度研究报告</h2><div class="md-body">${renderMarkdown(r.markdown)}</div></div>`;
}

// ---------- 研究资料库 ----------
async function loadKB() {
  const r = await fetch(API + '/api/kb').then(x => x.json());
  if (!r.ok) return;
  $('#kb-stats').textContent = '总量 ' + (r.stats?.total||0) + ' · ' + JSON.stringify(r.stats?.byType||{});
  const label = { macro:'宏观研判', selection:'选股', deep:'深度研究' };
  let html = '';
  r.entries.forEach(e => {
    html += `<div class="kb-item" data-file="${e.file}"><div><b>${e.title}</b><br><span class="kb-meta">${label[e.type]||e.type} · ${e.timestamp} · ${e.ticker}</span></div><span class="pill">${e.type}</span></div>`;
  });
  $('#kb-list').innerHTML = html || '<div class="card">暂无研究记录</div>';
  $$('.kb-item').forEach(it => it.addEventListener('click', () => viewReport(it.dataset.file)));
}
async function viewReport(file) {
  const r = await fetch(API + '/api/kb/' + encodeURIComponent(file)).then(x => x.json());
  if (!r.ok) return;
  $('#kb-view').innerHTML = `<div class="card"><h2>${file}</h2><div class="md-body">${renderMarkdown(r.content)}</div></div>`;
}

// ---------- 雷达图 ----------
function drawRadar(canvas, labels, values) {
  const ctx = canvas.getContext('2d');
  const cx = canvas.width/2, cy = canvas.height/2, R = 90;
  const n = labels.length;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // 网格
  for (let ring=1; ring<=5; ring++) {
    ctx.beginPath();
    for (let i=0;i<n;i++){const a=-Math.PI/2+i*2*Math.PI/n;const r=R*ring/5;ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));}
    ctx.closePath(); ctx.strokeStyle='#e5e7eb'; ctx.stroke();
  }
  // 轴
  for (let i=0;i<n;i++){const a=-Math.PI/2+i*2*Math.PI/n;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+R*Math.cos(a),cy+R*Math.sin(a));ctx.strokeStyle='#cbd5e1';ctx.stroke();}
  // 数据
  ctx.beginPath();
  for (let i=0;i<n;i++){const a=-Math.PI/2+i*2*Math.PI/n;const r=R*(Math.max(0,Math.min(100,values[i]))/100);ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));}
  ctx.closePath(); ctx.fillStyle='rgba(37,99,235,.18)'; ctx.fill(); ctx.strokeStyle='#2563eb'; ctx.lineWidth=2; ctx.stroke();
  // 标签
  ctx.fillStyle='#374151'; ctx.font='11px sans-serif';
  for (let i=0;i<n;i++){const a=-Math.PI/2+i*2*Math.PI/n;const lx=cx+(R+14)*Math.cos(a),ly=cy+(R+14)*Math.sin(a);ctx.textAlign='center';ctx.fillText(labels[i],lx,ly);}
}

// ---------- 复制 ----------
function copyText(id){const el=document.getElementById(id);if(!el)return;navigator.clipboard.writeText(el.innerText).then(()=>{const b=event.target;b.textContent='已复制';setTimeout(()=>b.textContent='复制',1200);});}

// ---------- 极简 Markdown 渲染 ----------
function renderMarkdown(md){
  if(!md)return'';
  const lines=md.split('\n');let html='';let inCode=false,code='';
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  for(let raw of lines){
    const line=raw;
    if(line.startsWith('```')){if(inCode){html+=`<pre>${esc(code)}</pre>`;code='';inCode=false;}else{inCode=true;}continue;}
    if(inCode){code+=line+'\n';continue;}
    if(line.startsWith('---')){html+='<hr>';continue;}
    if(line.startsWith('>')){html+=`<blockquote>${inline(line.slice(1).trim())}</blockquote>`;continue;}
    if(line.startsWith('### ')){html+=`<h3>${inline(line.slice(4))}</h3>`;continue;}
    if(line.startsWith('## ')){html+=`<h2>${inline(line.slice(3))}</h2>`;continue;}
    if(line.startsWith('# ')){html+=`<h1>${inline(line.slice(2))}</h1>`;continue;}
    if(/^\|/.test(line)){ // 表格
      const cells=line.split('|').slice(1,-1).map(c=>c.trim());
      if(/^[-: |]+$/.test(line))continue; // 分隔行
      html+= cells.map(c=>`<td>${inline(c)}</td>`).join('');
      if(!html.endsWith('</tr>'))html='<table>'+html;
      html=html.replace(/<td>/, '<tr><td>').replace(/<\/td>$/, '</td></tr>');
      continue;
    }
    if(/^[-*] /.test(line)){html+=`<li>${inline(line.slice(2))}</li>`;continue;}
    if(line.trim()===''){html+='';continue;}
    html+=`<p>${inline(line)}</p>`;
  }
  if(inCode)html+=`<pre>${esc(code)}</pre>`;
  return html;
}
function inline(s){return s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`(.+?)`/g,'<code>$1</code>');}

// ---------- 绑定 ----------
$('#btn-macro').addEventListener('click', runMacro);
$('#btn-select').addEventListener('click', runSelect);
$('#btn-deep').addEventListener('click', () => runDeep());
$('#btn-kb').addEventListener('click', loadKB);
loadThemes();
loadKB();
