/* =========================================================================
   Kezle Lab Pro — Projetos (salvar/editar/exportar) e Galeria GLOBAL real
   (servidor Vercel em /api — ver api/*.js). Sem servidor: exemplos locais.
   ========================================================================= */
(function(){
'use strict';
const API = location.protocol === 'file:' ? 'https://kezlelabpro.vercel.app' : '';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
window.escHtml = esc;
const G = { list: [], seedLikes: {}, ok: null, persistent: null, loading: false, err: null, sort: 'likes', q: '', lang: '', mine: new Set(), liked: new Set(), t: 0 };

async function api(path, opt){
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(API + '/api/' + path, Object.assign({ signal: ctl.signal, headers: { 'Content-Type': 'application/json' } }, opt || {}));
    let j = null; try { j = await r.json(); } catch(e){}
    if(!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
    return j;
  } finally { clearTimeout(to); }
}
function clientId(){ let c = DB.get('klp_cid', null); if(!c){ c = 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36); DB.set('klp_cid', c); } return c; }
function ownerKey(){ const k = 'klp_okey_' + (USER || 'anon'); let o = DB.get(k, null); if(!o){ o = 'k' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36); DB.set(k, o); } return o; }
function flagOfUser(){ const u = DB.get('klp_users', {}); return (u[USER] && u[USER].flag) || '🌐'; }

/* ---------- projetos locais ---------- */
const projs = () => myProjects();
function setCurrent(p){
  BENCH.current = p ? { id: p.id, name: p.name } : null;
  let chip = document.getElementById('curProj');
  if(!chip){ chip = document.createElement('span'); chip.id = 'curProj'; chip.className = 'small'; chip.style.cssText = 'margin-left:8px;padding:3px 10px;border-radius:12px;background:#0e2b3d;border:1px solid #155e75;color:var(--ac);white-space:nowrap;cursor:pointer'; document.getElementById('benchTools').insertBefore(chip, document.getElementById('btnSave')); chip.title = 'Clique para encerrar a edição deste projeto'; chip.onclick = () => setCurrent(null); }
  chip.style.display = p ? 'inline-block' : 'none';
  if(p) chip.textContent = '✏️ editando: ' + p.name + '  ✕';
}
function snapshot(){ return { bench: serializeBench(), code: $('#pyEditor').value, lang: $('#pyLang').value, target: $('#pyTarget').value, dt: Date.now() }; }
function loadProject(p){
  loadBenchData(p.bench);
  if(p.lang && $('#pyLang').querySelector('option[value="' + p.lang + '"]')){ $('#pyLang').value = p.lang; refreshTpl(); }
  $('#pyEditor').value = p.code || ''; syncGutter(); renderHwCheck();
  if(p.target && [...$('#pyTarget').options].some(o => o.value === p.target)) $('#pyTarget').value = p.target;
  SIM.on = false; refreshPower();
}
window.benchTag = function(b){
  const s = new Set((b.parts || []).map(p => PARTMAP[p.id] ? PARTMAP[p.id].n.split(' ')[0] : p.id));
  return [...s].slice(0, 4).join(' · ') || '—';
};

$('#btnSave').onclick = function(){
  const cur = BENCH.current ? projs().find(p => p.id === BENCH.current.id) : null;
  modal('💾 Salvar projeto',
    '<label class="small">Nome do projeto</label><input id="spName" style="width:100%;margin-top:5px" value="' + esc(cur ? cur.name : '') + '" placeholder="ex.: Estação meteorológica">' +
    (cur ? '<p class="small" style="margin-top:8px">Você está editando <b>' + esc(cur.name) + '</b>. Atualize-o ou salve uma cópia.</p>' : '<p class="small" style="margin-top:8px">Inclui peças, fios (com dobras), propriedades, código e linguagem.</p>'),
    [{ t: 'Cancelar' }].concat(cur ? [{ t: '➕ Salvar como novo', f: () => doSave(false) }, { t: '💾 Atualizar projeto', p: 1, f: () => doSave(true) }] : [{ t: 'Salvar', p: 1, f: () => doSave(false) }]));
  function doSave(update){
    const name = $('#spName').value.trim() || ('Projeto ' + (projs().length + 1));
    const arr = projs();
    const snap = snapshot();
    if(update && cur){
      const i = arr.findIndex(p => p.id === cur.id);
      arr[i] = Object.assign({}, arr[i], snap, { name });
      saveMyProjects(arr); setCurrent(arr[i]);
      toast('✅ Projeto "' + name + '" atualizado' + (arr[i].pub ? ' — republique para atualizar a versão global' : ''), 'ok');
    } else {
      const np = Object.assign({ id: uid(), name, pub: 0 }, snap);
      arr.push(np); saveMyProjects(arr); setCurrent(np);
      toast('✅ Projeto salvo na sua conta', 'ok');
    }
    renderProjects();
  }
};
// "Limpar" encerra a edição
const _btnClear = $('#btnClear').onclick;
$('#btnClear').addEventListener('click', () => setCurrent(null));

