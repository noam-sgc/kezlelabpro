const { store, cors, send } = require('./_lib');
module.exports = async (req, res) => {
  cors(res);
  if(req.method === 'OPTIONS') return res.status(204).end();
  let count = 0;
  try { count = Object.keys(await store.hgetall('klp:meta')).length; } catch(e){ return send(res, 200, { ok: false, storage: store.persistent ? 'redis' : 'memory', error: String(e.message || e) }); }
  send(res, 200, { ok: true, storage: store.persistent ? 'redis' : 'memory', persistent: store.persistent, projects: count, time: Date.now(), version: '1.2.0' });
};
