/* =========================================================================
   Kezle Lab Pro — Lua (interpretador completo de subconjunto) e BASIC
   ========================================================================= */
(function(){
'use strict';
const HAL = KezleHAL, RUNNERS = window.KEZLE_RUNNERS;

/* ============================ LUA ============================ */
class LuaTable {
  constructor(){ this.h = new Map(); this.meta = null; }
  static key(k){ return typeof k === 'number' && Number.isInteger(k) ? k : k; }
  get(k){ if(k === null || k === undefined) return null; const v = this.h.get(k); if(v === undefined){ if(this.meta){ const idx = this.meta.get('__index'); if(idx instanceof LuaTable) return idx.get(k); if(typeof idx === 'function') return null; } return null; } return v; }
  set(k, v){ if(k === null || k === undefined) throw new Error('índice de tabela é nil'); if(v === null || v === undefined) this.h.delete(k); else this.h.set(k, v); }
  len(){ let n = 0; while(this.h.has(n + 1)) n++; return n; }
  arr(){ const a = []; for(let i = 1; this.h.has(i); i++) a.push(this.h.get(i)); return a; }
  static from(a){ const t = new LuaTable(); a.forEach((v, i) => t.set(i + 1, v)); return t; }
}
class LuaErr extends Error { constructor(v, line){ super(typeof v === 'string' ? v : 'erro Lua'); this.val = v; this.line = line; } }
class Ret { constructor(v){ this.v = v; } }
const BRK = { brk: true };

function luaLex(src){
  const toks = []; let i = 0, line = 1; const n = src.length;
  const KW = new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while']);
  while(i < n){
    const c = src[i];
    if(c === '\n'){ line++; i++; continue; }
    if(/\s/.test(c)){ i++; continue; }
    if(c === '-' && src[i + 1] === '-'){
      const m = src.slice(i + 2).match(/^\[(=*)\[/);
      if(m){ const close = ']' + m[1] + ']'; const e = src.indexOf(close, i); const end = e < 0 ? n : e + close.length; for(const ch of src.slice(i, end)) if(ch === '\n') line++; i = end; continue; }
      while(i < n && src[i] !== '\n') i++; continue;
    }
    if(c === '"' || c === "'"){
      let j = i + 1, s = '';
      while(j < n && src[j] !== c){
        if(src[j] === '\\'){ const nx = src[j + 1]; const m = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v', '\\': '\\', '"': '"', "'": "'", '\n': '\n' }; if(nx in m){ s += m[nx]; j += 2; } else if(/\d/.test(nx)){ const dd = src.slice(j + 1).match(/^\d{1,3}/)[0]; s += String.fromCharCode(+dd); j += 1 + dd.length; } else if(nx === 'x'){ s += String.fromCharCode(parseInt(src.substr(j + 2, 2), 16)); j += 4; } else { s += nx; j += 2; } }
        else { if(src[j] === '\n') throw new LuaErr('string não terminada', line); s += src[j]; j++; }
      }
      toks.push({ t: 'str', v: s, line }); i = j + 1; continue;
    }
    const lb = src.slice(i).match(/^\[(=*)\[/);
    if(lb){ const close = ']' + lb[1] + ']'; const st = i + lb[0].length; const e = src.indexOf(close, st); let s = src.slice(st, e < 0 ? n : e); if(s[0] === '\n') s = s.slice(1); for(const ch of src.slice(i, e + close.length)) if(ch === '\n') line++; toks.push({ t: 'str', v: s, line }); i = (e < 0 ? n : e) + close.length; continue; }
    if(/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))){
      const m = src.slice(i).match(/^(0[xX][0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?(?:[pP][+-]?\d+)?|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/)[0];
      toks.push({ t: 'num', v: /^0[xX]/.test(m) ? parseInt(m, 16) : parseFloat(m), line }); i += m.length; continue;
    }
    if(/[A-Za-z_]/.test(c)){ let j = i + 1; while(j < n && /[A-Za-z0-9_]/.test(src[j])) j++; const w = src.slice(i, j); toks.push({ t: KW.has(w) ? 'kw' : 'name', v: w, line }); i = j; continue; }
    const s3 = src.substr(i, 3), s2 = src.substr(i, 2);
    if(s3 === '...'){ toks.push({ t: 'op', v: '...', line }); i += 3; continue; }
    if(['==', '~=', '<=', '>=', '//', '..', '::', '<<', '>>'].includes(s2)){ toks.push({ t: 'op', v: s2, line }); i += 2; continue; }
    toks.push({ t: 'op', v: c, line }); i++;
  }
  toks.push({ t: 'eof', line });
  return toks;
}
function luaParse(toks){
  let p = 0;
  const peek = () => toks[p];
  const is = (t, v) => toks[p].t === t && (v === undefined || toks[p].v === v);
  const isKw = v => is('kw', v), isOp = v => is('op', v);
  const err = m => new LuaErr('linha ' + toks[p].line + ': ' + m, toks[p].line);
  const eat = (t, v) => { if(!is(t, v)) throw err('esperava ' + (v || t) + ' mas veio ' + (toks[p].v !== undefined ? toks[p].v : toks[p].t)); return toks[p++]; };
  const acc = (t, v) => { if(is(t, v)){ p++; return true; } return false; };
  function block(){
    const st = [];
    while(!(is('eof') || isKw('end') || isKw('else') || isKw('elseif') || isKw('until'))){
      if(isKw('return')){ p++; let ex = []; if(!(is('eof') || isKw('end') || isKw('else') || isKw('elseif') || isKw('until') || isOp(';'))) ex = exprList(); acc('op', ';'); st.push({ t: 'ret', ex, line: toks[p - 1].line }); break; }
      const s = stmt(); if(s) st.push(s);
    }
    return st;
  }
  function stmt(){
    const tk = peek();
    if(acc('op', ';')) return null;
    if(tk.t === 'kw'){
      switch(tk.v){
        case 'if': { p++; const cl = []; let cond = expr(); eat('kw', 'then'); cl.push([cond, block()]); let els = null; for(;;){ if(acc('kw', 'elseif')){ cond = expr(); eat('kw', 'then'); cl.push([cond, block()]); } else if(acc('kw', 'else')){ els = block(); break; } else break; } eat('kw', 'end'); return { t: 'if', cl, els, line: tk.line }; }
        case 'while': { p++; const c = expr(); eat('kw', 'do'); const b = block(); eat('kw', 'end'); return { t: 'while', c, b, line: tk.line }; }
        case 'do': { p++; const b = block(); eat('kw', 'end'); return { t: 'do', b }; }
        case 'repeat': { p++; const b = block(); eat('kw', 'until'); const c = expr(); return { t: 'repeat', b, c, line: tk.line }; }
        case 'for': {
          p++; const n1 = eat('name').v;
          if(isOp('=')){ p++; const a = expr(); eat('op', ','); const b = expr(); let c = null; if(acc('op', ',')) c = expr(); eat('kw', 'do'); const body = block(); eat('kw', 'end'); return { t: 'nfor', v: n1, a, b, c, body, line: tk.line }; }
          const names = [n1]; while(acc('op', ',')) names.push(eat('name').v);
          eat('kw', 'in'); const ex = exprList(); eat('kw', 'do'); const body = block(); eat('kw', 'end'); return { t: 'gfor', names, ex, body, line: tk.line };
        }
        case 'function': { p++; let target = { t: 'name', v: eat('name').v, line: tk.line }; let isMethod = false; while(isOp('.') || isOp(':')){ const col = isOp(':'); p++; const nm = eat('name').v; target = { t: 'index', o: target, k: { t: 'str', v: nm }, line: tk.line }; if(col){ isMethod = true; break; } } const f = funcBody(isMethod, tk.line); return { t: 'assign', targets: [target], ex: [f], line: tk.line }; }
        case 'local': {
          p++;
          if(acc('kw', 'function')){ const nm = eat('name').v; const f = funcBody(false, tk.line); return { t: 'localfn', name: nm, f, line: tk.line }; }
          const names = [eat('name').v]; if(isOp('<')){ p++; eat('name'); eat('op', '>'); } while(acc('op', ',')){ names.push(eat('name').v); if(isOp('<')){ p++; eat('name'); eat('op', '>'); } }
          let ex = []; if(acc('op', '=')) ex = exprList(); return { t: 'local', names, ex, line: tk.line };
        }
        case 'break': p++; return { t: 'break' };
        case 'goto': throw err('goto não é suportado');
        case 'return': break;
      }
    }
    const e = suffixed();
    if(isOp('=') || isOp(',')){
      const targets = [e]; while(acc('op', ',')) targets.push(suffixed());
      eat('op', '='); const ex = exprList(); return { t: 'assign', targets, ex, line: tk.line };
    }
    if(e.t !== 'call' && e.t !== 'mcall') throw err('instrução inválida');
    return { t: 'expr', e, line: tk.line };
  }
  function funcBody(isMethod, line){
    eat('op', '('); const params = isMethod ? ['self'] : []; let vararg = false;
    if(!isOp(')')) do { if(acc('op', '...')){ vararg = true; break; } params.push(eat('name').v); } while(acc('op', ','));
    eat('op', ')'); const b = block(); eat('kw', 'end');
    return { t: 'func', params, vararg, b, line };
  }
  function exprList(){ const l = [expr()]; while(acc('op', ',')) l.push(expr()); return l; }
  const PREC = { 'or': [1, 1], 'and': [2, 2], '<': [3, 3], '>': [3, 3], '<=': [3, 3], '>=': [3, 3], '~=': [3, 3], '==': [3, 3], '|': [4, 4], '~': [5, 5], '&': [6, 6], '<<': [7, 7], '>>': [7, 7], '..': [9, 8], '+': [10, 10], '-': [10, 10], '*': [11, 11], '/': [11, 11], '//': [11, 11], '%': [11, 11], '^': [14, 13] };
  function expr(limit){
    limit = limit || 0;
    let left;
    const tk = peek();
    if(isKw('not') || isOp('-') || isOp('#') || isOp('~')){ p++; const a = expr(12); left = { t: 'un', op: tk.v, a, line: tk.line }; }
    else left = simple();
    for(;;){
      const t = peek(); const op = (t.t === 'op' || (t.t === 'kw' && (t.v === 'and' || t.v === 'or'))) ? t.v : null;
      const pr = op && PREC[op];
      if(!pr || pr[0] <= limit) break;
      p++; const right = expr(pr[1]);
      left = { t: 'bin', op, a: left, b: right, line: t.line };
    }
    return left;
  }
  function simple(){
    const tk = peek();
    switch(tk.t){
      case 'num': p++; return { t: 'num', v: tk.v };
      case 'str': p++; return { t: 'str', v: tk.v };
      case 'kw':
        if(tk.v === 'nil'){ p++; return { t: 'nil' }; } if(tk.v === 'true'){ p++; return { t: 'bool', v: true }; } if(tk.v === 'false'){ p++; return { t: 'bool', v: false }; }
        if(tk.v === 'function'){ p++; return funcBody(false, tk.line); }
        break;
      case 'op':
        if(tk.v === '...'){ p++; return { t: 'vararg' }; }
        if(tk.v === '{') return tableCons();
        break;
    }
    return suffixed();
  }
  function tableCons(){
    eat('op', '{'); const items = [];
    while(!isOp('}')){
      if(isOp('[')){ p++; const k = expr(); eat('op', ']'); eat('op', '='); items.push({ k, v: expr() }); }
      else if(is('name') && toks[p + 1].t === 'op' && toks[p + 1].v === '='){ const k = { t: 'str', v: toks[p].v }; p += 2; items.push({ k, v: expr() }); }
      else items.push({ k: null, v: expr() });
      if(!(acc('op', ',') || acc('op', ';'))) break;
    }
    eat('op', '}'); return { t: 'table', items };
  }
  function primary(){
    const tk = peek();
    if(is('name')){ p++; return { t: 'name', v: tk.v, line: tk.line }; }
    if(isOp('(')){ p++; const e = expr(); eat('op', ')'); return { t: 'paren', e }; }
    throw err('expressão inesperada: ' + (tk.v !== undefined ? tk.v : tk.t));
  }
  function suffixed(){
    let e = primary();
    for(;;){
      const tk = peek();
      if(isOp('.')){ p++; e = { t: 'index', o: e, k: { t: 'str', v: eat('name').v }, line: tk.line }; }
      else if(isOp('[')){ p++; const k = expr(); eat('op', ']'); e = { t: 'index', o: e, k, line: tk.line }; }
      else if(isOp(':')){ p++; const nm = eat('name').v; const args = callArgs(); e = { t: 'mcall', o: e, name: nm, args, line: tk.line }; }
      else if(isOp('(') || is('str') || isOp('{')){ e = { t: 'call', f: e, args: callArgs(), line: tk.line }; }
      else break;
    }
    return e;
  }
  function callArgs(){
    if(is('str')){ const s = toks[p++]; return [{ t: 'str', v: s.v }]; }
    if(isOp('{')) return [tableCons()];
    eat('op', '('); let a = []; if(!isOp(')')) a = exprList(); eat('op', ')'); return a;
  }
  const b = block();
  if(!is('eof')) throw err('"' + toks[p].v + '" inesperado');
  return b;
}

/* ---- interpretador ---- */
class LScope { constructor(parent){ this.v = new Map(); this.parent = parent; } }
function lget(sc, G, n){ for(let s = sc; s; s = s.parent) if(s.v.has(n)) return s.v.get(n); return G.get(n); }
function lset(sc, G, n, val){ for(let s = sc; s; s = s.parent) if(s.v.has(n)){ s.v.set(n, val); return; } G.set(n, val); }
const first = r => Array.isArray(r) ? (r.length ? r[0] : null) : r;
const truthy = v => !(v === null || v === undefined || v === false);
function tostr(v){
  if(v === null || v === undefined) return 'nil'; if(v === true) return 'true'; if(v === false) return 'false';
  if(typeof v === 'number') return Number.isInteger(v) ? String(v) : (Number.isFinite(v) ? String(+v.toPrecision(14)) : (v > 0 ? 'inf' : v < 0 ? '-inf' : 'nan'));
  if(typeof v === 'string') return v;
  if(v instanceof LuaTable){ if(v.meta && v.meta.get('__tostring')){ return '<tabla>'; } return 'table: 0x' + (v.__id || (v.__id = Math.floor(Math.random() * 1e8).toString(16))); }
  if(typeof v === 'function') return 'function: 0x' + Math.floor(Math.random() * 1e6).toString(16);
  return String(v);
}
function tonum(v){ if(typeof v === 'number') return v; if(typeof v === 'string'){ const s = v.trim(); if(/^0[xX][0-9a-fA-F]+$/.test(s)) return parseInt(s, 16); if(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return parseFloat(s); } return null; }
function arith(op, a, b, line){
  const x = tonum(a), y = tonum(b);
  if(x === null || y === null){
    const mt = a instanceof LuaTable && a.meta ? a.meta : (b instanceof LuaTable && b.meta ? b.meta : null);
    const ev = { '+': '__add', '-': '__sub', '*': '__mul', '/': '__div' }[op];
    if(mt && ev && mt.get(ev)) return { meta: mt.get(ev) };
    throw new LuaErr('linha ' + line + ': tentativa de operação aritmética com ' + (x === null ? typeName(a) : typeName(b)), line);
  }
  switch(op){ case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': return x / y; case '//': return Math.floor(x / y); case '%': return y === 0 ? NaN : x - Math.floor(x / y) * y; case '^': return Math.pow(x, y); }
}
function typeName(v){ return v === null || v === undefined ? 'nil' : typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'number' : typeof v === 'string' ? 'string' : v instanceof LuaTable ? 'table' : 'function'; }
function lcmp(op, a, b, line){
  if(typeof a === 'number' && typeof b === 'number' || typeof a === 'string' && typeof b === 'string'){ switch(op){ case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b; } }
  throw new LuaErr('linha ' + line + ': comparação inválida entre ' + typeName(a) + ' e ' + typeName(b), line);
}
let stringLib = null;

async function levalMulti(list, sc, G, va){ // lista de expressões com expansão do último
  const out = [];
  for(let i = 0; i < list.length; i++){
    const e = list[i];
    if(i === list.length - 1 && (e.t === 'call' || e.t === 'mcall' || e.t === 'vararg')){ const r = await lev(e, sc, G, va, true); if(Array.isArray(r)) out.push(...r); else out.push(r); }
    else out.push(first(await lev(e, sc, G, va)));
  }
  return out;
}
async function lcallFn(f, args, line){
  if(typeof f === 'function'){ const r = await f(args); return Array.isArray(r) ? r : (r === undefined ? [] : [r]); }
  if(f instanceof LuaTable && f.meta && f.meta.get('__call')) return lcallFn(f.meta.get('__call'), [f, ...args], line);
  throw new LuaErr('linha ' + line + ': tentativa de chamar um valor ' + typeName(f), line);
}
async function lindex(o, k, line){
  if(o instanceof LuaTable){
    const v = o.h.get(k);
    if(v !== undefined) return v;
    if(o.meta){ const idx = o.meta.get('__index'); if(idx instanceof LuaTable) return lindex(idx, k, line); if(typeof idx === 'function') return first(await idx([o, k])); }
    return null;
  }
  if(typeof o === 'string') return stringLib ? stringLib.get(k) : null;
  throw new LuaErr('linha ' + line + ': tentativa de indexar um valor ' + typeName(o), line);
}
async function lev(e, sc, G, va, multi){
  if(!RUN.on) throw new PyStop();
  switch(e.t){
    case 'nil': return null; case 'bool': return e.v; case 'num': return e.v; case 'str': return e.v;
    case 'vararg': return multi ? (va || []) : first(va || []);
    case 'name': return lget(sc, G, e.v) === undefined ? null : lget(sc, G, e.v);
    case 'paren': return first(await lev(e.e, sc, G, va));
    case 'func': return makeLuaFn(e, sc, G);
    case 'table': {
      const t = new LuaTable(); let n = 1;
      for(let i = 0; i < e.items.length; i++){
        const it = e.items[i];
        if(it.k){ t.set(first(await lev(it.k, sc, G, va)), first(await lev(it.v, sc, G, va))); }
        else if(i === e.items.length - 1 && (it.v.t === 'call' || it.v.t === 'mcall' || it.v.t === 'vararg')){ const r = await lev(it.v, sc, G, va, true); for(const x of (Array.isArray(r) ? r : [r])) t.set(n++, x); }
        else t.set(n++, first(await lev(it.v, sc, G, va)));
      }
      return t;
    }
    case 'index': { const o = first(await lev(e.o, sc, G, va)); const k = first(await lev(e.k, sc, G, va)); return lindex(o, k, e.line); }
    case 'call': {
      const f = first(await lev(e.f, sc, G, va));
      const args = await levalMulti(e.args, sc, G, va);
      const r = await lcallFn(f, args, e.line);
      return multi ? r : (r.length ? r[0] : null);
    }
    case 'mcall': {
      const o = first(await lev(e.o, sc, G, va));
      const f = await lindex(o, e.name, e.line);
      const args = [o, ...await levalMulti(e.args, sc, G, va)];
      const r = await lcallFn(f, args, e.line);
      return multi ? r : (r.length ? r[0] : null);
    }
    case 'un': {
      const a = first(await lev(e.a, sc, G, va));
      if(e.op === 'not') return !truthy(a);
      if(e.op === '-'){ const x = tonum(a); if(x === null) throw new LuaErr('linha ' + e.line + ': operação aritmética em ' + typeName(a), e.line); return -x; }
      if(e.op === '#'){ if(typeof a === 'string') return a.length; if(a instanceof LuaTable){ if(a.meta && a.meta.get('__len')) return first(await a.meta.get('__len')([a])); return a.len(); } throw new LuaErr('linha ' + e.line + ': tentativa de obter o tamanho de ' + typeName(a), e.line); }
      if(e.op === '~') return ~Math.trunc(a);
      break;
    }
    case 'bin': {
      if(e.op === 'and'){ const a = first(await lev(e.a, sc, G, va)); return truthy(a) ? first(await lev(e.b, sc, G, va)) : a; }
      if(e.op === 'or'){ const a = first(await lev(e.a, sc, G, va)); return truthy(a) ? a : first(await lev(e.b, sc, G, va)); }
      const a = first(await lev(e.a, sc, G, va)), b = first(await lev(e.b, sc, G, va));
      switch(e.op){
        case '==': return a === b || (a === null && b === undefined) || (a === undefined && b === null);
        case '~=': return !(a === b || (a == null && b == null));
        case '<': case '>': case '<=': case '>=': return lcmp(e.op, a, b, e.line);
        case '..': { if((typeof a === 'string' || typeof a === 'number') && (typeof b === 'string' || typeof b === 'number')) return tostr(a) + tostr(b); throw new LuaErr('linha ' + e.line + ': tentativa de concatenar ' + typeName(typeof a === 'string' || typeof a === 'number' ? b : a), e.line); }
        case '&': return Math.trunc(a) & Math.trunc(b); case '|': return Math.trunc(a) | Math.trunc(b); case '<<': return Math.trunc(a) << Math.trunc(b); case '>>': return Math.trunc(a) >>> Math.trunc(b);
        default: { const r = arith(e.op, a, b, e.line); if(r && r.meta) return first(await r.meta([a, b])); return r; }
      }
    }
  }
  throw new LuaErr('nó desconhecido ' + e.t);
}
function makeLuaFn(e, sc, G){
  return async function(args){
    const s = new LScope(sc);
    e.params.forEach((p, i) => s.v.set(p, args[i] === undefined ? null : args[i]));
    const va = e.vararg ? args.slice(e.params.length) : [];
    const r = await lblock(e.b, s, G, va);
    return r instanceof Ret ? r.v : [];
  };
}
async function lblock(stmts, sc, G, va){
  for(const s of stmts){
    const r = await lstmt(s, sc, G, va);
    if(r) return r;
  }
  return null;
}
let lsteps = 0, llast = 0;
async function lstmt(s, sc, G, va){
  if(!RUN.on) throw new PyStop();
  if(++lsteps % 64 === 0 && performance.now() - llast > 10){ await new Promise(r => setTimeout(r, 0)); llast = performance.now(); }
  switch(s.t){
    case 'expr': await lev(s.e, sc, G, va, true); return null;
    case 'local': { const vals = await levalMulti(s.ex, sc, G, va); s.names.forEach((n, i) => sc.v.set(n, vals[i] === undefined ? null : vals[i])); return null; }
    case 'localfn': { sc.v.set(s.name, null); const f = makeLuaFn(s.f, sc, G); sc.v.set(s.name, f); return null; }
    case 'assign': {
      const vals = await levalMulti(s.ex, sc, G, va);
      for(let i = 0; i < s.targets.length; i++){
        const t = s.targets[i], v = vals[i] === undefined ? null : vals[i];
        if(t.t === 'name') lset(sc, G, t.v, v);
        else if(t.t === 'index'){
          const o = first(await lev(t.o, sc, G, va)), k = first(await lev(t.k, sc, G, va));
          if(o instanceof LuaTable){
            if(o.meta && !o.h.has(k) && o.meta.get('__newindex')){ const ni = o.meta.get('__newindex'); if(typeof ni === 'function') await ni([o, k, v]); else ni.set(k, v); }
            else o.set(k, v);
          } else throw new LuaErr('linha ' + t.line + ': tentativa de indexar ' + typeName(o), t.line);
        }
      }
      return null;
    }
    case 'if': { for(const [c, b] of s.cl){ if(truthy(first(await lev(c, sc, G, va)))) return lblock(b, new LScope(sc), G, va); } if(s.els) return lblock(s.els, new LScope(sc), G, va); return null; }
    case 'while': { while(truthy(first(await lev(s.c, sc, G, va)))){ const r = await lblock(s.b, new LScope(sc), G, va); if(r){ if(r === BRK) break; return r; } } return null; }
    case 'repeat': { for(;;){ const inner = new LScope(sc); const r = await lblock(s.b, inner, G, va); if(r){ if(r === BRK) break; return r; } if(truthy(first(await lev(s.c, inner, G, va)))) break; } return null; }
    case 'do': return lblock(s.b, new LScope(sc), G, va);
    case 'nfor': {
      const a = tonum(first(await lev(s.a, sc, G, va))), b = tonum(first(await lev(s.b, sc, G, va))), c = s.c ? tonum(first(await lev(s.c, sc, G, va))) : 1;
      if(a === null || b === null || c === null) throw new LuaErr('linha ' + s.line + "': 'for' precisa de números", s.line);
      if(c === 0) throw new LuaErr("linha " + s.line + ": 'for' step é zero", s.line);
      for(let i = a; c > 0 ? i <= b : i >= b; i += c){ const inner = new LScope(sc); inner.v.set(s.v, i); const r = await lblock(s.body, inner, G, va); if(r){ if(r === BRK) break; return r; } }
      return null;
    }
    case 'gfor': {
      const vals = await levalMulti(s.ex, sc, G, va);
      const [f, st, ctl0] = vals; let ctl = ctl0;
      for(;;){
        const rs = await lcallFn(f, [st, ctl], s.line);
        if(rs[0] === null || rs[0] === undefined) break;
        ctl = rs[0];
        const inner = new LScope(sc); s.names.forEach((n, i) => inner.v.set(n, rs[i] === undefined ? null : rs[i]));
        const r = await lblock(s.body, inner, G, va);
        if(r){ if(r === BRK) break; return r; }
      }
      return null;
    }
    case 'ret': { const vals = s.ex.length === 1 && (s.ex[0].t === 'call' || s.ex[0].t === 'mcall') ? await lev(s.ex[0], sc, G, va, true) : await levalMulti(s.ex, sc, G, va); return new Ret(Array.isArray(vals) ? vals : [vals]); }
    case 'break': return BRK;
  }
  throw new LuaErr('instrução desconhecida ' + s.t);
}

/* ---- biblioteca padrão Lua ---- */
function luaPattern(pat){
  // converte padrão Lua -> RegExp (suporta classes %a %d %s %w %p %l %u %x %c, âncoras, quantificadores, [], %b não)
  let re = '', i = 0;
  const cls = { a: 'A-Za-z', d: '0-9', l: 'a-z', u: 'A-Z', s: '\\s', w: 'A-Za-z0-9', x: '0-9A-Fa-f', p: '!-\\/:-@\\[-`{-~', c: '\\x00-\\x1f', g: '!-~' };
  const single = ch => { const lo = ch.toLowerCase(); if(cls[lo]) return (ch === lo ? '[' : '[^') + cls[lo] + ']'; return '\\' + ch; };
  while(i < pat.length){
    const c = pat[i];
    if(c === '%'){ const n = pat[i + 1]; if(/[a-zA-Z]/.test(n)) re += single(n); else re += '\\' + n; i += 2; continue; }
    if(c === '['){ let j = i + 1, s = '['; if(pat[j] === '^'){ s += '^'; j++; } while(j < pat.length && pat[j] !== ']'){ if(pat[j] === '%'){ const n = pat[j + 1]; const lo = n.toLowerCase(); if(cls[lo] && /[a-zA-Z]/.test(n)) s += cls[lo]; else s += '\\' + n; j += 2; } else { s += pat[j] === '\\' ? '\\\\' : pat[j]; j++; } } s += ']'; re += s; i = j + 1; continue; }
    if(c === '-'){ re += '*?'; i++; continue; }
    if(c === '.' || c === '*' || c === '+' || c === '?' || c === '^' || c === '$' || c === '(' || c === ')'){ re += c; i++; continue; }
    re += c.replace(/[\\{}|]/g, '\\$&'); i++;
  }
  return new RegExp(re);
}
function luaFormat(fmt, args){ let i = 0; return fmt.replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?([diouxXeEfgGcsq%])/g, (all, fl, w, pr, t) => { if(t === '%') return '%'; const v = args[i++]; let s; switch(t){ case 'd': case 'i': s = String(Math.trunc(tonum(v))); break; case 'u': s = String(Math.trunc(tonum(v)) >>> 0); break; case 'o': s = Math.trunc(v).toString(8); break; case 'x': s = Math.trunc(v).toString(16); break; case 'X': s = Math.trunc(v).toString(16).toUpperCase(); break; case 'f': s = (+tonum(v)).toFixed(pr === undefined ? 6 : +pr); break; case 'e': case 'E': s = (+v).toExponential(pr === undefined ? 6 : +pr); break; case 'g': s = String(+(+v).toPrecision(pr === undefined ? 6 : +pr || 1)); break; case 'c': s = String.fromCharCode(v); break; case 'q': s = JSON.stringify(String(v)); break; default: s = tostr(v); if(pr !== undefined) s = s.slice(0, +pr); } if(fl.includes('+') && typeof v === 'number' && v >= 0 && 'dif'.includes(t)) s = '+' + s; if(w){ const W = +w; if(s.length < W) s = fl.includes('-') ? s.padEnd(W) : fl.includes('0') && !/[sc]/.test(t) ? s.padStart(W, '0') : s.padStart(W); } return s; }); }
function mkLib(o){ const t = new LuaTable(); for(const k in o){ const v = o[k]; t.set(k, typeof v === 'function' ? (args => { const r = v(...args); return r === undefined ? [] : (Array.isArray(r) && r.__multi ? r : [r]); }) : v); } return t; }
const multi = (...a) => { a.__multi = true; return a; };
function makeLuaEnv(){
  const G = new LuaTable();
  const reg = (n, f) => G.set(n, f);
  const nat = (name, f) => reg(name, args => { const r = f(...args); return r === undefined ? [] : (Array.isArray(r) && r.__multi ? r : [r]); });
  nat('print', (...a) => { HAL.write(a.map(x => (x instanceof LuaTable && x.meta && x.meta.get('__tostring')) ? '<obj>' : tostr(x)).join('\t') + '\n'); });
  nat('type', v => typeName(v)); nat('tostring', v => tostr(v));
  nat('tonumber', (v, b) => { if(b) { const r = parseInt(v, b); return isNaN(r) ? null : r; } return tonum(v); });
  nat('rawget', (t, k) => t.h.has(k) ? t.h.get(k) : null); nat('rawset', (t, k, v) => { t.set(k, v); return t; }); nat('rawequal', (a, b) => a === b); nat('rawlen', t => typeof t === 'string' ? t.length : t.len());
  nat('assert', (v, m) => { if(!truthy(v)) throw new LuaErr(m !== undefined ? tostr(m) : 'assertion failed!'); return v; });
  reg('error', args => { throw new LuaErr(args[0] !== undefined ? args[0] : 'erro', 0); });
  reg('pcall', async args => { try { const r = await lcallFn(args[0], args.slice(1)); return [true, ...r]; } catch(e){ if(e instanceof PyStop) throw e; return [false, e instanceof LuaErr ? e.val : (e.message || String(e))]; } });
  reg('xpcall', async args => { try { const r = await lcallFn(args[0], args.slice(2)); return [true, ...r]; } catch(e){ if(e instanceof PyStop) throw e; const h = await lcallFn(args[1], [e instanceof LuaErr ? e.val : e.message]); return [false, ...h]; } });
  reg('select', args => { const n = args[0]; if(n === '#') return [args.length - 1]; return args.slice(n < 0 ? args.length + n : n); });
  reg('next', args => { const t = args[0]; const ks = [...t.h.keys()]; let i = args[1] === null || args[1] === undefined ? 0 : ks.indexOf(args[1]) + 1; if(i >= ks.length) return [null]; return [ks[i], t.h.get(ks[i])]; });
  reg('pairs', args => { const t = args[0]; if(t instanceof LuaTable && t.meta && t.meta.get('__pairs')) return t.meta.get('__pairs')([t]); const ks = [...t.h.keys()].sort((a, b) => (typeof a === 'number' && typeof b === 'number') ? a - b : typeof a === 'number' ? -1 : typeof b === 'number' ? 1 : 0); let i = 0; return [() => { if(i >= ks.length) return [null]; const k = ks[i++]; return [k, t.h.get(k)]; }, t, null]; });
  reg('ipairs', args => { const t = args[0]; return [a => { const i = a[1] + 1; return t.h.has(i) ? [i, t.h.get(i)] : [null]; }, t, 0]; });
  reg('setmetatable', args => { args[0].meta = args[1]; return [args[0]]; }); reg('getmetatable', args => [args[0] instanceof LuaTable ? args[0].meta : null]);
  reg('unpack', args => args[0].arr().slice((args[1] || 1) - 1, args[2] || undefined));
  G.set('_G', G); G.set('_VERSION', 'Lua 5.3 (Kezle)');
  G.set('table', mkLib({
    insert: (t, a, b) => { if(b === undefined) t.set(t.len() + 1, a); else { const n = t.len(); for(let i = n; i >= a; i--) t.set(i + 1, t.get(i)); t.set(a, b); } },
    remove: (t, pos) => { const n = t.len(); if(!n) return null; pos = pos === undefined ? n : pos; const v = t.get(pos); for(let i = pos; i < n; i++) t.set(i, t.get(i + 1)); t.set(n, null); return v; },
    concat: (t, sep, i, j) => t.arr().slice((i || 1) - 1, j || undefined).map(tostr).join(sep || ''), unpack: (t, i, j) => multi(...t.arr().slice((i || 1) - 1, j || undefined)), pack: (...a) => { const t = LuaTable.from(a); t.set('n', a.length); return t; },
    sort: null
  }));
  G.get('table').set('sort', async args => { const t = args[0], cmp = args[1]; const a = t.arr(); const keys = a.map((v, i) => i); const less = async (x, y) => cmp ? truthy(first(await lcallFn(cmp, [x, y]))) : (x < y); // merge sort assíncrono
    const ms = async arr => { if(arr.length < 2) return arr; const m = arr.length >> 1; const l = await ms(arr.slice(0, m)), r = await ms(arr.slice(m)); const out = []; let i = 0, j = 0; while(i < l.length && j < r.length){ if(await less(r[j], l[i])) out.push(r[j++]); else out.push(l[i++]); } return out.concat(l.slice(i), r.slice(j)); };
    const s = await ms(a); s.forEach((v, i) => t.set(i + 1, v)); return []; });
  stringLib = mkLib({
    len: s => String(s).length, upper: s => String(s).toUpperCase(), lower: s => String(s).toLowerCase(), rep: (s, n, sep) => Array(Math.max(0, n)).fill(s).join(sep || ''), reverse: s => [...String(s)].reverse().join(''),
    sub: (s, i, j) => { s = String(s); const n = s.length; i = i === undefined || i === null ? 1 : i; j = j === undefined || j === null ? -1 : j; if(i < 0) i = Math.max(n + i + 1, 1); else if(i === 0) i = 1; if(j < 0) j = n + j + 1; else if(j > n) j = n; return i > j ? '' : s.slice(i - 1, j); },
    byte: (s, i, j) => { i = i || 1; j = j || i; const r = []; for(let k = i; k <= j; k++) if(s.charCodeAt(k - 1) === s.charCodeAt(k - 1)) r.push(s.charCodeAt(k - 1)); return multi(...r); }, char: (...a) => String.fromCharCode(...a),
    format: (f, ...a) => luaFormat(f, a),
    find: (s, pat, init, plain) => { s = String(s); const st = init ? (init < 0 ? s.length + init : init - 1) : 0; if(plain || !/[%^$*+?.\[\]()-]/.test(pat)){ const i = s.indexOf(pat, st); return i < 0 ? null : multi(i + 1, i + pat.length); } const re = luaPattern(pat); const m = re.exec(s.slice(st)); if(!m) return null; const idx = st + m.index; return multi(idx + 1, idx + m[0].length, ...m.slice(1)); },
    match: (s, pat, init) => { s = String(s); const m = luaPattern(pat).exec(s.slice(init ? init - 1 : 0)); if(!m) return null; return m.length > 1 ? multi(...m.slice(1)) : m[0]; },
    gmatch: (s, pat) => { const re = new RegExp(luaPattern(pat).source, 'g'); const all = [...String(s).matchAll(re)]; let i = 0; return () => { if(i >= all.length) return null; const m = all[i++]; return m.length > 1 ? multi(...m.slice(1)) : m[0]; }; },
    gsub: (s, pat, rep, n) => { let cnt = 0; const re = new RegExp(luaPattern(pat).source, 'g'); const res = String(s).replace(re, (...m) => { if(n !== undefined && cnt >= n) return m[0]; cnt++; const groups = m.slice(1, -2).filter(x => typeof x === 'string'); if(typeof rep === 'string') return rep.replace(/%(\d)/g, (a, d) => d === '0' ? m[0] : groups[d - 1]); if(rep instanceof LuaTable){ const v = rep.get(groups[0] !== undefined ? groups[0] : m[0]); return v === null ? m[0] : tostr(v); } return m[0]; }); return multi(res, cnt); }
  });
  G.set('string', stringLib);
  G.set('math', mkLib({
    floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: (y, x) => Math.atan2(y, x === undefined ? 1 : x), exp: Math.exp, log: (x, b) => b ? Math.log(x) / Math.log(b) : Math.log(x),
    max: Math.max, min: Math.min, fmod: (a, b) => a % b, modf: x => multi(Math.trunc(x), x - Math.trunc(x)), pow: Math.pow, rad: x => x * Math.PI / 180, deg: x => x * 180 / Math.PI, tointeger: x => Number.isInteger(+x) ? +x : null, type: x => typeof x === 'number' ? (Number.isInteger(x) ? 'integer' : 'float') : null,
    random: (a, b) => a === undefined ? Math.random() : b === undefined ? 1 + Math.floor(Math.random() * a) : a + Math.floor(Math.random() * (b - a + 1)), randomseed: () => 0, pi: Math.PI, huge: Infinity, maxinteger: Number.MAX_SAFE_INTEGER, mininteger: Number.MIN_SAFE_INTEGER
  }));
  G.set('os', mkLib({ time: t => Math.floor(Date.now() / 1000), clock: () => performance.now() / 1000, date: (f) => new Date().toLocaleString('pt-BR'), getenv: () => null, exit: () => { RUN.on = false; } }));
  G.set('bit32', mkLib({ band: (a, b) => a & b, bor: (a, b) => a | b, bxor: (a, b) => a ^ b, bnot: a => ~a, lshift: (a, n) => a << n, rshift: (a, n) => a >>> n }));
  G.set('bit', G.get('bit32'));
  // ---- hardware (NodeMCU-like + Arduino-like) ----
  const m = CIRCUIT.primaryMcu();
  const ledp = pinId('LED');
  G.set('gpio', mkLib({ mode: (p, m2) => HAL.pinMode(p, m2 === 2 ? 'in_up' : m2), write: (p, v) => HAL.digitalWrite(p, v), read: p => HAL.digitalRead(p), toggle: p => HAL.digitalWrite(p, (PINS[p] && PINS[p].v) ? 0 : 1), trig: (p, ev, cb) => HAL.attach(p, a => cb([p, a]), ev === 'up' ? 'rising' : ev === 'down' ? 'falling' : 'change'), OUTPUT: 1, INPUT: 0, INT: 2, HIGH: 1, LOW: 0, PULLUP: 2, FLOAT: 0, OPENDRAIN: 1 }));
  G.set('adc', mkLib({ read: ch => HAL.analogRead(ch), readvdd33: () => 3300, force_init_mode: () => 0, INIT_ADC: 0, INIT_VDD33: 1 }));
  G.set('pwm', mkLib({ setup: (p, f, d) => { HAL.pwm(p, f, d); }, start: () => 0, stop: p => HAL.pwm(p, 1000, 0), setduty: (p, d) => HAL.pwm(p, (PINS[p] && PINS[p].freq) || 1000, d), getduty: p => (PINS[p] && PINS[p].duty) || 0, write: (p, d255) => HAL.analogWrite(p, d255, 255), setclock: () => 0 }));
  const tmrObj = () => { let h = null; return mkLib({ alarm: (self, ms, mode, cb) => { if(h) clearInterval(h); h = HAL.every(ms, () => cb([tmrObj]), mode === 0); return true; }, register: (self, ms, mode, cb) => { if(h) clearInterval(h); h = HAL.every(ms, () => cb([tmrObj]), mode === 0); }, start: () => true, stop: () => { if(h){ clearInterval(h); clearTimeout(h); } return true; }, unregister: () => { if(h){ clearInterval(h); clearTimeout(h); } } }); };
  G.set('tmr', mkLib({ now: () => HAL.micros(), delay: us => HAL.delayUs(us), create: () => tmrObj(), ALARM_AUTO: 1, ALARM_SINGLE: 0, ALARM_SEMI: 2, time: () => Math.floor(HAL.millis() / 1000), wdclr: () => 0 }));
  G.get('tmr').set('delay', async args => { await HAL.delayUs(args[0]); return []; });
  G.set('node', mkLib({ heap: () => 40000, restart: () => { RUN.on = false; }, chipid: () => 0xDEADBE, flashid: () => 1 }));
  G.set('wifi', mkLib({ setmode: () => 0, sta: { config: () => 0, connect: () => 0, getip: () => multi('192.168.4.22', '255.255.255.0', '192.168.4.1'), status: () => 5 }, STATION: 1, SOFTAP: 2, eventmon: { register: () => 0 } }));
  G.set('i2c', mkLib({ setup: () => 0, start: () => 0, stop: () => 0, address: () => true, write: () => 1, read: () => '', FAST: 400000, SLOW: 100000, TRANSMITTER: 0, RECEIVER: 1 }));
  G.set('servo', mkLib({ write: (p, a) => HAL.servoWrite(p, a), attach: p => HAL.pinMode(p, 'out') }));
  G.set('tone', args => { HAL.tone(args[0], args[1], args[2]); return []; }); G.set('noTone', args => { HAL.noTone(args[0]); return []; });
  G.set('LED', ledp); G.set('LED_BUILTIN', ledp);
  nat('pinMode', (p, m2) => HAL.pinMode(p, m2)); nat('digitalWrite', (p, v) => HAL.digitalWrite(p, v)); nat('digitalRead', p => HAL.digitalRead(p)); nat('analogRead', p => HAL.analogRead(p)); nat('analogWrite', (p, v) => HAL.analogWrite(p, v, 255));
  G.set('INPUT', 0); G.set('OUTPUT', 1); G.set('INPUT_PULLUP', 2); G.set('HIGH', 1); G.set('LOW', 0);
  reg('delay', async args => { await HAL.delay(args[0]); return []; }); reg('sleep', async args => { await HAL.delay(args[0]); return []; }); reg('delayMicroseconds', async args => { await HAL.delayUs(args[0]); return []; });
  nat('millis', () => HAL.millis()); nat('micros', () => HAL.micros());
  // display / touch (lazy)
  const lazy = (factory) => { let o = null; const t = new LuaTable(); t.meta = new LuaTable(); t.meta.set('__index', null); const get = () => o || (o = factory()); const origGet = t.get.bind(t); t.get = k => { const real = get(); if(!real) return null; const v = real[k]; if(typeof v === 'function') return args => { const r = v(...args.slice(0)); return r === undefined ? [] : (Array.isArray(r) ? r : [r]); }; return v === undefined ? null : v; }; Object.defineProperty(t, 'h', { get: () => ({ get: k => t.get(k), has: k => true }) }); return t; };
  const gfxLazy = () => { const g = HAL.gfx(null); return Object.assign({}, g, { circle: (x, y, r, c, f) => g.circle(x, y, r, c, !!f), rect: (x, y, w, h, c, f) => g.rect(x, y, w, h, c, !!f) }); };
  G.set('tft', lazy(gfxLazy)); G.set('oled', G.get('tft')); G.set('display', G.get('tft'));
  G.set('touch', lazy(() => { const t = HAL.touch(); if(!t) return { get: () => [null], touched: () => false }; return Object.assign({}, t, { get: () => { const p = t.touched() ? t.get_point() : null; return p ? multi(p.x, p.y) : null; }, count: () => t.getTouchCount(), gesture: () => t.gesture() }); }));
  G.set('button', lazy(() => ({ pressed: n => HAL.button(n).isPressed() })));
  return G;
}
async function runLua(src){
  const toks = luaLex(src);
  const ast = luaParse(toks);
  const G = makeLuaEnv();
  lsteps = 0; llast = performance.now();
  const r = await lblock(ast, new LScope(null), G, []);
  // callbacks de timers mantêm o programa vivo
  while(RUN.on && (HAL.timers.length || HAL.watchers.length)) await wait(50);
}
RUNNERS.lua = async function(src){
  try { await runLua(src); }
  catch(e){ if(e instanceof LuaErr) throw new Error('Lua: ' + e.message); throw e; }
};

/* ============================ BASIC ============================ */
function basicRun(src){
  // linhas: "10 PRINT ..." ou sem número (rótulos "nome:")
  const rawLines = src.replace(/\r/g, '').split('\n');
  const prog = []; const labels = {}; const numIdx = {};
  rawLines.forEach((l, i) => {
    let s = l.trim(); if(!s) return;
    let num = null; const m = s.match(/^(\d+)\s+(.*)$/); if(m){ num = +m[1]; s = m[2]; } else if(/^\d+$/.test(s)){ num = +s; s = ''; }
    const lm = s.match(/^([A-Za-z_]\w*):(?!=)\s*(.*)$/); if(lm && !/^(REM|PRINT|IF|FOR)$/i.test(lm[1])){ labels[lm[1].toUpperCase()] = prog.length; s = lm[2]; }
    const idx = prog.length; prog.push({ n: num, s, line: i + 1 }); if(num != null) numIdx[num] = idx;
  });
  return { prog, labels, numIdx };
}
function bTok(s){
  const t = []; let i = 0;
  while(i < s.length){
    const c = s[i];
    if(/\s/.test(c)){ i++; continue; }
    if(c === '"'){ let j = i + 1, v = ''; while(j < s.length && s[j] !== '"'){ v += s[j]; j++; } t.push({ t: 's', v }); i = j + 1; continue; }
    if(/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))){ const m = s.slice(i).match(/^(&H[0-9A-Fa-f]+|0[xX][0-9A-Fa-f]+|\d*\.?\d+(?:[eE][+-]?\d+)?)/)[0]; t.push({ t: 'n', v: /^&H/i.test(m) ? parseInt(m.slice(2), 16) : /^0x/i.test(m) ? parseInt(m, 16) : parseFloat(m) }); i += m.length; continue; }
    if(/[A-Za-z_]/.test(c)){ let j = i + 1; while(j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++; if(s[j] === '$' || s[j] === '%' || s[j] === '#' || s[j] === '!'){ j++; } t.push({ t: 'w', v: s.slice(i, j).toUpperCase() }); i = j; continue; }
    const two = s.substr(i, 2);
    if(['<>', '<=', '>=', '==', '!=', '<<', '>>'].includes(two)){ t.push({ t: 'o', v: two }); i += 2; continue; }
    t.push({ t: 'o', v: c }); i++;
  }
  return t;
}
RUNNERS.bas = async function(src){
  const { prog, labels, numIdx } = basicRun(src);
  const vars = {}, arrays = {}, forStack = [], gosub = [], whileStack = [], doStack = [];
  let pc = 0, color = 0xFFFF, tsize = 1, gfx = null, touchObj = null;
  const G = () => gfx || (gfx = HAL.gfx(null));
  const T = () => touchObj || (touchObj = HAL.touch());
  const berr = (m, ln) => { const e = new Error(m); e.line = ln; return e; };
  const FUN = {
    ABS: Math.abs, INT: Math.floor, SQR: Math.sqrt, SQRT: Math.sqrt, SIN: Math.sin, COS: Math.cos, TAN: Math.tan, ATN: Math.atan, ATAN: Math.atan, EXP: Math.exp, LOG: Math.log, SGN: Math.sign, FIX: Math.trunc, ROUND: Math.round, MAX: Math.max, MIN: Math.min,
    RND: n => Math.random(), RANDOM: (a, b) => b === undefined ? Math.floor(Math.random() * a) : a + Math.floor(Math.random() * (b - a)),
    LEN: s => String(s).length, 'LEFT$': (s, n) => String(s).slice(0, n), 'RIGHT$': (s, n) => String(s).slice(-n), 'MID$': (s, a, n) => String(s).substr(a - 1, n === undefined ? 1e9 : n), 'STR$': v => (v >= 0 ? ' ' : '') + v, 'CHR$': c => String.fromCharCode(c), ASC: s => String(s).charCodeAt(0), VAL: s => parseFloat(s) || 0, 'UPPER$': s => String(s).toUpperCase(), 'LOWER$': s => String(s).toLowerCase(), 'HEX$': v => Math.trunc(v).toString(16).toUpperCase(), 'SPACE$': n => ' '.repeat(n), 'STRING$': (n, c) => (typeof c === 'number' ? String.fromCharCode(c) : String(c)[0]).repeat(n), INSTR: (a, b) => String(a).indexOf(b) + 1,
    MILLIS: () => HAL.millis(), MICROS: () => HAL.micros(), TIMER: () => HAL.millis() / 1000, DREAD: p => HAL.digitalRead(p), AREAD: p => HAL.analogRead(p), PIN: p => p,
    TOUCHED: () => { const t = T(); return t && t.touched() ? -1 : 0; }, TOUCHX: () => { const t = T(); const p = t && t.touched() ? t.get_point() : null; return p ? p.x : -1; }, TOUCHY: () => { const t = T(); const p = t && t.touched() ? t.get_point() : null; return p ? p.y : -1; },
    BUTTON: n => (HAL.button(String(n)).isPressed() ? -1 : 0), WIDTH: () => G().width(), HEIGHT: () => G().height(), PEEK: () => 0, FRE: () => 30000, COLOR565: (r, g, b) => ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3), RGB: (r, g, b) => ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
  };
  // ---- avaliador de expressões (precedência) ----
  function parseExpr(toks, st){
    let i = st.i;
    const peek = () => toks[i];
    function orE(){ let l = andE(); while(peek() && peek().t === 'w' && (peek().v === 'OR' || peek().v === 'XOR')){ const op = toks[i++].v; const r = andE(); l = op === 'OR' ? (l | r) : (l ^ r); } return l; }
    function andE(){ let l = notE(); while(peek() && peek().t === 'w' && peek().v === 'AND'){ i++; const r = notE(); l = l & r; } return l; }
    function notE(){ if(peek() && peek().t === 'w' && peek().v === 'NOT'){ i++; return ~notE(); } return cmpE(); }
    function cmpE(){ let l = addE(); while(peek() && peek().t === 'o' && ['=', '==', '<>', '!=', '<', '>', '<=', '>='].includes(peek().v)){ const op = toks[i++].v; const r = addE(); const R = op === '=' || op === '==' ? l === r : op === '<>' || op === '!=' ? l !== r : op === '<' ? l < r : op === '>' ? l > r : op === '<=' ? l <= r : l >= r; l = R ? -1 : 0; } return l; }
    function addE(){ let l = mulE(); while(peek() && peek().t === 'o' && (peek().v === '+' || peek().v === '-')){ const op = toks[i++].v; const r = mulE(); l = op === '+' ? (typeof l === 'string' || typeof r === 'string' ? String(l) + String(r) : l + r) : l - r; } return l; }
    function mulE(){ let l = powE(); while(peek() && ((peek().t === 'o' && ['*', '/', '\\', '%', '<<', '>>'].includes(peek().v)) || (peek().t === 'w' && peek().v === 'MOD'))){ const op = toks[i++].v; const r = powE(); if(op === '*') l *= r; else if(op === '/') { if(r === 0) throw new Error('divisão por zero'); l /= r; } else if(op === '\\') l = Math.trunc(l / r); else if(op === '<<') l = l << r; else if(op === '>>') l = l >> r; else l = l % r; } return l; }
    function powE(){ let l = unE(); while(peek() && peek().t === 'o' && (peek().v === '^')){ i++; const r = unE(); l = Math.pow(l, r); } return l; }
    function unE(){ if(peek() && peek().t === 'o' && peek().v === '-'){ i++; return -unE(); } if(peek() && peek().t === 'o' && peek().v === '+'){ i++; return unE(); } return atom(); }
    function atom(){
      const t = toks[i++];
      if(!t) throw new Error('expressão incompleta');
      if(t.t === 'n' || t.t === 's') return t.v;
      if(t.t === 'o' && t.v === '('){ const v = orE(); if(!(peek() && peek().v === ')')) throw new Error('esperava )'); i++; return v; }
      if(t.t === 'w'){
        const name = t.v;
        if(peek() && peek().v === '('){
          i++; const args = []; if(!(peek() && peek().v === ')')){ for(;;){ args.push(orE()); if(peek() && peek().v === ','){ i++; continue; } break; } }
          if(!(peek() && peek().v === ')')) throw new Error('esperava ) em ' + name); i++;
          if(name in FUN) return FUN[name](...args);
          if(arrays[name]){ let a = arrays[name]; for(const ix of args) a = a[ix]; return a === undefined ? 0 : a; }
          throw new Error('função/array desconhecido: ' + name);
        }
        if(name in FUN && !(name in vars) && ['TOUCHED', 'TOUCHX', 'TOUCHY', 'MILLIS', 'MICROS', 'TIMER', 'WIDTH', 'HEIGHT', 'RND', 'FRE'].includes(name)) return FUN[name]();
        const consts = { PI: Math.PI, TRUE: -1, FALSE: 0, HIGH: 1, LOW: 0, OUTPUT: 1, INPUT: 0, INPUT_PULLUP: 2, LED: pinId('LED') };
        if(name in vars) return vars[name];
        if(name in consts) return consts[name];
        return name.endsWith('$') ? '' : 0;
      }
      throw new Error('símbolo inesperado: ' + t.v);
    }
    st.i = i; const v = orE(); st.i = i; return v;
  }
  const ev = (toks, st) => { const s = { i: st.i }; const v = parseExpr(toks, s); st.i = s.i; return v; };
  function evList(toks, st){ const a = []; if(st.i >= toks.length) return a; for(;;){ a.push(ev(toks, st)); if(toks[st.i] && toks[st.i].v === ','){ st.i++; continue; } break; } return a; }
  function assignVar(name, idxs, val){ if(idxs && idxs.length){ if(!arrays[name]) throw new Error('array não declarado (use DIM): ' + name); let a = arrays[name]; for(let k = 0; k < idxs.length - 1; k++) a = a[idxs[k]]; a[idxs[idxs.length - 1]] = val; } else vars[name] = val; }
  const prn = v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(+v.toFixed(6))) : String(v);
  let outBuf = '';
  async function execStmt(s, ln){
    const toks = bTok(s);
    if(!toks.length) return null;
    const first = toks[0];
    if(first.t !== 'w') throw new Error('instrução inválida: ' + s);
    const st = { i: 1 };
    const K = first.v;
    switch(K){
      case 'REM': return null;
      case 'LET': st.i = 1; return execAssign(toks, st);
      case 'PRINT': case '?': { let out = ''; let nl = true; while(st.i < toks.length){ if(toks[st.i].v === ';'){ st.i++; nl = false; continue; } if(toks[st.i].v === ','){ st.i++; out += '\t'; nl = false; continue; } out += prn(ev(toks, st)); nl = true; } HAL.write(out + (nl ? '\n' : '')); return null; }
      case 'IF': {
        let depth = 0, ti = -1; for(let k = 1; k < toks.length; k++){ if(toks[k].t === 'o' && toks[k].v === '(') depth++; if(toks[k].t === 'o' && toks[k].v === ')') depth--; if(depth === 0 && toks[k].t === 'w' && toks[k].v === 'THEN'){ ti = k; break; } }
        if(ti < 0) throw new Error('IF sem THEN');
        const cond = ev(toks.slice(0, ti), { i: 1 });
        let ei = -1; depth = 0; for(let k = ti + 1; k < toks.length; k++){ if(toks[k].t === 'w' && toks[k].v === 'ELSE'){ ei = k; break; } }
        const thenT = toks.slice(ti + 1, ei < 0 ? toks.length : ei), elseT = ei < 0 ? null : toks.slice(ei + 1);
        const pick = cond ? thenT : elseT; if(!pick || !pick.length) return null;
        if(pick[0].t === 'n') return { goto: pick[0].v };
        const txt = pick.map(t => t.t === 's' ? '"' + t.v + '"' : String(t.v)).join(' ');
        return execStmt(pick.map(t => t.t === 's' ? '"' + t.v + '"' : (t.t === 'n' ? String(t.v) : t.v)).join(' ').replace(/ ([,;()]) /g, '$1'), ln);
      }
      case 'GOTO': return { goto: toks[1].t === 'n' ? toks[1].v : toks[1].v };
      case 'GOSUB': gosub.push(pc + 1); return { goto: toks[1].t === 'n' ? toks[1].v : toks[1].v };
      case 'RETURN': { if(!gosub.length) throw new Error('RETURN sem GOSUB'); return { pc: gosub.pop() }; }
      case 'END': case 'STOP': return { end: true };
      case 'FOR': { const name = toks[1].v; if(!(toks[2] && toks[2].v === '=')) throw new Error('FOR: esperava ='); st.i = 3; const from = ev(toks, st); if(!(toks[st.i] && toks[st.i].v === 'TO')) throw new Error('FOR: esperava TO'); st.i++; const to = ev(toks, st); let step = 1; if(toks[st.i] && toks[st.i].v === 'STEP'){ st.i++; step = ev(toks, st); } vars[name] = from; forStack.push({ name, to, step, pc }); if((step > 0 && from > to) || (step < 0 && from < to)){ // pula até o NEXT
          let d = 1, k = pc + 1; for(; k < prog.length; k++){ const w = bTok(prog[k].s)[0]; if(w && w.v === 'FOR') d++; if(w && w.v === 'NEXT'){ d--; if(!d) break; } } forStack.pop(); return { pc: k + 1 }; } return null; }
      case 'NEXT': { const f = forStack[forStack.length - 1]; if(!f) throw new Error('NEXT sem FOR'); vars[f.name] += f.step; if((f.step > 0 && vars[f.name] <= f.to) || (f.step < 0 && vars[f.name] >= f.to)) return { pc: f.pc + 1 }; forStack.pop(); return null; }
      case 'WHILE': { const c = ev(toks, st); if(c){ whileStack.push(pc); return null; } let d = 1, k = pc + 1; for(; k < prog.length; k++){ const w = bTok(prog[k].s)[0]; if(w && w.v === 'WHILE') d++; if(w && w.v === 'WEND'){ d--; if(!d) break; } } return { pc: k + 1 }; }
      case 'WEND': { const w = whileStack.pop(); return { pc: w }; }
      case 'DO': doStack.push(pc); return null;
      case 'LOOP': { const d = doStack[doStack.length - 1]; let again = true; if(toks[1] && toks[1].v === 'UNTIL'){ st.i = 2; again = !ev(toks, st); } else if(toks[1] && toks[1].v === 'WHILE'){ st.i = 2; again = !!ev(toks, st); } if(again) return { pc: d + 1 }; doStack.pop(); return null; }
      case 'DIM': { while(st.i < toks.length){ const nm = toks[st.i++].v; st.i++; const dims = []; for(;;){ dims.push(ev(toks, st) + 1); if(toks[st.i] && toks[st.i].v === ','){ st.i++; continue; } break; } st.i++; const mk = k => Array.from({ length: dims[k] }, () => k + 1 < dims.length ? mk(k + 1) : (nm.endsWith('$') ? '' : 0)); arrays[nm] = mk(0); if(toks[st.i] && toks[st.i].v === ',') st.i++; } return null; }
      case 'DELAY': case 'SLEEP': case 'PAUSE': { await HAL.delay(ev(toks, st)); return null; }
      case 'PINMODE': { const [p, m] = evList(toks, st); HAL.pinMode(p, m); return null; }
      case 'DWRITE': { const [p, v] = evList(toks, st); HAL.digitalWrite(p, v); return null; }
      case 'PWM': case 'AWRITE': { const [p, v] = evList(toks, st); HAL.analogWrite(p, v, 255); return null; }
      case 'TONE': { const [p, f, d] = evList(toks, st); HAL.tone(p, f, d); return null; }
      case 'NOTONE': { HAL.noTone(ev(toks, st)); return null; }
      case 'SERVO': { const [p, a] = evList(toks, st); HAL.servoWrite(p, a); return null; }
      case 'CLS': { G().fillScreen(toks.length > 1 ? ev(toks, st) : 0); return null; }
      case 'COLOR': { color = ev(toks, st); return null; }
      case 'SIZE': { tsize = ev(toks, st); G().setTextSize(tsize); return null; }
      case 'ROT': { G().setRotation(ev(toks, st)); return null; }
      case 'BACKLIGHT': { G().backlight(ev(toks, st)); return null; }
      case 'TEXT': { const a = evList(toks, st); G().setTextSize(tsize); G().setTextColor(a[3] !== undefined ? a[3] : color); G().setCursor(a[0], a[1]); G().print(String(a[2])); return null; }
      case 'PIXEL': { const a = evList(toks, st); G().drawPixel(a[0], a[1], a[2] !== undefined ? a[2] : color); return null; }
      case 'LINE': { const a = evList(toks, st); G().drawLine(a[0], a[1], a[2], a[3], a[4] !== undefined ? a[4] : color); return null; }
      case 'RECT': { const a = evList(toks, st); a[5] ? G().fillRect(a[0], a[1], a[2], a[3], a[4] !== undefined ? a[4] : color) : G().drawRect(a[0], a[1], a[2], a[3], a[4] !== undefined ? a[4] : color); return null; }
      case 'CIRCLE': { const a = evList(toks, st); a[4] ? G().fillCircle(a[0], a[1], a[2], a[3] !== undefined ? a[3] : color) : G().drawCircle(a[0], a[1], a[2], a[3] !== undefined ? a[3] : color); return null; }
      case 'INPUT': { const nm = toks[toks.length - 1].v; vars[nm] = nm.endsWith('$') ? '' : 0; return null; }
      case 'RANDOMIZE': return null;
      default: return execAssign(toks, { i: 0 });
    }
  }
  function execAssign(toks, st){
    const nameTok = toks[st.i]; if(!nameTok || nameTok.t !== 'w') throw new Error('instrução desconhecida: ' + (nameTok ? nameTok.v : ''));
    const name = nameTok.v; st.i++;
    let idxs = null;
    if(toks[st.i] && toks[st.i].v === '('){ st.i++; idxs = []; for(;;){ idxs.push(ev(toks, st)); if(toks[st.i] && toks[st.i].v === ','){ st.i++; continue; } break; } st.i++; }
    if(!(toks[st.i] && (toks[st.i].v === '=' || toks[st.i].v === ':='))) throw new Error('instrução desconhecida: ' + name);
    st.i++; assignVar(name, idxs, ev(toks, st)); return null;
  }
  let guard = 0, lastY = performance.now();
  while(pc < prog.length){
    if(!RUN.on) throw new PyStop();
    if(performance.now() - lastY > 12){ await new Promise(r => setTimeout(r, 0)); lastY = performance.now(); }
    const line = prog[pc];
    let r = null;
    // múltiplos comandos por linha separados por ':' (fora de strings)
    const parts = []; { let cur = '', q = false; for(const ch of line.s){ if(ch === '"') q = !q; if(ch === ':' && !q && !/^\s*(IF)\b/i.test(line.s)){ parts.push(cur); cur = ''; } else cur += ch; } parts.push(cur); }
    let jumped = false;
    for(const part of parts){
      try { r = await execStmt(part.trim(), line.line); }
      catch(e){ if(e instanceof PyStop) throw e; e.message = (e.message || String(e)); e.line = line.line; throw e; }
      if(r){ if(r.end){ pc = prog.length; jumped = true; break; } if(r.pc !== undefined){ pc = r.pc; jumped = true; break; } if(r.goto !== undefined){ const g = r.goto; let target = typeof g === 'number' ? numIdx[g] : labels[String(g).toUpperCase()]; if(target === undefined) throw berr('linha/rótulo não encontrado: ' + g, line.line); pc = target; jumped = true; break; } }
    }
    if(!jumped) pc++;
    if(++guard > 5e7) break;
  }
  HAL.flush();
};
})();