/* ---------- publicar ---------- */
async function publish(p, desc){
  const body = { id: p.pub || undefined, title: p.name, author: USER, flag: flagOfUser(), bench: p.bench, code: p.code, lang: p.lang || 'py', target: p.target || '', tag: benchTag(p.bench), desc: desc || '', ownerKey: ownerKey() };
  const r = await api('projects', { method: 'POST', body: JSON.stringify(body) });
  const arr = projs(); const q = arr.find(x => x.id === p.id);
  if(q){ q.pub = r.id; q.pubAt = Date.now(); saveMyProjects(arr); }
  G.mine.add(r.id);
  return r;
}
async function unpublish(p){
  await api('projects?id=' + encodeURIComponent(p.pub) + '&ownerKey=' + encodeURIComponent(ownerKey()), { method: 'DELETE' });
  const arr = projs(); const q = arr.find(x => x.id === p.id); if(q){ q.pub = 0; saveMyProjects(arr); }
  G.mine.delete(p.pub);
}
window.publishProject = async function(p){
  try {
    toast('📤 Publicando…', 'ok');
    const r = await publish(p);
    toast((r.updated ? '🌍 Publicação atualizada' : '🌍 Publicado na Galeria Global') + ' — visível para todos', 'ok');
    renderProjects(); await loadGallery(true);
  } catch(e){ toast('Falha ao publicar: ' + e.message + ' — verifique a conexão com o servidor', 'err'); }
};
$('#btnPublish').onclick = function(){
  const cur = BENCH.current ? projs().find(x => x.id === BENCH.current.id) : null;
  modal('📤 Publicar no mundo',
    '<p class="small">Sua bancada (peças, fios, código e linguagem) ficará visível para <b>qualquer pessoa</b> na Galeria Global.' + (cur && cur.pub ? ' Isto atualizará a versão já publicada.' : '') + '</p>' +
    '<label class="small">Título</label><input id="pbName" style="width:100%;margin-top:5px" value="' + esc(cur ? cur.name : 'Projeto de ' + USER) + '">' +
    '<label class="small" style="margin-top:8px;display:block">Descrição (opcional)</label><textarea id="pbDesc" style="width:100%;margin-top:5px" rows="3" placeholder="O que este projeto faz?"></textarea>',
    [{ t: 'Cancelar' }, { t: (cur && cur.pub ? 'Atualizar 🌍' : 'Publicar 🌍'), p: 1, f: async function(){
      const name = $('#pbName').value.trim() || 'Projeto de ' + USER, desc = $('#pbDesc').value.trim();
      let arr = projs(), p = cur ? arr.find(x => x.id === cur.id) : null;
      const snap = snapshot();
      if(p) Object.assign(p, snap, { name }); else { p = Object.assign({ id: uid(), name, pub: 0 }, snap); arr.push(p); }
      saveMyProjects(arr); setCurrent(p);
      try { toast('📤 Publicando…', 'ok'); const r = await publish(p, desc); toast((r.updated ? '🌍 Publicação atualizada' : '🌍 Publicado na Galeria Global') + '!', 'ok'); renderProjects(); loadGallery(true); }
      catch(e){ toast('Falha ao publicar: ' + e.message, 'err'); }
    } }]);
};

