/* =========================================================================
   Kezle Lab Pro — Solver de circuito real (Análise Nodal Modificada)
   - Redes = fios + trilhas da protoboard + pinos encaixados nos furos
   - Resistor/LED/diodo/transistor/MOSFET/capacitor/indutor/relé/botão...
   - Fontes com resistência interna, GPIO como fonte Thevenin, ADC lê tensão
   - Nada acende "por osmose": a corrente real decide tudo.
   ========================================================================= */
(function(){
'use strict';

const VT = 0.025852;
const GMIN = 1e-10;
const exp = x => Math.exp(Math.max(-60, Math.min(60, x)));

const CIR = window.CIRCUIT = {
  V: new Map(),          // chave 'partId:pin' -> tensão
  nets: null,
  last: null,
  prevV: {},
  dirty: true,
  stats: { iters: 0, ms: 0, nodes: 0, elems: 0, converged: true },
  react: {}              // estado de capacitores/indutores/relés por id de peça
};

/* ---------- utilidades de pinos ---------- */
const pinName = (inst, i) => (inst.def.pinNames && inst.def.pinNames[i]) || '';
function findPin(inst, re){
  const names = inst.def.pinNames || [];
  for(let i = 0; i < names.length; i++) if(re.test(names[i])) return i;
  return -1;
}
const RE_GND = /^(GND\d*|G|VSS|−|-|K|B-|BAT-|USB-|IN-|OUT-|3V3-|5V-|GND)$/i;
const RE_VCC = /^(VCC|VIN|VDD|3V3|5V|\+5V|V\+|VM|\+|B\+|BAT\+|USB\+|IN\+)$/i;

function gpioOf(def, name){
  let m;
  if(def.id === 'nodemcu'){
    const t = { D0: 16, D1: 5, D2: 4, D3: 0, D4: 2, D5: 14, D6: 12, D7: 13, D8: 15, A0: 17, RXD: 3, TXD: 1 };
    if(name in t) return t[name];
  }
  if((m = name.match(/^(?:IO|GPIO|GP)(\d+)$/i))) return +m[1];
  if(/^(uno|nano|nano_every|pro_mini|mega|leonardo|attiny)$/.test(def.id)){
    if((m = name.match(/^D(\d+)$/i))) return +m[1];
    if((m = name.match(/^A(\d+)$/i))) return (def.id === 'mega' ? 54 : 14) + +m[1];
    if((m = name.match(/^P(\d+)$/))) return +m[1];
  }
  if((m = name.match(/^D(\d+)$/i))) return +m[1];
  if((m = name.match(/^P([A-H])(\d+)$/))) return (m[1].charCodeAt(0) - 65) * 16 + +m[2];
  if((m = name.match(/^(\d+)$/))) return +m[1];
  if((m = name.match(/^A(\d+)$/i))) return 100 + +m[1];
  return null;
}
function pinClass(def, name){
  if(/^(GND\d*[a-z]?|GND)$/i.test(name)) return 'gnd';
  if(/^(3V3[a-z]?|3\.3V)$/i.test(name)) return 'v3';
  if(/^(5V|VIN|VBUS|VSYS|\+5V)$/i.test(name)) return 'v5';
  if(gpioOf(def, name) != null) return 'io';
  return 'other';
}
CIR.gpioOf = gpioOf;

function primaryMcu(){ return BENCH.parts.find(p => p.def.cat === 'mcu' && !p.def.scr_only); }
CIR.primaryMcu = primaryMcu;

/* ---------- construção das redes ---------- */
function buildNets(){
  const parent = new Map();
  const find = x => { if(!parent.has(x)) parent.set(x, x); let r = x; while(parent.get(r) !== r) r = parent.get(r); while(parent.get(x) !== r){ const n = parent.get(x); parent.set(x, r); x = n; } return r; };
  const uni = (a, b) => { const ra = find(a), rb = find(b); if(ra !== rb) parent.set(ra, rb); };

  const boards = [];
  for(const p of BENCH.parts){
    const n = pinOffsets(p).length;
    for(let i = 0; i < n; i++) find(p.id + ':' + i);
    if(p.def.cat === 'board'){
      const H = boardHoles(p.def);
      const first = {};
      H.forEach((h, i) => {
        find(p.id + ':' + i);
        if(h.g in first) uni(p.id + ':' + first[h.g], p.id + ':' + i); else first[h.g] = i;
      });
      boards.push({ p, H });
    }
  }
  // pinos encaixados nos furos
  const plugs = [];
  if(boards.length){
    for(const p of BENCH.parts){
      if(p.def.cat === 'board') continue;
      const offs = pinOffsets(p);
      for(let i = 0; i < offs.length; i++){
        const q = pinPos(p.id, i);
        for(const b of boards){
          const bx = q.x - b.p.x, by = q.y - b.p.y;
          if(bx < -6 || by < -6 || bx > b.p.def.w + 6 || by > b.p.def.h + 6) continue;
          let best = -1, bd = 4.6;
          for(let k = 0; k < b.H.length; k++){
            const dx = b.H[k].x - bx, dy = b.H[k].y - by;
            const dd = Math.hypot(dx, dy);
            if(dd < bd){ bd = dd; best = k; }
          }
          if(best >= 0){ uni(p.id + ':' + i, b.p.id + ':' + best); plugs.push({ part: p.id, pin: i, board: b.p.id, hole: best }); break; }
        }
      }
    }
  }
  for(const w of BENCH.wires) uni(w.a.p + ':' + w.a.i, w.b.p + ':' + w.b.i);
  const counts = new Map();
  // pinos internos equivalentes dos MCUs (GND, 3V3, 5V)
  for(const m of BENCH.parts){
    if(m.def.cat !== 'mcu') continue;
    const names = m.def.pinNames || [];
    let g0 = null, v30 = null, v50 = null;
    names.forEach((nme, i) => {
      const c = pinClass(m.def, nme);
      const key = m.id + ':' + i;
      if(c === 'gnd'){ if(g0) uni(g0, key); else g0 = key; }
      if(c === 'v3'){ if(v30) uni(v30, key); else v30 = key; }
      if(c === 'v5' && !/^VIN$/i.test(nme) || (c === 'v5' && !v50)){ if(v50) uni(v50, key); else v50 = key; }
    });
  }
  for(const p of BENCH.parts){ if(p.def.cat === 'board') continue; const n = pinOffsets(p).length; for(let i = 0; i < n; i++){ const r = find(p.id + ':' + i); counts.set(r, (counts.get(r) || 0) + 1); } }
  for(const w of BENCH.wires){ const r = find(w.a.p + ':' + w.a.i); counts.set(r, (counts.get(r) || 0) + 1); }
  return { find, plugs, counts };
}
CIR.buildNets = buildNets;

/* ---------- elementos ---------- */
function lin(nodes, J, I0, owner, tag){ return { n: nodes, lin: true, J, I0, owner, tag }; }
function res(a, b, R, owner, tag){
  if(!Number.isFinite(R)) R = 1e9;
  const g = 1 / Math.max(R, 1e-6);
  return lin([a, b], [[g, -g], [-g, g]], [0, 0], owner, tag);
}
function thev(p, m, V, R, owner, tag){
  if(!Number.isFinite(V)) V = 0; if(!Number.isFinite(R)) R = 1e9;
  const g = 1 / Math.max(R, 1e-6);
  return lin([p, m], [[g, -g], [-g, g]], [-g * V, g * V], owner, tag);
}
function nonlin(nodes, f, owner, tag){ return { n: nodes, lin: false, f, owner, tag }; }

function diodeElem(a, k, Is, nvt, owner, tag, Vz){
  return nonlin([a, k], v => {
    const vd = v[0] - v[1];
    let I = Is * (exp(vd / nvt) - 1) + GMIN * vd;
    if(Vz) I -= 1e-3 * exp((-vd - Vz) / 0.04);
    return [I, -I];
  }, owner, tag);
}
const LEDV = { '#ff3b30': 1.9, '#ef4444': 1.9, '#ff0000': 1.9, '#ff9500': 2.0, '#fbbf24': 2.05, '#ffd60a': 2.05, '#22c55e': 2.15, '#00ff00': 2.15, '#3b82f6': 3.0, '#0000ff': 3.0, '#ffffff': 3.1, '#a855f7': 3.2 };
function ledVf(color){
  if(!color) return 1.9;
  color = color.toLowerCase();
  if(LEDV[color]) return LEDV[color];
  const m = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if(!m) return 2.0;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  if(r > 200 && g > 200 && b > 200) return 3.1;
  if(b > r && b > g) return 3.0;
  if(g > r) return 2.15;
  if(g > 120) return 2.05;
  return 1.9;
}
function ledElem(a, k, Vf, owner, tag){
  const nvt = 2 * VT;
  const Is = 0.02 / Math.exp(Vf / nvt);
  return diodeElem(a, k, Is, nvt, owner, tag);
}

function bjt(B, C, E, type, beta, owner, tag){
  const s = type === 'pnp' ? -1 : 1;
  const Is = 1.2e-14, br = 4;
  return nonlin([B, C, E], v => {
    const vbe = s * (v[0] - v[2]), vbc = s * (v[0] - v[1]);
    const If = Is * (exp(vbe / VT) - 1), Ir = Is * (exp(vbc / VT) - 1);
    const Ic = If - Ir * (1 + 1 / br);
    const Ib = If / beta + Ir / br;
    const iB = s * Ib, iC = s * Ic;
    return [iB + GMIN * (v[0] - v[2]), iC + GMIN * (v[1] - v[2]), -(iB + iC) - GMIN * (v[0] - v[2]) - GMIN * (v[1] - v[2])];
  }, owner, tag);
}
function mosfet(G, D, S, pch, Vth, Kp, owner, tag){
  const s = pch ? -1 : 1;
  return nonlin([G, D, S], v => {
    let vd = v[1], vs = v[2];
    let sw = 1;
    if(s * (vd - vs) < 0){ const t = vd; vd = vs; vs = t; sw = -1; }
    const vgs = s * (v[0] - vs), vds = s * (vd - vs);
    const vov = vgs - Vth;
    let id = 0;
    if(vov > 0){
      if(vds < vov) id = Kp * (vov * vds - vds * vds / 2);
      else id = (Kp / 2) * vov * vov * (1 + 0.01 * (vds - vov));
    }
    id += 1e-9 * vds;
    const iD = s * id * sw;
    return [0, iD, -iD];
  }, owner, tag);
}

function capElem(a, b, C, dt, vprev, owner, tag){
  const g = C / dt;
  return lin([a, b], [[g, -g], [-g, g]], [-g * vprev, g * vprev], owner, tag);
}
function indElem(a, b, L, dt, iprev, owner, tag){
  const g = dt / L;
  return lin([a, b], [[g, -g], [-g, g]], [iprev, -iprev], owner, tag);
}

/* ---------- parâmetros por tipo de peça ---------- */
const SRC = {
  b9: [9.0, 1.7], aa: [1.5, 0.2], aaa: [1.5, 0.3], b18: [3.7, 0.08], lipo: [3.7, 0.1], coin: [3.0, 15],
  usb: [5.0, 0.1], bank: [5.0, 0.1]
};
function lightFrac(){ try { return clamp(dayLight() + 0.05, 0, 1); } catch(e){ return 0.8; } }

function resistanceOf(inst){
  const d = inst.def, p = inst.props, st = inst.state;
  if(d.kind === 'res') return Math.max(0.001, +p.value || 220);
  return null;
}
function ldrR(inst){
  const lux = inst.state.vals && inst.state.vals.lux != null ? inst.state.vals.lux : 300;
  return clamp(1e6 * Math.pow(Math.max(lux, 0.1) / 10, -0.8) / 1.5, 150, 2e6);
}

/* sensores com saída analógica: retorna tensão como fração da alimentação */
function analogFrac(inst){
  const v = inst.state.vals || {};
  const d = inst.def;
  const n = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
  switch(d.sk){
    case 'luxA': return n(v.raw != null ? v.raw : 2000, 0, 4095);
    case 'gas': return n(Math.log10(Math.max(v.ppm || 400, 10)), 1, 4);
    case 'soil': return 1 - n(v.moisture != null ? v.moisture : 40, 0, 100) * 0.8;
    case 'rain': return 1 - n(v.wetness || 0, 0, 100);
    case 'wlev': return n(v.level || 0, 0, 100);
    case 'snd': return n(v.db || 40, 20, 110);
    case 'hall': return 0.5 + clamp((v.field || 0) / 200, -0.45, 0.45);
    case 'curr': return 0.5 + clamp((v.current || 0) / 40, -0.45, 0.45);
    case 'volt': return n(v.voltage || 0, 0, 250);
    case 'ph': return n(v.ph != null ? v.ph : 7, 0, 14);
    case 'tds': return n(v.tds || 0, 0, 1000);
    case 'dust': return n(v.pm25 || 0, 0, 600);
  }
  return null;
}


/* ---------- motores: modelo elétrico + mecânico (RPM, força contra-eletromotriz) ---------- */
const MOTORS = {
  dcmotor:        { Vn: 6,   rpm: 9000,  Istall: 1.2,  I0: 0.12, tau: 0.12 },
  dcmotor_encoder:{ Vn: 6,   rpm: 150,   Istall: 0.9,  I0: 0.08, tau: 0.2 },
  dc_gearmotor:   { Vn: 6,   rpm: 100,   Istall: 1.0,  I0: 0.07, tau: 0.25 },
  vibro:          { Vn: 3.3, rpm: 12000, Istall: 0.12, I0: 0.06, tau: 0.08 },
  fan5v:          { Vn: 5,   rpm: 4500,  Istall: 0.35, I0: 0.14, tau: 0.35 }
};
function motorSpec(d){
  if(d._mot) return d._mot;
  const b = MOTORS[d.id] || { Vn: d.vcc || 6, rpm: d.kind === 'fan' ? 4000 : 8000, Istall: 1, I0: 0.1, tau: 0.15 };
  const Ra = b.Vn / b.Istall;
  const Ke = (b.Vn - b.I0 * Ra) / b.rpm; // V por rpm
  return d._mot = { Vn: b.Vn, rpmNL: b.rpm, Ra, Ke, I0: b.I0, Irated: b.Istall * 0.45, tau: b.tau, Vstart: b.I0 * Ra * 1.4 };
}
CIR.motorSpec = motorSpec;
function burn(inst, why){
  const st = inst.state;
  if(st.burnt) return;
  st.burnt = true; st.on = false; st.brightness = 0; st.rpm = 0; st.heat = 1;
  serialOut('🔥 ' + inst.def.n + ' queimou — ' + why, 'err');
  toast('🔥 ' + inst.def.n + ' queimou', 'err');
}
/* aquecimento: ratio>1 aquece, <1 esfria; ao chegar em 100% queima */
function thermal(inst, ratio, dt, k, why){
  const st = inst.state;
  st.heat = st.heat || 0;
  if(ratio > 1) st.heat += (ratio - 1) * (k || 0.6) * dt;
  else st.heat = Math.max(0, st.heat - dt * 0.2);
  st.heat = Math.min(st.heat, 1.2);
  if(st.heat >= 1) burn(inst, why);
}

/* ---------- construção da lista de elementos ---------- */
function buildElements(net, dt){
  const find = net.find;
  const els = [];
  const sources = [];   // {neg: key}
  const key = (inst, i) => inst.id + ':' + i;
  const K = (inst, i) => (i == null || i < 0) ? ('float:' + inst.id + ':' + Math.random()) : find(key(inst, i));
  const mcu = primaryMcu();
  const R = CIR.react;
  const prev = CIR.prevV;
  const pv = k => { const x = prev[k]; return Number.isFinite(x) ? x : 0; };
  const state = CIR.devState = CIR.devState || {};

  for(const inst of BENCH.parts){
    const d = inst.def, p = inst.props, st = inst.state, id = inst.id;
    const pn = i => pinName(inst, i);
    const A = i => K(inst, i);
    if(d.cat === 'board') continue;
    inst.cs = { I: {}, V: {}, note: '' };
    if(st.burnt) continue;

    /* ===== MCU ===== */
    if(d.cat === 'mcu'){
      const names = d.pinNames || [];
      const gnd = names.map((n, i) => pinClass(d, n) === 'gnd' ? i : -1).filter(i => i >= 0);
      const gKey = gnd.length ? find(key(inst, gnd[0])) : null;
      if(!gKey) continue;
      sources.push({ neg: gKey, mcu: true });
      const vdd = d.vcc || 3.3;
      let v5i = names.findIndex(n => /^(5V|VBUS)$/i.test(n)); if(v5i < 0) v5i = names.findIndex(n => /^(VIN|VSYS)$/i.test(n));
      const v3i = names.findIndex(n => /^3V3$/i.test(n));
      const k5 = v5i >= 0 ? find(key(inst, v5i)) : null, k3 = v3i >= 0 ? find(key(inst, v3i)) : null;
      let powered = false, fedVin = false;
      if(SIM.on){
        if(SIM.vusb) powered = true;
        else {
          if(k5 && pv(k5) - pv(gKey) > (vdd > 4 ? 4.3 : 3.9)) { powered = true; fedVin = true; }
          if(k3 && pv(k3) - pv(gKey) > 2.9) powered = true;
          if(!d.pinNames.some(n => /^(3V3|5V|VIN|VBUS|VSYS)$/i.test(n)) ) powered = SIM.vusb;
        }
      }
      st.mcuPow = powered;
      inst.cs.note = powered ? (SIM.vusb ? 'USB virtual 5V' : 'alimentação externa') : 'sem energia';
      if(!powered) continue;
      if(!SIM.vusb){ if(fedVin && k5) els.push(res(k5, gKey, 5 / 0.09, inst, 'load')); else if(k3) els.push(res(k3, gKey, 3.3 / 0.07, inst, 'load')); }
      if(SIM.vusb){
        if(k5) els.push(thev(k5, gKey, 5, 0.3, inst, '5V'));
        if(k3) els.push(thev(k3, gKey, 3.3, 1.0, inst, '3V3'));
      } else if(fedVin && k3 && vdd < 4) els.push(thev(k3, gKey, 3.3, 1.0, inst, '3V3'));
      if(vdd > 4 && !SIM.vusb && k5 == null){}
      names.forEach((nme, i) => {
        if(pinClass(d, nme) !== 'io') return;
        const g = gpioOf(d, nme);
        const kk = find(key(inst, i));
        const ps = (typeof PINS !== 'undefined' && PINS[g]) || null;
        const outMode = ps && (ps.mode === 'out' || (ps.mode == null && ps.v != null));
        if(outMode && !(ps.hiz)){
          let level = ps.v ? vdd : 0;
          if(ps.duty != null && ps.duty > 0 && ps.duty < 1023 && ps.pwmPhase != null) level = ps.pwmPhase ? vdd : 0;
          els.push(thev(kk, gKey, level, vdd > 4 ? 40 : 25, inst, 'io' + g));
        } else if(ps && ps.pull === 'up') els.push(thev(kk, gKey, vdd, 45000, inst, 'pu' + g));
        else if(ps && ps.pull === 'down') els.push(res(kk, gKey, 45000, inst, 'pd' + g));
        else els.push(res(kk, gKey, 1e8, inst, 'z' + g));
      });
      continue;
    }

    /* ===== FONTES ===== */
    if(d.cat === 'power'){
      const kd = d.kind;
      const pp = findPin(inst, /^(\+|B\+|BAT\+|USB\+|IN\+|VBUS)$/), pm = findPin(inst, /^(−|-|B-|BAT-|USB-|IN-|GND)$/);
      if((kd in SRC || d.srcV) && pp >= 0 && pm >= 0){
        let [V, Rint] = d.srcV ? [d.adj ? (+p.vset || 5) : d.srcV, d.srcR || 0.2] : SRC[kd];
        if(p.drain) V *= (1 - clamp(+p.drain, 0, 0.5));
        els.push(thev(A(pp), A(pm), V, Rint, inst, 'src'));
        sources.push({ neg: A(pm) });
      } else if((kd === 'solar5' || kd === 'solar12') && pp >= 0){
        const Voc = (d.solarV || (kd === 'solar5' ? 6.0 : 21)) * (0.15 + 0.85 * lightFrac()) * (+p.pct / 100 || 1);
        els.push(thev(A(pp), A(pm), Voc, kd === 'solar5' ? 6 : 12, inst, 'src'));
        sources.push({ neg: A(pm) });
      } else if(kd === 'scap'){
        const rs = R[id] = R[id] || { v: +p.chargeV || 0 };
        els.push(capElem(A(pp), A(pm), 5, dt, rs.v, inst, 'cap'));
        els.push(res(A(pp), A(pm), 2e5, inst, 'leak'));
        sources.push({ neg: A(pm) });
      } else if(kd === 'tp4056' || kd === 'tp4056u' || kd === 'tp4056d'){
        const bp = findPin(inst, /^(B\+|BAT\+)$/), bm = findPin(inst, /^(B-|BAT-)$/), up = findPin(inst, /^USB\+$/), um = findPin(inst, /^USB-$/);
        const usbV = pv(A(up)) - pv(A(um));
        const usbOn = usbV > 4.3;
        const bV = pv(A(bp)) - pv(A(bm));
        if(bp >= 0 && bm >= 0 && up >= 0 && um >= 0){
          els.push(res(A(bm), A(um), 0.01, inst, 'gnd'));
          if(usbOn){ const vt = Math.min(4.2, Math.max(bV + 0.3, 3.0)); els.push(thev(A(bp), A(bm), 4.2, 1.2, inst, 'chg')); }
        }
        const outP = findPin(inst, /^(5V\+|3V3\+)$/), outM = findPin(inst, /^(5V-|3V3-)$/);
        if(outP >= 0 && outM >= 0){
          const vin = usbOn ? usbV : bV;
          const tgt = kd === 'tp4056u' ? 5 : 3.3;
          if(vin > (kd === 'tp4056u' ? 2.8 : tgt + 0.3)) els.push(thev(A(outP), A(outM), tgt, 0.4, inst, 'reg'));
          els.push(res(A(outM), A(bm), 0.01, inst, 'gnd2'));
        }
        sources.push({ neg: A(bm) });
      } else if(kd === 'buck'){
        const ip = findPin(inst, /^IN\+$/), im = findPin(inst, /^IN-$/), op = findPin(inst, /^OUT\+$/), om = findPin(inst, /^OUT-$/);
        const vin = pv(A(ip)) - pv(A(im)); const tgt = +p.vout || 5;
        els.push(res(A(im), A(om), 0.01, inst, 'gnd'));
        if(vin > tgt + 0.6) els.push(thev(A(op), A(om), tgt, 0.3, inst, 'buck'));
        else if(vin > 3) els.push(thev(A(op), A(om), Math.max(0, vin - 0.6), 0.5, inst, 'buck'));
        els.push(res(A(ip), A(im), 400, inst, 'iq'));
      } else if(kd === 'mt3608'){
        const ip = findPin(inst, /^IN\+$/), im = findPin(inst, /^IN-$/), op = findPin(inst, /^OUT\+$/), om = findPin(inst, /^OUT-$/);
        const vin = pv(A(ip)) - pv(A(im));
        const tgt = +p.vout || 5;
        els.push(res(A(im), A(om), 0.01, inst, 'gnd'));
        if(vin > 2.2 && vin < tgt) els.push(thev(A(op), A(om), tgt, 0.5, inst, 'boost'));
        else if(vin >= tgt) els.push(thev(A(op), A(om), vin - 0.3, 0.5, inst, 'boost'));
      }
      continue;
    }

    /* ===== PASSIVOS ===== */
    if(d.kind === 'res'){ els.push(res(A(0), A(1), resistanceOf(inst), inst, 'R')); continue; }
    if(d.kind === 'cap' && (d.id === 'cap' || d.capModel)){
      const unit = p.capUnit || 'µF';
      const C = (+p.capVal || 100) * (unit === 'pF' ? 1e-12 : unit === 'nF' ? 1e-9 : unit === 'mF' ? 1e-3 : 1e-6);
      const rs = R[id] = R[id] || { v: 0 };
      els.push(capElem(A(0), A(1), C, dt, rs.v, inst, 'cap'));
      els.push(res(A(0), A(1), 1e8, inst, 'leak'));
      continue;
    }
    if(d.id === 'inductor_10uh' || d.id2 === 'inductor'){
      const rs = R[id] = R[id] || { i: 0 };
      els.push(indElem(A(0), A(1), (+p.L || 10) * 1e-6, dt, rs.i, inst, 'L'));
      els.push(res(A(0), A(1), 1e7, inst, 'leak'));
      continue;
    }
    if(d.id === 'fuse' || d.id2 === 'fuse'){
      const rs = R[id] = R[id] || { blown: false };
      els.push(res(A(0), A(1), rs.blown ? 1e9 : 0.05, inst, 'fuse'));
      continue;
    }
    if(d.id === 'varistor'){
      els.push(nonlin([A(0), A(1)], v => { const x = v[0] - v[1]; const I = 1e-9 * x + 1e-3 * (exp((x - 275) / 12) - exp((-x - 275) / 12)); return [I, -I]; }, inst, 'MOV'));
      continue;
    }
    if(d.id === 'crystal_16mhz'){ els.push(res(A(0), A(1), 1e9, inst, 'xtal')); continue; }
    if(d.kind === 'd'){
      const zener = /zener/.test(d.id);
      const zm = d.id.match(/zener_(\d+)v(\d*)/);
      const Vz = zener ? (zm ? parseFloat(zm[1] + '.' + (zm[2] || '0')) : 5.1) : 0;
      if(d.vf){ const nv = 1.1 * VT; els.push(diodeElem(A(0), A(1), (d.ifm || 0.1) / Math.exp(d.vf / nv), nv, inst, 'D')); }
      else els.push(diodeElem(A(0), A(1), zener ? 1e-12 : 7.7e-9, zener ? 1.0 * VT * 1.6 : 1.8 * VT, inst, 'D', Vz));
      continue;
    }
    if(d.kind === 'led'){
      els.push(ledElem(A(0), A(1), ledVf(p.color), inst, 'LED'));
      continue;
    }
    if(d.kind === 'rgb'){
      const base = [[0, 1.9], [1, 2.15], [2, 3.0]];
      for(const [i, vf] of base) els.push(ledElem(A(i), A(3), vf, inst, 'LED' + i));
      continue;
    }
    if(d.kind === 'bridge'){
      const nv = 1.8 * VT, Is = 7.7e-9;
      els.push(diodeElem(A(0), A(2), Is, nv, inst, 'D1')); els.push(diodeElem(A(1), A(2), Is, nv, inst, 'D2'));
      els.push(diodeElem(A(3), A(0), Is, nv, inst, 'D3')); els.push(diodeElem(A(3), A(1), Is, nv, inst, 'D4'));
      continue;
    }
    if(d.kind === 'trans' && d.id !== 'optocoupler' && d.id !== 'triac'){
      let type = 'npn', mos = false;
      if(d.tt){ if(d.tt === 'nmos') mos = 'n'; else if(d.tt === 'pmos') mos = 'p'; else type = d.tt; }
      else if(d.id === 'mosfet_n') mos = 'n'; else if(d.id === 'mosfet_p') mos = 'p';
      else {
        const t = p.ttype || 'NPN (2N2222)';
        if(/MOSFET-N/.test(t)) mos = 'n'; else if(/MOSFET-P/.test(t)) mos = 'p'; else if(/PNP/.test(t)) type = 'pnp';
      }
      if(mos) els.push(mosfet(A(0), A(1), A(2), mos === 'p', d.vth != null ? d.vth : (mos === 'p' ? -3.5 : (/irlz|logic|2n7000/i.test(p.ttype || '') ? 1.8 : 3.5)), d.id === 'm_2n7000' || d.id === 'm_bs170' ? 0.15 : 2.0, inst, 'M'));
      else els.push(bjt(A(0), A(1), A(2), type, d.beta || (type === 'pnp' ? 120 : 150), inst, 'Q'));
      continue;
    }
    if(d.id === 'optocoupler'){
      // A,K,C,E : LED + fototransistor (CTR ~ 100%)
      const Vf = 1.2, nvt = 1.8 * VT, Is = 0.01 / Math.exp(Vf / nvt);
      const led = diodeElem(A(0), A(1), Is, nvt, inst, 'LED');
      els.push(led);
      const ledI = (inst.cs && inst.cs.prevLed) || 0;
      const Ic = CIR.optoI = CIR.optoI || {};
      const ic = Ic[id] || 0;
      els.push(nonlin([A(2), A(3)], v => { const vce = v[0] - v[1]; const sat = Math.tanh(Math.max(vce, 0) / 0.3); return [ic * sat + GMIN * vce, -(ic * sat + GMIN * vce)]; }, inst, 'PT'));
      continue;
    }
    if(d.id === 'triac'){
      const rs = R[id] = R[id] || { on: false };
      els.push(res(A(1), A(2), rs.on ? 0.3 : 1e8, inst, 'T'));
      els.push(res(A(0), A(1), 100, inst, 'G'));
      continue;
    }
    if(d.kind === 'ic' && d.reg){
      const vi = pv(A(0)) - pv(A(1)); const R2 = d.reg;
      if(vi > R2.vin_min) els.push(thev(A(2), A(1), R2.vout, 0.5, inst, 'reg'));
      else if(vi > R2.vout * 0.6) els.push(thev(A(2), A(1), Math.max(0, vi - (R2.vin_min - R2.vout)), 0.8, inst, 'reg'));
      els.push(res(A(0), A(1), 4000, inst, 'iq'));
      continue;
    }
    if(d.kind === 'lm317'){ // ADJ, OUT, IN : Vout = 1,25 (1 + R2/R1) — usa a tensão real do pino ADJ
      const vo = pv(A(1)), va = pv(A(0));
      if(pv(A(2)) - vo > 2.5 || vo < va + 1.0) els.push(thev(A(1), A(0), 1.25, 0.8, inst, 'reg'));
      els.push(res(A(0), A(2), 1e6, inst, 'iq'));
      continue;
    }
    if(d.kind === 'ne555'){
      const rs = R[id] = R[id] || { q: 0 };
      const vcc = pv(A(7)) - pv(A(0));
      els.push(res(A(7), A(0), Math.max(vcc, 4.5) / 0.006, inst, 'iq'));
      if(vcc > 4.2){
        els.push(rs.q ? thev(A(2), A(0), vcc - 1.7, 60, inst, 'OUT') : thev(A(2), A(0), 0.1, 12, inst, 'OUT'));
        els.push(res(A(6), A(0), rs.q ? 1e9 : 10, inst, 'DIS'));
      } else { els.push(res(A(2), A(0), 1e9, inst, 'OUT')); els.push(res(A(6), A(0), 1e9, inst, 'DIS')); }
      for(const k of [1, 3, 5]) els.push(res(A(k), A(0), 1e9, inst, 'hz' + k));
      els.push(thev(A(4), A(0), vcc * 2 / 3, 5000, inst, 'ctrl')); els.push(res(A(7), A(3), 1e5, inst, 'rst'));
      continue;
    }
    if(d.kind === 'opamp'){
      const chans = d.pinNames.length === 14 ? [[0, 1, 2], [6, 5, 4], [7, 8, 9], [13, 12, 11]] : [[0, 1, 2], [6, 5, 4]];
      const iv = d.pinNames.indexOf('VCC'), ig = d.pinNames.indexOf('GND');
      els.push(res(A(iv), A(ig), 5 / 0.0007, inst, 'iq'));
      chans.forEach(([o, m, pl], ci) => {
        if(d.comp){
          els.push(nonlin([A(o), A(m), A(pl), A(ig)], v => { const dv = v[2] - v[1]; const sink = 0.5 * (1 - Math.tanh(dv * 200)); const g = sink / 12 + 1e-9; const I = g * (v[0] - v[3]); return [I, 0, 0, -I]; }, inst, 'C' + ci));
        } else {
          els.push(nonlin([A(o), A(m), A(pl), A(iv), A(ig)], v => { const lo = v[4] + 0.05, hi = v[3] - 1.5; const tgt = lo + (hi - lo) * 0.5 * (1 + Math.tanh(1500 * (v[2] - v[1]) / Math.max(hi - lo, 1))); const I = (v[0] - tgt) / 80; return [I, 0, 0, 0, -I]; }, inst, 'A' + ci));
        }
        els.push(res(A(m), A(ig), 1e10, inst, 'im' + ci)); els.push(res(A(pl), A(ig), 1e10, inst, 'ip' + ci));
      });
      continue;
    }
    if(d.kind === 'mosmod'){
      const sig = findPin(inst, /^SIG$/), ig = findPin(inst, /^GND$/), vm = findPin(inst, /^V−$/);
      els.push(mosfet(A(sig), A(vm), A(ig), false, 3.0, 2.0, inst, 'M'));
      els.push(res(A(findPin(inst, /^VCC$/)), A(ig), 5000, inst, 'iq'));
      continue;
    }
    if(d.kind === 'uln'){
      const ig = findPin(inst, /^GND$/);
      for(let i = 1; i <= 7; i++){
        const ii = findPin(inst, new RegExp('^IN' + i + '$')), oo = findPin(inst, new RegExp('^OUT' + i + '$'));
        els.push(nonlin([A(ii), A(oo), A(ig)], v => { const ib = Math.max(0, (v[0] - v[2] - 1.4) / 2700); const ic = Math.min(ib * 1000, 0.5) * Math.tanh(Math.max(v[1] - v[2], 0) / 0.3); return [ib + 1e-10 * (v[0] - v[2]), ic + 1e-9 * (v[1] - v[2]), -(ib + ic) - 1e-10 * (v[0] - v[2]) - 1e-9 * (v[1] - v[2])]; }, inst, 'CH' + i));
        const cm = findPin(inst, /^COM$/); if(cm >= 0) els.push(diodeElem(A(oo), A(cm), 1e-9, 1.8 * VT, inst, 'fly' + i));
      }
      continue;
    }
    if(d.kind === 'ssr'){
      const rs = R[id] = R[id] || { on: false };
      els.push(ledElem(A(0), A(1), 1.2, inst, 'IN'));
      els.push(res(A(2), A(3), rs.on ? 0.1 : 1e9, inst, 'LOAD'));
      continue;
    }
    if(d.kind === 'relayN'){
      const n = d.channelsN, iv = findPin(inst, /^VCC$/), ig = findPin(inst, /^GND$/);
      const rs = R[id] = R[id] || { on: [] };
      const vs = pv(A(iv)) - pv(A(ig));
      els.push(res(A(iv), A(ig), 5 / (0.015 + 0.07 * n), inst, 'coil'));
      const lowActive = !p.activeHigh;
      for(let c = 1; c <= n; c++){
        const ii = findPin(inst, new RegExp('^IN' + c + '$')), com = findPin(inst, new RegExp('^COM' + c + '$')), no = findPin(inst, new RegExp('^NO' + c + '$')), nc = findPin(inst, new RegExp('^NC' + c + '$'));
        const sig = pv(A(ii)) - pv(A(ig));
        rs.on[c - 1] = vs > 3.2 && (lowActive ? sig < 1.0 : sig > 2.0);
        // módulos reais têm entrada ativa-BAIXA com pull-up interno: o relé só fecha ao levar IN a 0 V
        els.push(thev(A(ii), A(iv), vs, 2000, inst, 'in' + c));
        els.push(res(A(com), A(no), rs.on[c - 1] ? 0.05 : 1e9, inst, 'NO' + c));
        els.push(res(A(com), A(nc), rs.on[c - 1] ? 1e9 : 0.05, inst, 'NC' + c));
      }
      continue;
    }
    if(d.kind === 'hbridge'){
      const ig = findPin(inst, /^GND$/), ivs = findPin(inst, /^(VS|VM|B\+)$/), ivc = findPin(inst, /^(V5|VCC|VDD)$/);
      const vs = Math.max(0, pv(A(ivs)) - pv(A(ig)));
      const vlog = d.vcc || 5, drop = d.drop || 0.5;
      els.push(res(A(ivs), A(ig), Math.max(vs, 1) / 0.01, inst, 'iq'));
      if(ivc >= 0) els.push(res(A(ivc), A(ig), 5 / 0.036, inst, 'logic'));
      const floating = idx => net.counts && (net.counts.get(A(idx)) || 0) <= 1;
      const frac = idx => { if(idx < 0 || floating(idx)) return 1; return clamp((pv(A(idx)) - pv(A(ig))) / vlog, 0, 1); };
      const fracIn = idx => { if(idx < 0 || floating(idx)) return 0; return clamp((pv(A(idx)) - pv(A(ig))) / vlog, 0, 1); };
      let ci = 0;
      const out = (o, f, tag) => { if(o < 0) return; const high = Math.max(0, vs - drop); els.push(thev(A(o), A(ig), 0.2 + f * high, 0.6, inst, tag)); };
      const fp = nm => findPin(inst, new RegExp('^' + nm + '$'));
      if(d.bts){
        const en = Math.min(frac(fp('R_EN')), frac(fp('L_EN')));
        out(fp('M\\+'), en * fracIn(fp('RPWM')), 'M1'); out(fp('M−'), en * fracIn(fp('LPWM')), 'M2');
      } else {
        for(const [en, i1, i2, o1, o2] of d.ch){
          const e = en ? frac(fp(en)) : 1;
          const stby = findPin(inst, /^(STBY|SLP)$/);
          const stOK = stby < 0 || floating(stby) || pv(A(stby)) - pv(A(ig)) > 0.5 * vlog;
          out(fp(o1), (stOK ? e : 0) * fracIn(fp(i1)), 'OA' + ci);
          out(fp(o2), (stOK ? e : 0) * fracIn(fp(i2)), 'OB' + ci);
          ci++;
        }
      }
      continue;
    }
    /* ===== ENTRADAS / CONTROLES ===== */
    if(d.kind === 'btn'){
      const closed = !!(st.pressed || st.latched);
      els.push(res(A(0), A(1), 0.02, inst, 'A'));
      els.push(res(A(2), A(3), 0.02, inst, 'B'));
      els.push(res(A(0), A(2), closed ? 0.05 : 1e9, inst, 'SW'));
      continue;
    }
    if(d.kind === 'sw'){
      const pos = st.sw ? 1 : 0;
      els.push(res(A(0), A(1), pos ? 0.03 : 1e9, inst, 'NO'));
      els.push(res(A(0), A(2), pos ? 1e9 : 0.03, inst, 'NC'));
      continue;
    }
    if(d.kind === 'dip'){
      const bits = st.dip || (st.dip = Array(4).fill(0));
      for(let i = 0; i < 4; i++) els.push(res(A(i), A(7 - i), bits[i] ? 0.03 : 1e9, inst, 'S' + i));
      continue;
    }
    if(d.kind === 'pot'){
      const Rt = +p.rtotal || 10000;
      const f = clamp((+p.pct || 0) / 100, 0.001, 0.999);
      // VCC(0) - wiper(1) - GND(2)
      els.push(res(A(0), A(1), Rt * (1 - f), inst, 'R1'));
      els.push(res(A(1), A(2), Rt * f, inst, 'R2'));
      continue;
    }
    if(d.kind === 'joy'){
      const fx2 = clamp((p.jx == null ? 50 : +p.jx) / 100, 0.001, 0.999), fy = clamp((p.jy == null ? 50 : +p.jy) / 100, 0.001, 0.999);
      els.push(res(A(3), A(0), 10000 * (1 - fx2), inst, 'X1')); els.push(res(A(0), A(4), 10000 * fx2, inst, 'X2'));
      els.push(res(A(3), A(1), 10000 * (1 - fy), inst, 'Y1')); els.push(res(A(1), A(4), 10000 * fy, inst, 'Y2'));
      els.push(res(A(2), A(4), st.pressed ? 0.05 : 1e9, inst, 'SW'));
      els.push(thev(A(2), A(4), 0, 1e9, inst, 'x'));
      continue;
    }
    if(d.kind === 'enc'){
      const pos = st.encPos || 0;
      const cl = (((pos % 4) + 4) % 4); // quadratura
      const a = (cl === 1 || cl === 2), b = (cl === 2 || cl === 3);
      const iclk = d.pins === 3 ? 0 : 0, idt = 1, isw = 2, ivcc = d.pins >= 5 ? 3 : -1, ign = d.pins >= 5 ? 4 : -1;
      if(ign >= 0 && ivcc >= 0){
        els.push(res(A(iclk), A(ivcc), 10000, inst, 'pu1')); els.push(res(A(idt), A(ivcc), 10000, inst, 'pu2')); els.push(res(A(isw), A(ivcc), 10000, inst, 'pu3'));
        els.push(res(A(iclk), A(ign), a ? 50 : 1e9, inst, 'A')); els.push(res(A(idt), A(ign), b ? 50 : 1e9, inst, 'B'));
        els.push(res(A(isw), A(ign), st.pressed ? 50 : 1e9, inst, 'SW'));
      } else {
        els.push(res(A(0), A(1), a ? 50 : 1e9, inst, 'A')); els.push(res(A(2), A(1), st.pressed ? 50 : 1e9, inst, 'SW'));
      }
      continue;
    }
    if(d.kind === 'key'){
      const keys = st.keys || (st.keys = {});
      for(let r = 0; r < 4; r++) for(let c = 0; c < 4; c++) if(keys[r + ',' + c]) els.push(res(A(r), A(4 + c), 0.5, inst, 'K' + r + c));
      continue;
    }
    if(d.id === 'limit'){ /* usa kind 'sw' */ }

    /* ===== SENSORES RESISTIVOS ===== */
    if(d.id === 'ldr'){ els.push(res(A(0), A(1), ldrR(inst), inst, 'LDR')); continue; }
    if(d.id === 'force_sensor'){ const f = clamp((+p.pct || 0) / 100, 0, 1); els.push(res(A(0), A(1), 1e6 * Math.pow(1 - f, 3) + 300, inst, 'FSR')); continue; }
    if(d.id === 'flex_sensor'){ const f = clamp((+p.pct || 0) / 100, 0, 1); els.push(res(A(0), A(1), 25000 + f * 45000, inst, 'FLEX')); continue; }
    if(d.id === 'thumbwheel'){ }
    if(d.kind === 'ntc'){
      const T = (st.vals && st.vals.temperature != null ? st.vals.temperature : 25) + 273.15;
      els.push(res(A(0), A(1), 10000 * Math.exp(3950 * (1 / T - 1 / 298.15)), inst, 'NTC'));
      continue;
    }

    /* ===== ATUADORES / CARGAS ===== */
    if(d.kind === 'buzzer' && d.modBuzz){
      const iv = findPin(inst, /^(VCC|VIN|VDD|5V)$/), ig = findPin(inst, /^GND$/);
      els.push(res(A(iv), A(ig), 5 / 0.03, inst, 'load'));
      continue;
    }
    if(d.kind === 'buzzer'){
      const active = d.id === 'buzzA';
      els.push(res(A(0), A(1), active ? 42 : (d.id === 'speaker' ? 8 : 60), inst, 'load'));
      continue;
    }
    if(d.kind === 'motor' || d.kind === 'fan'){
      const M = motorSpec(d);
      const rs = R[id] = R[id] || { rpm: 0 };
      els.push(thev(A(0), A(1), M.Ke * rs.rpm, M.Ra, inst, 'M'));
      if(d.pins >= 4){ els.push(res(A(2), A(3), 1e8, inst, 'enc')); }
      continue;
    }
    if(d.kind === 'relay' && d.id !== 'peltier' && d.id !== 'solenoid' && !d.id2){
      // módulo relé: SIG,VCC,GND (+ COM,NO,NC quando existirem)
      const ig = findPin(inst, /^SIG\d*$/), iv = findPin(inst, /^VCC$/), ign = findPin(inst, /^GND$/);
      if(iv >= 0 && ign >= 0){
        els.push(res(A(iv), A(ign), 5 / 0.07, inst, 'coil'));
        const rs = R[id] = R[id] || { on: false };
        const vs = pv(A(iv)) - pv(A(ign));
        const sig = pv(A(ig)) - pv(A(ign));
        const ctl = sig > 0.55 * Math.max(vs, 0.1) ? 1 : 0;
        // módulo comum: IN ativo-baixo? usa nível alto por padrão (prop activeLow)
        const act = (p.activeLow ? !ctl : ctl) && vs > 3.2;
        rs.on = !!act;
        els.push(res(A(ig), A(ign), 2e4, inst, 'in'));
        const ic = findPin(inst, /^COM/), ino = findPin(inst, /^NO/), inc = findPin(inst, /^NC/);
        if(ic >= 0 && ino >= 0) els.push(res(A(ic), A(ino), rs.on ? 0.05 : 1e9, inst, 'NO'));
        if(ic >= 0 && inc >= 0) els.push(res(A(ic), A(inc), rs.on ? 1e9 : 0.05, inst, 'NC'));
      }
      continue;
    }
    if(d.kind === 'relay_mod'){
      const ch = +p.channels || 1;
      const iv = ch, ign = ch + 1;
      els.push(res(A(iv), A(ign), 5 / (0.02 + 0.07 * ch), inst, 'coil'));
      const rs = R[id] = R[id] || { on: [] };
      for(let c = 0; c < ch; c++){
        const sig = pv(A(c)) - pv(A(ign));
        rs.on[c] = (pv(A(iv)) - pv(A(ign)) > 3.2) && sig > 1.7;
        els.push(res(A(c), A(ign), 2e4, inst, 'in' + c));
      }
      continue;
    }
    if(d.id === 'peltier' || d.id === 'solenoid' || d.id2){ els.push(res(A(0), A(1), d.loadR || ((d.id2 || d.id) === 'peltier' ? 3 : 25), inst, 'load')); continue; }
    if(d.kind === 'stepper'){
      const names = d.pinNames;
      if(names.includes('A+')){ els.push(res(A(names.indexOf('A+')), A(names.indexOf('A−')), 4, inst, 'cA')); els.push(res(A(names.indexOf('B+')), A(names.indexOf('B−')), 4, inst, 'cB')); }
      else if(names.some(n => /^IN1$/.test(n)) && names.some(n => /^\+?(5V|12V)$/.test(n))){ const pc = names.findIndex(n => /^\+?(5V|12V)$/.test(n)); for(let i = 0; i < 4; i++) els.push(res(A(i), A(pc), 2000, inst, 'in' + i)); }
      else {
        const ivm = findPin(inst, /^(VMOT|VM)$/), ig = findPin(inst, /^GND$/), il = findPin(inst, /^(VDD|VIO|VCC)$/);
        if(ivm >= 0 && ig >= 0) els.push(res(A(ivm), A(ig), 12 / 0.5, inst, 'motor'));
        if(il >= 0 && ig >= 0) els.push(res(A(il), A(ig), 5 / 0.012, inst, 'logic'));
        if(d.pins >= 6 && il < 0 && ivm < 0){ els.push(res(A(3), A(4), 5 / 0.012, inst, 'logic')); els.push(res(A(5), A(4), 12 / 0.5, inst, 'motor')); }
      }
      continue;
    }
    if(d.kind === 'servo'){
      els.push(res(A(1), A(2), (d.vcc || 5) / 0.25, inst, 'load'));
      els.push(res(A(0), A(2), 1e5, inst, 'sig'));
      continue;
    }
    if(d.kind === 'strip'){
      const iv = findPin(inst, /^VCC$/), ign = findPin(inst, /^GND$/), idn = findPin(inst, /^DIN$/);
      const n = d.leds || 8;
      const lit = (st.colors || []).reduce((s, c) => s + (c[0] + c[1] + c[2]) / 765, 0);
      els.push(res(A(iv), A(ign), 5 / (0.001 * n + 0.018 * lit + 1e-6), inst, 'load'));
      els.push(res(A(idn), A(ign), 1e5, inst, 'din'));
      continue;
    }
    if(d.kind === 'b9' || false){}

    /* ===== MÓDULOS GENÉRICOS COM VCC/GND (sensores, displays, comunicação) ===== */
    const iv = findPin(inst, /^(VCC|VIN|VDD|3V3|5V|\+5V|V\+|VM)$/i);
    const ig = findPin(inst, /^(GND\d*|G)$/i);
    if(iv >= 0 && ig >= 0){
      const vnom = d.vcc || 3.3;
      let I = d.iq != null ? d.iq : (d.cat === 'display' ? (d.kind === 'tft' || d.kind === 'screen' ? 0.06 : d.kind === 'lcd' ? 0.03 : 0.012) : d.cat === 'comm' ? 0.08 : 0.006);
      els.push(res(A(iv), A(ig), vnom / Math.max(I, 1e-4), inst, 'load'));
      // saída analógica
      const frac = analogFrac(inst);
      const vsup = pv(A(iv)) - pv(A(ig));
      const powOK = vsup > (vnom > 4 ? 3.0 : 2.4);
      if(frac != null && powOK){
        const io = findPin(inst, /^(AO|OUT|SIG|A0)$/i);
        if(io >= 0) els.push(thev(A(io), A(ig), frac * vsup, 1000, inst, 'AO'));
        const idg = findPin(inst, /^DO$/i);
        if(idg >= 0) els.push(thev(A(idg), A(ig), frac > 0.6 ? vsup : 0, 500, inst, 'DO'));
      } else if(d.sk === 'ta' && /lm35/.test(d.id) && powOK){
        const io = findPin(inst, /^OUT$/i);
        const T = st.vals && st.vals.temperature != null ? st.vals.temperature : 25;
        if(io >= 0) els.push(thev(A(io), A(ig), T * 0.01, 200, inst, 'AO'));
      } else if(d.sk === 'motion' || d.sk === 'touch'){
        const io = findPin(inst, /^OUT$/i);
        const on = (st.vals && (st.vals.motion || st.vals.touch)) || st.pressed;
        if(io >= 0 && powOK) els.push(thev(A(io), A(ig), on ? vsup : 0, 300, inst, 'OUT'));
      }
      continue;
    }
    // peças sem eletricidade modelada: pinos flutuam
  }
  return { els, sources };
}

/* ---------- solução MNA ---------- */
function gauss(A, b, n){
  for(let c = 0; c < n; c++){
    let piv = c, mx = Math.abs(A[c][c]);
    for(let r = c + 1; r < n; r++){ const v = Math.abs(A[r][c]); if(v > mx){ mx = v; piv = r; } }
    if(mx < 1e-30) { A[c][c] = 1e-12; mx = 1e-12; }
    if(piv !== c){ const t = A[c]; A[c] = A[piv]; A[piv] = t; const tb = b[c]; b[c] = b[piv]; b[piv] = tb; }
    const row = A[c], d = row[c];
    for(let r = c + 1; r < n; r++){
      const f = A[r][c] / d;
      if(f === 0) continue;
      const rr = A[r];
      for(let k = c; k < n; k++) rr[k] -= f * row[k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for(let r = n - 1; r >= 0; r--){
    let s = b[r];
    const row = A[r];
    for(let k = r + 1; k < n; k++) s -= row[k] * x[k];
    x[r] = s / row[r];
  }
  return x;
}

function solveOnce(els, nodeIndex, nN, v0){
  const n = nN - 1; // sem terra
  const A = Array.from({ length: n }, () => new Float64Array(n));
  const b = new Float64Array(n);
  for(let i = 0; i < n; i++) A[i][i] += GMIN;
  const curr = [];
  for(const e of els){
    const m = e.n.length;
    const nodes = e.n.map(k => nodeIndex(k));
    const vv = nodes.map(ni => ni > 0 ? v0[ni - 1] : 0);
    let I, J;
    if(e.lin){
      J = e.J;
      I = new Array(m);
      for(let k = 0; k < m; k++){ let s = e.I0[k]; for(let j = 0; j < m; j++) s += J[k][j] * vv[j]; I[k] = s; }
    } else {
      I = e.f(vv);
      J = Array.from({ length: m }, () => new Array(m).fill(0));
      for(let j = 0; j < m; j++){
        const h = 1e-7 * Math.max(1, Math.abs(vv[j]));
        const v2 = vv.slice(); v2[j] += h;
        const I2 = e.f(v2);
        for(let k = 0; k < m; k++) J[k][j] = (I2[k] - I[k]) / h;
      }
    }
    curr.push(I);
    for(let k = 0; k < m; k++){
      const nk = nodes[k];
      if(nk <= 0) continue;
      let rhs = -I[k];
      for(let j = 0; j < m; j++){
        rhs += J[k][j] * vv[j];
        const nj = nodes[j];
        if(nj > 0) A[nk - 1][nj - 1] += J[k][j];
      }
      b[nk - 1] += rhs;
    }
  }
  const x = gauss(A, b, n);
  return { x, curr };
}

function solveCircuit(dt){
  const t0 = performance.now();
  const net = buildNets();
  CIR.nets = net;
  let result = null;
  const pwmList = [];
  if(typeof PINS !== 'undefined') for(const g in PINS){ const ps = PINS[g]; if(ps && ps.duty != null && ps.duty > 0 && ps.duty < 1023 && ps.mode !== 'in') pwmList.push(+g); }
  const runPass = (pwmHigh) => {
    // PWM: marca fase
    for(const g of pwmList) PINS[g].pwmPhase = pwmHigh === g ? 1 : 0;
    const { els, sources } = buildElements(net, dt);
    // mapeia nós
    const gndKeys = new Set();
    for(const s of sources) if(s.mcu) gndKeys.add(s.neg);
    // componentes conectados (por elementos)
    const uf = new Map();
    const f = x => { if(!uf.has(x)) uf.set(x, x); while(uf.get(x) !== x){ uf.set(x, uf.get(uf.get(x))); x = uf.get(x); } return x; };
    for(const e of els) for(let i = 1; i < e.n.length; i++){ const a = f(e.n[0]), b = f(e.n[i]); if(a !== b) uf.set(a, b); }
    const compHasGnd = new Set();
    for(const g of gndKeys) compHasGnd.add(f(g));
    const alias = new Map();
    for(const g of gndKeys) alias.set(g, 'GND');
    for(const s of sources){
      if(s.mcu) continue;
      const c = f(s.neg);
      if(!compHasGnd.has(c)){ compHasGnd.add(c); alias.set(s.neg, 'GND'); }
    }
    // componentes sem fonte: referência arbitrária
    const seen = new Set();
    for(const e of els) for(const k of e.n){ const c = f(k); if(!compHasGnd.has(c) && !seen.has(c)){ seen.add(c); alias.set(k, 'GND'); compHasGnd.add(c); } }
    const idx = new Map([['GND', 0]]);
    let nN = 1;
    const nodeIndex = k => { if(alias.has(k)) return 0; if(!idx.has(k)) idx.set(k, nN++); return idx.get(k); };
    for(const e of els) for(const k of e.n) nodeIndex(k);
    let v = new Float64Array(nN - 1);
    // chute inicial: tensões anteriores
    for(const [k, i] of idx) if(i > 0 && Number.isFinite(CIR.prevV[k])) v[i - 1] = CIR.prevV[k];
    let converged = false, it = 0, sol = null;
    for(it = 0; it < 120; it++){
      sol = solveOnce(els, nodeIndex, nN, v);
      let maxd = 0;
      const nv = new Float64Array(v.length);
      for(let i = 0; i < v.length; i++){
        let d = sol.x[i] - v[i];
        const lim = it < 40 ? 1.5 : 0.3;
        if(d > lim) d = lim; else if(d < -lim) d = -lim;
        nv[i] = v[i] + d;
        maxd = Math.max(maxd, Math.abs(sol.x[i] - v[i]));
      }
      v = nv;
      if(maxd < 1e-7 + 1e-8 * 5){ converged = true; break; }
    }
    // correntes finais
    sol = solveOnce(els, nodeIndex, nN, v);
    return { els, idx, alias, v, nodeIndex, curr: sol.curr, converged, it };
  };

  // passe base: todos os PWM em nível baixo, depois soma ponderada
  let base;
  if(!pwmList.length){ base = runPass(null); result = base; result.pwmMix = null; }
  else {
    const lows = runPass(-1);
    const highs = pwmList.map(g => runPass(g));
    result = lows;
    result.pwmMix = { lows, highs, list: pwmList };
  }
  for(const g of pwmList) PINS[g].pwmPhase = null;

  // publica tensões
  const V = new Map();
  const vOf = (r, k) => { const ni = r.nodeIndex(k); return ni > 0 ? r.v[ni - 1] : 0; };
  const prev = {};
  const keys = new Set();
  for(const p of BENCH.parts){ const n = pinOffsets(p).length; for(let i = 0; i < n; i++) keys.add(p.id + ':' + i); }
  for(const kk of keys){
    const root = net.find(kk);
    let val = vOf(result, root);
    if(result.pwmMix){
      const m = result.pwmMix;
      let acc = vOf(m.lows, root);
      m.list.forEach((g, i) => { const duty = clamp(PINS[g].duty / 1023, 0, 1); acc += duty * (vOf(m.highs[i], root) - vOf(m.lows, root)); });
      val = acc;
    }
    if(!Number.isFinite(val)) val = 0;
    V.set(kk, val);
    prev[root] = val;
  }
  CIR.V = V;
  CIR.prevV = prev;

  // correntes por elemento -> peças
  const accumulate = (r, scale, add) => {
    r.els.forEach((e, ei) => {
      const o = e.owner;
      if(!o || !e.tag) return;
      const I = r.curr[ei][0];
      const vv = e.n.map(k => vOf(r, k));
      add(o, e.tag, I * scale, vv, e);
    });
  };
  for(const p of BENCH.parts) if(p.cs){ p.cs.I = {}; p.cs.Vd = {}; }
  const addI = (o, tag, I, vv) => { if(!o.cs) return; o.cs.I[tag] = (o.cs.I[tag] || 0) + I; if(vv.length >= 2) o.cs.Vd[tag] = vv[0] - vv[1]; };
  if(result.pwmMix){
    const m = result.pwmMix;
    // I = I_low + Σ d_g (I_high_g - I_low)
    const tab = new Map();
    const collect = (r, store) => r.els.forEach((e, ei) => { if(e.owner && e.tag) store.set(e.owner.id + '|' + e.tag, { o: e.owner, tag: e.tag, I: r.curr[ei][0], vv: e.n.map(k => vOf(r, k)) }); });
    const Lw = new Map(); collect(m.lows, Lw);
    const Hs = m.highs.map(h => { const s = new Map(); collect(h, s); return s; });
    for(const [k, l] of Lw){
      let I = l.I;
      m.list.forEach((g, i) => { const h = Hs[i].get(k); if(h) I += clamp(PINS[g].duty / 1023, 0, 1) * (h.I - l.I); });
      addI(l.o, l.tag, I, l.vv);
    }
  } else accumulate(result, 1, addI);

  CIR.stats = { iters: result.it, ms: performance.now() - t0, nodes: result.idx.size, elems: result.els.length, converged: result.converged };
  CIR.last = result;
  return result;
}

/* ---------- API pública ---------- */
CIR.pinV = (inst, i) => { const v = CIR.V.get(inst.id + ':' + i); return v == null ? 0 : v; };
CIR.pinVByName = (inst, nm) => { const i = (inst.def.pinNames || []).indexOf(nm); return i < 0 ? 0 : CIR.pinV(inst, i); };
CIR.netOf = (inst, i) => CIR.nets ? CIR.nets.find(inst.id + ':' + i) : null;

CIR.supply = function(inst){
  const iv = findPin(inst, /^(VCC|VIN|VDD|3V3|5V|\+5V|V\+|VM)$/i);
  const ig = findPin(inst, /^(GND\d*|G)$/i);
  if(iv < 0 || ig < 0) return null;
  return CIR.pinV(inst, iv) - CIR.pinV(inst, ig);
};

/* qual GPIO do MCU principal está ligado (eletricamente) a este pino? */
CIR.gpioOfPin = function(inst, i){
  const mcu = primaryMcu();
  if(!mcu || !CIR.nets) return null;
  const root = CIR.nets.find(inst.id + ':' + i);
  const names = mcu.def.pinNames || [];
  for(let k = 0; k < names.length; k++){
    if(pinClass(mcu.def, names[k]) !== 'io') continue;
    if(CIR.nets.find(mcu.id + ':' + k) === root) return gpioOf(mcu.def, names[k]);
  }
  return null;
};
CIR.mcuPinNet = function(gpio){
  const mcu = primaryMcu();
  if(!mcu || !CIR.nets) return null;
  const names = mcu.def.pinNames || [];
  for(let k = 0; k < names.length; k++) if(pinClass(mcu.def, names[k]) === 'io' && gpioOf(mcu.def, names[k]) === gpio) return { inst: mcu, i: k };
  return null;
};
CIR.readPin = function(gpio){
  const r = CIR.mcuPinNet(gpio);
  if(!r) return 0;
  return CIR.pinV(r.inst, r.i);
};
CIR.vdd = () => { const m = primaryMcu(); return m ? (m.def.vcc || 3.3) : 3.3; };

CIR.powered = function(inst){
  if(!SIM.on) return false;
  const d = inst.def;
  if(inst.state.burnt) return false;
  if(d.cat === 'mcu') return !!inst.state.mcuPow;
  if(d.cat === 'board') return true;
  const s = CIR.supply(inst);
  if(s == null){
    // peças sem VCC/GND: considera "energizada" se existir queda de tensão ou corrente
    const I = inst.cs && inst.cs.I ? Object.values(inst.cs.I).reduce((a, b) => a + Math.abs(b), 0) : 0;
    return I > 1e-5;
  }
  const vn = d.vcc || 3.3;
  return s > (vn > 4 ? 2.8 : 2.3);
};

/* ---------- pós-processamento: efeitos físicos ---------- */
function applyPhysics(dt){
  for(const inst of BENCH.parts){
    const d = inst.def, st = inst.state, cs = inst.cs;
    if(!cs) continue;
    const R = CIR.react;
    // capacitores / indutores: atualiza estado
    if(d.id === 'cap' && cs.Vd.cap != null) R[inst.id].v = cs.Vd.cap;
    if(d.kind === 'scap' && cs.Vd.cap != null) R[inst.id].v = cs.Vd.cap;
    if(d.id === 'inductor_10uh' && cs.I.L != null) R[inst.id].i = cs.I.L;
    if(d.id === 'fuse' && R[inst.id] && !R[inst.id].blown && Math.abs(cs.I.fuse || 0) > (+inst.props.rating || 1)){
      R[inst.id].blown = true; st.blown = true; serialOut('💥 Fusível queimou (' + (Math.abs(cs.I.fuse) * 1000).toFixed(0) + ' mA)', 'warn');
    }
    if(d.id === 'triac'){
      const rs = R[inst.id];
      const Ig = Math.abs(cs.I.G || 0), It = Math.abs(cs.I.T || 0);
      if(Ig > 5e-3) rs.on = true; else if(It < 5e-3) rs.on = false;
    }
    if(d.id === 'optocoupler'){
      const Il = Math.max(0, cs.I.LED || 0);
      CIR.optoI[inst.id] = Math.min(Il * 1.0, 0.05);
      st.brightness = Math.min(1, Il / 0.01);
    }
    // LED: brilho perceptual (curva ~ I^0.6), queima por aquecimento
    if(d.kind === 'led'){
      const I = Math.max(0, cs.I.LED || 0);
      st.current = I;
      const maxI = +inst.props.imax || 0.03;
      st.brightness = clamp(Math.pow(I / 0.02, 0.6), 0, 1.3);
      st.on = I > 2e-5;
      thermal(inst, I / maxI, dt, 2.5, 'corrente de ' + (I * 1000).toFixed(0) + ' mA (máx ' + (maxI * 1000).toFixed(0) + ' mA) — falta resistor limitador');
      if(st.burnt){ st.on = false; st.brightness = 0; }
      st.overdrive = I > maxI * 1.1;
    }
    if(d.kind === 'rgb'){
      const ch = [0, 1, 2].map(i => Math.max(0, cs.I['LED' + i] || 0));
      st.rgbI = ch; st.on = ch.some(x => x > 2e-4);
      st.rgbCol = ch.map(x => clamp(x / 0.012, 0, 1));
    }
    if(d.kind === 'buzzer'){
      const V = Math.abs(cs.Vd.load || 0);
      st.on = V > 2.0 && !!(inst.state.mcuPow !== false);
      const gp = CIR.gpioOfPin(inst, 0);
      st.freq = gp != null && PINS[gp] ? PINS[gp].freq : null;
      st.v = V;
      if(V > 2.0) thermal(inst, Math.abs(cs.I.load || 0) / 0.09, dt, 0.5, 'sobrecorrente no buzzer');
    }
    if(d.kind === 'motor' || d.kind === 'fan'){
      const M = motorSpec(d);
      const rs = R[inst.id] = R[inst.id] || { rpm: 0 };
      const V = cs.Vd.M != null ? cs.Vd.M : 0;
      const I = cs.I.M || 0;
      const sgn = V >= 0 ? 1 : -1;
      const va = Math.abs(V);
      const target = va > M.Vstart ? sgn * Math.max(0, (va - M.Ra * M.I0) / M.Ke) : 0;
      const a = 1 - Math.exp(-dt / M.tau);
      rs.rpm += (target - rs.rpm) * a;
      if(Math.abs(rs.rpm) < 1) rs.rpm = 0;
      st.rpm = rs.rpm; st.v = V; st.current = I;
      st.on = Math.abs(rs.rpm) > 5;
      st.speed = clamp(Math.abs(rs.rpm) / M.rpmNL, 0, 2);
      st.duty = Math.max(0.15, st.speed);
      const stall = Math.abs(I) > M.Irated * 2.2 && Math.abs(rs.rpm) < M.rpmNL * 0.05 && va > M.Vstart;
      thermal(inst, Math.max(Math.abs(I) / M.Irated, va / (1.6 * M.Vn)), dt, stall ? 0.9 : 0.35, stall ? 'rotor travado/sobrecorrente de ' + Math.abs(I).toFixed(2) + ' A' : 'sobrecarga: ' + va.toFixed(1) + ' V / ' + Math.abs(I).toFixed(2) + ' A');
      if(st.burnt){ rs.rpm = 0; st.rpm = 0; st.on = false; }
    }
    if(d.kind === 'servo'){
      const vs = CIR.supply(inst);
      const gp = CIR.gpioOfPin(inst, 0);
      const ps = gp != null ? PINS[gp] : null;
      st.servoPow = vs != null && vs > 3.6 && SIM.on;
      if(st.servoPow && ps && ps.duty != null) st.angle = clamp(ps.angle != null ? ps.angle : (ps.duty / 1023 * 180), 0, 180);
      else if(!st.servoPow) st.on = false;
    }
    if(d.kind === 'relay' && CIR.react[inst.id]) st.on = !!CIR.react[inst.id].on;
    if(d.kind === 'relay_mod' && CIR.react[inst.id]) st.onArr = CIR.react[inst.id].on;
    if(d.kind === 'relayN' && CIR.react[inst.id]) st.onArr = CIR.react[inst.id].on;
    if(d.kind === 'ssr'){ const Ii = Math.abs(cs.I.IN || 0); const rs = CIR.react[inst.id]; if(rs) rs.on = Ii > 0.004; st.on = !!(rs && rs.on); }
    if(d.kind === 'ne555' && CIR.react[inst.id]){ const rs = CIR.react[inst.id]; const vcc = CIR.pinV(inst, 7) - CIR.pinV(inst, 0); if(vcc > 4.2){ const thr = CIR.pinV(inst, 5) - CIR.pinV(inst, 0), trg = CIR.pinV(inst, 1) - CIR.pinV(inst, 0), rst = CIR.pinV(inst, 3) - CIR.pinV(inst, 0); if(rst < 0.7) rs.q = 0; else if(thr > vcc * 2 / 3) rs.q = 0; else if(trg < vcc / 3) rs.q = 1; st.on = !!rs.q; } }
    if(d.kind === 'strip'){
      const gp = CIR.gpioOfPin(inst, findPin(inst, /^DIN$/));
      st.dinOK = gp != null;
    }
    if(d.kind === 'res'){
      const I = cs.I.R || 0, V = cs.Vd.R || 0;
      inst.props.currentFlow = I * 1000; inst.props.voltageDrop = V;
      const P = I * V;
      st.power = P;
      st.hot = P > (+inst.props.watt || 0.25) * 0.8;
      thermal(inst, P / (+inst.props.watt || 0.25), dt, 0.8, 'dissipou ' + (P * 1000).toFixed(0) + ' mW (limite ' + ((+inst.props.watt || 0.25) * 1000).toFixed(0) + ' mW)');
    }
    if(d.id === 'cap'){ inst.props.chargeLevel = clamp(Math.abs(cs.Vd.cap || 0) / 5 * 100, 0, 100); }
    // sobretensão em módulos
    if(d.cat !== 'power' && d.cat !== 'mcu' && d.cat !== 'board'){
      const s = CIR.supply(inst);
      if(s != null && SIM.on){
        const vn = d.vcc || 3.3;
        const vmax = d.vmax || (vn <= 3.3 ? 3.9 : vn <= 5 ? 6.0 : vn + 4);
        if(s > vmax && !st.burnt && !(d.kind === 'servo' && s < 8) && d.kind !== 'motor'){
          st.burnt = true;
          serialOut('🔥 ' + d.n + ' queimou: ' + s.toFixed(1) + ' V aplicados (máx ' + vmax.toFixed(1) + ' V)', 'err');
          toast('🔥 ' + d.n + ' queimou por sobretensão', 'err');
        }
      }
    }
  }
}

/* ---------- laço de simulação ---------- */
let lastT = performance.now(), scheduled = false, running = false;
function stepNow(forceDt){
  if(running || CIR.frozen) return;
  running = true;
  try {
    const now = performance.now();
    let dt = forceDt || Math.min(0.05, Math.max(1e-4, (now - lastT) / 1000));
    lastT = now;
    if(!SIM.on){
      for(const p of BENCH.parts){ p.cs = { I: {}, Vd: {}, V: {} }; if(p.def.cat === 'mcu') p.state.mcuPow = false; }
      CIR.V = new Map(); CIR.prevV = {}; CIR.nets = buildNets();
    } else {
      solveCircuit(dt);
      // segunda passada se o estado de alimentação mudou (reguladores / MCU alimentado externamente)
      const sig = BENCH.parts.map(p => p.state.mcuPow ? 1 : 0).join('');
      if(sig !== CIR._sig){ CIR._sig = sig; solveCircuit(dt); }
      applyPhysics(dt);
    }
    CIR.dirty = false;
  } catch(e){ console.error('[circuit]', e); }
  running = false;
  if(typeof refreshAllVisuals === 'function' && BENCH.parts.every(p => p.el)) refreshAllVisuals();
  if(typeof updatePowerUI === 'function') updatePowerUI();
  if(CIR.onSolve) CIR.onSolve();
}
CIR.solveNow = stepNow;
CIR.request = function(){
  CIR.dirty = true;
  if(scheduled) return;
  scheduled = true;
  setTimeout(() => { scheduled = false; stepNow(); }, 8);
};

setInterval(() => { if(SIM.on) stepNow(); }, 60);

/* ---------- substitui funções do app que usavam o "grafo antigo" ---------- */
window.buildGraph = function(){ const n = buildNets(); return { find: n.find }; };

window.connectivity = function(){
  return {
    mcuOf: function(p){
      if(!CIR.nets) CIR.nets = buildNets();
      const n = pinOffsets(p).length;
      const roots = new Set();
      for(let i = 0; i < n; i++) roots.add(CIR.nets.find(p.id + ':' + i));
      for(const m of BENCH.parts){
        if(m.def.cat !== 'mcu' || m === p) continue;
        const mn = pinOffsets(m).length;
        for(let i = 0; i < mn; i++) if(roots.has(CIR.nets.find(m.id + ':' + i))) return m.id;
      }
      return p.def.cat === 'mcu' ? p.id : null;
    },
    powered: function(p){ return CIR.powered(p); }
  };
};

window.updateOutputs = function(){
  if(RUN.on && BENCH.demo){ BENCH.demo = false; if(typeof syncDemoBtn === 'function') syncDemoBtn(); }
  CIR.request();
};
const _refreshPower = window.refreshPower;
window.refreshPower = function(){
  CONN = connectivity();
  POWER = { powered: id => { const p = BENCH.parts.find(x => x.id === id); return p ? CIR.powered(p) : false; } };
  CIR.solveNow();
  if(typeof renderHwCheck === 'function') renderHwCheck();
};

/* estado de energia válido desde o carregamento (antes era null => tudo parecia energizado) */
POWER = { powered: id => { const p = BENCH.parts.find(x => x.id === id); return p ? CIR.powered(p) : false; } };
CONN = connectivity();

/* ---------- leitura de pinos pelo código ---------- */
window.readADC = function(id){
  if(!SIM.on) return 0;
  const m = primaryMcu();
  if(!m || !m.state.mcuPow) return 0;
  const vref = CIR.vdd();
  const v = clamp(CIR.readPin(+id), 0, vref);
  const bits = /^(uno|nano|nano_every|pro_mini|mega|leonardo|attiny)$/.test(m.def.id) ? 10 : 12;
  return Math.round(v / vref * (Math.pow(2, bits) - 1));
};
window.HWRead = {
  digital: function(id){
    if(!SIM.on) return 0;
    const m = primaryMcu();
    if(!m || !m.state.mcuPow) return 0;
    const ps = PINS[id];
    if(ps && (ps.mode === 'out')) return ps.v ? 1 : 0;
    const v = CIR.readPin(+id);
    const prevLvl = ps && ps._lvl;
    const vdd = CIR.vdd();
    const hi = prevLvl ? v > 0.3 * vdd : v > 0.6 * vdd;
    if(ps) ps._lvl = hi ? 1 : 0;
    return hi ? 1 : 0;
  }
};
window.pinWrite = function(id, val){
  if(!SIM.on && false) return;
  PINS[id] = Object.assign(PINS[id] || {}, { v: val ? 1 : 0, duty: undefined });
  if(PINS[id].mode == null) PINS[id].mode = 'out';
  updateOutputs();
  if(IRQMAP[id]){ try { IRQMAP[id]({ id: id }); } catch(e){} }
};
window.pwmWrite = function(id, duty){
  PINS[id] = Object.assign(PINS[id] || {}, { duty: duty, v: duty > 0 ? 1 : 0, mode: 'out' });
  updateOutputs();
};

})();
