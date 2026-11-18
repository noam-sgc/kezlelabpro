/* =========================================================================
   Kezle Lab Pro — WebRTC: Sala Global
   - Conexão P2P (DataChannel) entre navegadores; o servidor (/api/signal) só
     ajuda a se encontrarem. Alternativa manual (copiar/colar) sem servidor.
   - Chat, rádio/MQTT entre bancadas diferentes (umqtt, ESP-NOW, PubSubClient,
     mqtt.js, NodeMCU mqtt), transmissão ao vivo da bancada (peças, LEDs, motores,
     telas, serial) e espectadores.
   ========================================================================= */
(function(){
'use strict';
const esc = window.escHtml;
const API = location.protocol === 'file:' ? 'https://kezlelabpro.vercel.app' : '';
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
const R = window.KezleRTC = {
  id: 'u' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3), room: null, peers: new Map(), since: 0, poll: null, broadcasting: false, viewing: null,
  names: new Map(), inbox: [], subs: new Set(), log: [], onUI: null, sigOK: null, retained: new Map()
};
const myName = () => (typeof USER !== 'undefined' && USER) || 'visitante';

/* ---------- sinalização via servidor ---------- */
async function sig(method, path, body){
  const r = await fetch(API + '/api/signal' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if(!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}
const sendSig = (type, data, to) => sig('POST', '', { room: R.room, from: R.id, to, type, data }).catch(e => ui('Sinalização: ' + e.message, 'err'));

/* ---------- pares ---------- */
function newPeer(pid, initiator){
  if(R.peers.has(pid)) return R.peers.get(pid);
  const pc = new RTCPeerConnection(ICE);
  const peer = { id: pid, pc, dc: null, state: 'conectando', name: R.names.get(pid) || pid, queue: [], remoteSet: false };
  R.peers.set(pid, peer);
  pc.onicecandidate = e => { if(e.candidate) sendSig('ice', e.candidate, pid); };
  pc.onconnectionstatechange = () => { peer.state = pc.connectionState; if(['failed', 'closed'].includes(pc.connectionState)){ R.peers.delete(pid); } ui(); };
  pc.ondatachannel = e => wire(peer, e.channel);
  if(initiator){ wire(peer, pc.createDataChannel('kezle', { ordered: true })); pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => sendSig('offer', pc.localDescription, pid)); }
  return peer;
}
function wire(peer, dc){
  peer.dc = dc;
  dc.onopen = () => { peer.state = 'conectado'; dcSend(peer, { t: 'hi', n: myName() }); ui('🟢 ' + peer.name + ' conectou (P2P)'); if(R.broadcasting) sendSnap(peer); ui(); };
  dc.onclose = () => { peer.state = 'desconectado'; R.peers.delete(peer.id); ui('🔴 ' + peer.name + ' saiu'); };
  dc.onmessage = e => { try { onMsg(peer, JSON.parse(e.data)); } catch(er){} };
}
function dcSend(peer, obj){ if(peer.dc && peer.dc.readyState === 'open'){ try { peer.dc.send(JSON.stringify(obj)); } catch(e){} } }
const bcast = obj => { for(const p of R.peers.values()) dcSend(p, obj); };
R.bcast = bcast;
R.connected = () => [...R.peers.values()].filter(p => p.dc && p.dc.readyState === 'open');

async function handleSig(m){
  const pid = m.from;
  if(m.type === 'hello'){
    R.names.set(pid, m.data && m.data.n || pid);
    if(!R.peers.has(pid) && R.id < pid) newPeer(pid, true);
    else if(!R.peers.has(pid)) sendSig('hello', { n: myName() }, pid);
    return;
  }
  const peer = newPeer(pid, false);
  const pc = peer.pc;
  if(m.type === 'offer'){
    await pc.setRemoteDescription(m.data); peer.remoteSet = true;
    const a = await pc.createAnswer(); await pc.setLocalDescription(a); sendSig('answer', pc.localDescription, pid);
    for(const c of peer.queue.splice(0)) pc.addIceCandidate(c).catch(() => {});
  } else if(m.type === 'answer'){
    if(pc.signalingState === 'have-local-offer'){ await pc.setRemoteDescription(m.data); peer.remoteSet = true; for(const c of peer.queue.splice(0)) pc.addIceCandidate(c).catch(() => {}); }
  } else if(m.type === 'ice'){
    if(peer.remoteSet) pc.addIceCandidate(m.data).catch(() => {}); else peer.queue.push(m.data);
  }
}
R.join = async function(room){
  R.leave();
  room = String(room || '').trim().toLowerCase().replace(/[^\w\-]/g, '');
  if(room.length < 3){ ui('Código de sala: mínimo 3 caracteres', 'err'); return; }
  R.room = room; R.since = 0;
  try {
    await sendSig('hello', { n: myName() });
    R.sigOK = true;
  } catch(e){ R.sigOK = false; }
  const tick = async () => {
    if(!R.room) return;
    try {
      const j = await sig('GET', '?room=' + encodeURIComponent(R.room) + '&since=' + R.since + '&me=' + R.id);
      R.since = j.next; R.sigOK = true; R.sigPersistent = j.persistent;
      for(const m of j.msgs) await handleSig(m).catch(e => console.warn(e));
    } catch(e){ R.sigOK = false; }
    ui();
  };
  R.poll = setInterval(tick, 1200); tick();
  // refaz hello periodicamente para quem entrar depois
  R.hi = setInterval(() => { if(R.room && R.connected().length === 0) sendSig('hello', { n: myName() }); }, 6000);
  ui('Entrou na sala "' + room + '" — aguardando pares…');
};
R.leave = function(){
  clearInterval(R.poll); clearInterval(R.hi);
  for(const p of R.peers.values()){ try { p.pc.close(); } catch(e){} }
  R.peers.clear(); R.room = null; R.broadcasting = false; R.viewing = null; CIRCUIT.frozen = false;
  ui();
};

/* ---------- mensagens ---------- */
function onMsg(peer, m){
  switch(m.t){
    case 'hi': peer.name = m.n || peer.name; R.names.set(peer.id, peer.name); ui(); break;
    case 'chat': chatAdd(peer.name, m.x); break;
    case 'pub': deliver(m.topic, m.payload, peer.name); break;
    case 'snap': peer.snap = m; peer.snapAt = Date.now(); if(R.viewing === peer.id) applySnap(m); ui(); break;
    case 'st': if(R.viewing === peer.id) applyStates(m.s); break;
    case 'scr': if(R.viewing === peer.id) applyScr(m); break;
    case 'log': if(R.viewing === peer.id) serialOut('[' + peer.name + '] ' + m.x, m.c || ''); break;
    case 'bye': R.peers.delete(peer.id); ui(); break;
  }
}
const chat = [];
function chatAdd(who, text){ chat.push({ who, text, t: Date.now() }); if(chat.length > 200) chat.shift(); ui(); }
R.chat = text => { chatAdd('você', text); bcast({ t: 'chat', x: String(text).slice(0, 500) }); };

/* ---------- rádio / MQTT entre bancadas ---------- */
function match(filter, topic){
  if(filter === '#') return true;
  const f = filter.split('/'), t = topic.split('/');
  for(let i = 0; i < f.length; i++){ if(f[i] === '#') return true; if(f[i] === '+'){ if(t[i] === undefined) return false; continue; } if(f[i] !== t[i]) return false; }
  return f.length === t.length;
}
function deliver(topic, payload, from){
  R.log.push({ topic, payload, from, t: Date.now() }); if(R.log.length > 100) R.log.shift();
  for(const s of R.subs) if(match(s, topic)){ R.inbox.push({ topic, payload: String(payload), from }); break; }
  if(R.inbox.length > 500) R.inbox.shift();
  ui();
}
R.publish = (topic, payload, retain) => { const p = String(payload); topic = String(topic); bcast({ t: 'pub', topic, payload: p }); if(R.connected().length === 0 && R.room) ui('⚠ publicação sem pares conectados'); R.log.push({ topic, payload: p, from: 'você', t: Date.now() }); };
R.subscribe = topic => { R.subs.add(String(topic)); };
R.recv = () => R.inbox.shift() || null;
R.hasInbox = () => R.inbox.length > 0;

/* ---------- transmissão ao vivo ---------- */
let snapSig = '', lastSnap = 0;
function snapObj(){ const o = serializeBench(); return { t: 'snap', bench: o, code: $('#pyEditor').value, lang: $('#pyLang').value, n: myName(), sim: !!SIM.on }; }
function sendSnap(peer){ const m = snapObj(); if(peer) dcSend(peer, m); else bcast(m); }
function stateRow(p){ const s = p.state; return [CIRCUIT.powered(p) ? 1 : 0, s.on ? 1 : 0, +(s.brightness || 0).toFixed(2), Math.round(s.rpm || 0), Math.round(s.angle != null ? s.angle : 90), +(s.heat || 0).toFixed(2), s.burnt ? 1 : 0, s.servoPow ? 1 : 0, +((s.current || 0) * 1000).toFixed(2), s.mcuPow ? 1 : 0, s.pressed ? 1 : 0, s.sw ? 1 : 0, +(s.vals && s.vals[Object.keys(s.vals)[0]] || 0).toFixed(2)]; }
function applyStates(rows){
  BENCH.parts.forEach((p, i) => { const r = rows[i]; if(!r) return; const s = p.state; s.__pw = !!r[0]; s.on = !!r[1]; s.brightness = r[2]; s.rpm = r[3]; s.angle = r[4]; s.heat = r[5]; s.burnt = !!r[6]; s.servoPow = !!r[7]; s.current = r[8] / 1000; s.mcuPow = !!r[9]; s.pressed = !!r[10]; s.sw = r[11]; s.speed = Math.min(2, Math.abs(r[3]) / 3000); });
  refreshAllVisuals();
}
function applySnap(m){
  CIRCUIT.frozen = true; SIM.on = !!m.sim;
  loadBenchData(m.bench);
  if(m.code != null){ $('#pyEditor').value = m.code; syncGutter(); }
  if(m.lang && $('#pyLang').querySelector('option[value="' + m.lang + '"]')){ $('#pyLang').value = m.lang; refreshTpl(); }
  updatePowerUI();
}
function applyScr(m){
  const p = BENCH.parts[m.i]; if(!p || !p.def.scr) return;
  const sc = KezleScreens.get(p); sc.user = true;
  const im = new Image(); im.onload = () => { sc.g.setTransform(1, 0, 0, 1, 0, 0); sc.g.drawImage(im, 0, 0, sc.W, sc.H); KezleScreens.makeGfx(p, { idle: true }).dirty(); }; im.src = m.d;
}
R.startBroadcast = function(){ R.broadcasting = true; snapSig = ''; ui('📡 Transmitindo sua bancada para a sala'); };
R.stopBroadcast = function(){ R.broadcasting = false; ui(); };
R.view = function(pid){
  const p = R.peers.get(pid); if(!p || !p.snap){ ui('Esse par ainda não transmite', 'err'); return; }
  R.viewing = pid; applySnap(p.snap); setTimeout(() => $('#btnSim') && 0, 0); switchView('bench'); toast('👁 Assistindo a bancada de ' + p.name + ' (somente leitura)', 'ok'); ui();
};
R.stopView = function(){ R.viewing = null; CIRCUIT.frozen = false; toast('Saiu do modo espectador', 'ok'); ui(); };
setInterval(() => {
  if(!R.broadcasting || !R.connected().length || R.viewing) return;
  const sg = JSON.stringify(serializeBench()) + $('#pyEditor').value.length + SIM.on;
  if(sg !== snapSig){ snapSig = sg; sendSnap(); }
  bcast({ t: 'st', s: BENCH.parts.map(stateRow) });
}, 250);
setInterval(() => {
  if(!R.broadcasting || !R.connected().length || R.viewing) return;
  BENCH.parts.forEach((p, i) => { if(!p.def.scr) return; const sc = KezleScreens.get(p); const cv = document.createElement('canvas'); const k = Math.min(1, 240 / sc.W); cv.width = Math.round(sc.W * k); cv.height = Math.round(sc.H * k); cv.getContext('2d').drawImage(sc.buf, 0, 0, cv.width, cv.height); bcast({ t: 'scr', i, d: cv.toDataURL('image/jpeg', 0.5) }); });
}, 450);
const _so = window.serialOut;
window.serialOut = function(text, cls){ _so(text, cls); if(R.broadcasting && !R.viewing) bcast({ t: 'log', x: String(text).slice(0, 300), c: cls || '' }); };

/* ---------- toque/edição bloqueados no modo espectador ---------- */
document.addEventListener('pointerdown', e => { if(R.viewing && e.target.closest && e.target.closest('#partLayer, #wireLayer')){ e.stopPropagation(); e.preventDefault(); } }, true);
const _tg = window.toggleSim;
window.toggleSim = function(){ if(R.viewing){ toast('Modo espectador: saia para simular a sua bancada', 'warn'); return; } return _tg.apply(this, arguments); };

/* ---------- sinalização manual (sem servidor) ---------- */
const wait = pc => new Promise(res => { if(pc.iceGatheringState === 'complete') return res(); pc.onicegatheringstatechange = () => { if(pc.iceGatheringState === 'complete') res(); }; setTimeout(res, 3500); });
const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
R.manualOffer = async function(){
  const pid = 'm' + Math.random().toString(36).slice(2, 6);
  const pc = new RTCPeerConnection(ICE); const peer = { id: pid, pc, dc: null, state: 'manual', name: 'par manual', queue: [] }; R.peers.set(pid, peer);
  pc.onconnectionstatechange = () => { peer.state = pc.connectionState; ui(); };
  wire(peer, pc.createDataChannel('kezle'));
  await pc.setLocalDescription(await pc.createOffer()); await wait(pc);
  R._manual = peer; return enc({ d: pc.localDescription, id: pid });
};
R.manualAnswer = async function(code){
  const o = dec(code); const pid = o.id;
  const pc = new RTCPeerConnection(ICE); const peer = { id: pid, pc, dc: null, state: 'manual', name: 'par manual', queue: [] }; R.peers.set(pid, peer);
  pc.onconnectionstatechange = () => { peer.state = pc.connectionState; ui(); }; pc.ondatachannel = e => wire(peer, e.channel);
  await pc.setRemoteDescription(o.d); await pc.setLocalDescription(await pc.createAnswer()); await wait(pc);
  return enc({ d: pc.localDescription });
};
R.manualFinish = async function(code){ const o = dec(code); if(R._manual) await R._manual.pc.setRemoteDescription(o.d); };

/* ---------- UI: aba "Sala Global" ---------- */
const nav = document.createElement('button');
nav.className = 'navBtn'; nav.dataset.v = 'rtc'; nav.innerHTML = '<span class="ic">📡</span>Sala Global (P2P)';
document.getElementById('side').insertBefore(nav, document.querySelector('#side .foot'));
nav.onclick = () => switchView('rtc');
const view = document.createElement('div'); view.className = 'view'; view.id = 'v-rtc';
document.getElementById('views').appendChild(view);
view.innerHTML = `<div class="vpad">
 <div class="pgTitle">📡 Sala Global <span class="tag c1">WebRTC P2P</span></div>
 <div class="pgSub">Conecte bancadas de pessoas diferentes direto entre navegadores (sem passar os dados por servidor). Troque mensagens, faça seus microcontroladores conversarem (MQTT / ESP-NOW / rádio) e transmita sua bancada ao vivo.</div>
 <div class="twoCol"><div>
  <div class="panelBox"><h3>Sala</h3>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="rtcRoom" placeholder="código da sala (ex.: lab-do-joao)" style="flex:1;min-width:160px"><button class="btn" id="rtcGen">🎲 Gerar</button><button class="btn prime" id="rtcJoin">Entrar</button><button class="btn danger" id="rtcLeave">Sair</button></div>
   <p class="small" id="rtcStat" style="margin-top:8px"></p><div id="rtcPeers" style="margin-top:6px"></div>
   <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="rtcBc">📡 Transmitir minha bancada</button><button class="btn" id="rtcStopView" style="display:none">⏹ Sair do modo espectador</button></div>
   <details style="margin-top:12px"><summary class="small" style="cursor:pointer">🔧 Conexão manual (sem servidor de sinalização)</summary>
    <p class="small">A: gere o código de oferta e envie à pessoa B. B cola em "Responder" e devolve o código. A cola em "Finalizar".</p>
    <button class="btn" id="rtcMo">1 · Gerar oferta (A)</button> <textarea id="rtcMoT" rows="2" style="width:100%;margin-top:4px" placeholder="oferta…" readonly></textarea>
    <textarea id="rtcMaIn" rows="2" style="width:100%;margin-top:6px" placeholder="B: cole aqui a oferta de A"></textarea><button class="btn" id="rtcMa">2 · Responder (B)</button><textarea id="rtcMaOut" rows="2" style="width:100%;margin-top:4px" readonly placeholder="resposta…"></textarea>
    <textarea id="rtcMfIn" rows="2" style="width:100%;margin-top:6px" placeholder="A: cole aqui a resposta de B"></textarea><button class="btn" id="rtcMf">3 · Finalizar (A)</button></details>
  </div>
  <div class="panelBox" style="margin-top:14px"><h3>Chat</h3><div id="rtcChat" style="height:190px;overflow:auto;background:#060b14;border:1px solid var(--line);border-radius:8px;padding:8px;font-size:12.5px"></div><div style="display:flex;gap:6px;margin-top:6px"><input id="rtcMsg" placeholder="mensagem…" style="flex:1"><button class="btn prime" id="rtcSend">Enviar</button></div></div>
 </div><div>
  <div class="panelBox"><h3>Rádio / MQTT entre bancadas</h3>
   <p class="small">Seu código publica e assina tópicos que chegam a <b>todos na sala</b>. Exemplos (cada um num dos lados):</p>
   <pre class="mono small" style="white-space:pre-wrap;background:#060b14;padding:8px;border-radius:8px;border:1px solid var(--line)"># MicroPython
from umqtt.simple import MQTTClient
c = MQTTClient("esp-a", "broker")
def cb(topic, msg): print(topic, msg.decode())
c.set_callback(cb); c.connect(); c.subscribe(b"lab/led")
c.publish(b"lab/temp", b"24.5")
while True: c.check_msg()

// Arduino (PubSubClient)  |  JS: mqtt.connect()  |  Lua: mqtt.Client()
// ESP-NOW (Python): import espnow; e = espnow.ESPNow(); e.send(None, b"oi")</pre>
   <div class="row" style="display:flex;gap:6px;margin-top:8px"><input id="rtcTopic" placeholder="tópico" style="flex:1"><input id="rtcPayload" placeholder="mensagem" style="flex:1"><button class="btn" id="rtcPub">Publicar</button></div>
   <div id="rtcLog" class="mono small" style="margin-top:8px;height:200px;overflow:auto;background:#060b14;border:1px solid var(--line);border-radius:8px;padding:8px"></div>
  </div></div></div></div>`;
const $r = id => document.getElementById(id);
$r('rtcGen').onclick = () => { $r('rtcRoom').value = 'lab-' + Math.random().toString(36).slice(2, 7); };
$r('rtcJoin').onclick = () => R.join($r('rtcRoom').value);
$r('rtcLeave').onclick = () => R.leave();
$r('rtcBc').onclick = () => { if(R.broadcasting) R.stopBroadcast(); else R.startBroadcast(); };
$r('rtcStopView').onclick = () => R.stopView();
$r('rtcSend').onclick = () => { const v = $r('rtcMsg').value.trim(); if(v){ R.chat(v); $r('rtcMsg').value = ''; } };
$r('rtcMsg').onkeydown = e => { if(e.key === 'Enter') $r('rtcSend').click(); };
$r('rtcPub').onclick = () => { const t = $r('rtcTopic').value.trim(); if(t) R.publish(t, $r('rtcPayload').value); };
$r('rtcMo').onclick = async () => { $r('rtcMoT').value = 'gerando…'; $r('rtcMoT').value = await R.manualOffer(); };
$r('rtcMa').onclick = async () => { try { $r('rtcMaOut').value = await R.manualAnswer($r('rtcMaIn').value); } catch(e){ toast('Código inválido', 'err'); } };
$r('rtcMf').onclick = async () => { try { await R.manualFinish($r('rtcMfIn').value); toast('Conectando…', 'ok'); } catch(e){ toast('Código inválido', 'err'); } };
let note = '';
function ui(msg, cls){
  if(msg){ note = msg; if(cls === 'err') toast(msg, 'err'); }
  if(!$r('rtcStat')) return;
  const open = R.connected();
  $r('rtcStat').innerHTML = (R.room ? '🏠 Sala <b>' + esc(R.room) + '</b> · ' : 'Fora de sala · ') + (R.room ? (R.sigOK ? 'sinalização ok' + (R.sigPersistent === false ? ' <span style="color:var(--warn)">(servidor sem Redis: pode falhar entre instâncias — use a conexão manual)</span>' : '') : '<span style="color:var(--warn)">sinalização indisponível — use a conexão manual</span>') : '') + ' · ' + open.length + ' par(es) conectado(s)' + (note ? '<br><span class="small">' + esc(note) + '</span>' : '');
  $r('rtcPeers').innerHTML = [...R.peers.values()].map(p => `<div class="libRow"><span class="nm">${p.dc && p.dc.readyState === 'open' ? '🟢' : '🟡'} ${esc(p.name)}</span><span class="tag">${esc(p.state)}</span>${p.snap ? `<button class="installBtn" data-view="${esc(p.id)}">${R.viewing === p.id ? '👁 assistindo' : '👁 assistir bancada'}</button>` : ''}</div>`).join('') || '<p class="small">Nenhum par ainda. Compartilhe o código da sala.</p>';
  $r('rtcPeers').querySelectorAll('[data-view]').forEach(b => b.onclick = () => R.view(b.dataset.view));
  $r('rtcBc').textContent = R.broadcasting ? '⏹ Parar transmissão' : '📡 Transmitir minha bancada';
  $r('rtcStopView').style.display = R.viewing ? 'inline-flex' : 'none';
  $r('rtcChat').innerHTML = chat.map(c => `<div><b style="color:${c.who === 'você' ? 'var(--ac)' : 'var(--ac2)'}">${esc(c.who)}</b> <span class="small">${new Date(c.t).toLocaleTimeString('pt-BR')}</span><div>${esc(c.text)}</div></div>`).join('');
  $r('rtcChat').scrollTop = 1e9;
  $r('rtcLog').innerHTML = R.log.slice(-60).map(l => `<div><span style="color:var(--dim)">${new Date(l.t).toLocaleTimeString('pt-BR')}</span> <b>${esc(l.from)}</b> → <span style="color:var(--ac)">${esc(l.topic)}</span> : ${esc(l.payload)}</div>`).join('');
  $r('rtcLog').scrollTop = 1e9;
  const chip = document.getElementById('rtcChip');
  if(chip) chip.textContent = '📡 ' + open.length;
}
ui();

/* ---------- APIs de rede para o código do usuário ---------- */
const bytes = s => Uint8Array.from([...unescape(encodeURIComponent(String(s)))].map(c => c.charCodeAt(0)));
const str = v => v instanceof Uint8Array ? decodeURIComponent(escape(String.fromCharCode(...v))) : String(v);
function mqttClass(){
  return function(){
    let cb = null, conn = false; const mine = new Set();
    const self = {
      set_callback: f => { cb = f; }, connect: () => { conn = true; return 0; }, disconnect: () => { conn = false; }, ping: () => 0, set_last_will: () => 0,
      subscribe: t => { R.subscribe(str(t)); mine.add(str(t)); }, publish: (t, m) => { R.publish(str(t), str(m)); },
      check_msg: async () => { const m = R.recv(); if(m && cb){ await cb(bytes(m.topic), bytes(m.payload)); } return null; },
      wait_msg: async () => { for(;;){ if(!RUN.on) throw new PyStop(); const m = R.recv(); if(m && cb){ await cb(bytes(m.topic), bytes(m.payload)); return null; } await wait(20); } }
    };
    return self;
  };
}
const _mm = window.makeModules;
window.makeModules = function(){
  const mods = _mm();
  const MQ = mqttClass();
  mods.umqtt = { simple: { MQTTClient: MQ }, robust: { MQTTClient: MQ }, MQTTClient: MQ };
  mods['umqtt.simple'] = mods.umqtt.simple;
  mods.paho = { mqtt: { client: { Client: MQ } } };
  mods.espnow = { ESPNow: function(){ return { active: () => 0, add_peer: () => 0, send: (mac, msg) => { R.publish('espnow/' + (mac ? Array.from(mac).map(x => x.toString(16)).join(':') : 'broadcast'), str(msg)); return true; }, recv: async (timeout) => { R.subscribe('espnow/#'); let waited = 0; for(;;){ const m = R.recv(); if(m) return KezlePy.tup([new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0, 1]), bytes(m.payload)]); if(!timeout || waited >= timeout) return KezlePy.tup([null, null]); await wait(10); waited += 10; } }, irecv: async function(t){ return this.recv(t); }, any: () => R.hasInbox(), irq: () => 0, config: () => 0 }; }, MAX_DATA_LEN: 250 };
  mods.kezle_net = { publish: (t, m) => R.publish(str(t), str(m)), subscribe: t => R.subscribe(str(t)), recv: () => { const m = R.recv(); return m ? KezlePy.tup([m.topic, m.payload]) : null; }, peers: () => R.connected().length, room: () => R.room };
  return mods;
};
window.KEZLE_JS_API = { mqtt: { connect: () => { const h = {}; const c = { on: (ev, f) => { h[ev] = f; if(ev === 'connect') setTimeout(() => f(), 0); return c; }, subscribe: t => { R.subscribe(t); return c; }, publish: (t, m) => { R.publish(t, m); return c; }, end: () => 0 }; const t = setInterval(() => { if(!RUN.on){ clearInterval(t); return; } let m; while((m = R.recv())){ if(h.message) try { h.message(m.topic, m.payload); } catch(e){} } }, 20); HAL_TIMER(t); return c; } }, radio: { send: (t, m) => R.publish(t, m), subscribe: t => R.subscribe(t), peers: () => R.connected().length } };
function HAL_TIMER(t){ KezleHAL.timers.push(t); }
const _gen = window.KEZLE_CPP_CLASSES = window.KEZLE_CPP_CLASSES || {};
_gen.WiFiClient = function(){ return { connected: () => true, stop: () => 0, connect: () => true }; };
_gen.PubSubClient = function(){
  let cb = null, conn = false;
  const toArr = s => Array.from(bytes(s));
  return { setServer: () => 0, setCallback: f => { cb = f; }, connect: () => { conn = true; return true; }, connected: () => conn, state: () => 0, disconnect: () => { conn = false; }, setKeepAlive: () => 0, setBufferSize: () => true,
    subscribe: t => { R.subscribe(String(t)); return true; }, unsubscribe: () => true, publish: (t, m) => { R.publish(String(t), String(m)); return true; },
    loop: () => { let m; while((m = R.recv())){ if(cb){ const p = toArr(m.payload); try { const r = cb(m.topic, p, p.length); if(r && r.catch) r.catch(() => {}); } catch(e){} } } return true; } };
};
window.KEZLE_LUA_HOOK = function(G, K){
  const { mkLib, LuaTable } = K;
  G.set('mqtt', mkLib({ Client: () => { const h = {}; const t = new LuaTable(); const fns = { on: (self, ev, f) => { h[ev] = f; }, connect: (self, host, port, secure, ok) => { if(ok) setTimeout(() => ok([self]), 0); return true; }, subscribe: (self, topic) => { R.subscribe(String(topic)); return true; }, publish: (self, topic, data) => { R.publish(String(topic), String(data)); return true; }, close: () => 0 };
    for(const k in fns) t.set(k, args => { const r = fns[k](...args); return r === undefined ? [] : [r]; });
    const tm = setInterval(() => { if(!RUN.on){ clearInterval(tm); return; } let m; while((m = R.recv())){ if(h.message) try { h.message([t, m.topic, m.payload]); } catch(e){} } }, 20); KezleHAL.timers.push(tm);
    return t; } }));
};
})();
