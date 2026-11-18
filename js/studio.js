/* =========================================================================
   Kezle Lab Pro — Estúdio de Peças v2 (planejador de componentes)
   Pinagem por função, elétrica (VCC/Vmax/consumo), tamanho físico em mm,
   tela/touch, campos de leitura, API de código e validação — com pré-visualização.
   A peça criada entra no solver de circuito e nas bibliotecas genéricas.
   ========================================================================= */
(function(){
'use strict';
const esc = window.escHtml;
const MM = 3.6;
const px = mm => Math.round(mm * MM / 2) * 2;
const ROLES = [
  ['VCC', 'Alimentação (VCC)'], ['GND', 'Terra (GND)'], ['SDA', 'I2C SDA'], ['SCL', 'I2C SCL'], ['SIG_IN', 'Entrada de sinal'], ['SIG_OUT', 'Saída digital'], ['AO', 'Saída analógica'],
  ['TX', 'UART TX'], ['RX', 'UART RX'], ['MOSI', 'SPI MOSI'], ['MISO', 'SPI MISO'], ['SCK', 'SPI SCK'], ['CS', 'SPI CS'], ['DC', 'Dados/Comando'], ['RST', 'Reset'], ['INT', 'Interrupção'], ['EN', 'Enable'], ['NC', 'Não conectado']
];
const TEMPLATES = {
  blank: { n: 'Em branco', pins: [] },
  i2c: { n: 'Sensor I2C (4 pinos)', pins: [['VCC', 'VCC'], ['GND', 'GND'], ['SCL', 'SCL'], ['SDA', 'SDA']], proto: 'I2C', addr: '0x40' },
  i2c_int: { n: 'Sensor I2C + INT', pins: [['VCC', 'VCC'], ['GND', 'GND'], ['SCL', 'SCL'], ['SDA', 'SDA'], ['INT', 'INT']], proto: 'I2C', addr: '0x40' },
  analog: { n: 'Sensor analógico', pins: [['VCC', 'VCC'], ['GND', 'GND'], ['AO', 'AO']], proto: 'Analógico' },
  digital: { n: 'Sensor digital (1 fio)', pins: [['VCC', 'VCC'], ['DATA', 'SIG_OUT'], ['GND', 'GND']], proto: 'Digital' },
  spi_disp: { n: 'Display SPI', pins: [['VCC', 'VCC'], ['GND', 'GND'], ['CS', 'CS'], ['RST', 'RST'], ['DC', 'DC'], ['SDA', 'MOSI'], ['SCL', 'SCK'], ['BLK', 'EN']], proto: 'SPI', cat: 'display' },
  uart: { n: 'Módulo UART', pins: [['VCC', 'VCC'], ['GND', 'GND'], ['TX', 'TX'], ['RX', 'RX']], proto: 'UART' },
  load: { n: 'Carga (2 terminais)', pins: [['+', 'VCC'], ['−', 'GND']], proto: 'Outro', cat: 'act' }
};
const ST = window.StudioState = { pins: TEMPLATES.i2c.pins.map(p => p.slice()), editing: null };

const SK_OPTS = [['custom', 'Campos personalizados'], ['dht', 'Temperatura + umidade'], ['bmp', 'Pressão + temperatura'], ['bme', 'T + U + pressão'], ['imu', 'IMU (acel./giro)'], ['lux', 'Luz (lux)'], ['luxA', 'Luz analógica'], ['dist', 'Distância'], ['gas', 'Gás'], ['soil', 'Umidade do solo'], ['snd', 'Som'], ['motion', 'Movimento'], ['touch', 'Toque'], ['hall', 'Campo magnético'], ['curr', 'Corrente'], ['volt', 'Tensão'], ['co2', 'CO₂'], ['pm', 'Partículas'], ['uv', 'UV'], ['gps', 'GPS'], ['mag', 'Bússola'], ['hr', 'Batimentos / SpO₂'], ['flow', 'Fluxo'], ['', 'Sem dados (só elétrica)']];

function render(){
  const v = document.querySelector('#v-studio .vpad');
  const catOpts = Object.keys(CATS).filter(k => k !== 'custom' && k !== 'board').map(k => `<option value="${k}">${CATS[k][1]} ${CATS[k][0]}</option>`).join('');
  v.innerHTML = `
  <div class="pgTitle">🛠️ Estúdio de Criação de Peças <span class="tag c1">v2 · planejador</span></div>
  <div class="pgSub">Planeje o componente como no mundo real: pinagem por função, elétrica, dimensões em mm, tela/touch, campos de leitura e API de código. A peça entra no solver de circuito (alimentação, consumo, sobretensão) e nas bibliotecas Python/C++.</div>
  <div class="twoCol">
   <div>
    <div class="panelBox frm" id="stForm">
      <h3>1 · Identificação</h3>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px"><div><label>Nome *</label><input id="stName" placeholder="ex.: Sensor de CO₂ X-200"></div><div><label>Marca</label><input id="stBrand" placeholder="Fabricante"></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>Categoria *</label><select id="stCat">${catOpts}</select></div><div><label>Modelo de partida</label><select id="stTpl">${Object.keys(TEMPLATES).map(k => `<option value="${k}">${TEMPLATES[k].n}</option>`).join('')}</select></div></div>
      <label>Descrição</label><input id="stDesc" placeholder="Para que serve?">

      <h3 style="margin-top:14px">2 · Elétrica</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        <div><label>VCC nominal (V)</label><input id="stVcc" type="number" step="0.1" value="3.3"></div>
        <div><label>VCC mínimo (V)</label><input id="stVmin" type="number" step="0.1" value="2.7"></div>
        <div><label>VCC máximo (V)</label><input id="stVmax" type="number" step="0.1" value="3.6"></div>
        <div><label>Consumo (mA)</label><input id="stIq" type="number" step="0.5" value="5"></div>
      </div>
      <div class="hint">Abaixo do mínimo a peça não liga; acima do máximo ela <b>queima</b> (como na vida real).</div>

      <h3 style="margin-top:14px">3 · Pinagem (por função)</h3>
      <div id="stPins"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn" id="stAddPin">➕ Pino</button><button class="btn" id="stAddI2C">+ I2C</button><button class="btn" id="stAddSPI">+ SPI</button><button class="btn" id="stAddUART">+ UART</button><button class="btn" id="stAddPwr">+ VCC/GND</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px"><div><label>Protocolo</label><select id="stProto"><option>I2C</option><option>SPI</option><option>UART</option><option>Analógico</option><option>Digital</option><option>1-Wire</option><option>Radio RF</option><option>Outro</option></select></div><div><label>Endereço I2C</label><input id="stAddr" placeholder="0x40"></div></div>

      <h3 style="margin-top:14px">4 · Dimensões físicas</h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px"><div><label>Largura (mm)</label><input id="stW" type="number" step="0.5" value="22"></div><div><label>Altura (mm)</label><input id="stH" type="number" step="0.5" value="16"></div><div><label>Cor da placa</label><input id="stColor" type="color" value="#0f3d5c" style="height:34px;padding:2px"></div></div>
      <div class="hint">Escala real: 3,6 px/mm (mesma do ESP32 e das telas). Pinos a cada 2,54 mm.</div>

      <div id="stScrBox" style="display:none;margin-top:12px;background:#0f172a;padding:10px;border-radius:8px;border:1px solid var(--line)">
        <label style="color:var(--ac);font-weight:bold">🖥️ Tela integrada</label>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:6px"><div><label class="small">Res. X</label><input id="stSW" type="number" value="240"></div><div><label class="small">Res. Y</label><input id="stSH" type="number" value="240"></div><div><label class="small">Área útil L (mm)</label><input id="stAW" type="number" step="0.5" value="20"></div><div><label class="small">Área útil A (mm)</label><input id="stAH" type="number" step="0.5" value="20"></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px"><div><label class="small">Tipo</label><select id="stSType"><option value="tft">TFT / IPS colorido</option><option value="oled">OLED monocromático</option><option value="epd">e-Paper</option><option value="mono">LCD monocromático</option></select></div><div><label class="small">Touch</label><select id="stSTouch"><option value="">sem touch</option><option value="cap">capacitivo (multitoque)</option><option value="res">resistivo</option></select></div><div><label class="small">Formato</label><select id="stSShape"><option value="">retangular</option><option value="round">redondo</option></select></div></div>
      </div>

      <h3 style="margin-top:14px">5 · Comportamento e leituras</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>Tipo de dado</label><select id="stSk">${SK_OPTS.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></div><div><label>Nome do módulo (Python)</label><input id="stMod" placeholder="gerado a partir do nome"></div></div>
      <label>Campos de leitura <span class="small">(nome | unidade | mín | máx — um por linha)</span></label>
      <textarea id="stFields" rows="3">value | un | 0 | 100</textarea>

      <div id="stWarn" style="margin-top:12px"></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn prime" id="stCreate">⚒️ Criar peça</button><button class="btn" id="stReset">↺ Limpar</button><span id="stEditTag" class="small" style="align-self:center"></span></div>
    </div>
   </div>
   <div>
    <div class="panelBox"><h3>Pré-visualização</h3><div id="stPrev" style="background:#060b14;border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto;min-height:150px"></div><p class="small" id="stPrevInfo" style="margin-top:6px"></p><div id="stApi" class="mono small" style="margin-top:8px;white-space:pre-wrap"></div></div>
    <div class="panelBox" style="margin-top:14px"><h3>Minhas peças <span style="float:right"><button class="btn" id="stImport">📥 Importar</button><input type="file" id="stImpFile" accept=".json" style="display:none"></span></h3><div id="cpList" style="max-height:48vh;overflow:auto"></div></div>
   </div>
  </div>`;
  bind();
  $s('stCat').value = 'sensor';
  loadTemplate('i2c');
  renderList();
}
const $s = id => document.getElementById(id);

function pinRows(){
  const roleOpt = r => ROLES.map(x => `<option value="${x[0]}"${x[0] === r ? ' selected' : ''}>${x[1]}</option>`).join('');
  $s('stPins').innerHTML = ST.pins.length ? ST.pins.map((p, i) => `<div style="display:grid;grid-template-columns:24px 1fr 1.4fr 28px 28px 28px;gap:6px;margin-bottom:4px;align-items:center"><span class="small mono">${i + 1}</span><input data-pn="${i}" value="${esc(p[0])}" maxlength="10"><select data-pr="${i}">${roleOpt(p[1])}</select><button class="btn" data-up="${i}" title="subir">↑</button><button class="btn" data-dn="${i}" title="descer">↓</button><button class="btn danger" data-rm="${i}" title="remover">✕</button></div>`).join('') : '<p class="small">Sem pinos — adicione ao menos VCC e GND.</p>';
  $s('stPins').querySelectorAll('[data-pn]').forEach(e => e.oninput = () => { ST.pins[+e.dataset.pn][0] = e.value; preview(); });
  $s('stPins').querySelectorAll('[data-pr]').forEach(e => e.onchange = () => { ST.pins[+e.dataset.pr][1] = e.value; preview(); });
  $s('stPins').querySelectorAll('[data-rm]').forEach(e => e.onclick = () => { ST.pins.splice(+e.dataset.rm, 1); pinRows(); preview(); });
  $s('stPins').querySelectorAll('[data-up]').forEach(e => e.onclick = () => { const i = +e.dataset.up; if(i > 0){ [ST.pins[i - 1], ST.pins[i]] = [ST.pins[i], ST.pins[i - 1]]; pinRows(); preview(); } });
  $s('stPins').querySelectorAll('[data-dn]').forEach(e => e.onclick = () => { const i = +e.dataset.dn; if(i < ST.pins.length - 1){ [ST.pins[i + 1], ST.pins[i]] = [ST.pins[i], ST.pins[i + 1]]; pinRows(); preview(); } });
}
function loadTemplate(k){
  const t = TEMPLATES[k];
  ST.pins = t.pins.map(p => p.slice());
  if(t.proto) $s('stProto').value = t.proto;
  if(t.addr !== undefined) $s('stAddr').value = t.addr || '';
  $s('stCat').value = t.cat || ($s('stCat').value === 'act' || $s('stCat').value === 'display' ? 'sensor' : $s('stCat').value);
  $s('stSk').value = (k === 'load' || k === 'spi_disp') ? '' : 'custom';
  syncCat(); pinRows(); preview();
}
function syncCat(){
  const c = $s('stCat').value;
  $s('stScrBox').style.display = (c === 'display' || c === 'mcu') ? 'block' : 'none';
}
function collect(){
  const name = $s('stName').value.trim();
  const fields = $s('stFields').value.split('\n').map(l => l.split('|').map(s => s.trim())).filter(a => a[0]).map(a => ({ k: a[0].replace(/\W+/g, '_'), u: a[1] || '', min: isFinite(+a[2]) && a[2] !== '' ? +a[2] : 0, max: isFinite(+a[3]) && a[3] !== '' ? +a[3] : 100 }));
  return {
    name, brand: $s('stBrand').value.trim() || 'Custom', cat: $s('stCat').value, desc: $s('stDesc').value.trim(),
    vcc: +$s('stVcc').value || 3.3, vmin: +$s('stVmin').value, vmax: +$s('stVmax').value, iq: (+$s('stIq').value || 0) / 1000,
    pins: ST.pins.map(p => ({ n: p[0].trim() || 'P', r: p[1] })), proto: $s('stProto').value, addr: $s('stAddr').value.trim(),
    wmm: +$s('stW').value || 20, hmm: +$s('stH').value || 15, color: $s('stColor').value, sk: $s('stSk').value, mod: $s('stMod').value.trim(), fields,
    scr: (['display', 'mcu'].includes($s('stCat').value) && $s('stScrBox').style.display !== 'none') ? { W: +$s('stSW').value || 240, H: +$s('stSH').value || 240, aw: +$s('stAW').value || 20, ah: +$s('stAH').value || 20, type: $s('stSType').value, touch: $s('stSTouch').value || null, round: $s('stSShape').value === 'round' } : null
  };
}
function validate(c){
  const w = [], e = [];
  if(!c.name) e.push('Informe o nome da peça.');
  if(c.pins.length < 2) e.push('Uma peça precisa de pelo menos 2 pinos.');
  const names = c.pins.map(p => p.n);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if(dup.length) w.push('Nomes de pino repetidos: ' + [...new Set(dup)].join(', ') + ' (use nomes únicos para ligar fios sem ambiguidade).');
  const roles = c.pins.map(p => p.r);
  if(c.cat !== 'passive' && c.cat !== 'power'){
    if(!roles.includes('VCC')) w.push('Sem pino de alimentação (VCC) — a peça nunca terá energia no solver.');
    if(!roles.includes('GND')) w.push('Sem pino GND — não há retorno de corrente.');
  }
  if(roles.includes('SDA') !== roles.includes('SCL')) w.push('I2C incompleto: SDA e SCL devem existir juntos.');
  if(roles.includes('SDA') && !c.addr) w.push('Defina o endereço I2C (ex.: 0x40) para o scan() e as bibliotecas.');
  if(c.vmax < c.vcc) w.push('VCC máximo menor que o nominal.');
  if(c.vmin > c.vcc) w.push('VCC mínimo maior que o nominal.');
  if(c.iq > 0.5) w.push('Consumo alto (' + (c.iq * 1000) + ' mA): ligue a uma fonte forte, não ao pino do MCU.');
  const fit = Math.ceil(c.pins.length * 2.54 + 2);
  if(c.wmm < fit && c.pins.length > 2) w.push('Largura menor que ' + fit + ' mm: os pinos não cabem em linha (a peça será alargada).');
  if(c.sk === 'custom' && !c.fields.length) w.push('Tipo "campos personalizados" sem campos de leitura.');
  return { w, e };
}
function preview(){
  const c = collect();
  const W = px(c.wmm), H = px(c.hmm);
  const n = c.pins.length, span = Math.max(0, (n - 1) * 8), width = Math.max(W, span + 16);
  let s = `<svg width="${width + 30}" height="${H + 50}" style="font-family:monospace">`;
  s += `<rect x="15" y="10" width="${width}" height="${H}" rx="6" fill="${c.color}" stroke="#000a"/>`;
  s += `<rect x="${15 + width / 2 - 14}" y="${18}" width="28" height="${Math.max(10, H - 34)}" rx="3" fill="#0d1117" stroke="#39424e"/>`;
  s += `<text x="${15 + width / 2}" y="${H - 2}" text-anchor="middle" font-size="7" fill="#fff9">${esc(c.name.slice(0, 22) || 'sem nome')}</text>`;
  if(c.scr){ const aw = px(c.scr.aw), ah = px(c.scr.ah); s += `<rect x="${15 + (width - aw) / 2}" y="16" width="${aw}" height="${ah}" rx="${c.scr.round ? aw / 2 : 3}" fill="#05080d" stroke="#334155"/><text x="${15 + width / 2}" y="${16 + ah / 2}" text-anchor="middle" font-size="7" fill="#64748b">${c.scr.W}×${c.scr.H}${c.scr.touch ? ' 👆' : ''}</text>`; }
  const x0 = 15 + (width - span) / 2;
  c.pins.forEach((p, i) => {
    const x = x0 + i * 8, y = H + 6;
    const col = p.r === 'VCC' ? '#ef4444' : p.r === 'GND' ? '#9ca3af' : /SDA|SCL/.test(p.r) ? '#38bdf8' : /TX|RX/.test(p.r) ? '#a78bfa' : '#d4af37';
    s += `<circle cx="${x}" cy="${y}" r="3" fill="${col}" stroke="#000"/><text transform="translate(${x + 2},${y + 6}) rotate(60)" font-size="6" fill="#cbd5e1">${esc(p.n)}</text>`;
  });
  s += '</svg>';
  $s('stPrev').innerHTML = s;
  $s('stPrevInfo').innerHTML = `Tamanho: <b>${c.wmm} × ${c.hmm} mm</b> (${W}×${H}px) · ${n} pinos · passo 2,54 mm · ${c.vcc} V · ${(c.iq * 1000).toFixed(1)} mA`;
  const slug = (c.mod || c.name || 'minha_peca').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'peca';
  const cls = slug.replace(/_/g, '').toUpperCase();
  $s('stApi').textContent = c.sk ? `# MicroPython\nfrom ${slug} import ${cls}\ns = ${cls}()\n${c.sk === 'custom' ? c.fields.map(f => 'print(s.' + f.k + ')').join('\n') : 'print(s.read())'}\n\n// Arduino\n${'Adafruit_' + cls} s;\ns.begin();` : '(sem leituras: peça somente elétrica)';
  const v = validate(c);
  $s('stWarn').innerHTML = v.e.map(x => `<div class="small" style="color:var(--err)">⛔ ${esc(x)}</div>`).join('') + v.w.map(x => `<div class="small" style="color:var(--warn)">⚠ ${esc(x)}</div>`).join('') + (!v.e.length && !v.w.length ? '<div class="small" style="color:var(--ac2)">✅ Planejamento consistente</div>' : '');
}
function build(c, id){
  const slug = (c.mod || c.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'peca';
  const n = c.pins.length;
  const names = c.pins.map(p => p.n);
  const width = Math.max(px(c.wmm), (n - 1) * 8 + 16), height = px(c.hmm);
  const d = {
    id: id || 'c_' + slug, n: c.name, cat: c.cat, brand: c.brand, vcc: c.vcc, vmin: c.vmin, vmax: c.vmax, iq: c.iq, lib: null, pinNames: names, pins: n, w: width, h: height,
    sk: c.sk || undefined, customFields: c.sk === 'custom' ? c.fields : undefined, proto: c.proto, addr: c.addr, desc: c.desc, studio: true, color: c.color, roles: c.pins.map(p => p.r), mod: slug, wmm: c.wmm, hmm: c.hmm
  };
  if(c.addr && /^0x[0-9a-f]+$/i.test(c.addr)) d.i2c = parseInt(c.addr, 16);
  if(c.scr){ d.kind = 'screen'; d.scr = { x: Math.round((width - px(c.scr.aw)) / 2 / 2) * 2, y: 8, w: px(c.scr.aw), h: px(c.scr.ah), W: c.scr.W, H: c.scr.H, type: c.scr.type, touch: c.scr.touch, round: c.scr.round, ctrl: 'generic', fg: '#e8f6ff', bg: '#000', pcb: c.color }; if(c.cat === 'mcu'){ d.vcc = c.vcc; d.chip = c.name; d.core = c.desc; } }
  return d;
}
function register(d){
  if(PARTMAP[d.id]){ const i = PARTS.findIndex(p => p.id === d.id); if(i >= 0) PARTS.splice(i, 1); }
  delete d._holes;
  PARTS.push(d); PARTMAP[d.id] = d;
  if(window.KEZLE_REG_CPP) KEZLE_REG_CPP(d);
}
function create(){
  const c = collect(), v = validate(c);
  if(v.e.length){ toast(v.e[0], 'err'); return; }
  const id = ST.editing || 'c_' + (c.mod || c.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const d = build(c, id);
  d._form = c;
  register(d);
  const all = DB.get('klp_cparts', []).filter(x => x.id !== d.id);
  all.push(JSON.parse(JSON.stringify(d)));
  DB.set('klp_cparts', all);
  ST.editing = null; $s('stEditTag').textContent = '';
  renderPalette(); renderCatalog(); renderList();
  // atualiza peças já na bancada que usam esta definição
  BENCH.parts.forEach(p => { if(p.def.id === d.id){ p.def = PARTMAP[d.id]; } });
  renderBench();
  toast('⚒️ Peça "' + c.name + '" criada — já está na paleta e no catálogo', 'ok');
  serialOut('[estúdio] peça registrada: ' + c.name + ' (' + c.cat + ', ' + c.pins.length + ' pinos)', 'sys');
}
function fill(d){
  const c = d._form; if(!c) return;
  $s('stName').value = c.name; $s('stBrand').value = c.brand; $s('stCat').value = c.cat; $s('stDesc').value = c.desc; $s('stVcc').value = c.vcc; $s('stVmin').value = c.vmin; $s('stVmax').value = c.vmax; $s('stIq').value = c.iq * 1000;
  ST.pins = c.pins.map(p => [p.n, p.r]); $s('stProto').value = c.proto; $s('stAddr').value = c.addr; $s('stW').value = c.wmm; $s('stH').value = c.hmm; $s('stColor').value = c.color; $s('stSk').value = c.sk; $s('stMod').value = c.mod || ''; $s('stFields').value = (c.fields || []).map(f => [f.k, f.u, f.min, f.max].join(' | ')).join('\n');
  syncCat();
  if(c.scr){ $s('stSW').value = c.scr.W; $s('stSH').value = c.scr.H; $s('stAW').value = c.scr.aw; $s('stAH').value = c.scr.ah; $s('stSType').value = c.scr.type; $s('stSTouch').value = c.scr.touch || ''; $s('stSShape').value = c.scr.round ? 'round' : ''; }
  ST.editing = d.id; $s('stEditTag').textContent = '✏️ editando ' + d.n + ' — "Criar peça" atualiza';
  pinRows(); preview(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderList(){
  const box = $s('cpList');
  const all = DB.get('klp_cparts', []);
  if(!all.length){ box.innerHTML = '<p class="small">Nenhuma peça customizada ainda. Escolha um modelo de partida e planeje o componente.</p>'; return; }
  box.innerHTML = all.map(d => `<div class="libRow" style="flex-wrap:wrap"><span class="nm">★ ${esc(d.n)}</span><span class="tag c4">${esc(d.proto || '')}${d.addr ? ' · ' + esc(d.addr) : ''}</span><span class="tag">${d.pins} pinos · ${d.wmm || '?'}×${d.hmm || '?'} mm</span><span style="flex:1"></span><button class="installBtn" data-add="${esc(d.id)}">+ bancada</button><button class="installBtn" data-ed="${esc(d.id)}">editar</button><button class="installBtn" data-ex="${esc(d.id)}">.json</button><button class="installBtn" data-rm="${esc(d.id)}">remover</button></div>`).join('');
  box.onclick = e => {
    const t = e.target;
    if(t.dataset.add){ addPart(t.dataset.add, rnd(80, 300), rnd(80, 300)); renderBench(); switchView('bench'); }
    if(t.dataset.ed){ const d = PARTMAP[t.dataset.ed] || all.find(x => x.id === t.dataset.ed); if(d) fill(d._form ? d : all.find(x => x.id === t.dataset.ed)); }
    if(t.dataset.ex){ const d = all.find(x => x.id === t.dataset.ex); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' })); a.download = d.id + '.kezlepart.json'; a.click(); }
    if(t.dataset.rm){
      DB.set('klp_cparts', all.filter(x => x.id !== t.dataset.rm));
      const i = PARTS.findIndex(p => p.id === t.dataset.rm); if(i >= 0) PARTS.splice(i, 1); delete PARTMAP[t.dataset.rm];
      BENCH.parts = BENCH.parts.filter(p => p.def.id !== t.dataset.rm);
      renderPalette(); renderCatalog(); renderList(); renderBench(); toast('Peça removida', 'warn');
    }
  };
}
function bind(){
  $s('stTpl').onchange = () => loadTemplate($s('stTpl').value);
  $s('stCat').onchange = () => { syncCat(); preview(); };
  ['stName', 'stBrand', 'stVcc', 'stVmin', 'stVmax', 'stIq', 'stProto', 'stAddr', 'stW', 'stH', 'stColor', 'stSk', 'stMod', 'stFields', 'stSW', 'stSH', 'stAW', 'stAH', 'stSType', 'stSTouch', 'stSShape'].forEach(id => { const e = $s(id); e.oninput = preview; e.onchange = preview; });
  $s('stAddPin').onclick = () => { ST.pins.push(['P' + (ST.pins.length + 1), 'SIG_IN']); pinRows(); preview(); };
  $s('stAddI2C').onclick = () => { ST.pins.push(['SCL', 'SCL'], ['SDA', 'SDA']); $s('stProto').value = 'I2C'; pinRows(); preview(); };
  $s('stAddSPI').onclick = () => { ST.pins.push(['SCK', 'SCK'], ['MISO', 'MISO'], ['MOSI', 'MOSI'], ['CS', 'CS']); $s('stProto').value = 'SPI'; pinRows(); preview(); };
  $s('stAddUART').onclick = () => { ST.pins.push(['TX', 'TX'], ['RX', 'RX']); $s('stProto').value = 'UART'; pinRows(); preview(); };
  $s('stAddPwr').onclick = () => { ST.pins.unshift(['VCC', 'VCC'], ['GND', 'GND']); pinRows(); preview(); };
  $s('stCreate').onclick = create;
  $s('stReset').onclick = () => { ST.editing = null; $s('stEditTag').textContent = ''; $s('stName').value = ''; loadTemplate('i2c'); };
  $s('stImport').onclick = () => $s('stImpFile').click();
  $s('stImpFile').onchange = async () => { try { const d = JSON.parse(await $s('stImpFile').files[0].text()); if(!d.id || !d.pinNames) throw new Error('arquivo de peça inválido'); register(d); const all = DB.get('klp_cparts', []).filter(x => x.id !== d.id); all.push(d); DB.set('klp_cparts', all); renderPalette(); renderCatalog(); renderList(); toast('📥 Peça importada', 'ok'); } catch(e){ toast('Erro: ' + e.message, 'err'); } $s('stImpFile').value = ''; };
}

/* ---------- campos personalizados + visual ---------- */
const _sf = window.sensFields;
window.sensFields = function(def){
  if(def && def.sk === 'custom' && def.customFields) return def.customFields.map(f => ({ k: f.k, u: f.u, base: () => (f.min + f.max) / 2 + (f.max - f.min) * 0.15 * Math.sin(Date.now() / 5000), n: (f.max - f.min) * 0.01, cl: [f.min, f.max] }));
  return _sf(def);
};
const _svgFor = window.svgFor;
window.svgFor = function(inst){
  const d = inst.def;
  if(d.studio && !d.scr){
    const roleCol = r => r === 'VCC' ? '#ef4444' : r === 'GND' ? '#9ca3af' : /SDA|SCL/.test(r) ? '#38bdf8' : /TX|RX/.test(r) ? '#a78bfa' : '#d4af37';
    return `<svg width="${d.w}" height="${d.h}" style="font-family:monospace"><rect x="1" y="1" width="${d.w - 2}" height="${d.h - 2}" rx="6" fill="${d.color || '#0f3d5c'}" stroke="#000a"/><rect x="${d.w / 2 - 14}" y="8" width="28" height="${Math.max(8, d.h - 26)}" rx="3" fill="#0d1117" stroke="#39424e"/><text x="${d.w / 2}" y="${d.h - 9}" text-anchor="middle" font-size="7" fill="#fffc">${esc((d.n || '').slice(0, 20))}</text></svg>`;
  }
  return _svgFor(inst);
};
// restaura peças salvas no boot e remove XSS do nome
const saved = DB.get('klp_cparts', []);
for(const d of saved){ if(d.studio){ if(!PARTMAP[d.id] || !PARTMAP[d.id].studio) register(d); } else if(!PARTMAP[d.id]){ d.n = String(d.n).replace(/[<>]/g, ''); PARTS.push(d); PARTMAP[d.id] = d; d.pinNames = d.pinNames || autoPinNames(d); } }
render();
renderPalette(); renderCatalog();

/* ---------- parâmetros avançados no painel de propriedades ---------- */
const PARAMS = { vset: ['Tensão de saída (V)', 0.5, 30, 0.1], rtotal: ['Resistência total (Ω)', 1, 1e7, 1], watt: ['Potência máxima (W)', 0.05, 100, 0.05], rating: ['Corrente do fusível (A)', 0.01, 100, 0.01], vout: ['Tensão ajustada (V)', 1.2, 36, 0.1], L: ['Indutância (µH)', 0.1, 1e6, 1], imax: ['Corrente máx. do LED (A)', 0.005, 0.2, 0.005] };
const _rp = window.renderProps;
window.renderProps = function(){
  _rp();
  const inst = BENCH.sel; if(!inst || BENCH.selWire) return;
  const keys = Object.keys(PARAMS).filter(k => k in inst.props || (inst.def.defaults && k in inst.def.defaults) || (k === 'vset' && inst.def.adj) || (k === 'watt' && inst.def.kind === 'res') || (k === 'imax' && inst.def.kind === 'led'));
  if(!keys.length) return;
  const box = document.getElementById('props');
  const el = document.createElement('div');
  el.innerHTML = '<div class="propRow" style="margin-top:10px;background:#0f172a;padding:10px;border-radius:8px;border:1px solid var(--line)"><b style="color:var(--ac)">⚙ Parâmetros</b>' + keys.map(k => `<div style="margin-top:6px"><label class="small">${PARAMS[k][0]}</label><input type="number" data-prm="${k}" step="${PARAMS[k][3]}" min="${PARAMS[k][1]}" max="${PARAMS[k][2]}" value="${inst.props[k] != null ? inst.props[k] : (k === 'watt' ? 0.25 : k === 'imax' ? 0.03 : k === 'vset' ? 5 : '')}" style="width:100%"></div>`).join('') + '</div>';
  box.appendChild(el);
  el.querySelectorAll('[data-prm]').forEach(i => i.oninput = () => { inst.props[i.dataset.prm] = +i.value; CIRCUIT.request(); scheduleSaveBench(); });
};
/* paleta/catálogo: nomes como texto (sem HTML) */
const _rpal = window.renderPalette;
window.renderPalette = function(f){
  _rpal(f);
  document.querySelectorAll('#palList .palItem').forEach(it => { const sp = it.children[1]; if(sp) sp.textContent = sp.textContent; });
};
})();
