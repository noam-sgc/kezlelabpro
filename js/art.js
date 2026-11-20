/* =========================================================================
   Kezle Lab Pro — Arte realista das peças (estilo Tinkercad)
   Componentes reais: LED com cúpula de epóxi, resistor com faixas, capacitores,
   diodos, transistores TO-92/TO-220, botões, chaves, potenciômetros, buzzer,
   motor com eixo, servo, módulos em PCB com chip/SMD/furos de fixação etc.
   Os pinos NÃO são desenhados aqui: o app desenha os pinos dourados nas posições
   exatas (KezleRaw), e as pernas/terminais aqui terminam exatamente neles.
   ========================================================================= */
(function(){
'use strict';
const RAW = window.KezleRaw;
let gid = 0;
const G = () => 'g' + (++gid);
const leg = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9aa3ad" stroke-width="2.2" stroke-linecap="round"/><line x1="${x1 - .5}" y1="${y1}" x2="${x2 - .5}" y2="${y2}" stroke="#e5e7eb" stroke-width=".8" stroke-linecap="round"/>`;
const hex = c => (c || '#ff3b30');
function shade(h, k){
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || ''); if(!m) return h;
  const f = v => Math.max(0, Math.min(255, Math.round(parseInt(v, 16) * k)));
  return '#' + [m[1], m[2], m[3]].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
const hash = s => { let h = 0; for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const wrap = (d, body, defs) => `<svg width="${d.w}" height="${d.h}" xmlns="http://www.w3.org/2000/svg">${defs ? '<defs>' + defs + '</defs>' : ''}${body}</svg>`;

/* ---------------- LED ---------------- */
function artLED(inst){
  const d = inst.def, w = d.w, h = d.h, c = hex(inst.props.color), id = G();
  const o = RAW(inst);
  const cx = w / 2;
  let s = '';
  // pernas até os pinos (ânodo mais longo)
  o.forEach((p, i) => { s += leg(p.x, h - 24, p.x, p.y); });
  s += `<path d="M${cx - 14},30 Q${cx - 14},4 ${cx},4 Q${cx + 14},4 ${cx + 14},30 Z" fill="url(#${id}d)" stroke="${shade(c, .55)}" stroke-width=".8"/>`;
  s += `<rect x="${cx - 15}" y="29" width="30" height="5" rx="1.5" fill="${shade(c, .75)}" stroke="${shade(c, .5)}" stroke-width=".6" opacity=".95"/>`;
  s += `<ellipse cx="${cx - 5}" cy="12" rx="3.2" ry="5.5" fill="#fff" opacity=".55" transform="rotate(-18 ${cx - 5} 12)"/>`;
  s += `<rect x="${cx - 4}" y="14" width="8" height="12" rx="1" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width=".7"/>`;
  return wrap(d, s, `<radialGradient id="${id}d" cx=".42" cy=".3" r=".8"><stop offset="0" stop-color="${shade(c, 1.35)}" stop-opacity=".95"/><stop offset=".6" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${shade(c, .55)}"/></radialGradient>`);
}
function artRGB(inst){
  const d = inst.def, w = d.w, h = d.h, id = G(), cx = w / 2, o = RAW(inst);
  let s = '';
  o.forEach(p => { s += leg(p.x, h - 24, p.x, p.y); });
  s += `<path d="M${cx - 15},30 Q${cx - 15},3 ${cx},3 Q${cx + 15},3 ${cx + 15},30 Z" fill="url(#${id})" stroke="#9ca3af" stroke-width=".8"/>`;
  s += `<rect x="${cx - 16}" y="29" width="32" height="5" rx="1.5" fill="#d1d5db" stroke="#9ca3af" stroke-width=".6"/>`;
  s += `<circle cx="${cx - 5}" cy="18" r="3" fill="#ef4444"/><circle cx="${cx + 5}" cy="18" r="3" fill="#22c55e"/><circle cx="${cx}" cy="11" r="3" fill="#3b82f6"/>`;
  s += `<ellipse cx="${cx - 6}" cy="10" rx="3" ry="5" fill="#fff" opacity=".5" transform="rotate(-18 ${cx - 6} 10)"/>`;
  return wrap(d, s, `<radialGradient id="${id}" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#cbd5e1" stop-opacity=".9"/></radialGradient>`);
}

/* ---------------- passivos ---------------- */
function bandsOf(inst){ try { return resBands(inst ? +inst.props.value || 220 : 220); } catch(e){ return ['#f00', '#f00', '#a52', '#c9a227']; } }
function artRes(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), cy = h / 2, id = G();
  const x0 = o[0].x, x1 = o[1].x, bx = x0 + 8, bw = x1 - x0 - 16;
  let s = leg(x0, cy, bx + 2, cy) + leg(x1, cy, bx + bw - 2, cy);
  s += `<rect x="${bx}" y="${cy - 5.5}" width="${bw}" height="11" rx="5" fill="url(#${id})" stroke="#8a6d3b" stroke-width=".7"/>`;
  const b = bandsOf(inst), bandX = [.2, .36, .52, .8];
  b.slice(0, 4).forEach((c, i) => { s += `<rect x="${bx + bw * bandX[i] - 1.4}" y="${cy - 5.4}" width="2.8" height="10.8" fill="${c}" opacity=".95"/>`; });
  s += `<rect x="${bx + 3}" y="${cy - 4.5}" width="${bw - 6}" height="2.6" rx="1.3" fill="#fff" opacity=".28"/>`;
  return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9cf9c"/><stop offset=".5" stop-color="#d4b277"/><stop offset="1" stop-color="#a98650"/></linearGradient>`);
}
function artCap(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), cy = h / 2, id = G(), x0 = o[0].x, x1 = o[1].x;
  const nm = d.id + ' ' + d.n;
  let s = '';
  if(d.id2 === 'inductor'){
    s += leg(x0, cy, x0 + 10, cy) + leg(x1, cy, x1 - 10, cy);
    s += `<rect x="${x0 + 9}" y="${cy - 6}" width="${x1 - x0 - 18}" height="12" rx="5" fill="#b45309" stroke="#78350f"/>`;
    for(let i = 0; i < 5; i++) s += `<path d="M${x0 + 13 + i * 5},${cy - 6} q2,6 0,12" stroke="#fcd34d" stroke-width="1.6" fill="none"/>`;
    return wrap(d, s);
  }
  if(d.id2 === 'fuse'){
    s += leg(x0, cy, x0 + 6, cy) + leg(x1, cy, x1 - 6, cy);
    s += `<rect x="${x0 + 5}" y="${cy - 5}" width="${x1 - x0 - 10}" height="10" rx="3" fill="#e0f2fe" fill-opacity=".55" stroke="#7dd3fc"/><rect x="${x0 + 5}" y="${cy - 5}" width="5" height="10" fill="#9ca3af"/><rect x="${x1 - 10}" y="${cy - 5}" width="5" height="10" fill="#9ca3af"/><path d="M${x0 + 10},${cy} q4,-4 8,0 t8,0" stroke="#f59e0b" fill="none" stroke-width="1"/>`;
    return wrap(d, s);
  }
  if(d.id === 'crystal_16mhz'){
    s += leg(x0, cy, x0 + 8, cy) + leg(x1, cy, x1 - 8, cy);
    s += `<rect x="${x0 + 7}" y="${cy - 6}" width="${x1 - x0 - 14}" height="12" rx="6" fill="url(#${id})" stroke="#6b7280"/><text x="${w / 2}" y="${cy + 2.4}" text-anchor="middle" font-size="5" fill="#374151" font-family="monospace">16.000</text>`;
    return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f4f6"/><stop offset="1" stop-color="#9ca3af"/></linearGradient>`);
  }
  if(d.id === 'varistor' || /ceramic/.test(nm)){
    s += leg(x0, cy, w / 2 - 6, cy) + leg(x1, cy, w / 2 + 6, cy);
    const col = d.id === 'varistor' ? '#2563eb' : '#f59e0b';
    s += `<circle cx="${w / 2}" cy="${cy}" r="${Math.min(10, h / 2 - 1)}" fill="url(#${id})" stroke="${shade(col, .6)}"/><text x="${w / 2}" y="${cy + 2.2}" text-anchor="middle" font-size="5.5" fill="#1f2937" font-family="monospace">${d.id === 'varistor' ? 'MOV' : (inst.props.capVal || '') + ((inst.props.capUnit || '').slice(0, 1))}</text>`;
    return wrap(d, s, `<radialGradient id="${id}" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="${shade(col, 1.3)}"/><stop offset="1" stop-color="${shade(col, .75)}"/></radialGradient>`);
  }
  if(/tantalum|film/.test(nm)){
    const col = /tantalum/.test(nm) ? '#eab308' : '#f97316';
    s += leg(x0, cy, x0 + 8, cy) + leg(x1, cy, x1 - 8, cy);
    s += `<rect x="${x0 + 7}" y="${cy - 7}" width="${x1 - x0 - 14}" height="14" rx="3" fill="${col}" stroke="${shade(col, .6)}"/><text x="${w / 2}" y="${cy + 2.3}" text-anchor="middle" font-size="5.5" fill="#451a03" font-family="monospace">${inst.props.capVal || ''}${(inst.props.capUnit || '').slice(0, 1)}</text>`;
    return wrap(d, s);
  }
  // eletrolítico axial
  s += leg(x0, cy, x0 + 8, cy) + leg(x1, cy, x1 - 8, cy);
  s += `<rect x="${x0 + 7}" y="${cy - 8}" width="${x1 - x0 - 14}" height="16" rx="4" fill="url(#${id})" stroke="#111827"/>`;
  s += `<rect x="${x1 - 14}" y="${cy - 8}" width="6" height="16" rx="2" fill="#e5e7eb" opacity=".85"/><text x="${x1 - 11}" y="${cy + 3}" text-anchor="middle" font-size="8" fill="#111827" font-weight="700">−</text>`;
  s += `<text x="${w / 2 - 2}" y="${cy + 2.2}" text-anchor="middle" font-size="5" fill="#cbd5e1" font-family="monospace">${inst.props.capVal || 100}${inst.props.capUnit || 'µF'}</text>`;
  s += `<rect x="${x0 + 10}" y="${cy - 6}" width="${x1 - x0 - 26}" height="2.6" rx="1.3" fill="#fff" opacity=".18"/>`;
  return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset=".5" stop-color="#1e3a8a"/><stop offset="1" stop-color="#0b1b4d"/></linearGradient>`);
}
function artDiode(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), cy = h / 2, id = G(), x0 = o[0].x, x1 = o[1].x;
  const zener = /zener/.test(d.id), sch = d.vf && d.vf < .5;
  const col = zener ? '#d97706' : sch ? '#374151' : '#111827';
  let s = leg(x0, cy, x0 + 9, cy) + leg(x1, cy, x1 - 9, cy);
  s += `<rect x="${x0 + 8}" y="${cy - 5}" width="${x1 - x0 - 16}" height="10" rx="3" fill="${col}" stroke="#000"/>`;
  s += `<rect x="${x1 - 14}" y="${cy - 5}" width="4" height="10" fill="#e5e7eb"/>`;
  s += `<rect x="${x0 + 12}" y="${cy - 3.8}" width="${x1 - x0 - 30}" height="2" rx="1" fill="#fff" opacity=".18"/>`;
  return wrap(d, s);
}
function artTrans(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), id = G();
  const tab = /tip|irf|irfz|irlz|m_irf|q_tip|mosfet_/.test(d.id);
  let s = '';
  const n = o.length, minx = Math.min(...o.map(p => p.x)), maxx = Math.max(...o.map(p => p.x));
  const cx = (minx + maxx) / 2;
  const label = (d.n.match(/(2N\d+|BC\d+|TIP\d+\w*|IRF\w+|IRL\w+|2N7000|BS170|AO34\d+|2SC\d+)/) || [d.id.toUpperCase().slice(0, 8)])[0];
  if(tab){
    o.forEach(p => { s += leg(p.x, h - 22, p.x, p.y); });
    s += `<rect x="${cx - 14}" y="2" width="28" height="9" rx="1.5" fill="#cbd5e1" stroke="#6b7280"/><circle cx="${cx}" cy="6.5" r="2.4" fill="#111827"/>`;
    s += `<rect x="${cx - 14}" y="11" width="28" height="${h - 33}" rx="2" fill="#111827" stroke="#000"/>`;
    s += `<text x="${cx}" y="${h - 25}" text-anchor="middle" font-size="5.2" fill="#d1d5db" font-family="monospace">${label}</text>`;
    return wrap(d, s);
  }
  o.forEach(p => { s += leg(p.x, h - 22, p.x, p.y); });
  s += `<path d="M${cx - 11},${h - 22} L${cx - 11},12 Q${cx - 11},3 ${cx},3 Q${cx + 11},3 ${cx + 11},12 L${cx + 11},${h - 22} Z" fill="url(#${id})" stroke="#000" stroke-width=".7"/>`;
  s += `<text x="${cx}" y="${h - 29}" text-anchor="middle" font-size="5" fill="#d1d5db" font-family="monospace">${label}</text>`;
  s += `<rect x="${cx - 8}" y="8" width="3" height="${h - 38}" rx="1.4" fill="#fff" opacity=".16"/>`;
  return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f2937"/><stop offset=".5" stop-color="#0b0f17"/><stop offset="1" stop-color="#1f2937"/></linearGradient>`);
}
function artIC(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst);
  if(o.length <= 3){ return artTrans(inst); }
  let s = '';
  const per = Math.ceil(o.length / 2);
  o.forEach(p => { s += leg(p.x, h - 18, p.x, p.y); });
  s += `<rect x="3" y="3" width="${w - 6}" height="${h - 21}" rx="3" fill="#161b22" stroke="#000"/><circle cx="9" cy="9" r="2.2" fill="#0b0f17" stroke="#374151"/>`;
  s += `<text x="${w / 2}" y="${(h - 15) / 2 + 3}" text-anchor="middle" font-size="6" fill="#cbd5e1" font-family="monospace">${esc((d.n.split(' ')[0] || '').slice(0, 10))}</text>`;
  return wrap(d, s);
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- entradas ---------------- */
function artButton(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), id = G();
  let s = '';
  o.forEach(p => { s += leg(p.x, h - 20, p.x, p.y); });
  const bx = w / 2 - 17, by = 2, bw = 34, bh = h - 22;
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" fill="url(#${id})" stroke="#000" stroke-width=".8"/>`;
  [[bx + 3, by + 3], [bx + bw - 3, by + 3], [bx + 3, by + bh - 3], [bx + bw - 3, by + bh - 3]].forEach(p => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="1.6" fill="#9ca3af"/>`; });
  s += `<circle cx="${w / 2}" cy="${by + bh / 2}" r="${Math.min(bw, bh) / 2 - 3}" fill="#0b0f17" stroke="#374151"/>`;
  return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5563"/><stop offset="1" stop-color="#1f2937"/></linearGradient>`);
}
function artSwitch(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst);
  let s = '';
  o.forEach(p => { s += leg(p.x, h - 18, p.x, p.y); });
  s += `<rect x="4" y="3" width="${w - 8}" height="${h - 21}" rx="3" fill="#374151" stroke="#000"/><rect x="${w / 2 - 17}" y="${(h - 18) / 2 - 7}" width="34" height="14" rx="3" fill="#111827" stroke="#000"/>`;
  s += `<text x="${w / 2}" y="${h - 22}" text-anchor="middle" font-size="5" fill="#9ca3af" font-family="monospace">ON · OFF</text>`;
  return wrap(d, s);
}
function artDip(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst);
  let s = '';
  o.forEach(p => { s += leg(p.x, h - 14, p.x, p.y); });
  s += `<rect x="2" y="2" width="${w - 4}" height="${h - 16}" rx="3" fill="#1d4ed8" stroke="#0b1e57"/><text x="${w / 2}" y="${h - 18}" text-anchor="middle" font-size="5" fill="#bfdbfe" font-family="monospace">ON</text>`;
  return wrap(d, s);
}
function artPot(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), id = G();
  let s = '';
  const trim = /trim/.test(d.id), slide = /slide/.test(d.id);
  o.forEach(p => { s += leg(p.x, h - 16, p.x, p.y); });
  if(slide){
    s += `<rect x="2" y="${h / 2 - 11}" width="${w - 4}" height="20" rx="3" fill="#1f2937" stroke="#000"/><rect x="8" y="${h / 2 - 3}" width="${w - 16}" height="5" rx="2.5" fill="#0b0f17"/>`;
    return wrap(d, s);
  }
  if(trim){
    s += `<rect x="${w / 2 - 15}" y="2" width="30" height="${h - 18}" rx="3" fill="#2563eb" stroke="#1e3a8a"/><circle cx="${w / 2}" cy="${(h - 14) / 2}" r="8" fill="#e5e7eb" stroke="#6b7280"/><line x1="${w / 2 - 6}" y1="${(h - 14) / 2}" x2="${w / 2 + 6}" y2="${(h - 14) / 2}" stroke="#374151" stroke-width="2"/>`;
    return wrap(d, s);
  }
  s += `<rect x="${w / 2 - 18}" y="4" width="36" height="${h - 20}" rx="4" fill="url(#${id})" stroke="#000"/><circle cx="${w / 2}" cy="${(h - 12) / 2}" r="${Math.min(w, h) * .34}" fill="#9ca3af" stroke="#4b5563"/>`;
  return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>`);
}
function artEnc(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst);
  let s = '';
  o.forEach(p => { s += leg(p.x, h - 18, p.x, p.y); });
  s += `<rect x="3" y="2" width="${w - 6}" height="${h - 20}" rx="4" fill="#0f766e" stroke="#042f2e"/>`;
  s += `<rect x="${w / 2 - 12}" y="4" width="24" height="${h - 24}" rx="3" fill="#cbd5e1" stroke="#64748b"/>`;
  return wrap(d, s);
}
function artJoy(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst);
  let s = '';
  o.forEach(p => { s += leg(p.x, h - 14, p.x, p.y); });
  s += `<rect x="1" y="1" width="${w - 2}" height="${h - 14}" rx="4" fill="#111827" stroke="#000"/>`;
  s += `<rect x="${w / 2 - 20}" y="4" width="40" height="${h - 20}" rx="4" fill="#d1d5db" stroke="#6b7280"/>`;
  return wrap(d, s);
}
function artKeypad(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst);
  let s = '';
  o.forEach(p => { s += leg(p.x, h - 12, p.x, p.y); });
  s += `<rect x="1" y="1" width="${w - 2}" height="${h - 14}" rx="5" fill="#475569" stroke="#0f172a"/>`;
  return wrap(d, s);
}

/* ---------------- atuadores ---------------- */
function artBuzzer(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), id = G(), cx = w / 2;
  if(d.modBuzz){ return artModule(inst); }
  let s = '';
  o.forEach(p => { s += leg(p.x, h - 20, p.x, p.y); });
  if(/speaker/.test(d.id)){
    s += `<circle cx="${cx}" cy="${(h - 14) / 2 + 2}" r="${Math.min(w, h) * .4}" fill="#1f2937" stroke="#000"/><circle cx="${cx}" cy="${(h - 14) / 2 + 2}" r="${Math.min(w, h) * .26}" fill="url(#${id})" stroke="#374151"/><circle cx="${cx}" cy="${(h - 14) / 2 + 2}" r="4" fill="#0b0f17"/>`;
    return wrap(d, s, `<radialGradient id="${id}"><stop offset="0" stop-color="#374151"/><stop offset="1" stop-color="#111827"/></radialGradient>`);
  }
  if(/piezo/.test(d.id)){
    s += `<circle cx="${cx}" cy="${(h - 14) / 2 + 2}" r="${Math.min(w, h) * .4}" fill="#d97706" stroke="#78350f"/><circle cx="${cx}" cy="${(h - 14) / 2 + 2}" r="${Math.min(w, h) * .26}" fill="#fde68a" stroke="#b45309"/>`;
    return wrap(d, s);
  }
  s += `<circle cx="${cx}" cy="${(h - 14) / 2 + 2}" r="${Math.min(w, h) * .38}" fill="url(#${id})" stroke="#000"/><circle cx="${cx}" cy="${(h - 14) / 2 + 2}" r="3" fill="#000"/><text x="${cx - Math.min(w, h) * .25}" y="${(h - 14) / 2 - 4}" font-size="7" fill="#e5e7eb" font-weight="700">+</text>`;
  return wrap(d, s, `<radialGradient id="${id}" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#374151"/><stop offset="1" stop-color="#0b0f17"/></radialGradient>`);
}
function artMotor(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), id = G(), cx = w / 2, cy = h / 2 - 2;
  let s = '';
  o.forEach(p => { s += leg(p.x, p.y - 8, p.x, p.y); });
  if(d.kind === 'fan'){
    s += `<rect x="2" y="2" width="${w - 4}" height="${h - 14}" rx="6" fill="#1f2937" stroke="#000"/><circle cx="${cx}" cy="${(h - 12) / 2}" r="${Math.min(w, h) * .38}" fill="#0b0f17"/>`;
    s += `<g class="rotG" style="transform-origin:${cx}px ${(h - 12) / 2}px">` + [0, 72, 144, 216, 288].map(a => `<path d="M${cx},${(h - 12) / 2} Q${cx + 9},${(h - 12) / 2 - 12} ${cx + 3},${(h - 12) / 2 - Math.min(w, h) * .36}" fill="#e5e7eb" stroke="#9ca3af" transform="rotate(${a} ${cx} ${(h - 12) / 2})"/>`).join('') + `<circle cx="${cx}" cy="${(h - 12) / 2}" r="4" fill="#9ca3af"/></g>`;
    return wrap(d, s);
  }
  const by = 6, bh = h - 24;
  s += `<rect x="6" y="${by}" width="${w - 22}" height="${bh}" rx="5" fill="url(#${id})" stroke="#4b5563"/>`;
  s += `<rect x="${w - 18}" y="${by + bh / 2 - 3}" width="12" height="6" fill="#9ca3af" stroke="#4b5563"/>`;
  s += `<rect x="3" y="${by + 3}" width="5" height="${bh - 6}" rx="1.5" fill="#374151"/>`;
  s += `<g class="rotG" style="transform-origin:${w - 6}px ${by + bh / 2}px"><circle cx="${w - 6}" cy="${by + bh / 2}" r="5" fill="#e5e7eb" stroke="#6b7280"/><line x1="${w - 10}" y1="${by + bh / 2}" x2="${w - 2}" y2="${by + bh / 2}" stroke="#374151" stroke-width="1.6"/><line x1="${w - 6}" y1="${by + bh / 2 - 4}" x2="${w - 6}" y2="${by + bh / 2 + 4}" stroke="#374151" stroke-width="1.6"/></g>`;
  s += `<text x="${w / 2 - 8}" y="${by + bh / 2 + 2}" text-anchor="middle" font-size="5" fill="#374151" font-family="monospace">${(d.n.match(/\d+\s?V/) || ['DC'])[0]}</text>`;
  return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5e7eb"/><stop offset=".5" stop-color="#9ca3af"/><stop offset="1" stop-color="#6b7280"/></linearGradient>`);
}
function artServo(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), id = G();
  let s = '';
  o.forEach((p, i) => { s += `<line x1="${p.x}" y1="${h - 14}" x2="${p.x}" y2="${p.y}" stroke="${['#f59e0b', '#ef4444', '#7c2d12'][i % 3]}" stroke-width="2.6" stroke-linecap="round"/>`; });
  const big = /mg|ds3|pro|metal/i.test(d.id);
  s += `<rect x="2" y="${h * .22}" width="${w - 4}" height="${h * .5}" rx="3" fill="url(#${id})" stroke="${big ? '#374151' : '#0c4a6e'}"/>`;
  s += `<rect x="${w * .12}" y="${h * .12}" width="${w * .18}" height="${h * .12}" fill="${big ? '#4b5563' : '#0284c7'}"/><rect x="${w * .7}" y="${h * .12}" width="${w * .18}" height="${h * .12}" fill="${big ? '#4b5563' : '#0284c7'}"/>`;
  s += `<rect x="${w * .08}" y="${h * .38}" width="${w * .1}" height="${h * .16}" fill="#0b0f17" opacity=".4"/>`;
  s += `<text x="${w * .45}" y="${h * .52}" text-anchor="middle" font-size="6" fill="#f0f9ff" font-family="monospace">${big ? 'METAL' : 'SG90'}</text>`;
  s += `<circle cx="${w * .84}" cy="${h * .28}" r="5.5" fill="#e5e7eb" stroke="#6b7280"/>`;
  return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${big ? '#6b7280' : '#38bdf8'}"/><stop offset="1" stop-color="${big ? '#374151' : '#0369a1'}"/></linearGradient>`);
}

