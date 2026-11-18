/* =========================================================================
   Kezle Lab Pro — Bancada: protoboard realista, rotação, encaixe nos furos,
   fios por cima (dobráveis com alça), controles reais (botão, chave, DIP,
   potenciômetro, joystick, encoder, teclado), pinos visíveis, multímetro.
   ========================================================================= */
(function(){
'use strict';
const NS = 'http://www.w3.org/2000/svg';

/* ---------- CSS ---------- */
const css = document.createElement('style');
css.textContent = `
#wireLayer{position:absolute;left:0;top:0;pointer-events:none;z-index:6}
#wireLayer .hit,#wireLayer .handle{pointer-events:stroke;cursor:pointer}
#wireLayer .handle{pointer-events:all;cursor:grab}
#partLayer{z-index:2}
.part .pin{opacity:1!important;width:7px!important;height:7px!important;background:radial-gradient(circle at 35% 30%,#fff7d6,#d4af37 55%,#7a5d10);border:1px solid #3a2c05!important;box-shadow:0 0 0 1px #0006}
.part.isBoard .pin{opacity:0!important;width:5px!important;height:5px!important;background:transparent!important;border:none!important;box-shadow:none!important}
#bench.connectMode .part.isBoard .pin{opacity:.8!important;background:#d4af37!important;width:5px!important;height:5px!important;border-radius:1px!important}
#bench.connectMode .part.isBoard .pin:hover{background:#22d3ee!important;transform:scale(1.8)}
.part.plugged .pin.plug{background:radial-gradient(circle,#34d399,#047857);box-shadow:0 0 5px #34d399}
#bench.connectMode .pin{width:11px!important;height:11px!important}
.part .rotWrap{position:absolute;transform-origin:50% 50%}
.part .ctl{position:absolute;z-index:12;touch-action:none}
.cap-btn{border-radius:50%;background:radial-gradient(circle at 35% 30%,#555,#111);border:2px solid #000;box-shadow:0 3px 0 #000a,inset 0 2px 3px #8886;cursor:pointer;transition:transform .05s,box-shadow .05s}
.cap-btn.down{transform:translateY(2px);box-shadow:0 1px 0 #000a,inset 0 2px 3px #8886;background:radial-gradient(circle at 35% 30%,#444,#000)}
.cap-btn.latched{outline:2px solid var(--ac2)}
.sw-track{background:#222;border:1px solid #000;border-radius:4px;cursor:pointer}
.sw-thumb{position:absolute;top:1px;width:48%;height:calc(100% - 2px);background:linear-gradient(#e5e7eb,#9ca3af);border-radius:3px;transition:left .08s}
.dip-cell{position:absolute;background:#1d4ed8;border:1px solid #0b1e57;border-radius:2px;cursor:pointer}
.dip-cell i{position:absolute;left:1px;width:calc(100% - 2px);height:48%;background:#f3f4f6;border-radius:1px;transition:top .08s}
.knob{border-radius:50%;background:radial-gradient(circle at 35% 30%,#4b5563,#111827);border:2px solid #000;cursor:ns-resize;box-shadow:0 2px 4px #000a}
.knob i{position:absolute;left:50%;top:6%;width:2px;height:34%;background:#f9fafb;transform-origin:50% 150%;margin-left:-1px}
.stick-base{border-radius:50%;background:#111;border:2px solid #000}
.stick-top{position:absolute;border-radius:50%;background:radial-gradient(circle at 35% 30%,#666,#111);cursor:grab;box-shadow:0 2px 3px #000a}
.keycell{position:absolute;background:linear-gradient(#e5e7eb,#9ca3af);color:#111;font:bold 9px var(--mono);display:flex;align-items:center;justify-content:center;border-radius:3px;cursor:pointer;border:1px solid #4b5563;box-shadow:0 2px 0 #4b5563;user-select:none}
.keycell.down{transform:translateY(2px);box-shadow:none;background:#facc15}
.burnTag{position:absolute;left:50%;top:-22px;transform:translateX(-50%);background:#450a0a;border:1px solid #f87171;color:#fecaca;font:10px var(--mono);padding:1px 7px;border-radius:10px;z-index:20;white-space:nowrap}
#probe{position:absolute;z-index:30;pointer-events:none;background:#031b12;border:1px solid #34d399;color:#6ee7b7;font:11px var(--mono);padding:3px 9px;border-radius:10px;display:none;white-space:nowrap}
.elTable{width:100%;font:11px var(--mono);border-collapse:collapse;margin-top:6px}
.elTable td{padding:1px 4px;border-bottom:1px solid var(--line)}
.elTable td:last-child{text-align:right;color:var(--ac2)}
`;
document.head.appendChild(css);

/* ---------- geometria da protoboard (passo 8 px = 2,54 mm) ---------- */
window.boardLayout = function(def){
  const rows = def.kind === 'bb' ? 63 : (def.kind === 'b400' ? 30 : 17);
  const rails = def.kind !== 'mbb';
  const pitch = 8;
  const w = 48 + (rows - 1) * pitch;
  const leftY = rails ? 56 : 30;
  const rightY = leftY + 56;
  const h = rails ? 176 : rightY + 32;
  return { rows, rails, pitch, w, h, leftY, rightY, railYs: rails ? [12, 20, h - 20, h - 12] : [], x0: 24, x1: w - 24,
    railHoles: def.kind === 'bb' ? 50 : (def.kind === 'b400' ? 25 : 0) };
};
window.boardHoles = function(def){
  if(def._holes2) return def._holes2;
  const L = boardLayout(def);
  const cL = ['e', 'd', 'c', 'b', 'a'], cR = ['f', 'g', 'h', 'i', 'j'];
  const H = [];
  for(let i = 0; i < L.rows; i++){
    const x = L.x0 + i * L.pitch;
    for(let k = 0; k < 5; k++) H.push({ x, y: L.leftY + (2 - k) * 8, g: 'L' + (i + 1), n: cL[k] + (i + 1) });
    for(let k = 0; k < 5; k++) H.push({ x, y: L.rightY + (k - 2) * 8, g: 'R' + (i + 1), n: cR[k] + (i + 1) });
  }
  if(L.rails){
    const groups = Math.floor(L.railHoles / 5);
    const span = L.railHoles + (groups - 1);
    const off = Math.round(((L.x1 - L.x0) / L.pitch - (span - 1)) / 2) * L.pitch;
    for(let j = 0; j < L.railHoles; j++){
      const x = L.x0 + off + (j + Math.floor(j / 5)) * L.pitch;
      H.push({ x, y: L.railYs[0], g: 'V+S', n: '+' + (j + 1) });
      H.push({ x, y: L.railYs[1], g: 'GNS', n: '−' + (j + 1) });
      H.push({ x, y: L.railYs[2], g: 'V+I', n: '+' + (j + 1) });
      H.push({ x, y: L.railYs[3], g: 'GNI', n: '−' + (j + 1) });
    }
  }
  def._holes2 = H;
  def._holes = H;
  def.w = L.w; def.h = L.h;
  return H;
};
['bread830', 'bread400', 'minibb'].forEach(id => { const d = PARTMAP[id]; if(d){ delete d._holes; const L = boardLayout(d); d.w = L.w; d.h = L.h; } });

window.svgBoard = function(d){
  const L = boardLayout(d);
  const H = boardHoles(d);
  let s = '';
  // trilhas metálicas (por coluna de 5 furos) — dão o visual "em trilhas"
  for(let i = 0; i < L.rows; i++){
    const x = L.x0 + i * L.pitch;
    s += `<rect x="${x - 2.6}" y="${L.leftY - 18}" width="5.2" height="36" rx="2.2" fill="#d9d4c3"/>`;
    s += `<rect x="${x - 2.6}" y="${L.rightY - 18}" width="5.2" height="36" rx="2.2" fill="#d9d4c3"/>`;
  }
  // canal central
  const chY = L.leftY + 18, chH = L.rightY - 18 - chY;
  s += `<rect x="6" y="${chY}" width="${d.w - 12}" height="${chH}" fill="#b9b3a0"/><rect x="6" y="${chY + chH / 2 - 1}" width="${d.w - 12}" height="2" fill="#8f8a79"/>`;
  if(L.rails){
    const groups = Math.floor(L.railHoles / 5);
    const rr = H.filter(h => /^(V\+|GN)/.test(h.g));
    const ys = L.railYs;
    const first = rr[0].x, last = rr[rr.length - 1].x;
    [[ys[0], '#ef4444', '+'], [ys[1], '#2563eb', '−'], [ys[2], '#ef4444', '+'], [ys[3], '#2563eb', '−']].forEach(([y, c, t], k) => {
      s += `<rect x="${first - 8}" y="${y - 3.6}" width="${last - first + 16}" height="7.2" rx="3" fill="#d9d4c3"/>`;
      s += `<line x1="${first - 12}" y1="${y + (k % 2 === 0 ? -5.6 : 5.6)}" x2="${last + 12}" y2="${y + (k % 2 === 0 ? -5.6 : 5.6)}" stroke="${c}" stroke-width="1.4" opacity=".85"/>`;
      s += `<text x="${first - 18}" y="${y + 3}" font-size="9" font-weight="700" fill="${c}" text-anchor="middle">${t}</text>`;
      s += `<text x="${last + 18}" y="${y + 3}" font-size="9" font-weight="700" fill="${c}" text-anchor="middle">${t}</text>`;
    });
  }
  // furos
  for(const h of H) s += `<rect x="${h.x - 1.9}" y="${h.y - 1.9}" width="3.8" height="3.8" rx=".8" fill="#2a2a2a" stroke="#7a7561" stroke-width=".5"/>`;
  // numeração e letras
  for(let i = 0; i < L.rows; i++){
    const n = i + 1;
    if(n === 1 || n % 5 === 0){
      const x = L.x0 + i * L.pitch;
      s += `<text x="${x}" y="${L.leftY - 22}" font-size="5.5" fill="#6b6655" text-anchor="middle">${n}</text>`;
      s += `<text x="${x}" y="${L.rightY + 27}" font-size="5.5" fill="#6b6655" text-anchor="middle">${n}</text>`;
    }
  }
  ['a', 'b', 'c', 'd', 'e'].forEach((c, k) => { s += `<text x="12" y="${L.leftY + (4 - k) * 8 - 6 + 8.5}" font-size="6" fill="#6b6655" text-anchor="middle">${c}</text>`; });
  ['f', 'g', 'h', 'i', 'j'].forEach((c, k) => { s += `<text x="12" y="${L.rightY + (k - 2) * 8 + 2.2}" font-size="6" fill="#6b6655" text-anchor="middle">${c}</text>`; });
  return `<svg width="${d.w}" height="${d.h}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bbg${d.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5f2e9"/><stop offset="1" stop-color="#e3dfd1"/></linearGradient></defs>
    <rect x="0" y="0" width="${d.w}" height="${d.h}" rx="7" fill="url(#bbg${d.id})" stroke="#b9b3a0"/>
    <rect x="1.5" y="1.5" width="${d.w - 3}" height="${d.h - 3}" rx="6" fill="none" stroke="#fff" stroke-opacity=".7"/>
    ${s}<text x="${d.w / 2}" y="${L.rails ? 38 : 12}" font-size="6.5" fill="#8f8a79" text-anchor="middle" letter-spacing="1.5">KEZLE · ${d.n.toUpperCase()}</text></svg>`;
};

/* ---------- geometria dos pinos (grade 8 px) e rotação ---------- */
const _origPinOffsets = window.pinOffsets;
function rawOffsets(inst){
  const d = inst.def;
  if(d.kind === 'relay_mod' || d.cat === 'board') return _origPinOffsets(inst);
  const n = (d.pinNames && d.pinNames.length) || d.pins || 2;
  const arr = [];
  if(d.cat === 'mcu'){
    const rows = Math.ceil(n / 2);
    const need = 8 * Math.ceil((d.w - 16) / 8) + 16;
    if(d.w !== need) d.w = need;
    const hneed = 16 + (rows - 1) * 8 + 16;
    if(d.h < hneed) d.h = hneed;
    for(let i = 0; i < rows; i++) arr.push({ x: 8, y: 14 + i * 8 });
    for(let i = 0; i < n - rows; i++) arr.push({ x: d.w - 8, y: 14 + i * 8 });
    return arr;
  }
  // linha de pinos na borda inferior, passo 8 px, centralizada
  const per = Math.min(n, Math.max(2, Math.floor((d.w - 8) / 8) + 1));
  const rowsN = Math.ceil(n / per);
  if(rowsN === 1){
    const span = (n - 1) * 8;
    if(span + 10 > d.w) d.w = span + 12;
    const x0 = Math.round((d.w - span) / 2 / 4) * 4;
    for(let i = 0; i < n; i++) arr.push({ x: x0 + i * 8, y: d.h - 4 });
  } else {
    const span = (per - 1) * 8, x0 = Math.round((d.w - span) / 2 / 4) * 4;
    for(let i = 0; i < n; i++){ const r = Math.floor(i / per), c = i % per; arr.push({ x: x0 + c * 8, y: d.h - 4 - (rowsN - 1 - r) * 8 }); }
  }
  return arr;
}
function rotOff(o, w, h, rot){
  switch(rot){
    case 1: return { x: h - o.y, y: o.x };
    case 2: return { x: w - o.x, y: h - o.y };
    case 3: return { x: o.y, y: w - o.x };
  }
  return o;
}
window.pinOffsets = function(inst){
  const raw = rawOffsets(inst);
  const rot = (inst.rot || 0) & 3;
  if(!rot) return raw;
  return raw.map(o => rotOff(o, inst.def.w, inst.def.h, rot));
};
window.partBox = function(inst){
  const rot = (inst.rot || 0) & 3;
  return rot & 1 ? { w: inst.def.h, h: inst.def.w } : { w: inst.def.w, h: inst.def.h };
};
window.rotatePart = function(inst){
  inst.rot = ((inst.rot || 0) + 1) & 3;
  renderBench();
  if(typeof scheduleSaveBench === 'function') scheduleSaveBench();
  CIRCUIT.request();
};

/* ---------- postPart: rotação + controles reais ---------- */
const _postPart = window.postPart;
window.postPart = function(inst, div){
  _postPart(inst, div);
  const d = inst.def;
  const rot = (inst.rot || 0) & 3;
  const box = partBox(inst);
  div.style.width = box.w + 'px';
  div.style.height = box.h + 'px';
  // embrulha tudo que não é pino num container rotacionável
  const wrap = document.createElement('div');
  wrap.className = 'rotWrap';
  wrap.style.cssText = `left:${(box.w - d.w) / 2}px;top:${(box.h - d.h) / 2}px;width:${d.w}px;height:${d.h}px;transform:rotate(${rot * 90}deg)`;
  [...div.children].forEach(ch => { if(!ch.classList.contains('pin')) wrap.appendChild(ch); });
  div.insertBefore(wrap, div.firstChild);
  inst.wrap = wrap;
  div.classList.toggle('isBoard', d.cat === 'board');
  if(inst.state.burnt){ const t = document.createElement('div'); t.className = 'burnTag'; t.textContent = '🔥 queimado'; div.appendChild(t); }
  buildControls(inst, wrap);
};

function stop(e){ e.stopPropagation(); }
function ctl(wrap, css, cls){
  const c = document.createElement('div');
  c.className = 'ctl ' + (cls || '');
  c.style.cssText = css;
  ['mousedown', 'touchstart'].forEach(ev => c.addEventListener(ev, e => { if(BENCH.mode === 'erase') return; e.stopPropagation(); }, { passive: true }));
  wrap.appendChild(c);
  return c;
}
function selectInst(inst){
  BENCH.selWire = null; BENCH.sel = inst;
  $$('.part.sel').forEach(x => x.classList.remove('sel'));
  if(inst.el) inst.el.classList.add('sel');
  renderProps();
}
function buildControls(inst, wrap){
  const d = inst.def, st = inst.state;
  const W = d.w, H = d.h;
  const lockOn = () => BENCH.mode !== 'erase';
  if(d.kind === 'btn'){
    const c = ctl(wrap, `left:${W / 2 - 12}px;top:${H / 2 - 13}px;width:24px;height:24px`, 'cap-btn');
    const set = v => { st.pressed = v; c.classList.toggle('down', v); CIRCUIT.request(); };
    c.addEventListener('pointerdown', e => { if(!lockOn()) return; selectInst(inst); if(e.shiftKey){ st.latched = !st.latched; c.classList.toggle('latched', st.latched); CIRCUIT.request(); return; } c.setPointerCapture(e.pointerId); set(true); e.preventDefault(); });
    c.addEventListener('pointerup', () => set(false));
    c.addEventListener('pointercancel', () => set(false));
    c.title = 'Clique e segure para pressionar · Shift+clique trava';
  } else if(d.kind === 'sw'){
    const c = ctl(wrap, `left:${W / 2 - 16}px;top:${H / 2 - 7}px;width:32px;height:14px`, 'sw-track');
    const th = document.createElement('div'); th.className = 'sw-thumb'; c.appendChild(th);
    const upd = () => { th.style.left = st.sw ? '50%' : '1px'; };
    upd();
    c.addEventListener('pointerdown', e => { if(!lockOn()) return; selectInst(inst); st.sw = st.sw ? 0 : 1; upd(); CIRCUIT.request(); e.preventDefault(); });
    c.title = 'Clique para alternar';
  } else if(d.kind === 'dip'){
    const n = 4, cw = (W - 8) / n;
    st.dip = st.dip || Array(n).fill(0);
    for(let i = 0; i < n; i++){
      const c = ctl(wrap, `left:${4 + i * cw}px;top:6px;width:${cw - 2}px;height:${Math.max(18, H - 16)}px`, 'dip-cell');
      const k = document.createElement('i'); c.appendChild(k);
      const upd = () => { k.style.top = st.dip[i] ? '2px' : 'calc(52% - 2px)'; };
      upd();
      c.addEventListener('pointerdown', e => { if(!lockOn()) return; selectInst(inst); st.dip[i] ^= 1; upd(); CIRCUIT.request(); e.preventDefault(); });
    }
  } else if(d.kind === 'pot' || d.kind === 'enc'){
    const sl = /slide/.test(d.id);
    if(sl){
      const c = ctl(wrap, `left:4px;top:${H / 2 - 5}px;width:${W - 8}px;height:10px;background:#222;border-radius:3px;cursor:ew-resize`);
      const th = document.createElement('div'); th.style.cssText = 'position:absolute;top:-4px;width:10px;height:18px;background:linear-gradient(#e5e7eb,#9ca3af);border-radius:2px;border:1px solid #000'; c.appendChild(th);
      const upd = () => { th.style.left = ((W - 18) * clamp(+inst.props.pct, 0, 100) / 100) + 'px'; };
      upd();
      const mv = e => { const r = c.getBoundingClientRect(); const f = d.w ? ((e.clientX - r.left) / r.width) : 0.5; inst.props.pct = Math.round(clamp(f, 0, 1) * 100); upd(); CIRCUIT.request(); refreshPropSlider(inst); };
      c.addEventListener('pointerdown', e => { selectInst(inst); c.setPointerCapture(e.pointerId); mv(e); c.onpointermove = mv; });
      c.addEventListener('pointerup', () => { c.onpointermove = null; });
    } else {
      const R = Math.min(W, H) * 0.42;
      const c = ctl(wrap, `left:${W / 2 - R}px;top:${H / 2 - R}px;width:${R * 2}px;height:${R * 2}px`, 'knob');
      const ind = document.createElement('i'); c.appendChild(ind);
      const isEnc = d.kind === 'enc';
      const upd = () => { const a = isEnc ? ((st.encPos || 0) * 18) : (-135 + 2.7 * clamp(+inst.props.pct, 0, 100)); ind.style.transform = `rotate(${a}deg)`; };
      upd();
      let sy = 0, spct = 0, moved = false;
      c.addEventListener('pointerdown', e => { selectInst(inst); c.setPointerCapture(e.pointerId); sy = e.clientY; spct = +inst.props.pct || 0; moved = false; c.dataset.drag = 1; if(isEnc){ st.pressed = true; CIRCUIT.request(); } e.preventDefault(); });
      c.addEventListener('pointermove', e => {
        if(!c.dataset.drag) return;
        const dy = sy - e.clientY;
        if(Math.abs(dy) > 3) moved = true;
        if(isEnc){ if(Math.abs(dy) >= 8){ st.encPos = (st.encPos || 0) + Math.sign(dy); sy = e.clientY; st.pressed = false; upd(); stepEnc(inst, Math.sign(dy)); } }
        else { inst.props.pct = Math.round(clamp(spct + dy * 0.8, 0, 100)); upd(); CIRCUIT.request(); refreshPropSlider(inst); }
      });
      c.addEventListener('pointerup', () => { delete c.dataset.drag; if(isEnc){ st.pressed = false; CIRCUIT.request(); } });
      c.addEventListener('wheel', e => {
        e.preventDefault(); e.stopPropagation();
        const dir = e.deltaY < 0 ? 1 : -1;
        if(isEnc){ st.encPos = (st.encPos || 0) + dir; upd(); stepEnc(inst, dir); }
        else { inst.props.pct = Math.round(clamp((+inst.props.pct || 0) + dir * 3, 0, 100)); upd(); CIRCUIT.request(); refreshPropSlider(inst); }
      }, { passive: false });
      c.title = isEnc ? 'Arraste ↕ ou use a roda para girar · clique pressiona' : 'Arraste ↕ ou roda do mouse para girar';
    }
  } else if(d.kind === 'joy'){
    const R = Math.min(W, H) * 0.46;
    const base = ctl(wrap, `left:${W / 2 - R}px;top:${H / 2 - R}px;width:${R * 2}px;height:${R * 2}px`, 'stick-base');
    const tr = R * 0.55;
    const top = document.createElement('div'); top.className = 'stick-top'; top.style.cssText = `width:${tr * 2}px;height:${tr * 2}px;left:${R - tr}px;top:${R - tr}px`; base.appendChild(top);
    const setXY = (fx, fy) => { inst.props.jx = Math.round(fx * 100); inst.props.jy = Math.round(fy * 100); top.style.left = (R - tr + (fx - 0.5) * R * 1.1) + 'px'; top.style.top = (R - tr + (fy - 0.5) * R * 1.1) + 'px'; CIRCUIT.request(); };
    setXY(0.5, 0.5);
    const mv = e => { const r = base.getBoundingClientRect(); const fx = clamp((e.clientX - r.left) / r.width, 0, 1), fy = clamp((e.clientY - r.top) / r.height, 0, 1); setXY(fx, fy); };
    base.addEventListener('pointerdown', e => { selectInst(inst); base.setPointerCapture(e.pointerId); mv(e); base.onpointermove = mv; st.pressed = e.shiftKey; CIRCUIT.request(); e.preventDefault(); });
    const rel = () => { base.onpointermove = null; setXY(0.5, 0.5); st.pressed = false; CIRCUIT.request(); };
    base.addEventListener('pointerup', rel); base.addEventListener('pointercancel', rel);
    base.title = 'Arraste o manche · segure Shift para pressionar o botão';
  } else if(d.kind === 'key'){
    const labels = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];
    const cw = (W - 10) / 4, ch = (H - 10) / 4;
    st.keys = st.keys || {};
    wrap.querySelectorAll('.partBody').forEach(b => b.style.opacity = '.0');
    const bg = ctl(wrap, `left:0;top:0;width:${W}px;height:${H}px;background:#374151;border-radius:6px;border:1px solid #111;z-index:11`);
    bg.style.pointerEvents = 'none';
    for(let r = 0; r < 4; r++) for(let c = 0; c < 4; c++){
      const k = ctl(wrap, `left:${5 + c * cw + 1}px;top:${5 + r * ch + 1}px;width:${cw - 2}px;height:${ch - 2}px`, 'keycell');
      k.textContent = labels[r * 4 + c];
      const key = r + ',' + c;
      const set = v => { if(v) st.keys[key] = 1; else delete st.keys[key]; k.classList.toggle('down', v); CIRCUIT.request(); };
      k.addEventListener('pointerdown', e => { selectInst(inst); k.setPointerCapture(e.pointerId); set(true); e.preventDefault(); });
      k.addEventListener('pointerup', () => set(false)); k.addEventListener('pointercancel', () => set(false));
    }
  } else if(d.sk === 'motion' || d.sk === 'touch' || /^(ttp223)$/.test(d.id)){
    const c = ctl(wrap, `left:${W / 2 - 14}px;top:${H / 2 - 14}px;width:28px;height:28px;border-radius:50%;background:#ffffff22;border:1px dashed #fff8;cursor:pointer`);
    c.title = d.sk === 'motion' ? 'Clique para simular movimento' : 'Toque aqui';
    const set = v => { st.pressed = v; inst.state.vals.touch = v ? 1 : 0; if(d.sk === 'motion') inst.state.vals.motion = v ? 1 : 0; c.style.background = v ? '#facc15aa' : '#ffffff22'; CIRCUIT.request(); };
    c.addEventListener('pointerdown', e => { selectInst(inst); c.setPointerCapture(e.pointerId); set(true); });
    c.addEventListener('pointerup', () => set(false));
  }
}
function stepEnc(inst, dir){ CIRCUIT.request(); setTimeout(() => CIRCUIT.request(), 30); }
function refreshPropSlider(inst){
  const pc = $('#pc');
  if(pc && BENCH.sel === inst){ pc.value = inst.props.pct; const l = $('#pcV'); if(l) l.textContent = Math.round(inst.props.pct); }
}

/* ---------- attachPart: arrastar (mouse/toque), encaixe, girar, apagar ---------- */
window.attachPart = function(inst, div){
  div.addEventListener('pointerdown', function(e){
    if(e.target.classList.contains('pin')) return;
    if(e.button != null && e.button !== 0) return;
    if(BENCH.mode === 'erase'){ removePart(inst); return; }
    selectInst(inst);
    if(BENCH.mode !== 'move') return;
    const sx = e.clientX, sy = e.clientY, ox = inst.x, oy = inst.y;
    // arrastar protoboard leva junto as peças encaixadas
    let riders = [];
    if(inst.def.cat === 'board'){
      const nets = CIRCUIT.buildNets();
      riders = nets.plugs.filter(pl => pl.board === inst.id).map(pl => pl.part).filter((v, i, a) => a.indexOf(v) === i)
        .map(id => BENCH.parts.find(p => p.id === id)).filter(Boolean).map(p => ({ p, x: p.x, y: p.y }));
    }
    let moved = false;
    div.setPointerCapture(e.pointerId);
    const bx = partBox(inst);
    const mm = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if(Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if(!moved) return;
      inst.x = clamp(ox + dx, 0, 1600 - bx.w);
      inst.y = clamp(oy + dy, 0, 1000 - bx.h);
      div.style.left = inst.x + 'px'; div.style.top = inst.y + 'px';
      for(const r of riders){ r.p.x = clamp(r.x + (inst.x - ox), 0, 1600 - r.p.def.w); r.p.y = clamp(r.y + (inst.y - oy), 0, 1000 - r.p.def.h); r.p.el.style.left = r.p.x + 'px'; r.p.el.style.top = r.p.y + 'px'; }
      drawWires();
    };
    const mu = () => {
      div.removeEventListener('pointermove', mm); div.removeEventListener('pointerup', mu); div.removeEventListener('pointercancel', mu);
      if(moved){
        if(inst.def.cat !== 'board') snapToBoard(inst);
        drawWires(); scheduleSaveBench(); CIRCUIT.request();
        updatePlugVisuals();
      }
    };
    div.addEventListener('pointermove', mm); div.addEventListener('pointerup', mu); div.addEventListener('pointercancel', mu);
    e.preventDefault();
  });
  div.addEventListener('dblclick', function(e){
    if(e.target.closest('.ctl')) return;
    const d = inst.def;
    if(d.kind === 'oled' || d.scr){ if(window.KezleScreens) KezleScreens.openMagnifier(inst); return; }
    if(d.kind === 'lcd'){ const t = prompt('Texto do LCD:', 'Ola, Kezle!'); if(t != null) lcdSetText(inst, t); }
    if(d.kind === 'led' && !inst.state.burnt){ /* LED só acende com corrente real */ serialOut('[bancada] LED acende apenas com corrente real — ligue-o a um circuito.', 'dim'); }
  });
  div.querySelectorAll('.pin').forEach(function(pd){
    const idx = +pd.dataset.i;
    pd.addEventListener('pointerdown', function(e){
      if(BENCH.mode !== 'connect') return;
      e.stopPropagation();
      BENCH.dragWire = { p: inst.id, i: idx, moved: false };
      startRubber(inst.id, idx, e);
    });
    pd.addEventListener('click', function(e){
      e.stopPropagation();
      if(BENCH.mode !== 'connect') return;
      if(BENCH.suppressClick){ BENCH.suppressClick = false; return; }
      pinClickConnect(inst, idx, pd);
    });
  });
};
function pinClickConnect(inst, idx, pd){
  if(!BENCH.pending){
    BENCH.pending = { p: inst.id, i: idx };
    if(pd) pd.classList.add('pending');
  } else {
    if(BENCH.pending.p !== inst.id || BENCH.pending.i !== idx) addWire(BENCH.pending, { p: inst.id, i: idx });
    $$('.pin.pending').forEach(x => x.classList.remove('pending'));
    BENCH.pending = null;
    drawWires();
  }
}
function addWire(a, b){
  if(BENCH.wires.some(w => (w.a.p === a.p && w.a.i === a.i && w.b.p === b.p && w.b.i === b.i) || (w.a.p === b.p && w.a.i === b.i && w.b.p === a.p && w.b.i === a.i))) return;
  BENCH.wires.push({ id: uid(), a: { p: a.p, i: a.i }, b: { p: b.p, i: b.i }, color: WIRECOLS[BENCH.colorIdx], fold: 0, dir: 1 });
  scheduleSaveBench();
}
let rubber = null;
function startRubber(pid, idx, e){
  const from = pinPos(pid, idx);
  rubber = document.createElementNS(NS, 'path');
  rubber.setAttribute('stroke', WIRECOLS[BENCH.colorIdx]); rubber.setAttribute('stroke-width', '3'); rubber.setAttribute('fill', 'none'); rubber.setAttribute('stroke-dasharray', '4 3'); rubber.setAttribute('stroke-linecap', 'round');
  wireLayer.appendChild(rubber);
  const br = () => benchEl.getBoundingClientRect();
  const mv = ev => {
    const r = br();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    if(Math.hypot(x - from.x, y - from.y) > 5) BENCH.dragWire.moved = true;
    rubber.setAttribute('d', `M${from.x},${from.y} L${x},${y}`);
  };
  const up = ev => {
    document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
    if(rubber){ rubber.remove(); rubber = null; }
    const moved = BENCH.dragWire && BENCH.dragWire.moved;
    if(moved){
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const pd = el && el.closest && el.closest('.pin');
      if(pd){
        const pe = pd.closest('.part');
        const tgt = BENCH.parts.find(p => p.id === pe.dataset.pid);
        if(tgt && !(tgt.id === pid && +pd.dataset.i === idx)){ addWire({ p: pid, i: idx }, { p: tgt.id, i: +pd.dataset.i }); drawWires(); }
      }
      BENCH.suppressClick = true;
    }
    BENCH.dragWire = null;
  };
  document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
}

/* encaixe: alinha o pino mais próximo ao furo mais próximo */
function snapToBoard(inst){
  const boards = BENCH.parts.filter(p => p.def.cat === 'board');
  if(!boards.length) return;
  const offs = pinOffsets(inst);
  let best = null;
  offs.forEach((o, i) => {
    const wx = inst.x + o.x, wy = inst.y + o.y;
    for(const b of boards){
      for(const h of boardHoles(b.def)){
        const dx = b.x + h.x - wx, dy = b.y + h.y - wy;
        const dd = Math.hypot(dx, dy);
        if(dd < 12 && (!best || dd < best.dd)) best = { dd, dx, dy };
      }
    }
  });
  if(best){
    inst.x += best.dx; inst.y += best.dy;
    if(inst.el){ inst.el.style.left = inst.x + 'px'; inst.el.style.top = inst.y + 'px'; }
  }
}
function updatePlugVisuals(){
  const nets = CIRCUIT.buildNets();
  const plugged = new Map();
  for(const pl of nets.plugs){ if(!plugged.has(pl.part)) plugged.set(pl.part, new Set()); plugged.get(pl.part).add(pl.pin); }
  for(const p of BENCH.parts){
    if(!p.el) continue;
    const set = plugged.get(p.id);
    p.el.classList.toggle('plugged', !!set);
    p.el.querySelectorAll('.pin').forEach(pd => pd.classList.toggle('plug', !!(set && set.has(+pd.dataset.i))));
  }
}

/* ---------- fios: por cima, dobráveis, com alça ---------- */
window.wirePath = function(w){
  const a = pinPos(w.a.p, w.a.i), b = pinPos(w.b.p, w.b.i);
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  if(w.bx != null){
    const cx = 2 * w.bx - (a.x + b.x) / 2, cy = 2 * w.by - (a.y + b.y) / 2;
    return { d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`, mid: { x: w.bx, y: w.by } };
  }
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const nx = -dy / L, ny = dx / L;
  const k = (w.fold ? 1 : 0.5) * w.dir * Math.min(w.fold ? 90 : 46, 18 + L * (w.fold ? 0.5 : 0.22));
  const cx = mx + nx * k * 2, cy = my + ny * k * 2;
  return { d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`, mid: { x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x, y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y } };
};
window.drawWires = function(){
  wireLayer.innerHTML = '';
  const mk = (n, attrs) => { const e = document.createElementNS(NS, n); for(const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  for(const w of BENCH.wires){
    const { d, mid } = wirePath(w);
    const g = mk('g', {});
    const sel = BENCH.selWire === w;
    g.appendChild(mk('path', { d, stroke: '#0008', 'stroke-width': 6.5, fill: 'none', 'stroke-linecap': 'round', transform: 'translate(1.5,2.5)' }));
    g.appendChild(mk('path', { d, stroke: sel ? '#22d3ee' : '#0b0b0b', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }));
    g.appendChild(mk('path', { d, stroke: w.color, 'stroke-width': 3.6, fill: 'none', 'stroke-linecap': 'round' }));
    g.appendChild(mk('path', { d, stroke: '#ffffff55', 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round', transform: 'translate(-.6,-.9)' }));
    const hit = mk('path', { d, stroke: 'transparent', 'stroke-width': 14, fill: 'none', class: 'hit' });
    hit.addEventListener('click', e => {
      e.stopPropagation();
      if(BENCH.mode === 'erase'){ removeWire(w); return; }
      BENCH.selWire = w; BENCH.sel = null; $$('.part.sel').forEach(x => x.classList.remove('sel'));
      drawWires(); renderProps();
    });
    hit.addEventListener('dblclick', e => { e.stopPropagation(); w.fold ^= 1; w.dir *= -1; w.bx = null; w.by = null; drawWires(); scheduleSaveBench(); });
    hit.addEventListener('contextmenu', e => { e.preventDefault(); removeWire(w); });
    g.appendChild(hit);
    for(const end of [w.a, w.b]){
      const q = pinPos(end.p, end.i);
      g.appendChild(mk('circle', { cx: q.x, cy: q.y, r: 4.2, fill: '#1f2937', stroke: '#000' }));
      g.appendChild(mk('circle', { cx: q.x, cy: q.y, r: 2.4, fill: '#c9a227' }));
    }
    if(sel){
      const hd = mk('circle', { cx: mid.x, cy: mid.y, r: 7, fill: '#22d3ee', stroke: '#031b22', 'stroke-width': 2, class: 'handle' });
      hd.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault();
        hd.setPointerCapture(e.pointerId);
        const r0 = benchEl.getBoundingClientRect();
        const mv = ev => { w.bx = clamp(ev.clientX - r0.left, 0, 1600); w.by = clamp(ev.clientY - r0.top, 0, 1000); drawWires(); };
        const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); scheduleSaveBench(); };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
      });
      g.appendChild(hd);
    }
    wireLayer.appendChild(g);
  }
  if(BENCH.sel || BENCH.parts.length) updatePlugVisuals();
  CIRCUIT.request();
  if(typeof renderHwCheck === 'function') renderHwCheck();
};
// camada de fios acima das peças
(function(){
  const b = document.getElementById('bench');
  const wl = document.getElementById('wireLayer');
  const pl = document.getElementById('partLayer');
  if(b && wl && pl) b.appendChild(wl);
  const hint = document.getElementById('benchHint');
  if(hint) b.appendChild(hint);
})();

/* fundo da bancada limpa a seleção e permite apagar com Delete / girar com R */
document.addEventListener('keydown', function(e){
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if(/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  if(!document.getElementById('v-bench').classList.contains('on')) return;
  if(e.key === 'r' || e.key === 'R'){ if(BENCH.sel){ rotatePart(BENCH.sel); e.preventDefault(); } }
  if(e.key === 'Delete' || e.key === 'Backspace'){
    if(BENCH.sel){ removePart(BENCH.sel); e.preventDefault(); }
    else if(BENCH.selWire){ removeWire(BENCH.selWire); e.preventDefault(); }
  }
  if(BENCH.sel && /^Arrow/.test(e.key)){
    const s = e.shiftKey ? 8 : 1;
    if(e.key === 'ArrowLeft') BENCH.sel.x -= s; if(e.key === 'ArrowRight') BENCH.sel.x += s;
    if(e.key === 'ArrowUp') BENCH.sel.y -= s; if(e.key === 'ArrowDown') BENCH.sel.y += s;
    BENCH.sel.el.style.left = BENCH.sel.x + 'px'; BENCH.sel.el.style.top = BENCH.sel.y + 'px';
    drawWires(); scheduleSaveBench(); e.preventDefault();
  }
});

/* ---------- visuais dependentes da física ---------- */
const _refreshAll = window.refreshAllVisuals;
window.refreshAllVisuals = function(){
  _refreshAll();
  for(const p of BENCH.parts){
    if(!p.el) continue;
    const d = p.def, st = p.state;
    const g = p.el.querySelector('.glow');
    if(g && (d.kind === 'led')){
      const b = clamp(st.brightness || 0, 0, 1);
      g.style.display = st.on && b > 0.02 ? 'block' : 'none';
      g.style.opacity = String(0.15 + 0.85 * Math.min(1, b));
      g.style.background = `radial-gradient(circle,${(p.props.color || '#ff3b30')}dd 0%,${(p.props.color || '#ff3b30')}44 45%,transparent 72%)`;
      g.style.transform = `scale(${0.8 + 0.7 * Math.min(1.2, b)})`;
    }
    if(g && d.kind === 'rgb'){
      const c = st.rgbCol || [0, 0, 0];
      const on = c.some(x => x > 0.02);
      g.style.display = on ? 'block' : 'none';
      g.style.background = `radial-gradient(circle,rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)}) 0%,transparent 72%)`;
    }
    if(d.kind === 'motor' || d.kind === 'fan'){
      const r = p.el.querySelector('.rotG');
      if(r){ r.style.transformOrigin = '50% 50%'; r.style.animation = st.on ? `rot ${Math.max(0.12, 0.7 / Math.max(0.1, st.speed || 0.3))}s linear infinite` : 'none'; }
    }
    if(d.kind === 'servo'){
      const hn = p.el.querySelector('.horn');
      if(hn) hn.style.transform = `rotate(${(st.angle != null ? st.angle : 90) - 90}deg)`;
    }
    const bt = p.el.querySelector('.burnTag');
    if(st.burnt && !bt){ const t = document.createElement('div'); t.className = 'burnTag'; t.textContent = '🔥 queimado'; p.el.appendChild(t); }
    if(!st.burnt && bt) bt.remove();
    p.el.classList.toggle('hot', !!st.hot);
  }
};

/* ---------- multímetro: passe o mouse sobre um pino ---------- */
const probe = document.createElement('div'); probe.id = 'probe';
document.getElementById('bench').appendChild(probe);
document.getElementById('partLayer').addEventListener('mousemove', function(e){
  const pd = e.target.closest && e.target.closest('.pin');
  if(!pd || !SIM.on){ probe.style.display = 'none'; return; }
  const pe = pd.closest('.part'); if(!pe) return;
  const inst = BENCH.parts.find(p => p.id === pe.dataset.pid); if(!inst) return;
  const v = CIRCUIT.pinV(inst, +pd.dataset.i);
  const r = document.getElementById('bench').getBoundingClientRect();
  probe.textContent = `${inst.def.n} · ${pd.dataset.nm}: ${v.toFixed(3)} V`;
  probe.style.left = (e.clientX - r.left + 12) + 'px'; probe.style.top = (e.clientY - r.top - 26) + 'px'; probe.style.display = 'block';
});
document.getElementById('partLayer').addEventListener('mouseleave', () => { probe.style.display = 'none'; });

/* ---------- painel de propriedades: girar, reparar, medidas ao vivo ---------- */
const _renderProps = window.renderProps;
window.renderProps = function(){
  _renderProps();
  const box = document.getElementById('props');
  const inst = BENCH.sel;
  if(!inst || BENCH.selWire) return;
  const extra = document.createElement('div');
  extra.innerHTML = `<div class="propRow" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn" id="btnRot">⟳ Girar 90° (R)</button>
      ${inst.state.burnt ? '<button class="btn prime" id="btnFix">🔧 Substituir peça queimada</button>' : ''}
      <button class="btn danger" id="btnDelPart">🗑 Remover</button></div>
    <div id="liveElec"></div>`;
  box.appendChild(extra);
  document.getElementById('btnRot').onclick = () => rotatePart(inst);
  const fx = document.getElementById('btnFix'); if(fx) fx.onclick = () => { inst.state.burnt = false; inst.state.blown = false; if(CIRCUIT.react[inst.id]) CIRCUIT.react[inst.id].blown = false; renderBench(); renderProps(); CIRCUIT.request(); };
  document.getElementById('btnDelPart').onclick = () => removePart(inst);
  updateLive();
};
function fmtI(I){ const a = Math.abs(I); return a < 1e-6 ? '0 A' : a < 1e-3 ? (I * 1e6).toFixed(1) + ' µA' : a < 1 ? (I * 1e3).toFixed(2) + ' mA' : I.toFixed(3) + ' A'; }
function updateLive(){
  const el = document.getElementById('liveElec');
  const inst = BENCH.sel;
  if(!el || !inst) return;
  if(!SIM.on){ el.innerHTML = '<p class="small" style="margin-top:6px">Ligue a ⏻ Simulação para medir tensões e correntes reais.</p>'; return; }
  const offs = pinOffsets(inst);
  if(inst.def.cat === 'board' || !offs.length) { el.innerHTML = ''; return; }
  let h = '<table class="elTable"><tr><td colspan="2"><b>Medidas ao vivo</b></td></tr>';
  const names = inst.def.pinNames || [];
  for(let i = 0; i < Math.min(offs.length, 16); i++) h += `<tr><td>${names[i] || 'P' + i}</td><td>${CIRCUIT.pinV(inst, i).toFixed(3)} V</td></tr>`;
  const cs = inst.cs || { I: {} };
  for(const k in cs.I) if(Math.abs(cs.I[k]) > 1e-9 && !/^(z|pd|pu|io|leak)/.test(k)) h += `<tr><td>I(${k})</td><td>${fmtI(cs.I[k])}</td></tr>`;
  if(inst.def.cat === 'mcu') h += `<tr><td>estado</td><td>${(cs.note) || (inst.state.mcuPow ? 'ligado' : 'sem energia')}</td></tr>`;
  h += '</table>';
  el.innerHTML = h;
}
CIRCUIT.onSolve = (function(){ let t = 0; return function(){ const n = performance.now(); if(n - t > 250){ t = n; updateLive(); } }; })();

/* ---------- salvar/carregar (corrige perda de fios: ids agora são índices) ---------- */
window.serializeBench = function(){
  const idx = id => BENCH.parts.findIndex(p => p.id === id);
  return {
    v: 2,
    parts: BENCH.parts.map(p => ({ id: p.def.id, x: p.x, y: p.y, props: p.props, rot: p.rot || 0, st: { sw: p.state.sw, dip: p.state.dip, latched: p.state.latched, burnt: p.state.burnt } })),
    wires: BENCH.wires.map(w => ({ ai: idx(w.a.p), a: w.a.i, bi: idx(w.b.p), b: w.b.i, color: w.color, fold: w.fold, dir: w.dir, bx: w.bx, by: w.by }))
  };
};
window.loadBenchData = function(dd){
  BENCH.parts = []; BENCH.wires = []; BENCH.sel = null; BENCH.selWire = null;
  const made = [];
  for(const sp of dd.parts || []){
    if(!PARTMAP[sp.id]){ made.push(null); continue; }
    const p = addPart(sp.id, sp.x, sp.y, sp.props);
    if(p){ p.rot = sp.rot || 0; if(sp.st) Object.assign(p.state, sp.st); }
    made.push(p);
  }
  for(const w of dd.wires || []){
    let a, b;
    if(w.ai != null){ a = made[w.ai]; b = made[w.bi]; if(!a || !b) continue; BENCH.wires.push({ id: uid(), a: { p: a.id, i: w.a }, b: { p: b.id, i: w.b }, color: w.color, fold: w.fold || 0, dir: w.dir || 1, bx: w.bx, by: w.by }); }
    else if(w.a && w.b && w.a.p){ if(BENCH.parts.find(x => x.id === w.a.p) && BENCH.parts.find(x => x.id === w.b.p)) BENCH.wires.push(Object.assign({ id: uid() }, w)); }
  }
  renderBench();
  renderProps();
};

/* nova bancada sempre re-renderiza com rotação aplicada */
const _renderBench = window.renderBench;
window.renderBench = function(){
  _renderBench();
  updatePlugVisuals();
  CIRCUIT.request();
};

})();