/* ---------- Meus Projetos ---------- */
window.renderProjects = function(){
  const grid = $('#projGrid');
  const arr = projs();
  const head = '<div class="card" style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>Meus projetos (' + arr.length + ')</b><span class="small">salvos na sua conta neste navegador · publique para compartilhar globalmente</span><span style="flex:1"></span><button class="btn" id="pjNew">➕ Novo (bancada vazia)</button><button class="btn" id="pjImp">📥 Importar .json</button><input type="file" id="pjFile" accept=".json" style="display:none"></div>';
  grid.innerHTML = head;
  if(!arr.length) grid.insertAdjacentHTML('beforeend', '<div class="card"><p class="small">Nenhum projeto salvo ainda. Monte sua bancada e clique em 💾 Salvar.</p></div>');
  for(const p of arr){
    if(p.pub) G.mine.add(p.pub);
    const c = document.createElement('div');
    c.className = 'card projCard';
    const lg = (window.KEZLE_LANGS && KEZLE_LANGS[p.lang]) || { ico: '🐍', name: 'MicroPython' };
    c.innerHTML = '<h3>' + (p.pub ? '🌍 ' : '💾 ') + esc(p.name) + (BENCH.current && BENCH.current.id === p.id ? ' <span class="tag c2">em edição</span>' : '') + '</h3>' +
      '<div class="tagrow"><span class="tag c1">' + ((p.bench.parts) || []).length + ' peças</span><span class="tag">🧵 ' + ((p.bench.wires) || []).length + ' fios</span><span class="tag">' + lg.ico + ' ' + esc(lg.name) + '</span>' +
      '<span class="tag">' + new Date(p.dt).toLocaleDateString('pt-BR') + '</span>' + (p.pub ? '<span class="tag c2">publicado</span>' : '') + '</div>' +
      '<p class="small mono">' + esc(benchTag(p.bench)) + '</p>' +
      '<div class="acts" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="btn prime" data-op="open">✏️ Abrir / editar</button>' +
      (p.pub ? '<button class="btn" data-op="repub">🔄 Atualizar global</button><button class="btn danger" data-op="unpub">Despublicar</button>' : '<button class="btn" data-op="pub">📤 Publicar</button>') +
      '<button class="btn" data-op="ren">🏷 Renomear</button><button class="btn" data-op="dup">⧉ Duplicar</button><button class="btn" data-op="exp">📤 .json</button><button class="btn danger" data-op="del">🗑</button></div>';
    c.onclick = async function(e){
      const op = e.target.dataset.op;
      if(!op) return;
      const all = projs(); const q = all.find(x => x.id === p.id);
      if(op === 'open'){ loadProject(p); setCurrent(p); switchView('bench'); toast('Projeto "' + p.name + '" aberto para edição — use 💾 Salvar para atualizar', 'ok'); }
      if(op === 'pub' || op === 'repub'){ await window.publishProject(q); }
      if(op === 'unpub'){ try { await unpublish(q); toast('Despublicado da Galeria Global', 'warn'); renderProjects(); loadGallery(true); } catch(er){ toast('Falha ao despublicar: ' + er.message, 'err'); } }
      if(op === 'ren'){ modal('🏷 Renomear', '<input id="rnName" style="width:100%" value="' + esc(p.name) + '">', [{ t: 'Cancelar' }, { t: 'Renomear', p: 1, f: () => { q.name = $('#rnName').value.trim() || p.name; saveMyProjects(all); if(BENCH.current && BENCH.current.id === p.id) setCurrent(q); renderProjects(); } }]); }
      if(op === 'dup'){ all.push(Object.assign({}, JSON.parse(JSON.stringify(p)), { id: uid(), name: p.name + ' (cópia)', pub: 0, dt: Date.now() })); saveMyProjects(all); renderProjects(); }
      if(op === 'exp'){ const blob = new Blob([JSON.stringify({ kezle: 2, name: p.name, bench: p.bench, code: p.code, lang: p.lang, target: p.target }, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = p.name.replace(/[^\w\-]+/g, '_') + '.kezle.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
      if(op === 'del'){ modal('🗑 Excluir projeto', '<p>Excluir <b>' + esc(p.name) + '</b>?' + (p.pub ? ' A versão global continuará publicada (use Despublicar antes).' : '') + '</p>', [{ t: 'Cancelar' }, { t: 'Excluir', p: 1, f: () => { saveMyProjects(all.filter(x => x.id !== p.id)); if(BENCH.current && BENCH.current.id === p.id) setCurrent(null); renderProjects(); } }]); }
    };
    grid.appendChild(c);
  }
  const nb = document.getElementById('pjNew'); if(nb) nb.onclick = () => { BENCH.parts = []; BENCH.wires = []; BENCH.sel = null; renderBench(); renderProps(); setCurrent(null); switchView('bench'); };
  const ib = document.getElementById('pjImp'), fi = document.getElementById('pjFile');
  if(ib){ ib.onclick = () => fi.click(); fi.onchange = async () => { try { const d = JSON.parse(await fi.files[0].text()); if(!d.bench) throw new Error('arquivo sem bancada'); const all = projs(); all.push({ id: uid(), name: d.name || 'Importado', bench: d.bench, code: d.code || '', lang: d.lang || 'py', target: d.target, dt: Date.now(), pub: 0 }); saveMyProjects(all); renderProjects(); toast('📥 Projeto importado', 'ok'); } catch(e){ toast('Arquivo inválido: ' + e.message, 'err'); } fi.value = ''; }; }
};

/* ---------- Galeria Global ---------- */
async function loadGallery(force){
  if(G.loading) return;
  if(!force && Date.now() - G.t < 20000 && G.ok) return;
  G.loading = true;
  try {
    const j = await api('projects');
    G.list = j.projects || []; G.seedLikes = j.seedLikes || {}; G.ok = true; G.persistent = j.persistent; G.err = null; G.t = Date.now();
    DB.set('klp_gal_cache', { t: Date.now(), list: G.list.slice(0, 60) });
  } catch(e){
    G.ok = false; G.err = e.message;
    const c = DB.get('klp_gal_cache', null); if(c && !G.list.length) G.list = c.list || [];
  }
  G.loading = false;
  if(document.getElementById('v-gal').classList.contains('on')) renderGallery();
}
function autoWire(mcu, parts){
  const nm = (i, n) => (i.def.pinNames || []).indexOf(n);
  const find = (inst, re) => (inst.def.pinNames || []).findIndex(n => re.test(n));
  const id = mcu.def.id;
  const sda = /uno|nano/.test(id) ? 'A4' : /pico/.test(id) ? 'GP4' : 'IO21', scl = /uno|nano/.test(id) ? 'A5' : /pico/.test(id) ? 'GP5' : 'IO22';
  const v33 = mcu.def.pinNames.includes('3V3') ? '3V3' : '5V';
  const gnd = mcu.def.pinNames.find(n => /^GND/.test(n));
  const W = (a, ai, b, bi) => { if(ai >= 0 && bi >= 0) BENCH.wires.push({ id: uid(), a: { p: a.id, i: ai }, b: { p: b.id, i: bi }, color: '#ef4444', fold: 0, dir: 1 }); };
  const cols = ['#ef4444', '#fbbf24', '#3b82f6', '#22c55e', '#a855f7', '#f97316'];
  let ci = 0;
  for(const q of parts){
    const v = find(q, /^(VCC|VIN|VDD|\+|\+5V|5V|VM)$/i), g = find(q, /^(GND|G|−|-|K)$/i);
    if(v >= 0 && g >= 0){
      const use5 = (q.def.vcc || 3.3) >= 4.5 && mcu.def.pinNames.includes('5V');
      W(mcu, nm(mcu, use5 ? '5V' : v33), q, v); W(mcu, nm(mcu, gnd), q, g);
      BENCH.wires[BENCH.wires.length - 2].color = '#ef4444'; BENCH.wires[BENCH.wires.length - 1].color = '#0f172a';
    }
    const s = find(q, /^SDA$/i), c = find(q, /^SCL$/i);
    if(s >= 0 && c >= 0){ W(mcu, nm(mcu, sda), q, s); W(mcu, nm(mcu, scl), q, c); }
    const sig = find(q, /^(DATA|OUT|AO|SIG|IN|DIN|AO|VRx|SIG1)$/i);
    if(sig >= 0 && !(s >= 0)){
      const analog = (q.def.sk && /^(luxA|gas|soil|rain|ph|tds|snd|curr|volt|dust|hall|wlev)$/.test(q.def.sk)) || q.def.kind === 'pot' || q.def.kind === 'joy' || /^(AO|VRx)$/.test(q.def.pinNames[sig]);
      const gp = analog ? 34 : (q.def.dgpio != null ? q.def.dgpio : 4);
      let pin = /uno|nano/.test(id) ? (analog ? 'A0' : 'D' + gp) : /pico/.test(id) ? (analog ? 'GP26' : 'GP' + gp) : 'IO' + gp;
      if(analog && /esp32/.test(id) === false && !/uno|nano|pico/.test(id)) pin = mcu.def.pinNames.includes('A0') ? 'A0' : pin;
      if(mcu.def.pinNames.includes(pin)){ W(mcu, nm(mcu, pin), q, sig); BENCH.wires[BENCH.wires.length - 1].color = cols[ci++ % cols.length]; }
    }
  }
}
function openFromData(bench, code, lang, label){
  loadBenchData(bench);
  setCurrent(null);
  if(lang && $('#pyLang').querySelector('option[value="' + lang + '"]')){ $('#pyLang').value = lang; refreshTpl(); }
  if(code != null){ $('#pyEditor').value = code; syncGutter(); renderHwCheck(); }
  SIM.on = false; refreshPower();
  switchView('bench');
  toast('⬇ ' + label + ' carregado — ligue a ⏻ Simulação', 'ok');
}
async function toggleLikeGlobal(id){
  const r = await api('like', { method: 'POST', body: JSON.stringify({ id, clientId: clientId() }) });
  if(r.liked) G.liked.add(id); else G.liked.delete(id);
  DB.set('klp_liked_ids', [...G.liked]);
  return r;
}
async function openCommentsGlobal(it){
  let list = [], err = null;
  try { list = (await api('comments?id=' + encodeURIComponent(it.id))).comments; } catch(e){ err = e.message; }
  modal('💬 Comentários — ' + esc(it.t),
    '<div style="max-height:38vh;overflow:auto">' + (err ? '<p class="small" style="color:var(--err)">Servidor indisponível: ' + esc(err) + '</p>' : list.length ? list.map(c => '<div style="border-bottom:1px solid var(--line);padding:6px 0"><b>' + esc(c.a) + '</b> <span class="small">' + new Date(c.dt).toLocaleString('pt-BR') + '</span><div>' + esc(c.t) + '</div></div>').join('') : '<p class="small">Sem comentários ainda. Seja o primeiro!</p>') + '</div>' +
    '<textarea id="cmtTx" placeholder="Escreva um comentário…" style="width:100%;margin-top:10px" maxlength="500"></textarea>',
    [{ t: 'Fechar' }, { t: 'Comentar', p: 1, f: async () => { const t = $('#cmtTx').value.trim(); if(!t) return; try { await api('comments', { method: 'POST', body: JSON.stringify({ id: it.id, author: USER || 'visitante', text: t }) }); loadGallery(true); openCommentsGlobal(it); } catch(e){ toast('Falha: ' + e.message, 'err'); } } }]);
}
window.renderGallery = function(){
  const grid = $('#galGrid');
  G.liked = new Set(DB.get('klp_liked_ids', []));
  const stat = G.ok === null ? '⏳ conectando ao servidor global…' : G.ok ? ('🌍 Servidor global conectado · ' + G.list.length + ' projeto(s) publicados' + (G.persistent ? ' · armazenamento persistente' : ' · ⚠ banco não configurado (dados temporários — veja o README)')) : ('⚠ Sem conexão com o servidor global (' + esc(G.err || '?') + ') — exibindo ' + (G.list.length ? 'cache + ' : '') + 'exemplos nativos');
  let h = '<div class="card" style="grid-column:1/-1"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="small" style="color:' + (G.ok ? 'var(--ac2)' : G.ok === false ? 'var(--warn)' : 'var(--dim)') + '">' + stat + '</span><span style="flex:1"></span>' +
    '<input id="galQ" placeholder="🔍 buscar projeto, autor, peça…" value="' + esc(G.q) + '" style="min-width:200px"><select id="galSort"><option value="likes"' + (G.sort === 'likes' ? ' selected' : '') + '>❤ mais curtidos</option><option value="new"' + (G.sort === 'new' ? ' selected' : '') + '>🆕 mais recentes</option></select>' +
    '<select id="galLang"><option value="">todas as linguagens</option>' + Object.keys(KEZLE_LANGS).map(k => '<option value="' + k + '"' + (G.lang === k ? ' selected' : '') + '>' + KEZLE_LANGS[k].ico + ' ' + esc(KEZLE_LANGS[k].name) + '</option>').join('') + '</select><button class="btn" id="galRef">🔄</button></div></div>';
  grid.innerHTML = h;
  const q = G.q.toLowerCase();
  let items = G.list.map(m => Object.assign({ remote: true }, m, { likes: m.likes || 0 }))
    .concat(SEEDS.map(s => Object.assign({}, s, { likes: G.seedLikes[s.id] || 0, lang: 'py' })));
  items = items.filter(m => (!G.lang || (m.lang || 'py') === G.lang) && (!q || ((m.t || '') + ' ' + (m.a || '') + ' ' + (m.tag || '')).toLowerCase().includes(q)));
  items.sort((a, b) => G.sort === 'new' ? ((b.dt || 0) - (a.dt || 0)) : ((b.likes - a.likes) || ((b.dt || 0) - (a.dt || 0))));
  for(const p of items){
    const lg = KEZLE_LANGS[p.lang || 'py'] || KEZLE_LANGS.py;
    const liked = G.liked.has(p.id);
    const nParts = p.remote ? p.parts : (p.parts || []).length;
    const mine = p.remote && G.mine.has(p.id);
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = '<h3>' + esc(p.t) + (p.native ? ' <span class="tag c2">exemplo nativo</span>' : '') + (mine ? ' <span class="tag c2">meu</span>' : '') + '</h3>' +
      '<div class="tagrow"><span class="tag c1">' + esc(p.f || '🌐') + ' ' + esc(p.a) + '</span><span class="tag ' + (liked ? 'c2' : 'c3') + '">' + (liked ? '❤' : '🤍') + ' <span class="likes">' + p.likes + '</span></span>' + (p.remote ? '<span class="tag">💬 ' + (p.cm || 0) + '</span>' : '') + '<span class="tag">' + nParts + ' peças</span><span class="tag">' + lg.ico + ' ' + esc(lg.name) + '</span></div>' +
      (p.desc ? '<p class="small">' + esc(p.desc) + '</p>' : '') + '<p class="small mono">' + esc(p.tag || (p.native ? benchTag({ parts: (p.parts || []).map(x => ({ id: x[0] })) }) : '')) + '</p>' +
      '<div class="acts" style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn prime" data-op="open" style="font-size:12px">⬇ Abrir</button><button class="btn ' + (liked ? 'prime' : '') + '" data-op="like" style="font-size:12px">' + (liked ? '💔 Remover like' : '❤ Curtir') + '</button><button class="btn" data-op="cmt" style="font-size:12px">💬</button><button class="btn" data-op="save" style="font-size:12px">💾 Salvar cópia</button>' + (mine ? '<button class="btn danger" data-op="rm" style="font-size:12px">remover</button>' : '') + '</div>';
    c.onclick = async function(e){
      const op = e.target.dataset.op; if(!op) return;
      try {
        if(op === 'like'){ const r = await toggleLikeGlobal(p.id); p.likes = r.likes; if(!p.remote) G.seedLikes[p.id] = r.likes; else { const m = G.list.find(x => x.id === p.id); if(m) m.likes = r.likes; } renderGallery(); }
        if(op === 'cmt'){ await openCommentsGlobal(p); }
        if(op === 'rm'){ modal('Remover publicação', '<p>Remover <b>' + esc(p.t) + '</b> da Galeria Global?</p>', [{ t: 'Cancelar' }, { t: 'Remover', p: 1, f: async () => { try { await api('projects?id=' + encodeURIComponent(p.id) + '&ownerKey=' + encodeURIComponent(ownerKey()), { method: 'DELETE' }); const arr = projs(); arr.forEach(x => { if(x.pub === p.id) x.pub = 0; }); saveMyProjects(arr); G.mine.delete(p.id); toast('Removido', 'warn'); loadGallery(true); } catch(er){ toast('Falha: ' + er.message, 'err'); } } }]); }
        if(op === 'open' || op === 'save'){
          let bench, code, lang, target;
          if(p.remote){ toast('⏳ Baixando projeto…', 'ok'); const full = await api('projects?id=' + encodeURIComponent(p.id)); bench = full.bench; code = full.code; lang = full.lang; target = full.target; }
          else {
            bench = { parts: p.parts.map((x, i) => ({ id: x[0], x: x[1] != null ? x[1] : (70 + (i % 3) * 170), y: x[2] != null ? x[2] : (80 + Math.floor(i / 3) * 130), props: {} })), wires: [] };
            code = p.code; lang = 'py';
          }
          if(op === 'save'){ const arr = projs(); arr.push({ id: uid(), name: p.t + ' (cópia)', bench, code: code || '', lang: lang || 'py', target, dt: Date.now(), pub: 0 }); saveMyProjects(arr); renderProjects(); toast('💾 Cópia salva em Meus Projetos — abra para editar', 'ok'); return; }
          openFromData(bench, code, lang, p.t);
          if(!p.remote){ const mcu = BENCH.parts.find(q2 => q2.def.cat === 'mcu'); if(mcu){ autoWire(mcu, BENCH.parts.filter(q2 => q2 !== mcu)); renderBench(); } }
        }
      } catch(er){ toast('Erro: ' + er.message, 'err'); }
    };
    grid.appendChild(c);
  }
  const q2 = document.getElementById('galQ');
  q2.oninput = () => { G.q = q2.value; clearTimeout(G._t); G._t = setTimeout(() => { renderGallery(); const n = document.getElementById('galQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  document.getElementById('galSort').onchange = e => { G.sort = e.target.value; renderGallery(); };
  document.getElementById('galLang').onchange = e => { G.lang = e.target.value; renderGallery(); };
  document.getElementById('galRef').onclick = () => { loadGallery(true); toast('Atualizando galeria…', 'ok'); };
};
// atualiza ao entrar na aba e a cada 30 s enquanto visível
const _sv = window.switchView;
window.switchView = function(v){ _sv(v); if(v === 'gal'){ renderGallery(); loadGallery(true); } if(v === 'proj') renderProjects(); };
setInterval(() => { if(document.getElementById('v-gal').classList.contains('on') && !document.hidden) loadGallery(true); }, 30000);

// seeds: usam código MicroPython; curtidas globais
SEEDS.forEach(s => { s.lang = 'py'; });
G.mine = new Set(projs().filter(p => p.pub).map(p => p.pub));
SEEDS[3].parts[0][0] = 'esp32';
setTimeout(() => loadGallery(true), 600);
renderProjects();

/* serialOut seguro (escapa HTML da saída do programa) */
window.serialOut = function(text, cls){
  cls = cls || '';
  const line = '[' + new Date().toLocaleTimeString('pt-BR') + '] ' + text;
  for(const el of [$('#serSim'), $('#serIde')]){
    if(!el) continue;
    const d = document.createElement('div');
    d.className = 'sline ' + cls;
    d.innerHTML = '<span class="ts">' + esc(line.slice(0, 10)) + '</span>' + esc(line.slice(10));
    el.appendChild(d);
    while(el.children.length > 300) el.firstChild.remove();
    el.scrollTop = el.scrollHeight;
  }
  if(!cls || cls === 'ok'){ for(const pr of parseNumericLine(text)) plotPush(pr[0], pr[1]); }
};
window.KezleOnline = { G, api, loadGallery, setCurrent };
})();