/* ---------------- módulos em PCB (sensores, comunicação, drivers...) ---------------- */
const PCBS = ['#1e4aa8', '#0b7a3e', '#7c1d1d', '#111827', '#5b2d82', '#0f5c4a'];
function pcbColor(d){
  if(/adafruit/i.test(d.brand || '')) return '#5b2d82';
  if(/sparkfun/i.test(d.brand || '')) return '#8b1a1a';
  if(/seeed/i.test(d.brand || '')) return '#111827';
  return PCBS[hash(d.id) % PCBS.length];
}
function artModule(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), id = G(), col = pcbColor(d);
  let s = '';
  const body = h - 10;
  s += `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="5" fill="url(#${id})" stroke="#000" stroke-width=".8"/>`;
  // furos de fixação
  [[7, 7], [w - 7, 7]].forEach(p => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="#0a0f18" stroke="#c9ced6" stroke-width=".8"/>`; });
  // trilhas decorativas
  s += `<path d="M10,${h - 14} H${w - 10}" stroke="#ffffff" stroke-opacity=".08" stroke-width="1"/>`;
  const id2 = (d.id + ' ' + d.n).toLowerCase();
  const cx = w / 2, cy = (h - 14) / 2 + 3;
  const hero = (() => {
    if(/hcsr04|hc-sr04|us100|jsn|a02y|ultrass/.test(id2)) return `<g><circle cx="${w * .27}" cy="${cy}" r="${Math.min(14, h * .26)}" fill="#cbd5e1" stroke="#475569"/><circle cx="${w * .27}" cy="${cy}" r="${Math.min(9, h * .17)}" fill="#111827"/><circle cx="${w * .73}" cy="${cy}" r="${Math.min(14, h * .26)}" fill="#cbd5e1" stroke="#475569"/><circle cx="${w * .73}" cy="${cy}" r="${Math.min(9, h * .17)}" fill="#111827"/><rect x="${cx - 7}" y="${cy - 3}" width="14" height="8" fill="#111827"/></g>`;
    if(d.sk === 'motion') return `<circle cx="${cx}" cy="${cy}" r="${Math.min(16, h * .3)}" fill="#f8fafc" stroke="#cbd5e1"/>` + [0, 60, 120, 180, 240, 300].map(a => `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a * Math.PI / 180) * Math.min(15, h * .28)}" y2="${cy + Math.sin(a * Math.PI / 180) * Math.min(15, h * .28)}" stroke="#cbd5e1" stroke-width=".8"/>`).join('');
    if(d.sk === 'gas') return `<circle cx="${cx}" cy="${cy}" r="${Math.min(15, h * .27)}" fill="#9ca3af" stroke="#4b5563"/><circle cx="${cx}" cy="${cy}" r="${Math.min(11, h * .2)}" fill="#374151"/>` + [-5, 0, 5].map(k => `<line x1="${cx - 9}" y1="${cy + k}" x2="${cx + 9}" y2="${cy + k}" stroke="#9ca3af" stroke-width=".8"/>`).join('');
    if(d.sk === 'soil') return `<rect x="${w * .3}" y="${h * .1}" width="${w * .4}" height="${h * .62}" fill="#065f46" opacity=".6"/>`;
    if(d.sk === 'luxA' || d.sk === 'lux') return `<circle cx="${cx}" cy="${cy}" r="9" fill="#f5e6b8" stroke="#c9a227"/><circle cx="${cx}" cy="${cy}" r="4" fill="#e2b93b"/>`;
    if(d.cat === 'comm') return `<rect x="${w * .2}" y="${h * .14}" width="${w * .6}" height="${h * .46}" rx="2" fill="#9ca3af" stroke="#4b5563"/><text x="${cx}" y="${h * .14 + h * .26}" text-anchor="middle" font-size="6" fill="#111827" font-family="monospace">${esc((d.n.split(' ')[0] || '').slice(0, 9))}</text><path d="M${w * .76},${h * .12} h8 v8 h8" stroke="#fde68a" fill="none" stroke-width="1.4"/>`;
    if(d.kind === 'hbridge') return `<rect x="${w * .08}" y="${h * .1}" width="${w * .34}" height="${h * .5}" fill="#111827" stroke="#000"/><rect x="${w * .12}" y="${h * .05}" width="${w * .26}" height="${h * .12}" fill="#cbd5e1"/><rect x="${w * .5}" y="${h * .15}" width="${w * .4}" height="${h * .32}" fill="#1d4ed8" stroke="#0b1e57"/>`;
    // chip + SMD
    return `<rect x="${cx - 10}" y="${cy - 9}" width="20" height="18" rx="2" fill="#0d1117" stroke="#39424e"/><circle cx="${cx - 7}" cy="${cy - 6}" r="1.2" fill="#6b7280"/><rect x="${cx - 24}" y="${cy - 4}" width="7" height="3.4" fill="#d6d3d1"/><rect x="${cx + 17}" y="${cy + 1}" width="7" height="3.4" fill="#d6d3d1"/><rect x="${cx + 15}" y="${cy - 8}" width="3.4" height="7" fill="#78716c"/>`;
  })();
  s += hero;
  s += `<text x="${w / 2}" y="${h - 14}" text-anchor="middle" font-size="6.4" fill="#fff" fill-opacity=".9" font-family="monospace">${esc((d.n.replace(/\s*\(.*$/, '') || '').slice(0, 20))}</text>`;
  // etiquetas dos pinos (serigrafia) em módulos com poucos pinos
  if(o.length <= 8 && w >= 70){
    const names = d.pinNames || [];
    o.forEach((p, i) => { s += `<text x="${p.x}" y="${p.y - 6}" text-anchor="middle" font-size="3.6" fill="#fff" fill-opacity=".7" font-family="monospace">${esc((names[i] || '').slice(0, 4))}</text>`; });
  }
  return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(col, 1.25)}"/><stop offset="1" stop-color="${shade(col, .8)}"/></linearGradient>`);
}
function artRelayMod(inst){
  const d = inst.def, w = d.w, h = d.h, o = RAW(inst), id = G();
  let s = `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="5" fill="url(#${id})" stroke="#000"/>`;
  const n = Math.max(1, d.channelsN || 1);
  for(let i = 0; i < n; i++){
    const x = 6 + i * ((w - 12) / n);
    s += `<rect x="${x}" y="8" width="${(w - 12) / n - 4}" height="${h * .44}" rx="2" fill="#1d4ed8" stroke="#0b1e57"/><text x="${x + ((w - 12) / n - 4) / 2}" y="${8 + h * .24}" text-anchor="middle" font-size="5" fill="#bfdbfe" font-family="monospace">SRD-05VDC</text><circle cx="${x + 6}" cy="${h * .62}" r="2" fill="#ef4444"/>`;
  }
  s += `<text x="${w / 2}" y="${h - 16}" text-anchor="middle" font-size="6" fill="#fff" fill-opacity=".85" font-family="monospace">${esc(d.n.slice(0, 26))}</text>`;
  return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15803d"/><stop offset="1" stop-color="#0b4f26"/></linearGradient>`);
}

