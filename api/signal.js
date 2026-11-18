/* Sinalização WebRTC (só troca ofertas/respostas/ICE; os dados NÃO passam pelo servidor).
   Mensagens ficam em lista com TTL de 10 min. Requer Redis para funcionar entre instâncias. */
const { store, cors, send, clean, body, limited } = require('./_lib');
module.exports = async (req, res) => {
  cors(res);
  if(req.method === 'OPTIONS') return res.status(204).end();
  try {
    const room = clean((req.query && req.query.room) || body(req).room, 40).replace(/[^\w\-]/g, '');
    if(room.length < 3) return send(res, 400, { error: 'código de sala inválido (mín. 3 caracteres)' });
    const key = 'klp:sig:' + room;
    if(req.method === 'GET'){
      const since = Math.max(0, parseInt(req.query.since, 10) || 0);
      const me = clean(req.query.me, 40);
      const raw = await store.lrange(key, since, -1);
      const msgs = [];
      raw.forEach((r, i) => { try { const m = JSON.parse(r); m.i = since + i; if(m.from !== me && (!m.to || m.to === me)) msgs.push(m); } catch(e){} });
      return send(res, 200, { msgs, next: since + raw.length, persistent: store.persistent });
    }
    if(req.method === 'POST'){
      if(limited(req, 400)) return send(res, 429, { error: 'Muitas requisições' });
      const b = body(req);
      const data = JSON.stringify(b.data || null);
      if(data.length > 20000) return send(res, 413, { error: 'mensagem grande demais' });
      const n = await store.llen(key);
      if(n > 800) return send(res, 429, { error: 'sala lotada de mensagens — crie outra' });
      await store.rpush(key, JSON.stringify({ from: clean(b.from, 40), to: clean(b.to, 40) || null, type: clean(b.type, 16), data: b.data || null, t: Date.now() }));
      await store.expire(key, 600);
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: 'Método não permitido' });
  } catch(e){ send(res, 500, { error: String(e && e.message || e) }); }
};
