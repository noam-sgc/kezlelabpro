/* Kezle Lab Pro — biblioteca do backend (Vercel Serverless, Node 18+)
   Armazenamento: Upstash Redis / Vercel KV (variáveis de ambiente) com fallback em memória.
   Configure no painel da Vercel: Storage → Upstash Redis → Connect Project
   (cria KV_REST_API_URL / KV_REST_API_TOKEN ou UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). */
const crypto = require('crypto');

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.REDIS_REST_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.REDIS_REST_TOKEN || '';
const persistent = !!(URL_ && TOKEN);

const mem = globalThis.__klp || (globalThis.__klp = { h: new Map(), s: new Map(), l: new Map() });

async function redis(cmd){
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if(j.error) throw new Error(j.error);
  return j.result;
}
const store = {
  persistent,
  async hset(key, field, val){ if(persistent) return redis(['HSET', key, field, val]); if(!mem.h.has(key)) mem.h.set(key, new Map()); mem.h.get(key).set(field, val); },
  async hget(key, field){ if(persistent) return redis(['HGET', key, field]); const m = mem.h.get(key); return m ? (m.get(field) ?? null) : null; },
  async hdel(key, field){ if(persistent) return redis(['HDEL', key, field]); const m = mem.h.get(key); if(m) m.delete(field); },
  async hgetall(key){ if(persistent){ const a = await redis(['HGETALL', key]); const o = {}; for(let i = 0; i < (a || []).length; i += 2) o[a[i]] = a[i + 1]; return o; } const m = mem.h.get(key); return m ? Object.fromEntries(m) : {}; },
  async sadd(key, v){ if(persistent) return redis(['SADD', key, v]); if(!mem.s.has(key)) mem.s.set(key, new Set()); mem.s.get(key).add(v); },
  async srem(key, v){ if(persistent) return redis(['SREM', key, v]); const s = mem.s.get(key); if(s) s.delete(v); },
  async sismember(key, v){ if(persistent) return !!(await redis(['SISMEMBER', key, v])); const s = mem.s.get(key); return !!(s && s.has(v)); },
  async scard(key){ if(persistent) return +(await redis(['SCARD', key])) || 0; const s = mem.s.get(key); return s ? s.size : 0; },
  async rpush(key, v){ if(persistent) return redis(['RPUSH', key, v]); if(!mem.l.has(key)) mem.l.set(key, []); mem.l.get(key).push(v); },
  async lrange(key, a, b){ if(persistent) return (await redis(['LRANGE', key, a, b])) || []; const l = mem.l.get(key) || []; return l.slice(a, b < 0 ? undefined : b + 1); },
  async expire(key, sec){ if(persistent) return redis(['EXPIRE', key, sec]); const m = mem.exp || (mem.exp = new Map()); m.set(key, Date.now() + sec * 1000); },
  async llen(key){ if(persistent) return +(await redis(['LLEN', key])) || 0; const m = mem.exp; if(m && m.get(key) && m.get(key) < Date.now()){ mem.l.delete(key); } return (mem.l.get(key) || []).length; },
  async del(key){ if(persistent) return redis(['DEL', key]); mem.h.delete(key); mem.s.delete(key); mem.l.delete(key); }
};

function cors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}
function send(res, code, obj){ res.status(code).setHeader('Content-Type', 'application/json; charset=utf-8'); res.send(JSON.stringify(obj)); }
function clean(s, max){ return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max); }
function hashKey(k){ return crypto.createHash('sha256').update('klp|' + String(k)).digest('hex'); }
function newId(){ return Date.now().toString(36) + crypto.randomBytes(4).toString('hex'); }
function body(req){ let b = req.body; if(typeof b === 'string'){ try { b = JSON.parse(b); } catch(e){ b = {}; } } return b || {}; }

// limite simples por IP (por instância)
const hits = globalThis.__klpHits || (globalThis.__klpHits = new Map());
function limited(req, n){
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const now = Date.now(); const k = ip + ':' + Math.floor(now / 60000);
  const c = (hits.get(k) || 0) + 1; hits.set(k, c);
  if(hits.size > 5000) hits.clear();
  return c > (n || 60);
}
module.exports = { store, cors, send, clean, hashKey, newId, body, limited, persistent };