/* ---------------- energia ---------------- */
function artPower(inst){
  const d = inst.def, w = d.w, h = d.h, id = G(), cx = w / 2;
  const k = d.kind, nm = d.id;
  let s = '';
  if(k === 'b9'){
    s += `<rect x="4" y="12" width="${w - 8}" height="${h - 14}" rx="4" fill="url(#${id})" stroke="#000"/><rect x="4" y="12" width="${w - 8}" height="14" fill="#111827"/>`;
    s += `<circle cx="${cx - 8}" cy="6" r="5" fill="#9ca3af" stroke="#4b5563"/><rect x="${cx + 3}" y="2" width="10" height="9" fill="#9ca3af" stroke="#4b5563"/>`;
    s += `<text x="${cx}" y="${h / 2 + 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#e5e7eb">9V</text><text x="${cx}" y="${h / 2 + 20}" text-anchor="middle" font-size="5.5" fill="#9ca3af">ALKALINE</text>`;
    return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#374151"/><stop offset=".5" stop-color="#6b7280"/><stop offset="1" stop-color="#374151"/></linearGradient>`);
  }
  if(k === 'aa' && /^(aa_|aaa_)/.test(nm) || /aa_battery|aaa_battery/.test(nm)){
    s += `<rect x="3" y="8" width="${w - 6}" height="${h - 10}" rx="4" fill="url(#${id})" stroke="#000"/><rect x="${cx - 4}" y="2" width="8" height="8" rx="1" fill="#d1d5db" stroke="#6b7280"/><rect x="3" y="${h * .3}" width="${w - 6}" height="${h * .22}" fill="#111827"/><text x="${cx}" y="${h * .45}" text-anchor="middle" font-size="7" fill="#fbbf24" font-weight="700">1.5V</text>`;
    return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b45309"/><stop offset=".5" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient>`);
  }
  if(k === 'solar5' || k === 'solar12'){
    s += `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="3" fill="#1e3a8a" stroke="#0f172a"/>`;
    const cols = 4, rows = 3;
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++) s += `<rect x="${5 + c * ((w - 10) / cols)}" y="${5 + r * ((h - 10) / rows)}" width="${(w - 10) / cols - 2}" height="${(h - 10) / rows - 2}" fill="#2563eb" stroke="#93c5fd" stroke-width=".4"/>`;
    return wrap(d, s);
  }
  // genérico: caixa com selo de tensão
  const v = d.srcV || ({ b18: 3.7, lipo: 3.7, coin: 3, usb: 5, bank: 5, scap: 2.7 }[k]) || '';
  s += `<rect x="3" y="3" width="${w - 6}" height="${h - 8}" rx="6" fill="url(#${id})" stroke="#000"/><text x="${cx}" y="${h / 2}" text-anchor="middle" font-size="9" font-weight="700" fill="#e5e7eb">${v ? v + ' V' : ''}</text><text x="${cx}" y="${h / 2 + 11}" text-anchor="middle" font-size="5" fill="#cbd5e1" font-family="monospace">${esc(d.n.slice(0, 18))}</text>`;
  s += `<rect x="${cx - 6}" y="0" width="12" height="5" fill="#d1d5db" stroke="#6b7280"/>`;
  return wrap(d, s, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>`);
}

/* ---------------- despacho ---------------- */
const _svgFor = window.svgFor;
window.svgFor = function(inst){
  const d = inst.def;
  try {
    if(d.cat === 'board' || d.scr || d.cat === 'mcu' || d.cat === 'display') return _svgFor(inst);
    if(d.kind === 'led') return artLED(inst);
    if(d.kind === 'rgb') return artRGB(inst);
    if(d.kind === 'res') return artRes(inst);
    if(d.kind === 'cap') return artCap(inst);
    if(d.kind === 'd') return artDiode(inst);
    if(d.kind === 'bridge') return artIC(inst);
    if(d.kind === 'trans' && d.id !== 'optocoupler') return artTrans(inst);
    if(d.cat === 'passive' && RAW(inst).length >= 3 && !d.kind) return artIC(inst);
    if(d.kind === 'ic' || d.kind === 'ne555' || d.kind === 'opamp' || d.kind === 'lm317' || d.id === 'optocoupler') return artIC(inst);
    if(d.kind === 'btn') return artButton(inst);
    if(d.kind === 'sw') return artSwitch(inst);
    if(d.kind === 'dip') return artDip(inst);
    if(d.kind === 'pot') return artPot(inst);
    if(d.kind === 'enc') return artEnc(inst);
    if(d.kind === 'joy') return artJoy(inst);
    if(d.kind === 'key') return artKeypad(inst);
    if(d.kind === 'buzzer') return artBuzzer(inst);
    if(d.kind === 'motor' || d.kind === 'fan') return artMotor(inst);
    if(d.kind === 'servo') return artServo(inst);
    if(d.kind === 'relayN' || d.kind === 'relay_mod') return artRelayMod(inst);
    if(d.cat === 'power') return artPower(inst);
    if(d.cat === 'sensor' || d.cat === 'comm' || d.kind === 'hbridge' || d.kind === 'mosmod' || d.kind === 'uln' || d.kind === 'ssr' || d.kind === 'relay' || d.kind === 'stepper' || d.kind === 'strip'){
      if(d.kind === 'strip' || d.kind === 'stepper') return _svgFor(inst);
      if((d.id === 'dht11' || d.id === 'dht22') ) return _svgFor(inst);
      return artModule(inst);
    }
  } catch(e){ console.warn('art', d.id, e); }
  return _svgFor(inst);
};
if(typeof renderBench === 'function') try { renderBench(); } catch(e){}
})();
