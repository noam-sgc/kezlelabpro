const { store, cors, send, clean, body, limited } = require('./_lib');
module.exports = async (req, res) => {
  cors(res);
  if(req.method === 'OPTIONS') return res.status(204).end();
  try {
    if(req.method === 'GET'){
      const id = clean(req.query.id, 40);
      const raw = await store.lrange('klp:cmt:' + id, 0, 199);
      return send(res, 200, { comments: raw.map(r => { try { return JSON.parse(r); } catch(e){ return null; } }).filter(Boolean) });
    }
    if(req.method === 'POST'){
      if(limited(req, 20)) return send(res, 429, { error: 'Muitas requisições' });
      const b = body(req);
      const id = clean(b.id, 40), text = clean(b.text, 500).trim();
      if(!id || !text) return send(res, 400, { error: 'comentário vazio' });
      await store.rpush('klp:cmt:' + id, JSON.stringify({ a: clean(b.author, 40) || 'anônimo', t: text, dt: Date.now() }));
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: 'Método não permitido' });
  } catch(e){ send(res, 500, { error: String(e && e.message || e) }); }
};
