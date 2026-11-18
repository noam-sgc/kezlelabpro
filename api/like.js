const { store, cors, send, clean, body, limited } = require('./_lib');
module.exports = async (req, res) => {
  cors(res);
  if(req.method === 'OPTIONS') return res.status(204).end();
  if(req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  try {
    if(limited(req, 120)) return send(res, 429, { error: 'Muitas requisições' });
    const b = body(req);
    const id = clean(b.id, 40), cid = clean(b.clientId, 64);
    if(!id || cid.length < 8) return send(res, 400, { error: 'dados inválidos' });
    const key = 'klp:likes:' + id;
    const has = await store.sismember(key, cid);
    if(has) await store.srem(key, cid); else await store.sadd(key, cid);
    send(res, 200, { liked: !has, likes: await store.scard(key) });
  } catch(e){ send(res, 500, { error: String(e && e.message || e) }); }
};
