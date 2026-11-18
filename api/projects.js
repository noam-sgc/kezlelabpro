const { store, cors, send, clean, hashKey, newId, body, limited } = require('./_lib');
const MAX = 450000;

function metaOf(p){
  return { id: p.id, t: p.t, a: p.a, f: p.f, parts: p.parts, tag: p.tag, lang: p.lang, dt: p.dt, upd: p.upd, desc: p.desc || '' };
}
module.exports = async (req, res) => {
  cors(res);
  if(req.method === 'OPTIONS') return res.status(204).end();
  try {
    if(req.method === 'GET'){
      const id = req.query && req.query.id;
      if(id){
        const raw = await store.hget('klp:proj', clean(id, 40));
        if(!raw) return send(res, 404, { error: 'Projeto não encontrado' });
        const p = JSON.parse(raw);
        const likes = await store.scard('klp:likes:' + p.id);
        return send(res, 200, { id: p.id, t: p.t, a: p.a, f: p.f, bench: p.bench, code: p.code, lang: p.lang, target: p.target, dt: p.dt, upd: p.upd, likes, desc: p.desc || '' });
      }
      const all = await store.hgetall('klp:meta');
      const list = [];
      for(const k in all){ try { list.push(JSON.parse(all[k])); } catch(e){} }
      const likesMap = {};
      await Promise.all(list.map(async m => { likesMap[m.id] = await store.scard('klp:likes:' + m.id); }));
      const seedLikes = {};
      await Promise.all(['seed0', 'seed1', 'seed2', 'seed3', 'seed4', 'seed5'].map(async s => { seedLikes[s] = await store.scard('klp:likes:' + s); }));
      const cmts = {};
      await Promise.all(list.map(async m => { cmts[m.id] = (await store.lrange('klp:cmt:' + m.id, 0, -1)).length; }));
      list.forEach(m => { m.likes = likesMap[m.id] || 0; m.cm = cmts[m.id] || 0; });
      list.sort((a, b) => (b.likes - a.likes) || (b.dt - a.dt));
      return send(res, 200, { projects: list.slice(0, 300), seedLikes, persistent: store.persistent });
    }
    if(limited(req, 40)) return send(res, 429, { error: 'Muitas requisições — aguarde um minuto' });
    if(req.method === 'POST'){
      const b = body(req);
      const raw = JSON.stringify(b);
      if(raw.length > MAX) return send(res, 413, { error: 'Projeto grande demais (máx ~450 KB)' });
      if(!b.ownerKey || String(b.ownerKey).length < 12) return send(res, 400, { error: 'ownerKey inválida' });
      if(!b.bench || !Array.isArray(b.bench.parts)) return send(res, 400, { error: 'bancada inválida' });
      const owner = hashKey(b.ownerKey);
      let id = b.id ? clean(b.id, 40) : null, existing = null;
      if(id){
        const old = await store.hget('klp:proj', id);
        if(old){ existing = JSON.parse(old); if(existing.owner !== owner) return send(res, 403, { error: 'Você não é o dono deste projeto' }); }
        else id = null;
      }
      const now = Date.now();
      const p = {
        id: id || newId(), t: clean(b.title, 80) || 'Projeto sem título', a: clean(b.author, 40) || 'anônimo', f: clean(b.flag, 8) || '🌐',
        parts: b.bench.parts.length, tag: clean(b.tag, 60), lang: clean(b.lang, 8) || 'py', target: clean(b.target, 60), desc: clean(b.desc, 300),
        code: clean(b.code, 100000), bench: b.bench, owner, dt: existing ? existing.dt : now, upd: now
      };
      await store.hset('klp:proj', p.id, JSON.stringify(p));
      await store.hset('klp:meta', p.id, JSON.stringify(metaOf(p)));
      return send(res, 200, { ok: true, id: p.id, updated: !!existing, meta: metaOf(p) });
    }
    if(req.method === 'DELETE'){
      const id = clean(req.query.id, 40), key = req.query.ownerKey || body(req).ownerKey;
      const raw = await store.hget('klp:proj', id);
      if(!raw) return send(res, 404, { error: 'Projeto não encontrado' });
      if(JSON.parse(raw).owner !== hashKey(key)) return send(res, 403, { error: 'Você não é o dono deste projeto' });
      await store.hdel('klp:proj', id); await store.hdel('klp:meta', id); await store.del('klp:likes:' + id); await store.del('klp:cmt:' + id);
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: 'Método não permitido' });
  } catch(e){
    send(res, 500, { error: String(e && e.message || e) });
  }
};
