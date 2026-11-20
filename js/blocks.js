/* =========================================================================
   Kezle Lab Pro — Programação em BLOCOS (estilo Scratch)
   Editor visual (arrastar/soltar, encaixe em pilha, blocos em "C", valores
   encaixáveis) que gera código nas 9 linguagens: MicroPython, CircuitPython,
   C++ (Arduino), C, JavaScript, Lua, BASIC, Go e Rust.
   ========================================================================= */
(function(){
'use strict';
const esc = window.escHtml;
const COL = { ctl: '#f59e0b', pin: '#0ea5e9', logic: '#22c55e', math: '#8b5cf6', vars: '#f97316', text: '#ec4899', disp: '#14b8a6', touch: '#6366f1', hat: '#ef4444' };
const CATS = [['ctl', '⏱ Controle'], ['pin', '🔌 Pinos'], ['logic', '⚖ Lógica'], ['math', '🔢 Matemática'], ['vars', '📦 Variáveis'], ['text', '💬 Texto / Serial'], ['disp', '🖥 Tela'], ['touch', '👆 Toque']];
const COLORS = [['0x0000', 'preto'], ['0xFFFF', 'branco'], ['0xF800', 'vermelho'], ['0x07E0', 'verde'], ['0x001F', 'azul'], ['0xFFE0', 'amarelo'], ['0x07FF', 'ciano'], ['0xF81F', 'magenta'], ['0xFDA0', 'laranja']];
const PINSEL = n => ({ f: 'pin', t: 'num', d: n, w: 42, title: 'número do pino (GPIO)' });

/* ---------- definição dos blocos ----------
   k: hat | stmt | c | cc | val | bool     parts: texto | {f,t,d,opts} (campo) | {v,d} (encaixe de valor)   */
const B = {
  start:    { cat: 'hat', k: 'hat', parts: ['quando iniciar ▶'] },
  forever:  { cat: 'ctl', k: 'c', parts: ['para sempre'] },
  repeat:   { cat: 'ctl', k: 'c', parts: ['repetir', { v: 'n', d: 10 }, 'vezes'] },
  while:    { cat: 'ctl', k: 'c', parts: ['enquanto', { v: 'c', d: '', bool: true }] },
  if:       { cat: 'ctl', k: 'c', parts: ['se', { v: 'c', d: '', bool: true }, 'então'] },
  ifelse:   { cat: 'ctl', k: 'cc', parts: ['se', { v: 'c', d: '', bool: true }, 'então'] },
  wait:     { cat: 'ctl', k: 'stmt', parts: ['esperar', { v: 'ms', d: 500 }, 'ms'] },
  millis:   { cat: 'ctl', k: 'val', parts: ['milissegundos desde o início'] },
  pinmode:  { cat: 'pin', k: 'stmt', parts: ['pino', PINSEL(2), 'como', { f: 'mode', t: 'sel', opts: [['OUTPUT', 'saída'], ['INPUT', 'entrada'], ['INPUT_PULLUP', 'entrada c/ pull-up']] }] },
  write:    { cat: 'pin', k: 'stmt', parts: ['escrever pino', PINSEL(2), { f: 'lv', t: 'sel', opts: [['1', 'ALTO'], ['0', 'BAIXO']] }] },
  read:     { cat: 'pin', k: 'bool', parts: ['ler digital pino', PINSEL(4)] },
  aread:    { cat: 'pin', k: 'val', parts: ['ler analógico % pino', PINSEL(34)] },
  pwm:      { cat: 'pin', k: 'stmt', parts: ['PWM pino', PINSEL(2), 'em', { v: 'v', d: 50 }, '%'] },
  servo:    { cat: 'pin', k: 'stmt', parts: ['servo pino', PINSEL(13), 'ângulo', { v: 'a', d: 90 }, '°'] },
  tone:     { cat: 'pin', k: 'stmt', parts: ['tocar pino', PINSEL(14), 'freq', { v: 'f', d: 440 }, 'Hz por', { v: 'ms', d: 200 }, 'ms'] },
  cmp:      { cat: 'logic', k: 'bool', parts: [{ v: 'a', d: 0 }, { f: 'op', t: 'sel', opts: [['<', '<'], ['>', '>'], ['<=', '≤'], ['>=', '≥'], ['==', '='], ['!=', '≠']] }, { v: 'b', d: 0 }] },
  and:      { cat: 'logic', k: 'bool', parts: [{ v: 'a', d: '', bool: true }, 'e', { v: 'b', d: '', bool: true }] },
  or:       { cat: 'logic', k: 'bool', parts: [{ v: 'a', d: '', bool: true }, 'ou', { v: 'b', d: '', bool: true }] },
  not:      { cat: 'logic', k: 'bool', parts: ['não', { v: 'a', d: '', bool: true }] },
  bool:     { cat: 'logic', k: 'bool', parts: [{ f: 'x', t: 'sel', opts: [['true', 'verdadeiro'], ['false', 'falso']] }] },
  num:      { cat: 'math', k: 'val', parts: [{ f: 'n', t: 'num', d: 0, w: 56 }] },
  arith:    { cat: 'math', k: 'val', parts: [{ v: 'a', d: 0 }, { f: 'op', t: 'sel', opts: [['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷'], ['%', 'resto']] }, { v: 'b', d: 0 }] },
  random:   { cat: 'math', k: 'val', parts: ['aleatório de', { v: 'a', d: 1 }, 'a', { v: 'b', d: 10 }] },
  map:      { cat: 'math', k: 'val', parts: ['mapear', { v: 'v', d: 0 }, 'de', { v: 'a', d: 0 }, '–', { v: 'b', d: 100 }, 'para', { v: 'c', d: 0 }, '–', { v: 'd', d: 255 }] },
  setvar:   { cat: 'vars', k: 'stmt', parts: ['definir', { f: 'name', t: 'var', d: 'x', w: 54 }, 'para', { v: 'v', d: 0 }] },
  changevar:{ cat: 'vars', k: 'stmt', parts: ['mudar', { f: 'name', t: 'var', d: 'x', w: 54 }, 'em', { v: 'v', d: 1 }] },
  getvar:   { cat: 'vars', k: 'val', parts: [{ f: 'name', t: 'var', d: 'x', w: 54 }] },
  text:     { cat: 'text', k: 'val', parts: ['“', { f: 't', t: 'text', d: 'olá', w: 74 }, '”'] },
  join:     { cat: 'text', k: 'val', parts: ['juntar', { v: 'a', d: 'olá ' }, 'com', { v: 'b', d: 'mundo' }] },
  print:    { cat: 'text', k: 'stmt', parts: ['escrever no serial', { v: 'v', d: 'olá' }] },
  clear:    { cat: 'disp', k: 'stmt', parts: ['limpar tela', { f: 'c', t: 'sel', opts: COLORS }] },
  drawtext: { cat: 'disp', k: 'stmt', parts: ['texto', { v: 't', d: 'olá' }, 'em x', { v: 'x', d: 10 }, 'y', { v: 'y', d: 10 }, { f: 'c', t: 'sel', opts: COLORS, d: '0xFFFF' }] },
  rect:     { cat: 'disp', k: 'stmt', parts: ['retângulo x', { v: 'x', d: 10 }, 'y', { v: 'y', d: 40 }, 'larg', { v: 'w', d: 60 }, 'alt', { v: 'h', d: 30 }, { f: 'c', t: 'sel', opts: COLORS, d: '0x07FF' }] },
  circle:   { cat: 'disp', k: 'stmt', parts: ['círculo x', { v: 'x', d: 100 }, 'y', { v: 'y', d: 100 }, 'raio', { v: 'r', d: 20 }, { f: 'c', t: 'sel', opts: COLORS, d: '0xF800' }] },
  line:     { cat: 'disp', k: 'stmt', parts: ['linha de', { v: 'x1', d: 0 }, { v: 'y1', d: 0 }, 'até', { v: 'x2', d: 100 }, { v: 'y2', d: 100 }, { f: 'c', t: 'sel', opts: COLORS, d: '0x07E0' }] },
  touched:  { cat: 'touch', k: 'bool', parts: ['tela tocada?'] },
  touchx:   { cat: 'touch', k: 'val', parts: ['toque x'] },
  touchy:   { cat: 'touch', k: 'val', parts: ['toque y'] }
};
const needsDisp = new Set(['clear', 'drawtext', 'rect', 'circle', 'line']);
const needsTouch = new Set(['touched', 'touchx', 'touchy']);

/* ---------- modelo ---------- */
function mk(t){
  const d = B[t], blk = { t, f: {}, v: {}, b1: [], b2: [] };
  for(const p of d.parts){ if(typeof p === 'string') continue; if(p.f) blk.f[p.f] = p.d !== undefined ? p.d : (p.opts ? p.opts[0][0] : ''); if(p.v) blk.f[p.v] = p.d !== undefined ? p.d : 0; }
  return blk;
}
const WS = { scripts: [] };   // [{x,y,blocks:[...]}]

/* ---------- renderização ---------- */
const css = document.createElement('style');
css.textContent = `
#v-blocks .bk-wrap{display:grid;grid-template-columns:330px 1fr 360px;gap:10px;height:calc(100vh - 150px);min-height:480px}
.bk-pal{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:auto;padding:8px}
.bk-pal h4{margin:10px 0 6px;font-size:12px;color:var(--dim);letter-spacing:.5px}
.bk-ws{position:relative;background:#0a1322;background-image:radial-gradient(#16233a 1px,transparent 1.4px);background-size:20px 20px;border:1px solid var(--line);border-radius:10px;overflow:auto}
.bk-ws .inner{position:relative;width:2400px;height:1600px}
.bk-code{display:flex;flex-direction:column;gap:6px;min-height:0}
.bk-code pre{flex:1;margin:0;background:#060b14;border:1px solid var(--line);border-radius:10px;padding:10px;overflow:auto;font:12px/1.5 var(--mono);color:#cfe8ff;white-space:pre}
.blk{position:relative;display:inline-flex;align-items:center;flex-wrap:wrap;gap:5px;padding:5px 9px;border-radius:7px;color:#fff;font:600 12px 'Segoe UI',system-ui,sans-serif;cursor:grab;user-select:none;touch-action:none;box-shadow:0 2px 0 rgba(0,0,0,.35);margin:0;vertical-align:top;border:1px solid rgba(255,255,255,.18)}
.blk.stmt,.blk.c,.blk.cc,.blk.hat{display:flex;width:max-content;max-width:none}
.blk.hat{border-radius:16px 16px 7px 7px;padding-top:9px}
.blk.val{border-radius:14px;padding:3px 8px}
.blk.bool{border-radius:4px 14px 14px 4px;clip-path:none;padding:3px 10px;border-left:3px solid rgba(0,0,0,.35)}
.blk input,.blk select{font:600 12px 'Segoe UI',system-ui;color:#111;background:#fff;border:none;border-radius:10px;padding:2px 6px;height:20px;outline:none}
.blk input[type=number]{-moz-appearance:textfield}
.blk .sock{display:inline-flex;align-items:center;min-width:28px;min-height:20px;background:rgba(0,0,0,.28);border-radius:11px;padding:0 2px;border:1px dashed rgba(255,255,255,.35)}
.blk .sock.bs{border-radius:4px 12px 12px 4px;min-width:34px}
.blk .sock.hover{outline:2px solid #fff}
.blkstack{display:flex;flex-direction:column;align-items:flex-start}
.blk.c,.blk.cc{flex-direction:column;align-items:flex-start;gap:0;padding:0;border-radius:7px}
.blk .row{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:5px 9px;width:100%}
.blk .arm{margin-left:14px;min-height:22px;min-width:120px;padding:3px 0 3px 6px;border-left:6px solid rgba(0,0,0,.28);background:rgba(0,0,0,.14);width:calc(100% - 14px);box-sizing:border-box}
.blk .arm.hover{background:rgba(255,255,255,.28)}
.blk .foot{height:8px;width:100%;background:rgba(0,0,0,.18);border-radius:0 0 7px 7px}
.bk-pal .blk.stmt,.bk-pal .blk.val,.bk-pal .blk.bool{max-width:100%;width:auto}
.ghost{position:fixed;z-index:9999;pointer-events:none;opacity:.92;filter:drop-shadow(0 6px 8px #000a)}
.bk-script{position:absolute}
.bk-trash{margin-top:8px;padding:8px;border:1px dashed var(--line);border-radius:8px;text-align:center;font-size:12px;color:var(--dim)}
.bk-trash.hover{background:#7f1d1d55;color:#fecaca}
`;
document.head.appendChild(css);

function fieldEl(blk, p, onChange){
  let el;
  if(p.t === 'sel'){
    el = document.createElement('select');
    el.innerHTML = p.opts.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('');
    el.value = blk.f[p.f];
  } else {
    el = document.createElement('input');
    el.type = p.t === 'num' ? 'number' : 'text';
    el.value = blk.f[p.f];
    if(p.t === 'num') el.step = 'any';
    el.style.width = (p.w || 48) + 'px';
    if(p.title) el.title = p.title;
  }
  el.onpointerdown = e => e.stopPropagation();
  el.oninput = el.onchange = () => { blk.f[p.f] = p.t === 'num' ? (el.value === '' ? 0 : +el.value) : (p.t === 'var' ? el.value.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 20) : el.value); onChange(); };
  return el;
}
function render(blk, onChange, parentArr){
  const d = B[blk.t];
  const el = document.createElement('div');
  el.className = 'blk ' + d.k;
  el.style.background = COL[d.cat];
  el._blk = blk; el._arr = parentArr;
  const row = (d.k === 'c' || d.k === 'cc') ? Object.assign(document.createElement('div'), { className: 'row' }) : el;
  if(row !== el) el.appendChild(row);
  for(const p of d.parts){
    if(typeof p === 'string'){ const s = document.createElement('span'); s.textContent = p; row.appendChild(s); }
    else if(p.f) row.appendChild(fieldEl(blk, p, onChange));
    else if(p.v){
      const sock = document.createElement('span');
      sock.className = 'sock' + (p.bool ? ' bs' : ''); sock.dataset.name = p.v; sock._blk = blk; sock._bool = !!p.bool;
      if(blk.v[p.v]){ sock.appendChild(render(blk.v[p.v], onChange, null)); sock.firstChild._sockOwner = { blk, name: p.v }; }
      else if(!p.bool){
        const inp = document.createElement('input'); inp.type = typeof p.d === 'number' ? 'number' : 'text'; inp.value = blk.f[p.v]; inp.step = 'any'; inp.style.width = (inp.type === 'number' ? 52 : 66) + 'px';
        inp.onpointerdown = e => e.stopPropagation();
        inp.oninput = () => { blk.f[p.v] = inp.type === 'number' ? (inp.value === '' ? 0 : +inp.value) : inp.value; onChange(); };
        sock.appendChild(inp);
      }
      row.appendChild(sock);
    }
  }
  if(d.k === 'c' || d.k === 'cc'){
    const arm = (arr, label) => {
      if(label){ const r = document.createElement('div'); r.className = 'row'; r.textContent = label; el.appendChild(r); }
      const a = document.createElement('div'); a.className = 'arm'; a._arr = arr; a._owner = blk; el.appendChild(a);
      for(const c of arr) a.appendChild(render(c, onChange, arr));
    };
    arm(blk.b1);
    if(d.k === 'cc') arm(blk.b2, 'senão');
    const f = document.createElement('div'); f.className = 'foot'; el.appendChild(f);
  }
  return el;
}

/* ---------- espaço de trabalho + arrastar/soltar ---------- */
let ui = null;
function changed(){ renderWS(); regen(); autosave(); }
function renderWS(){
  const inner = ui.inner; inner.innerHTML = '';
  WS.scripts.forEach(sc => {
    const wrap = document.createElement('div'); wrap.className = 'bk-script blkstack'; wrap.style.left = sc.x + 'px'; wrap.style.top = sc.y + 'px'; wrap._script = sc;
    sc.blocks.forEach(b => wrap.appendChild(render(b, regenOnly, sc.blocks)));
    inner.appendChild(wrap);
  });
}
function regenOnly(){ regen(); autosave(); }
function startDrag(e, blk, source){
  // source: {arr, index} (remove chain) | {owner, name} (value) | null (palette)
  e.preventDefault();
  let chain;
  const d = B[blk.t];
  if(source && source.arr){ const i = source.arr.indexOf(blk); chain = source.arr.splice(i); }
  else if(source && source.owner){ delete source.owner.v[source.name]; chain = [blk]; }
  else chain = [blk];
  const isVal = d.k === 'val' || d.k === 'bool';
  if(source) renderWS();
  const ghost = document.createElement('div'); ghost.className = 'ghost blkstack';
  chain.forEach(b => ghost.appendChild(render(b, () => {}, null)));
  document.body.appendChild(ghost);
  const off = { x: 14, y: 10 };
  const place = ev => { ghost.style.left = (ev.clientX - off.x) + 'px'; ghost.style.top = (ev.clientY - off.y) + 'px'; };
  place(e);
  let hot = null;
  const clearHot = () => { document.querySelectorAll('.hover').forEach(x => x.classList.remove('hover')); hot = null; };
  const findTarget = ev => {
    clearHot();
    const gr = ghost.getBoundingClientRect();
    const px = gr.left + 6, py = gr.top + 8;
    const trash = document.querySelector('.bk-pal');
    const pr = trash.getBoundingClientRect();
    if(ev.clientX >= pr.left && ev.clientX <= pr.right && ev.clientY >= pr.top && ev.clientY <= pr.bottom){ hot = { kind: 'trash' }; document.querySelector('.bk-trash').classList.add('hover'); return; }
    document.querySelector('.bk-trash').classList.remove('hover');
    const wsr = ui.ws.getBoundingClientRect();
    if(ev.clientX < wsr.left || ev.clientX > wsr.right || ev.clientY < wsr.top || ev.clientY > wsr.bottom) return;
    if(isVal){
      let best = null, bd = 1e9;
      ui.inner.querySelectorAll('.sock').forEach(s => {
        const r = s.getBoundingClientRect();
        const cx = Math.max(r.left, Math.min(ev.clientX, r.right)), cy = Math.max(r.top, Math.min(ev.clientY, r.bottom));
        const dd = Math.hypot(ev.clientX - cx, ev.clientY - cy);
        const okType = (d.k === 'bool' || !s._bool);
        if(dd < 24 && dd < bd && okType && !s.closest('.ghost')){ bd = dd; best = s; }
      });
      if(best){ best.classList.add('hover'); hot = { kind: 'sock', el: best }; }
      return;
    }
    if(d.k === 'hat'){ hot = { kind: 'free' }; return; }
    let best = null, bd = 38;
    const cand = [];
    ui.inner.querySelectorAll('.blk.stmt, .blk.c, .blk.cc, .blk.hat').forEach(b => { const r = b.getBoundingClientRect(); cand.push({ el: b, x: r.left, y: r.bottom, kind: 'after' }); });
    ui.inner.querySelectorAll('.arm').forEach(a => { const r = a.getBoundingClientRect(); cand.push({ el: a, x: r.left + 8, y: r.top + 4, kind: 'arm' }); });
    for(const c of cand){
      if(c.el.closest('.ghost')) continue;
      if(d.k === 'hat') continue;
      const dd = Math.hypot(px - c.x, py - c.y);
      if(dd < bd){ bd = dd; best = c; }
    }
    if(best){ (best.kind === 'arm' ? best.el : best.el).classList.add('hover'); hot = { kind: best.kind, el: best.el }; }
    else hot = { kind: 'free' };
  };
  const mv = ev => { place(ev); findTarget(ev); };
  const up = ev => {
    document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
    findTarget(ev);
    const target = hot; clearHot(); ghost.remove(); document.querySelector('.bk-trash').classList.remove('hover');
    if(!target || target.kind === 'trash'){ changed(); return; }
    const wsr = ui.ws.getBoundingClientRect();
    if(target.kind === 'sock'){
      const s = target.el; const owner = s._blk, name = s.dataset.name;
      if(owner.v[name]) { /* substitui: o antigo some */ }
      owner.v[name] = blk;
    } else if(target.kind === 'arm'){ target.el._arr.unshift(...chain); }
    else if(target.kind === 'after'){
      const t = target.el._blk, arr = target.el._arr;
      if(arr){ arr.splice(arr.indexOf(t) + 1, 0, ...chain); }
      else { /* bloco dentro de encaixe: ignora */ WS.scripts.push({ x: ev.clientX - wsr.left + ui.ws.scrollLeft - 14, y: ev.clientY - wsr.top + ui.ws.scrollTop - 10, blocks: chain }); }
    } else {
      if(isVal){ /* valor solto sem encaixe: descarta */ }
      else WS.scripts.push({ x: Math.max(4, ev.clientX - wsr.left + ui.ws.scrollLeft - 14), y: Math.max(4, ev.clientY - wsr.top + ui.ws.scrollTop - 10), blocks: chain });
    }
    WS.scripts = WS.scripts.filter(sc => sc.blocks.length);
    changed();
  };
  document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
}
function wire(){
  // arrastar blocos já na área de trabalho
  ui.inner.addEventListener('pointerdown', e => {
    const el = e.target.closest('.blk'); if(!el || e.target.closest('input,select')) return;
    // pega o bloco mais interno clicado
    const blk = el._blk; let source = null;
    if(el._arr) source = { arr: el._arr };
    else if(el._sockOwner) source = { owner: el._sockOwner.blk, name: el._sockOwner.name };
    else if(el.parentElement && el.parentElement._script){ source = { arr: el.parentElement._script.blocks }; }
    if(!source) return;
    e.stopPropagation();
    startDrag(e, blk, source);
  });
  ui.inner.addEventListener('contextmenu', e => {
    const el = e.target.closest('.blk'); if(!el) return; e.preventDefault();
    modal('Bloco', '<p class="small">O que fazer com este bloco?</p>', [{ t: 'Cancelar' }, { t: '⧉ Duplicar', f: () => { const b = JSON.parse(JSON.stringify(el._blk)); const arr = el._arr; if(arr){ arr.splice(arr.indexOf(el._blk) + 1, 0, b); } changed(); } }, { t: '🗑 Apagar', p: 1, f: () => { const arr = el._arr; if(arr){ arr.splice(arr.indexOf(el._blk), 1); } else if(el._sockOwner) delete el._sockOwner.blk.v[el._sockOwner.name]; WS.scripts = WS.scripts.filter(sc => sc.blocks.length); changed(); } }]);
  });
}
function renderPalette(){
  const pal = ui.pal; pal.innerHTML = '';
  for(const [cat, label] of CATS){
    const h = document.createElement('h4'); h.textContent = label; h.style.color = COL[cat]; pal.appendChild(h);
    const ids = Object.keys(B).filter(k => B[k].cat === cat);
    if(cat === 'ctl') ids.unshift('start');
    for(const id of ids){
      if(id === 'start' && cat !== 'ctl') continue;
      const blk = mk(id), el = render(blk, () => {}, null);
      el.style.margin = '3px 0'; el.style.cursor = 'grab';
      el.querySelectorAll('input,select').forEach(i => { i.disabled = false; });
      el.addEventListener('pointerdown', e => { if(e.target.closest('input,select')) return; startDrag(e, mk(id), null); });
      const w = document.createElement('div'); w.appendChild(el); pal.appendChild(w);
    }
  }
  const tr = document.createElement('div'); tr.className = 'bk-trash'; tr.textContent = '🗑 solte aqui para apagar'; pal.appendChild(tr);
}

/* ---------- geração de código ---------- */
const L = { py: 'MicroPython', cpy: 'CircuitPython', cpp: 'C++ (Arduino)', c: 'C', js: 'JavaScript', lua: 'Lua', bas: 'BASIC', go: 'Go', rs: 'Rust' };
const ident = s => (String(s || 'x').replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'x');
function lit(lang, v, isText){
  if(isText) return JSON.stringify(String(v));
  const n = Number(v); return Number.isFinite(n) ? String(n) : '0';
}
const lvToLang = (lang, v) => v === 'true' ? ({ py: 'True', cpy: 'True', lua: 'true', bas: '-1' }[lang] || 'true') : ({ py: 'False', cpy: 'False', lua: 'false', bas: '0' }[lang] || 'false');
const CMP = lang => ({ '<': '<', '>': '>', '<=': '<=', '>=': '>=', '==': lang === 'bas' ? '=' : '==', '!=': lang === 'lua' ? '~=' : lang === 'bas' ? '<>' : '!=' });
const LOGIC = lang => ({ and: { py: 'and', cpy: 'and', lua: 'and', bas: 'AND' }[lang] || '&&', or: { py: 'or', cpy: 'or', lua: 'or', bas: 'OR' }[lang] || '||', not: { py: 'not ', cpy: 'not ', lua: 'not ', bas: 'NOT ' }[lang] || '!' });

function val(lang, blk, name, ctx){
  const ch = blk.v[name];
  if(ch) return expr(lang, ch, ctx);
  const d = B[blk.t].parts.find(p => p.v === name);
  const v = blk.f[name];
  if(d && d.bool) return lvToLang(lang, 'false');
  return (typeof d.d === 'number' || (v !== '' && isFinite(+v) && typeof d.d !== 'string')) ? lit(lang, v) : lit(lang, v, true);
}
function pct2raw(lang, p){ return p; }
function expr(lang, b, ctx){
  const V = n => val(lang, b, n, ctx);
  const F = n => b.f[n];
  switch(b.t){
    case 'num': return lit(lang, F('n'));
    case 'text': return lit(lang, F('t'), true);
    case 'bool': return lvToLang(lang, F('x'));
    case 'getvar': ctx.vars.add(ident(F('name'))); return ident(F('name'));
    case 'millis': return { py: 'time.ticks_ms()', cpy: 'int(time.monotonic() * 1000)', cpp: 'millis()', c: 'millis()', js: 'millis()', lua: 'millis()', bas: 'MILLIS()', go: 'millis()', rs: 'millis()' }[lang];
    case 'read': { const p = lit(lang, F('pin')); return { py: `_rd(${p})`, cpy: `_rd(${p})`, cpp: `digitalRead(${p})`, c: `digitalRead(${p})`, js: `digitalRead(${p})`, lua: `(digitalRead(${p}) == 1)`, bas: `(DREAD(${p}) = 1)`, go: `(digitalRead(${p}) == 1)`, rs: `(digital_read(${p}) == 1)` }[lang]; }
    case 'aread': { const p = lit(lang, F('pin')); return { py: `_ad(${p})`, cpy: `_ad(${p})`, cpp: `(analogRead(${p}) * 100.0 / 4095.0)`, c: `(analogRead(${p}) * 100.0 / 4095.0)`, js: `(analogRead(${p}) * 100)`, lua: `(analogRead(${p}) * 100 / 4095)`, bas: `(AREAD(${p}) * 100 / 4095)`, go: `(float64(analogRead(${p})) * 100.0 / 4095.0)`, rs: `(analog_read(${p}) as f32 * 100.0 / 4095.0)` }[lang]; }
    case 'cmp': return `(${V('a')} ${CMP(lang)[F('op')]} ${V('b')})`;
    case 'and': return `(${V('a')} ${LOGIC(lang).and} ${V('b')})`;
    case 'or': return `(${V('a')} ${LOGIC(lang).or} ${V('b')})`;
    case 'not': return `(${LOGIC(lang).not}${V('a')})`;
    case 'arith': {
      const op = F('op'), a = V('a'), bb = V('b');
      if(op === '%') return { lua: `(${a} % ${bb})`, bas: `(${a} MOD ${bb})`, py: `(${a} % ${bb})`, cpy: `(${a} % ${bb})`, go: `(float64(int(${a}) % int(${bb})))`, rs: `((${a} as i32 % ${bb} as i32) as f32)`, cpp: `fmod(${a}, ${bb})`, c: `fmod(${a}, ${bb})`, js: `(${a} % ${bb})` }[lang];
      return `(${a} ${op} ${bb})`;
    }
    case 'random': { const a = V('a'), bb = V('b'); return { py: `random.randint(${a}, ${bb})`, cpy: `random.randint(${a}, ${bb})`, cpp: `random(${a}, (${bb}) + 1)`, c: `random(${a}, (${bb}) + 1)`, js: `Math.floor(${a} + Math.random() * ((${bb}) - (${a}) + 1))`, lua: `math.random(${a}, ${bb})`, bas: `RANDOM(${a}, ${bb} + 1)`, go: `float64(random(${a}, ${bb}))`, rs: `(random_range(${a} as i32, ${bb} as i32) as f32)` }[lang]; }
    case 'map': { const v = V('v'), a = V('a'), bb = V('b'), c = V('c'), d = V('d'); return `((${v} - ${a}) * (${d} - ${c}) / (${bb} - ${a}) + ${c})`; }
    case 'join': {
      const a = V('a'), bb = V('b');
      return { py: `str(${a}) + str(${bb})`, cpy: `str(${a}) + str(${bb})`, cpp: `(String(${a}) + String(${bb}))`, c: `"${'%s%s'}"`, js: `(String(${a}) + String(${bb}))`, lua: `(tostring(${a}) .. tostring(${bb}))`, bas: `((${a} + "") + ${bb})`, go: `(fmt.Sprint(${a}) + fmt.Sprint(${bb}))`, rs: `format!("{}{}", ${a}, ${bb})` }[lang];
    }
    case 'touched': ctx.touch = true; return { py: '_touched()', cpy: '_touched()', cpp: 'touched()', c: 'touched()', js: '_t.touched()', lua: '(touch.get() ~= nil)', bas: 'TOUCHED()', go: 'ts.Touched()', rs: 'ts.touched()' }[lang];
    case 'touchx': ctx.touch = true; return { py: '_tp[0]', cpy: '_tp[0]', cpp: '_tx', c: '_tx', js: '_t.getPoint().x', lua: '(touch.get())', bas: 'TOUCHX()', go: 'float64(ts.GetPoint().X)', rs: '(ts.get_point().x as f32)' }[lang];
    case 'touchy': ctx.touch = true; return { py: '_tp[1]', cpy: '_tp[1]', cpp: '_ty', c: '_ty', js: '_t.getPoint().y', lua: '(select(2, touch.get()))', bas: 'TOUCHY()', go: 'float64(ts.GetPoint().Y)', rs: '(ts.get_point().y as f32)' }[lang];
  }
  return '0';
}
function ind(n){ return '    '.repeat(n); }
let uid = 0;
function stmts(lang, arr, ctx, n){
  const out = [];
  for(const b of arr) out.push(...stmt(lang, b, ctx, n));
  return out;
}
function body(lang, arr, ctx, n, empty){
  const s = stmts(lang, arr, ctx, n);
  return s.length ? s : [ind(n) + empty];
}
function stmt(lang, b, ctx, n){
  const I = ind(n), V = k => val(lang, b, k, ctx), F = k => b.f[k];
  const py = lang === 'py' || lang === 'cpy';
  const brace = ['cpp', 'c', 'js', 'go', 'rs'].includes(lang);
  const semi = ['cpp', 'c', 'js'].includes(lang) ? ';' : '';
  if(needsDisp.has(b.t)) ctx.disp = true;
  const col = F('c');
  switch(b.t){
    case 'forever': {
      if(py) return [I + 'while True:', ...body(lang, b.b1, ctx, n + 1, 'pass')];
      if(lang === 'lua') return [I + 'while true do', ...body(lang, b.b1, ctx, n + 1, '-- nada'), I + 'end'];
      if(lang === 'bas') return [I + 'DO', ...stmts(lang, b.b1, ctx, n), I + 'LOOP'];
      if(lang === 'go') return [I + 'for {', ...body(lang, b.b1, ctx, n + 1, '// nada'), I + '}'];
      if(lang === 'rs') return [I + 'loop {', ...body(lang, b.b1, ctx, n + 1, '// nada'), I + '}'];
      return [I + 'while (true) {', ...body(lang, b.b1, ctx, n + 1, '// nada'), I + '}'];
    }
    case 'repeat': {
      const k = 'i' + (++uid), nn = V('n');
      if(py) return [I + `for ${k} in range(int(${nn})):`, ...body(lang, b.b1, ctx, n + 1, 'pass')];
      if(lang === 'lua') return [I + `for ${k} = 1, ${nn} do`, ...body(lang, b.b1, ctx, n + 1, '-- nada'), I + 'end'];
      if(lang === 'bas') return [I + `FOR ${k.toUpperCase()} = 1 TO ${nn}`, ...stmts(lang, b.b1, ctx, n), I + 'NEXT'];
      if(lang === 'go') return [I + `for ${k} := 0; ${k} < int(${nn}); ${k}++ {`, ...body(lang, b.b1, ctx, n + 1, '// nada'), I + '}'];
      if(lang === 'rs') return [I + `for ${k} in 0..(${nn} as i32) {`, ...body(lang, b.b1, ctx, n + 1, '// nada'), I + '}'];
      if(lang === 'js') return [I + `for (let ${k} = 0; ${k} < ${nn}; ${k}++) {`, ...body(lang, b.b1, ctx, n + 1, '// nada'), I + '}'];
      return [I + `for (int ${k} = 0; ${k} < ${nn}; ${k}++) {`, ...body(lang, b.b1, ctx, n + 1, '// nada'), I + '}'];
    }
    case 'while': {
      const c = V('c');
      if(py) return [I + `while ${c}:`, ...body(lang, b.b1, ctx, n + 1, 'pass')];
      if(lang === 'lua') return [I + `while ${c} do`, ...body(lang, b.b1, ctx, n + 1, '-- nada'), I + 'end'];
      if(lang === 'bas') return [I + `WHILE ${c}`, ...stmts(lang, b.b1, ctx, n), I + 'WEND'];
      if(lang === 'go') return [I + `for ${c} {`, ...body(lang, b.b1, ctx, n + 1, '// nada'), I + '}'];
      return [I + `while (${c}) {`, ...body(lang, b.b1, ctx, n + 1, '// nada'), I + '}'];
    }
    case 'if': case 'ifelse': {
      const c = V('c'), two = b.t === 'ifelse';
      if(py) return [I + `if ${c}:`, ...body(lang, b.b1, ctx, n + 1, 'pass'), ...(two ? [I + 'else:', ...body(lang, b.b2, ctx, n + 1, 'pass')] : [])];
      if(lang === 'lua') return [I + `if ${c} then`, ...body(lang, b.b1, ctx, n + 1, '-- nada'), ...(two ? [I + 'else', ...body(lang, b.b2, ctx, n + 1, '-- nada')] : []), I + 'end'];
      if(lang === 'bas'){ const id = ++uid; return [I + `IF NOT (${c}) THEN GOTO ELSE${id}`, ...stmts(lang, b.b1, ctx, n), I + `GOTO END${id}`, I + `ELSE${id}:`, ...(two ? stmts(lang, b.b2, ctx, n) : []), I + `END${id}:`]; }
      if(lang === 'go' || lang === 'rs') return [I + `if ${c} {`, ...body(lang, b.b1, ctx, n + 1, '// nada'), ...(two ? [I + '} else {', ...body(lang, b.b2, ctx, n + 1, '// nada')] : []), I + '}'];
      return [I + `if (${c}) {`, ...body(lang, b.b1, ctx, n + 1, '// nada'), ...(two ? [I + '} else {', ...body(lang, b.b2, ctx, n + 1, '// nada')] : []), I + '}'];
    }
    case 'wait': { const ms = V('ms'); return [I + ({ py: `time.sleep_ms(int(${ms}))`, cpy: `time.sleep((${ms}) / 1000)`, cpp: `delay(${ms});`, c: `delay(${ms});`, js: `await delay(${ms});`, lua: `delay(${ms})`, bas: `DELAY ${ms}`, go: `delay(${ms})`, rs: `delay(${ms} as u32);` }[lang])]; }
    case 'pinmode': { const p = lit(lang, F('pin')), m = F('mode'); return [I + ({
      py: `Pin(${p}, Pin.${m === 'OUTPUT' ? 'OUT' : 'IN'}${m === 'INPUT_PULLUP' ? ', Pin.PULL_UP' : ''})`, cpy: `_mode(${p}, ${m === 'OUTPUT' ? 1 : m === 'INPUT_PULLUP' ? 2 : 0})`, cpp: `pinMode(${p}, ${m});`, c: `pinMode(${p}, ${m});`, js: `pinMode(${p}, ${m});`, lua: `pinMode(${p}, ${m})`, bas: `PINMODE ${p}, ${m}`, go: `pinMode(${p}, ${m})`, rs: `pin_mode(${p}, ${m});` }[lang])]; }
    case 'write': { const p = lit(lang, F('pin')), v = F('lv'); return [I + ({ py: `_wr(${p}, ${v})`, cpy: `_wr(${p}, ${v})`, cpp: `digitalWrite(${p}, ${v});`, c: `digitalWrite(${p}, ${v});`, js: `digitalWrite(${p}, ${v});`, lua: `digitalWrite(${p}, ${v})`, bas: `DWRITE ${p}, ${v}`, go: `digitalWrite(${p}, ${v})`, rs: `digital_write(${p}, ${v});` }[lang])]; }
    case 'pwm': { const p = lit(lang, F('pin')), v = V('v'); return [I + ({ py: `_pw(${p}, ${v})`, cpy: `_pw(${p}, ${v})`, cpp: `analogWrite(${p}, (${v}) * 255.0 / 100.0);`, c: `analogWrite(${p}, (${v}) * 255.0 / 100.0);`, js: `analogWrite(${p}, (${v}) / 100);`, lua: `analogWrite(${p}, (${v}) * 255 // 100)`, bas: `PWM ${p}, (${v}) * 255 / 100`, go: `analogWrite(${p}, int((${v}) * 255.0 / 100.0))`, rs: `analog_write(${p}, ((${v}) * 255.0 / 100.0) as i32);` }[lang])]; }
    case 'servo': { const p = lit(lang, F('pin')), a = V('a'); return [I + ({ py: `_sv(${p}, ${a})`, cpy: `_sv(${p}, ${a})`, cpp: `servoWrite(${p}, ${a});`, c: `servoWrite(${p}, ${a});`, js: `servoWrite(${p}, ${a});`, lua: `servo.write(${p}, ${a})`, bas: `SERVO ${p}, ${a}`, go: `servoWrite(${p}, int(${a}))`, rs: `servo_write(${p}, ${a} as i32);` }[lang])]; }
    case 'tone': { const p = lit(lang, F('pin')), f = V('f'), ms = V('ms'); return [I + ({ py: `_tn(${p}, ${f}, ${ms})`, cpy: `_tn(${p}, ${f}, ${ms})`, cpp: `tone(${p}, ${f}, ${ms});`, c: `tone(${p}, ${f}, ${ms});`, js: `tone(${p}, ${f}, ${ms});`, lua: `tone({${p}, ${f}, ${ms}})`, bas: `TONE ${p}, ${f}, ${ms}`, go: `tone(${p}, int(${f}))`, rs: `tone_ms(${p}, ${f} as i32, ${ms} as i32);` }[lang])]; }
    case 'setvar': { const x = ident(F('name')), v = V('v'); ctx.vars.add(x); return [I + ({ py: `${x} = ${v}`, cpy: `${x} = ${v}`, cpp: `${x} = ${v};`, c: `${x} = ${v};`, js: `${x} = ${v};`, lua: `${x} = ${v}`, bas: `${x.toUpperCase()} = ${v}`, go: `${x} = ${v}`, rs: `${x} = ${v};` }[lang])]; }
    case 'changevar': { const x = ident(F('name')), v = V('v'); ctx.vars.add(x); const X = lang === 'bas' ? x.toUpperCase() : x; return [I + ({ cpp: `${x} += ${v};`, c: `${x} += ${v};`, js: `${x} += ${v};`, rs: `${x} += ${v};`, py: `${x} += ${v}`, cpy: `${x} += ${v}`, lua: `${x} = ${x} + ${v}`, bas: `${X} = ${X} + ${v}`, go: `${x} += ${v}` }[lang])]; }
    case 'print': {
      const ch = b.v.v;
      if(lang === 'c'){
        // printf: achata "juntar" em formato + argumentos
        const parts = [];
        const flat = bb => { if(bb && bb.t === 'join'){ flat(bb.v.a || { t: 'text', f: { t: bb.f.a }, v: {}, _lit: true }); flat(bb.v.b || { t: 'text', f: { t: bb.f.b }, v: {}, _lit: true }); } else parts.push(bb); };
        if(ch) flat(ch); else parts.push({ _lit: true, f: { t: b.f.v }, t: 'text' });
        const fmt = parts.map(p => (p.t === 'text' ? '%s' : '%g')).join('');
        const args = parts.map(p => p.t === 'text' ? lit(lang, p.f.t, true) : `(double)(${expr(lang, p, ctx)})`);
        return [I + `printf("${fmt}\\n", ${args.join(', ')});`];
      }
      const v = V('v');
      return [I + ({ py: `print(${v})`, cpy: `print(${v})`, cpp: `Serial.println(${v});`, js: `console.log(${v});`, lua: `print(${v})`, bas: `PRINT ${v}`, go: `println(${v})`, rs: `println!("{}", ${v});` }[lang])];
    }
    case 'clear': ctx.disp = true; return [I + ({ py: `tft.fill(${col})`, cpy: `tft.fill(${col})`, cpp: `tft.fillScreen(${col});`, c: `tft_fill(${col});`, js: `tft.fillScreen(${col});`, lua: `tft.fill(${col})`, bas: `CLS ${col}`, go: `tft.FillScreen(${col})`, rs: `tft.fill_screen(${col});` }[lang])];
    case 'drawtext': { const t = V('t'), x = V('x'), y = V('y'); ctx.disp = true; return [I + ({ py: `tft.text(font, str(${t}), int(${x}), int(${y}), ${col})`, cpy: `tft.text(font, str(${t}), int(${x}), int(${y}), ${col})`, cpp: `tft.setTextColor(${col}); tft.drawString(String(${t}), ${x}, ${y});`, c: `tft_text(${t}, ${x}, ${y}, ${col});`, js: `tft.setTextColor(${col}); tft.drawString(String(${t}), ${x}, ${y});`, lua: `tft.text(tostring(${t}), ${x}, ${y}, ${col})`, bas: `TEXT ${x}, ${y}, ${t}, ${col}`, go: `tft.SetTextColor(${col}); tft.DrawString(fmt.Sprint(${t}), int(${x}), int(${y}))`, rs: `tft.set_text_color(${col}); tft.draw_string(&format!("{}", ${t}), ${x} as i32, ${y} as i32);` }[lang])]; }
    case 'rect': { const x = V('x'), y = V('y'), w = V('w'), h = V('h'); return [I + ({ py: `tft.fill_rect(int(${x}), int(${y}), int(${w}), int(${h}), ${col})`, cpy: `tft.fill_rect(int(${x}), int(${y}), int(${w}), int(${h}), ${col})`, cpp: `tft.fillRect(${x}, ${y}, ${w}, ${h}, ${col});`, c: `tft_rect(${x}, ${y}, ${w}, ${h}, ${col});`, js: `tft.fillRect(${x}, ${y}, ${w}, ${h}, ${col});`, lua: `tft.rect(${x}, ${y}, ${w}, ${h}, ${col}, true)`, bas: `RECT ${x}, ${y}, ${w}, ${h}, ${col}, 1`, go: `tft.FillRect(int(${x}), int(${y}), int(${w}), int(${h}), ${col})`, rs: `tft.fill_rect(${x} as i32, ${y} as i32, ${w} as i32, ${h} as i32, ${col});` }[lang])]; }
    case 'circle': { const x = V('x'), y = V('y'), r = V('r'); return [I + ({ py: `tft.fill_circle(int(${x}), int(${y}), int(${r}), ${col})`, cpy: `tft.fill_circle(int(${x}), int(${y}), int(${r}), ${col})`, cpp: `tft.fillCircle(${x}, ${y}, ${r}, ${col});`, c: `tft_circle(${x}, ${y}, ${r}, ${col});`, js: `tft.fillCircle(${x}, ${y}, ${r}, ${col});`, lua: `tft.circle(${x}, ${y}, ${r}, ${col}, true)`, bas: `CIRCLE ${x}, ${y}, ${r}, ${col}, 1`, go: `tft.FillCircle(int(${x}), int(${y}), int(${r}), ${col})`, rs: `tft.fill_circle(${x} as i32, ${y} as i32, ${r} as i32, ${col});` }[lang])]; }
    case 'line': { const x1 = V('x1'), y1 = V('y1'), x2 = V('x2'), y2 = V('y2'); return [I + ({ py: `tft.line(int(${x1}), int(${y1}), int(${x2}), int(${y2}), ${col})`, cpy: `tft.line(int(${x1}), int(${y1}), int(${x2}), int(${y2}), ${col})`, cpp: `tft.drawLine(${x1}, ${y1}, ${x2}, ${y2}, ${col});`, c: `tft_line(${x1}, ${y1}, ${x2}, ${y2}, ${col});`, js: `tft.drawLine(${x1}, ${y1}, ${x2}, ${y2}, ${col});`, lua: `tft.line(${x1}, ${y1}, ${x2}, ${y2}, ${col})`, bas: `LINE ${x1}, ${y1}, ${x2}, ${y2}, ${col}`, go: `tft.DrawLine(int(${x1}), int(${y1}), int(${x2}), int(${y2}), ${col})`, rs: `tft.draw_line(${x1} as i32, ${y1} as i32, ${x2} as i32, ${y2} as i32, ${col});` }[lang])]; }
  }
  return [I + '// bloco sem tradução: ' + b.t];
}
function usedKinds(arr, set){ for(const b of arr){ set.add(b.t); for(const k in b.v) usedKinds([b.v[k]], set); usedKinds(b.b1, set); usedKinds(b.b2, set); } return set; }

function generate(lang){
  const ctx = { vars: new Set(), disp: false, touch: false };
  const scripts = WS.scripts.filter(sc => sc.blocks.length);
  const all = []; scripts.forEach(sc => all.push(...usedKinds(sc.blocks, new Set())));
  const used = new Set(all);
  // sequência principal: scripts que começam com "quando iniciar" (ou todos se não houver)
  const roots = scripts.filter(sc => sc.blocks[0].t === 'start');
  const main = (roots.length ? roots : scripts).flatMap(sc => sc.blocks.filter(b => b.t !== 'start'));
  const fi = main.findIndex(b => b.t === 'forever');
  const pre = fi < 0 ? main : main.slice(0, fi), loopBody = fi < 0 ? [] : main[fi].b1;
  const setupFam = lang === 'cpp' || lang === 'c';
  const isPy = lang === 'py' || lang === 'cpy';
  const hasD = [...used].some(t => needsDisp.has(t)), hasT = [...used].some(t => needsTouch.has(t));
  const touchWanted = hasT;
  const pwmU = used.has('pwm'), wrU = used.has('write') || used.has('pinmode'), rdU = used.has('read'), adU = used.has('aread'), svU = used.has('servo'), tnU = used.has('tone'), rndU = used.has('random');
  let head = [], foot = [];
  uid = 0;
  const bodyLines = (arr, n) => stmts(lang, arr, ctx, n);
  const V = [...ctx.vars];
  const declare = () => {
    const vs = [...ctx.vars];
    return vs;
  };
  if(isPy){
    const cp = lang === 'cpy';
    const bodyMain = [...bodyLines(pre, 0), ...(fi >= 0 ? bodyLines([main[fi]], 0) : [])];
    head.push(cp ? 'import time, board, digitalio, analogio, pwmio' : 'from machine import Pin, ADC, PWM\nimport time');
    if(rndU) head.push('import random');
    if(hasD){ head.push('import st7789'); if(!cp) head.push('import vga1_8x8 as font'); else head.push('import vga1_8x8 as font'); head.push('tft = st7789.ST7789(None, 240, 320, rotation=0)'); }
    if(touchWanted){ head.push('from xpt2046 import Touch', '_t = Touch(None)', '_tp = None', 'def _touched():', '    global _tp', '    _tp = _t.get_touch()', '    return _tp is not None'); }
    if(cp){
      head.push('_pins = {}', 'def _pin(n):', '    if n not in _pins:', '        _pins[n] = digitalio.DigitalInOut(getattr(board, "D%d" % n))', '    return _pins[n]');
      if(wrU || rdU) head.push('def _mode(n, m):', '    p = _pin(n)', '    p.direction = digitalio.Direction.OUTPUT if m == 1 else digitalio.Direction.INPUT', '    if m == 2:', '        p.pull = digitalio.Pull.UP');
      head.push('def _wr(n, v):', '    p = _pin(n)', '    p.direction = digitalio.Direction.OUTPUT', '    p.value = bool(v)');
      head.push('def _rd(n):', '    p = _pin(n)', '    p.direction = digitalio.Direction.INPUT', '    return p.value');
      if(adU) head.push('def _ad(n):', '    return analogio.AnalogIn(getattr(board, "D%d" % n)).value * 100 // 65535');
      if(pwmU) head.push('def _pw(n, v):', '    pwmio.PWMOut(getattr(board, "D%d" % n), frequency=1000, duty_cycle=int(v * 65535 / 100))');
      if(svU) head.push('def _sv(n, a):', '    pwmio.PWMOut(getattr(board, "D%d" % n), frequency=50, duty_cycle=int((0.5 + a / 180 * 2) / 20 * 65535))');
      if(tnU) head.push('def _tn(n, f, ms):', '    pwmio.PWMOut(getattr(board, "D%d" % n), frequency=int(f), duty_cycle=32768)', '    time.sleep(ms / 1000)');
    } else {
      if(wrU) head.push('def _wr(n, v):', '    Pin(n, Pin.OUT).value(v)');
      if(rdU) head.push('def _rd(n):', '    return Pin(n, Pin.IN).value()');
      if(adU) head.push('def _ad(n):', '    return ADC(Pin(n)).read() * 100 // 4095');
      if(pwmU) head.push('def _pw(n, v):', '    PWM(Pin(n), freq=1000).duty(int(v * 1023 / 100))');
      if(svU) head.push('def _sv(n, a):', '    PWM(Pin(n), freq=50).duty(int(25 + a / 180 * 103))');
      if(tnU) head.push('def _tn(n, f, ms):', '    PWM(Pin(n), freq=int(f), duty=512)', '    time.sleep_ms(int(ms))', '    PWM(Pin(n), freq=int(f), duty=0)');
    }
    const vars = [...ctx.vars].map(v => `${v} = 0`);
    return [...head, ...vars, '', ...bodyMain, ''].join('\n');
  }
  if(setupFam){
    const cpp = lang === 'cpp';
    const setupL = bodyLines(pre, 1), loopL = bodyLines(loopBody, 1);
    const vars = [...ctx.vars].map(v => `double ${v} = 0;`);
    const out = [];
    if(cpp && hasD) out.push('#include <TFT_eSPI.h>', 'TFT_eSPI tft = TFT_eSPI();');
    if(!cpp && hasD) out.push('// Display via API do simulador (tft_*)');
    if(touchWanted){ if(cpp){ out.push('uint16_t _tx = 0, _ty = 0;', 'bool touched() { return tft.getTouch(&_tx, &_ty); }'); } else out.push('uint16_t _tx = 0, _ty = 0;', 'int touched() { return tft_touched(&_tx, &_ty); }'); }
    out.push(...vars);
    out.push('void setup() {');
    if(cpp && used.has('print')) out.push('    Serial.begin(115200);');
    if(hasD) out.push(cpp ? '    tft.init();' : '    tft_init();');
    out.push(...setupL, '}', 'void loop() {', ...loopL, '}');
    return out.join('\n') + '\n';
  }
  // linguagens sequenciais: js, lua, bas, go, rs
  const seq = bodyLines(main.length ? [...pre, ...(fi >= 0 ? [main[fi]] : [])] : [], lang === 'go' || lang === 'rs' ? 1 : 0);
  const vars = [...ctx.vars];
  if(lang === 'js'){
    const o = [];
    if(hasD) o.push('const tft = display();');
    if(touchWanted) o.push('const _t = touch();');
    vars.forEach(v => o.push(`let ${v} = 0;`));
    return [...o, ...seq, ''].join('\n');
  }
  if(lang === 'lua'){
    const o = [];
    vars.forEach(v => o.push(`${v} = 0`));
    return [...o, ...seq, ''].join('\n');
  }
  if(lang === 'bas'){
    const lines = [];
    vars.forEach(v => lines.push(`${v.toUpperCase()} = 0`));
    lines.push(...seq);
    return lines.join('\n') + '\n';
  }
  if(lang === 'go'){
    const o = ['package main', '', 'import "fmt"', 'var _ = fmt.Sprint', ''];
    o.push('func main() {');
    if(hasD) o.push('    tft := Display()');
    if(touchWanted) o.push('    ts := Touch()');
    vars.forEach(v => o.push(`    var ${v} float64 = 0`));
    o.push(...seq, '}');
    return o.join('\n') + '\n';
  }
  if(lang === 'rs'){
    const o = ['fn main() {'];
    if(hasD) o.push('    let tft = display();');
    if(touchWanted) o.push('    let ts = touch();');
    vars.forEach(v => o.push(`    let mut ${v}: f32 = 0.0;`));
    o.push(...seq, '}');
    return o.join('\n') + '\n';
  }
  return '';
}
/* o gerador C usa tft_* do HAL: acrescenta helpers de toque quando necessário */
window.KEZLE_C_EXTRA = { tft_touched: null };

/* ---------- UI da aba ---------- */
function build(){
  const nav = document.createElement('button');
  nav.className = 'navBtn'; nav.dataset.v = 'blocks'; nav.innerHTML = '<span class="ic">🧩</span>Programar em Blocos';
  const side = document.getElementById('side');
  side.insertBefore(nav, side.querySelector('[data-v="py"]').nextSibling);
  nav.onclick = () => switchView('blocks');
  const view = document.createElement('div'); view.className = 'view'; view.id = 'v-blocks';
  document.getElementById('views').appendChild(view);
  view.innerHTML = `<div class="vpad" style="padding-bottom:0">
    <div class="pgTitle">🧩 Programação em Blocos <span class="tag c1">estilo Scratch · 9 linguagens</span></div>
    <div class="pgSub">Arraste blocos da esquerda, encaixe em pilha, solte valores nos encaixes. O código aparece ao vivo na linguagem escolhida — e roda na bancada.</div>
    <div class="searchRow" style="flex-wrap:wrap;gap:8px"><label class="small">Gerar em:</label><select id="bkLang">${Object.keys(L).map(k => `<option value="${k}">${(KEZLE_LANGS[k] || {}).ico || ''} ${L[k]}</option>`).join('')}</select>
      <button class="btn prime" id="bkRun">▶ Rodar na bancada</button><button class="btn" id="bkSend">💻 Abrir no editor de código</button><button class="btn" id="bkCopy">📋 Copiar</button><button class="btn" id="bkEx1">✨ Exemplo: piscar LED</button><button class="btn" id="bkEx2">🎨 Exemplo: pintar na tela</button><button class="btn danger" id="bkClear">🧹 Limpar</button></div>
    <div class="bk-wrap" style="margin-top:8px"><div class="bk-pal" id="bkPal"></div><div class="bk-ws" id="bkWs"><div class="inner" id="bkInner"></div></div><div class="bk-code"><div class="small" id="bkInfo"></div><pre id="bkCode"></pre></div></div></div>`;
  ui = { pal: document.getElementById('bkPal'), ws: document.getElementById('bkWs'), inner: document.getElementById('bkInner'), code: document.getElementById('bkCode'), lang: document.getElementById('bkLang') };
  renderPalette(); wire();
  ui.lang.onchange = regen;
  document.getElementById('bkSend').onclick = () => sendToEditor(false);
  document.getElementById('bkRun').onclick = () => sendToEditor(true);
  document.getElementById('bkCopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(ui.code.textContent); toast('Código copiado', 'ok'); };
  document.getElementById('bkClear').onclick = () => { WS.scripts = []; changed(); };
  document.getElementById('bkEx1').onclick = () => { loadWS(EX1()); changed(); };
  document.getElementById('bkEx2').onclick = () => { loadWS(EX2()); changed(); };
}
function sendToEditor(run){
  const lang = ui.lang.value, code = generate(lang);
  $('#pyLang').value = lang; refreshTpl(); $('#pyEditor').value = code; syncGutter(); renderHwCheck();
  switchView('py'); toast('Código ' + L[lang] + ' enviado ao editor', 'ok');
  if(run){ if(!SIM.on) toast('Ligue a ⏻ Simulação antes de rodar', 'warn'); else runCode(); }
}
function regen(){
  if(!ui) return;
  const lang = ui.lang.value;
  let code = '';
  try { code = generate(lang); } catch(e){ code = '// erro ao gerar: ' + e.message; }
  ui.code.textContent = code || '// arraste blocos para começar';
  document.getElementById('bkInfo').textContent = L[lang] + ' · ' + WS.scripts.reduce((n, s) => n + count(s.blocks), 0) + ' blocos';
}
const count = arr => arr.reduce((n, b) => n + 1 + count(b.b1) + count(b.b2) + Object.values(b.v).reduce((m, x) => m + count([x]), 0), 0);
let saveT = null;
function autosave(){ clearTimeout(saveT); saveT = setTimeout(() => { try { DB.set('klp_blocks_' + (USER || 'anon'), WS.scripts); } catch(e){} }, 400); }
function loadWS(scripts){ WS.scripts = JSON.parse(JSON.stringify(scripts || [])); }
const S = (type, f, v, b1, b2) => Object.assign(mk(type), { f: Object.assign(mk(type).f, f || {}), v: v || {}, b1: b1 || [], b2: b2 || [] });
const EX1 = () => [{ x: 30, y: 30, blocks: [S('start'), S('pinmode', { pin: 2, mode: 'OUTPUT' }), S('forever', {}, {}, [S('write', { pin: 2, lv: '1' }), S('wait', { ms: 500 }), S('write', { pin: 2, lv: '0' }), S('wait', { ms: 500 })])] }];
const EX2 = () => [{ x: 30, y: 30, blocks: [S('start'), S('clear', { c: '0x0000' }), S('drawtext', { t: 'Toque na tela', x: 10, y: 8, c: '0xFFFF' }), S('forever', {}, {}, [S('if', {}, { c: mk('touched') }, [S('circle', { r: 5, c: '0xF800' }, { x: mk('touchx'), y: mk('touchy') })])])] }];
window.KezleBlocks = { serialize: () => JSON.parse(JSON.stringify(WS.scripts)), load: s => { loadWS(s); if(ui) changed(); }, generate, LANGS: L };
build();
const saved = DB.get('klp_blocks_' + (USER || 'anon'), null);
if(saved && saved.length) loadWS(saved); else loadWS(EX1());
renderWS(); regen();
const _sv = window.switchView;
window.switchView = function(v){ _sv(v); if(v === 'blocks'){ renderWS(); regen(); } };
})();
