/* Kezle Lab Pro — componentes PARAMÉTRICOS (estilo Tinkercad)
   Um único Resistor / Capacitor / Indutor / Fusível / Zener / Potenciômetro / LED no catálogo;
   o valor, a unidade, a tolerância, a potência, o tipo e a cor são ajustados nas propriedades
   e a peça muda de aparência e de comportamento elétrico na hora. */
(function(){
'use strict';

/* ---------- 1) catálogo enxuto: some com as variantes "uma por valor" ---------- */
const FOLD = [
  'res_100','res_1k','res_4k7','res_10k','res_47k','res_100k','res_1M','res_10','res_47','res_2k2','res_330','res_470','res_1w','res_5w','shunt_01',
  'cap_electrolytic','cap_electro_1000','cap_ceramic_100n','cap_ceramic_10n','cap_ceramic_22p','cap_tantalum_10u','cap_film_1u',
  'ind_100uh','fuse_1a','fuse_5a','fuse_100ma','zener_3v3','zener_9v1','zener_12v',
  'led_3mm','led_10mm','led_white','led_blue','led_green','led_yellow','led_uv','led_ir','ir_led_tx',
  'pot_1k','pot_100k','pot_slide_10k',
  'kcd1_3p','kcd1_6p','relay_mod2','relay_mod4','relay_mod8','relay_modular'
];
const RENAME = { res: ['Resistor', 'Paramétrico: valor, tolerância e potência'], cap: ['Capacitor', 'Paramétrico: tipo, valor e tensão'],
  inductor_10uh: ['Indutor', 'Paramétrico: indutância'], fuse: ['Fusível', 'Paramétrico: corrente nominal'],
  zener_5v1: ['Diodo Zener', 'Paramétrico: tensão Zener'], pot10k: ['Potenciômetro', 'Paramétrico: resistência total'], led: ['LED', 'Paramétrico: cor'],
  relay_mod1: ['Módulo de relé', 'Paramétrico: canais, bobina e gatilho'], kcd1: ['Chave KCD1 (balancim)', 'Paramétrico: 2, 3 ou 6 terminais'] };
function slim(){
  if(typeof PARTS === 'undefined') return;
  for(let i = PARTS.length - 1; i >= 0; i--) if(FOLD.includes(PARTS[i].id)) PARTS.splice(i, 1);   // continuam em PARTMAP: projetos antigos abrem normalmente
  for(const id in RENAME){ const d = PARTMAP[id]; if(d){ d.n = RENAME[id][0]; d.desc = RENAME[id][1]; } }
  if(PARTMAP.cap) PARTMAP.cap.pinNames = ['+', '−'];
  if(PARTMAP.pot10k) PARTMAP.pot10k.defaults = Object.assign({ rtotal: 10000 }, PARTMAP.pot10k.defaults || {});
  if(typeof renderPalette === 'function') renderPalette();
  if(typeof renderCatalog === 'function') renderCatalog();
}


/* ---------- troca de definição mantendo os fios (nº de canais do relé, terminais da chave) ---------- */
function relayDef(n){
  const id = 'relay_mod' + n;
  if(PARTMAP[id]) return PARTMAP[id];
  const base = PARTMAP.relay_mod1; if(!base) return null;
  const pins = []; for(let i = 1; i <= n; i++) pins.push('IN' + i); pins.push('VCC', 'GND'); for(let i = 1; i <= n; i++) pins.push('COM' + i, 'NO' + i, 'NC' + i);
  const d = Object.assign({}, base, { id, n: 'Módulo de relé ' + n + ' canais', pinNames: pins, pins: pins.length, channelsN: n, w: Math.max(110, 40 + n * 42) });
  PARTMAP[id] = d; return d;
}
function swapDef(inst, nd, byName){
  const od = inst.def, map = {};
  od.pinNames.forEach((nm, i) => { const j = byName ? nd.pinNames.indexOf(nm) : (i < nd.pinNames.length ? i : -1); if(j >= 0) map[i] = j; });
  BENCH.wires = BENCH.wires.filter(w => { for(const e of [w.a, w.b]) if(e.p === inst.id && map[e.i] == null) return false; return true; });
  for(const w of BENCH.wires) for(const e of [w.a, w.b]) if(e.p === inst.id) e.i = map[e.i];
  inst.def = nd; inst.state.sw = inst.state.sw || 0;
  if(window.CIRCUIT){ CIRCUIT.request(); }
}

/* ---------- 2) código de cores do resistor (4 ou 5 faixas, multiplicador ouro/prata) ---------- */
const DC = ['#111111', '#7c4a03', '#dc2626', '#f97316', '#facc15', '#22c55e', '#2563eb', '#7c3aed', '#808080', '#f8fafc'];
const NAMES = ['Preto', 'Marrom', 'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul', 'Violeta', 'Cinza', 'Branco'];
const GOLD = '#c9a227', SILVER = '#c0c4cc';
const TOL = { 1: ['#7c4a03', 'Marrom'], 2: ['#dc2626', 'Vermelho'], 5: [GOLD, 'Ouro'], 10: [SILVER, 'Prata'] };
function bands(inst){
  const p = (inst && inst.props) || {};
  let v = +p.value; if(!(v > 0)) v = 220;
  const five = +p.bands === 5, n = five ? 3 : 2;
  let e = Math.floor(Math.log10(v)), sig = Math.round(v / Math.pow(10, e - (n - 1)));
  if(sig >= Math.pow(10, n)){ e++; sig = Math.round(v / Math.pow(10, e - (n - 1))); }
  const mult = e - (n - 1), ds = String(sig).padStart(n, '0').split('').map(Number);
  const out = ds.map(d => [DC[d], NAMES[d]]);
  out.push(mult >= 0 && mult <= 9 ? [DC[mult], NAMES[mult]] : mult === -1 ? [GOLD, 'Ouro'] : [SILVER, 'Prata']);
  out.push(TOL[+p.tol] || TOL[5]);
  return out;
}

/* ---------- 3) utilitários de unidade ---------- */
const fmt = x => { const r = Math.round(x * 1e6) / 1e6; return String(r).replace('.', ','); };
function split(v, units){                       // units: [[rótulo, fator]...] crescente
  let k = 0;
  for(let i = units.length - 1; i >= 0; i--) if(v >= units[i][1] * 0.9999){ k = i; break; }
  return [v / units[k][1], k];
}
const U_R = [['Ω', 1], ['kΩ', 1e3], ['MΩ', 1e6]];
const U_C = [['pF', 1], ['nF', 1e3], ['µF', 1e6], ['mF', 1e9]];          // base: pF
const U_L = [['µH', 1], ['mH', 1e3], ['H', 1e6]];                        // base: µH
const U_I = [['mA', 1], ['A', 1e3]];                                     // base: mA
const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
const WATTS = [0.125, 0.25, 0.5, 1, 2, 5, 10];
const LEDCOL = [['Vermelho', '#ff3b30'], ['Laranja', '#fb923c'], ['Amarelo', '#fbbf24'], ['Verde', '#22c55e'], ['Azul', '#3b82f6'], ['Branco', '#ffffff'], ['Violeta/UV', '#a855f7'], ['Infravermelho', '#7f1d1d']];
const CTYPES = [['electrolytic', 'Eletrolítico (polarizado)'], ['ceramic', 'Cerâmico'], ['tantalum', 'Tântalo (polarizado)'], ['film', 'Poliéster / filme']];
const VRAT = [6.3, 10, 16, 25, 35, 50, 63, 100, 250];

const unitSel = (id, units, k) => '<select id="' + id + '" style="width:76px">' + units.map((u, i) => '<option value="' + i + '"' + (i === k ? ' selected' : '') + '>' + u[0] + '</option>').join('') + '</select>';
const row = (label, inner, hint) => '<div class="propRow"><label>' + label + '</label>' + inner + (hint ? '<div class="small" style="margin-top:3px">' + hint + '</div>' : '') + '</div>';
const swatches = bs => bs.map(b => '<span title="' + b[1] + '" style="display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:3px;vertical-align:middle;background:' + b[0] + ';border:1px solid #0006"></span>').join('');

/* ---------- 4) painel de propriedades ---------- */
function mount(){
  const wrapRP = window.renderProps;
  window.renderProps = function(){
    wrapRP();
    const inst = BENCH.sel; if(!inst || BENCH.selWire) return;
    const d = inst.def, P = inst.props, box = document.getElementById('props');
    if(!box) return;
    const kind = d.kind, id2 = d.id2;
    let html = '', title = '', wire = null;
    const apply = (fn) => () => { fn(); CIRCUIT.request(); renderBench(); renderProps(); scheduleSaveBench(); };

    if(kind === 'res' && !/^(ferrite|jumper_0r|thermistor_ptc)$/.test(d.id)){
      title = 'Resistor';
      const [num, k] = split(+P.value || 220, U_R);
      const dec = Math.pow(10, Math.floor(Math.log10(num || 1))), cur = Math.round((num / dec) * 100) / 100;
      const b = bands(inst);
      html = row('Resistência', '<div class="inline"><input type="number" id="ps_v" value="' + fmt(num) + '" min="0.01" step="any">' + unitSel('ps_u', U_R, k) + '</div>',
               'Valor real: <b>' + fmt(+P.value || 220) + ' Ω</b>')
           + row('Valores padrão (série E12)', '<select id="ps_e"><option value="">— escolher —</option>' + E12.map(m => '<option value="' + m + '"' + (Math.abs(m - cur) < 0.001 ? ' selected' : '') + '>' + fmt(m) + ' ' + U_R[k][0] + '</option>').join('') + '</select>')
           + row('Tolerância', '<select id="ps_t">' + [1, 2, 5, 10].map(t => '<option value="' + t + '"' + ((+P.tol || 5) === t ? ' selected' : '') + '>±' + t + ' %</option>').join('') + '</select>')
           + row('Potência máxima', '<select id="ps_w">' + WATTS.map(w => '<option value="' + w + '"' + ((+P.watt || 0.25) === w ? ' selected' : '') + '>' + (w === 0.125 ? '⅛' : w === 0.25 ? '¼' : w === 0.5 ? '½' : w) + ' W</option>').join('') + '</select>',
               'Passou disso, o resistor esquenta e queima.')
           + row('Faixas de cor', '<select id="ps_b"><option value="4"' + (+P.bands !== 5 ? ' selected' : '') + '>4 faixas</option><option value="5"' + (+P.bands === 5 ? ' selected' : '') + '>5 faixas</option></select>',
               swatches(b) + b.map(x => x[1]).join(' · '));
      wire = () => {
        const set = () => { const u = U_R[+document.getElementById('ps_u').value][1]; P.value = Math.max(0.01, (+document.getElementById('ps_v').value || 1) * u); };
        document.getElementById('ps_v').onchange = apply(set);
        document.getElementById('ps_u').onchange = apply(() => { set(); });
        document.getElementById('ps_e').onchange = apply(() => { const m = +document.getElementById('ps_e').value; if(m) P.value = m * dec * U_R[k][1]; });
        document.getElementById('ps_t').onchange = apply(() => { P.tol = +document.getElementById('ps_t').value; });
        document.getElementById('ps_w').onchange = apply(() => { P.watt = +document.getElementById('ps_w').value; });
        document.getElementById('ps_b').onchange = apply(() => { P.bands = +document.getElementById('ps_b').value; });
      };
    } else if(kind === 'cap' && !id2 && d.id !== 'crystal_16mhz' && d.id !== 'varistor'){
      title = 'Capacitor';
      const pf = (+P.capVal || 100) * ({ 'pF': 1, 'nF': 1e3, 'µF': 1e6, 'mF': 1e9 }[P.capUnit || 'µF'] || 1e6);
      const [num, k] = split(pf, U_C);
      const ct = P.ctype || 'electrolytic';
      html = row('Tipo', '<select id="ps_ct">' + CTYPES.map(c => '<option value="' + c[0] + '"' + (c[0] === ct ? ' selected' : '') + '>' + c[1] + '</option>').join('') + '</select>',
               /electrolytic|tantalum/.test(ct) ? 'Polarizado: ligue + ao lado positivo — invertido, ele aquece e estoura.' : 'Sem polaridade.')
           + row('Capacitância', '<div class="inline"><input type="number" id="ps_v" value="' + fmt(num) + '" min="0.001" step="any">' + unitSel('ps_u', U_C, k) + '</div>')
           + row('Tensão máxima', '<select id="ps_vm">' + VRAT.map(v => '<option value="' + v + '"' + ((+P.vmax || 25) === v ? ' selected' : '') + '>' + v + ' V</option>').join('') + '</select>', 'Acima disso o capacitor queima.');
      wire = () => {
        const set = () => { const u = U_C[+document.getElementById('ps_u').value]; P.capUnit = u[0] === 'pF' ? 'pF' : u[0]; P.capVal = Math.max(0.001, +document.getElementById('ps_v').value || 1); };
        document.getElementById('ps_v').onchange = apply(set);
        document.getElementById('ps_u').onchange = apply(set);
        document.getElementById('ps_ct').onchange = apply(() => { P.ctype = document.getElementById('ps_ct').value; });
        document.getElementById('ps_vm').onchange = apply(() => { P.vmax = +document.getElementById('ps_vm').value; });
      };
    } else if(id2 === 'inductor' || d.id === 'inductor_10uh'){
      title = 'Indutor';
      const [num, k] = split(+P.L || 10, U_L);
      html = row('Indutância', '<div class="inline"><input type="number" id="ps_v" value="' + fmt(num) + '" min="0.001" step="any">' + unitSel('ps_u', U_L, k) + '</div>');
      wire = () => { const set = () => { P.L = Math.max(0.001, (+document.getElementById('ps_v').value || 1) * U_L[+document.getElementById('ps_u').value][1]); };
        document.getElementById('ps_v').onchange = apply(set); document.getElementById('ps_u').onchange = apply(set); };
    } else if((id2 === 'fuse' || d.id === 'fuse') && !d.ptc){
      title = 'Fusível';
      const [num, k] = split((+P.rating || 1) * 1000, U_I);
      html = row('Corrente nominal', '<div class="inline"><input type="number" id="ps_v" value="' + fmt(num) + '" min="1" step="any">' + unitSel('ps_u', U_I, k) + '</div>', 'Acima dessa corrente o fusível queima e abre o circuito.');
      wire = () => { const set = () => { P.rating = Math.max(0.001, (+document.getElementById('ps_v').value || 1) * U_I[+document.getElementById('ps_u').value][1] / 1000); };
        document.getElementById('ps_v').onchange = apply(set); document.getElementById('ps_u').onchange = apply(set); };
    } else if(/^zener/.test(d.id)){
      title = 'Diodo Zener';
      const zm = d.id.match(/zener_(\d+)v(\d*)/), vz = +P.vz || (zm ? parseFloat(zm[1] + '.' + (zm[2] || '0')) : 5.1);
      html = row('Tensão Zener (V)', '<input type="number" id="ps_v" value="' + fmt(vz) + '" min="1.8" max="75" step="0.1">')
           + row('Valores comuns', '<select id="ps_e"><option value="">— escolher —</option>' + [2.7, 3.3, 3.9, 4.7, 5.1, 6.2, 7.5, 9.1, 12, 15, 18, 24, 33].map(v => '<option value="' + v + '"' + (v === vz ? ' selected' : '') + '>' + fmt(v) + ' V</option>').join('') + '</select>');
      wire = () => { document.getElementById('ps_v').onchange = apply(() => { P.vz = Math.min(75, Math.max(1.8, +document.getElementById('ps_v').value || 5.1)); });
        document.getElementById('ps_e').onchange = apply(() => { const v = +document.getElementById('ps_e').value; if(v) P.vz = v; }); };
    } else if(kind === 'pot'){
      title = 'Potenciômetro';
      const [num, k] = split(+P.rtotal || (d.defaults && d.defaults.rtotal) || 10000, U_R);
      html = row('Resistência total', '<div class="inline"><input type="number" id="ps_v" value="' + fmt(num) + '" min="0.01" step="any">' + unitSel('ps_u', U_R, k) + '</div>');
      wire = () => { const set = () => { P.rtotal = Math.max(1, (+document.getElementById('ps_v').value || 1) * U_R[+document.getElementById('ps_u').value][1]); };
        document.getElementById('ps_v').onchange = apply(set); document.getElementById('ps_u').onchange = apply(set); };
    } else if(kind === 'relayN'){
      title = 'Módulo de relé';
      const n = d.channelsN || 1, cv = +P.coilV || 5;
      html = row('Canais', '<select id="ps_n">' + [1, 2, 3, 4, 5, 6, 7, 8].map(x => '<option value="' + x + '"' + (x === n ? ' selected' : '') + '>' + x + ' canal' + (x > 1 ? 'is' : '') + '</option>').join('') + '</select>', 'Os fios já ligados nos pinos que continuam existindo são mantidos.')
           + row('Tensão da bobina', '<select id="ps_cv">' + [3.3, 5, 12, 24].map(x => '<option value="' + x + '"' + (x === cv ? ' selected' : '') + '>' + fmt(x) + ' V</option>').join('') + '</select>', 'Fecha com ≥ 64 % da tensão; acima de ~' + fmt(cv + 4) + ' V a bobina queima.')
           + row('Gatilho (IN)', '<select id="ps_g"><option value="0"' + (!P.activeHigh ? ' selected' : '') + '>Ativo em nível BAIXO (módulos comuns)</option><option value="1"' + (P.activeHigh ? ' selected' : '') + '>Ativo em nível ALTO</option></select>');
      wire = () => {
        document.getElementById('ps_n').onchange = apply(() => { const nd = relayDef(+document.getElementById('ps_n').value); if(nd && nd !== inst.def) swapDef(inst, nd, true); });
        document.getElementById('ps_cv').onchange = apply(() => { P.coilV = +document.getElementById('ps_cv').value; });
        document.getElementById('ps_g').onchange = apply(() => { P.activeHigh = document.getElementById('ps_g').value === '1'; });
      };
    } else if(kind === 'rocker'){
      title = 'Chave KCD1';
      const np = d.pinNames.length;
      html = row('Terminais', '<select id="ps_n"><option value="2"' + (np === 2 ? ' selected' : '') + '>2 terminais (liga/desliga)</option><option value="3"' + (np === 3 ? ' selected' : '') + '>3 terminais (SPDT)</option><option value="6"' + (np === 6 ? ' selected' : '') + '>6 terminais (DPDT)</option></select>', 'Clique na tecla na bancada para ligar / desligar.');
      wire = () => { document.getElementById('ps_n').onchange = apply(() => { const id = { 2: 'kcd1', 3: 'kcd1_3p', 6: 'kcd1_6p' }[document.getElementById('ps_n').value]; const nd = PARTMAP[id]; if(nd && nd !== inst.def) swapDef(inst, nd, false); }); };
    } else if(kind === 'led' && !d.scr){
      title = 'LED';
      const cur = (P.color || '#ff3b30').toLowerCase();
      html = row('Cor', '<div style="display:flex;flex-wrap:wrap;gap:6px">' + LEDCOL.map(c => '<button class="btn ledc" data-c="' + c[1] + '" title="' + c[0] + '" style="width:30px;height:30px;padding:0;border-radius:50%;background:' + c[1] + ';border:' + (cur === c[1] ? '3px solid var(--ac)' : '1px solid #0008') + '"></button>').join('') + '</div>',
               'A cor define a tensão do LED (Vf ≈ ' + (window.CIRCUIT && typeof ledVfOf === 'function' ? ledVfOf(cur) : '') + ').');
      wire = () => box.querySelectorAll('.ledc').forEach(btn => btn.onclick = apply(() => { P.color = btn.dataset.c; }));
    }
    if(!html) return;

    // tira o campo "numérico simples" antigo e o bloco genérico de parâmetros (duplicados do painel novo)
    const old = box.querySelector('#pv'); if(old){ const r = old.closest('.propRow'); if(r) r.remove(); }
    const oldPcol = box.querySelector('#pcol'); if(oldPcol && kind === 'led'){ /* mantém o seletor livre de cor, abaixo dos presets */ }
    if(kind !== 'led') box.querySelectorAll('[data-prm]').forEach(i => { const w = i.closest('.propRow'); if(w) w.remove(); });
    const panel = document.createElement('div');
    panel.className = 'passPanel';
    panel.innerHTML = '<div class="propRow" style="background:#0f172a;padding:10px;border-radius:8px;border:1px solid var(--line)"><b style="color:var(--ac)">⚙ ' + title + ' paramétrico</b></div>' + html;
    box.insertBefore(panel, box.children[1] || null);
    if(wire) wire();
  };
}

/* expõe para a arte (art.js) */
window.KezlePassives = { bands, split, units: { R: U_R, C: U_C, L: U_L } };
window.ledVfOf = c => { try { return (ledVf(c)).toFixed(2) + ' V'; } catch(e){ return ''; } };

function start(){ slim(); mount(); }
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0)); else start();
})();
