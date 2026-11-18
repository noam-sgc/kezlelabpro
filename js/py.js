/* =========================================================================
   Kezle Lab Pro — Interpretador MicroPython (subconjunto amplo de Python 3)
   Suporta: kwargs, tuplas, dicts, sets, comprehensions, lambda, classes,
   try/except/finally, with, global/nonlocal, slices, f-strings, % e .format,
   operadores bit a bit, strings/listas/dicts com métodos reais.
   Substitui o interpretador simples anterior (pyTokenize/pyParse/ev/execStmt).
   ========================================================================= */
(function(){
'use strict';

class PyExc extends Error {
  constructor(type, msg, line){ super(type + ': ' + msg); this.pyType = type; this.pyMsg = msg; this.line = line; this.obj = null; }
}
class KW { constructor(o){ Object.assign(this, o); } }
const E = (t, m, l) => new PyExc(t, m, l);

/* ---------- tipos ---------- */
function tup(a){ Object.defineProperty(a, '_t', { value: true, enumerable: false }); return a; }
const isTup = v => Array.isArray(v) && v._t === true;

function nk(k){
  if(k === null || k === undefined) return 'N';
  if(typeof k === 'object') return 'o:' + pyRepr(k);
  if(typeof k === 'boolean') return 'n:' + (k ? 1 : 0);
  return (typeof k)[0] + ':' + k;
}
class PyDict {
  constructor(){ this.m = new Map(); }
  get(k){ const e = this.m.get(nk(k)); return e ? e[1] : undefined; }
  set(k, v){ this.m.set(nk(k), [k, v]); }
  has(k){ return this.m.has(nk(k)); }
  del(k){ return this.m.delete(nk(k)); }
  keys(){ return [...this.m.values()].map(e => e[0]); }
  vals(){ return [...this.m.values()].map(e => e[1]); }
  items(){ return [...this.m.values()].map(e => tup([e[0], e[1]])); }
  get size(){ return this.m.size; }
}
class PySet {
  constructor(it){ this.m = new Map(); if(it) for(const v of it) this.add(v); }
  add(v){ this.m.set(nk(v), v); }
  has(v){ return this.m.has(nk(v)); }
  vals(){ return [...this.m.values()]; }
  get size(){ return this.m.size; }
}
class PyClass {
  constructor(name, bases, ns){ this.name = name; this.bases = bases; this.ns = ns; }
  mro(){
    const out = [this];
    for(const b of this.bases) if(b instanceof PyClass) for(const c of b.mro()) if(!out.includes(c)) out.push(c);
    return out;
  }
  find(name, skip){
    const m = this.mro();
    for(let i = skip || 0; i < m.length; i++) if(m[i].ns.has(name)) return m[i].ns.get(name);
    return undefined;
  }
}
class PyObj { constructor(cls){ this.cls = cls; this.attrs = new Map(); } }
class PySuper { constructor(cls, self){ this.cls = cls; this.self = self; } }

/* ---------- exceções embutidas ---------- */
const EXC = {};
(function(){
  const mk = (n, base) => { EXC[n] = new PyClass(n, base ? [EXC[base]] : [], new Map()); };
  mk('BaseException'); mk('Exception', 'BaseException'); mk('KeyboardInterrupt', 'BaseException');
  mk('StopIteration', 'Exception'); mk('ArithmeticError', 'Exception'); mk('ZeroDivisionError', 'ArithmeticError');
  mk('LookupError', 'Exception'); mk('IndexError', 'LookupError'); mk('KeyError', 'LookupError');
  mk('ValueError', 'Exception'); mk('TypeError', 'Exception'); mk('NameError', 'Exception');
  mk('AttributeError', 'Exception'); mk('OSError', 'Exception'); mk('RuntimeError', 'Exception');
  mk('AssertionError', 'Exception'); mk('ImportError', 'Exception'); mk('NotImplementedError', 'RuntimeError');
  mk('MemoryError', 'Exception'); mk('OverflowError', 'ArithmeticError'); mk('SyntaxError', 'Exception');
})();
EXC.IOError = EXC.OSError; EXC.EOFError = EXC.Exception;

/* ---------- formatação ---------- */
function fmtNum(v){
  if(Number.isNaN(v)) return 'nan';
  if(v === Infinity) return 'inf';
  if(v === -Infinity) return '-inf';
  if(Number.isInteger(v)) return Math.abs(v) < 1e16 ? String(v) : v.toExponential().replace('e+', 'e+');
  let s = String(v);
  if(/e/.test(s)) s = s.replace(/e([+-])(\d)$/, 'e$10$2');
  return s;
}
function quote(s){
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  return q + s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(q === "'" ? /'/g : /"/g, '\\' + q) + q;
}
function pyRepr(v){
  if(v === null || v === undefined) return 'None';
  if(v === true) return 'True';
  if(v === false) return 'False';
  if(typeof v === 'number') return fmtNum(v);
  if(typeof v === 'string') return quote(v);
  if(isTup(v)) return '(' + v.map(pyRepr).join(', ') + (v.length === 1 ? ',)' : ')');
  if(Array.isArray(v)) return '[' + v.map(pyRepr).join(', ') + ']';
  if(v instanceof Uint8Array) return "b'" + [...v].map(c => c >= 32 && c < 127 ? String.fromCharCode(c) : '\\x' + c.toString(16).padStart(2, '0')).join('') + "'";
  if(v instanceof PyDict) return '{' + v.items().map(e => pyRepr(e[0]) + ': ' + pyRepr(e[1])).join(', ') + '}';
  if(v instanceof PySet) return v.size ? '{' + v.vals().map(pyRepr).join(', ') + '}' : 'set()';
  if(v instanceof PyClass) return "<class '" + v.name + "'>";
  if(v instanceof PyObj){
    const r = v.cls.find('__repr__');
    if(r && r.__sync) return r.__sync(v);
    return '<' + v.cls.name + ' object>';
  }
  if(v && v.__typeName) return "<class '" + v.__typeName + "'>";
  if(typeof v === 'function') return '<function ' + (v.__name || 'native') + '>';
  return '<object>';
}
function pyStr(v){
  if(typeof v === 'string') return v;
  if(v instanceof PyObj){
    const r = v.cls.find('__str__') || v.cls.find('__repr__');
    if(r && r.__sync) return r.__sync(v);
    if(v.cls.mro().some(c => c === EXC.BaseException)) return v.attrs.has('args') ? (v.attrs.get('args').length === 1 ? pyStr(v.attrs.get('args')[0]) : pyRepr(v.attrs.get('args'))) : '';
  }
  return pyRepr(v);
}
function truthy(v){
  if(v === null || v === undefined || v === false || v === 0 || v === '') return false;
  if(Array.isArray(v) || v instanceof Uint8Array) return v.length > 0;
  if(v instanceof PyDict || v instanceof PySet) return v.size > 0;
  if(typeof v === 'number' && Number.isNaN(v)) return true;
  return true;
}

function fmtSpec(v, spec){
  if(!spec) return pyStr(v);
  const m = spec.match(/^(?:(.)?([<>^=]))?([+\- ])?(#)?(0)?(\d+)?(,|_)?(?:\.(\d+))?([bcdeEfFgGnosxX%])?$/);
  if(!m) return pyStr(v);
  let [, fill, align, sign, alt, zero, width, grp, prec, type] = m;
  let s;
  if(type === undefined){
    if(typeof v === 'number') type = Number.isInteger(v) && prec === undefined ? 'd' : (prec !== undefined ? 'g' : 'r');
    else type = 's';
  }
  const n = typeof v === 'boolean' ? +v : v;
  switch(type){
    case 'd': case 'n': s = String(Math.trunc(+n)); break;
    case 'f': case 'F': s = (+n).toFixed(prec === undefined ? 6 : +prec); break;
    case 'e': case 'E': s = (+n).toExponential(prec === undefined ? 6 : +prec).replace(/e([+-])(\d)$/, 'e$10$2'); if(type === 'E') s = s.toUpperCase(); break;
    case 'g': case 'G': s = String(+(+n).toPrecision(prec === undefined ? 6 : Math.max(1, +prec))); break;
    case 'x': s = Math.trunc(n).toString(16); if(alt) s = '0x' + s; break;
    case 'X': s = Math.trunc(n).toString(16).toUpperCase(); if(alt) s = '0X' + s; break;
    case 'o': s = Math.trunc(n).toString(8); break;
    case 'b': s = Math.trunc(n).toString(2); if(alt) s = '0b' + s; break;
    case 'c': s = String.fromCharCode(n); break;
    case '%': s = ((+n) * 100).toFixed(prec === undefined ? 6 : +prec) + '%'; break;
    case 'r': s = fmtNum(+n); break;
    default: s = pyStr(v); if(prec !== undefined) s = s.slice(0, +prec);
  }
  if(grp && /^-?\d+/.test(s)) s = s.replace(/^(-?)(\d+)/, (a, sg, d) => sg + d.replace(/\B(?=(\d{3})+(?!\d))/g, grp));
  if(sign === '+' && typeof n === 'number' && n >= 0) s = '+' + s;
  else if(sign === ' ' && typeof n === 'number' && n >= 0) s = ' ' + s;
  if(width){
    const w = +width;
    if(zero && !align){ fill = '0'; align = '='; }
    fill = fill || ' ';
    if(!align) align = typeof v === 'number' ? '>' : '<';
    if(s.length < w){
      const pad = w - s.length;
      if(align === '<') s = s + fill.repeat(pad);
      else if(align === '>') s = fill.repeat(pad) + s;
      else if(align === '^') s = fill.repeat(Math.floor(pad / 2)) + s + fill.repeat(Math.ceil(pad / 2));
      else { const sg = /^[+\- ]/.test(s) ? s[0] : ''; s = sg + fill.repeat(pad) + s.slice(sg.length); }
    }
  }
  return s;
}

function pctFormat(fmt, args){
  const a = isTup(args) ? args : [args];
  let i = 0;
  return fmt.replace(/%(\([^)]*\))?([-+ 0#]*)(\d+|\*)?(?:\.(\d+))?([diouxXeEfFgGcrs%])/g, (all, key, flags, width, prec, t) => {
    if(t === '%') return '%';
    let v = key ? args.get(key.slice(1, -1)) : a[i++];
    let s;
    switch(t){
      case 'd': case 'i': case 'u': s = String(Math.trunc(+v)); break;
      case 'f': case 'F': s = (+v).toFixed(prec === undefined ? 6 : +prec); break;
      case 'e': case 'E': s = (+v).toExponential(prec === undefined ? 6 : +prec).replace(/e([+-])(\d)$/, 'e$10$2'); break;
      case 'g': case 'G': s = String(+(+v).toPrecision(prec === undefined ? 6 : +prec || 1)); break;
      case 'x': s = Math.trunc(v).toString(16); break;
      case 'X': s = Math.trunc(v).toString(16).toUpperCase(); break;
      case 'o': s = Math.trunc(v).toString(8); break;
      case 'c': s = typeof v === 'number' ? String.fromCharCode(v) : String(v); break;
      case 'r': s = pyRepr(v); break;
      default: s = pyStr(v); if(prec !== undefined) s = s.slice(0, +prec);
    }
    if(flags.includes('+') && typeof v === 'number' && v >= 0) s = '+' + s;
    if(width){
      const w = +width;
      if(s.length < w){
        if(flags.includes('-')) s = s.padEnd(w);
        else if(flags.includes('0') && 'diufFeEgGxXo'.includes(t)){ const sg = /^[+-]/.test(s) ? s[0] : ''; s = sg + s.slice(sg.length).padStart(w - sg.length, '0'); }
        else s = s.padStart(w);
      }
    }
    return s;
  });
}

/* ---------- tokenizador ---------- */
function tokenize(src){
  src = src.replace(/\r\n?/g, '\n');
  const toks = [];
  const indents = [0];
  let i = 0, line = 1, depth = 0, bol = true;
  const n = src.length;
  const push = (t, v, extra) => toks.push(Object.assign({ t, v, line }, extra));
  const OPS3 = ['**=', '//=', '>>=', '<<=', '...'];
  const OPS2 = ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '//', '<<', '>>', '->', ':='];

  while(i < n){
    if(bol && depth === 0){
      let j = i, col = 0;
      while(j < n && (src[j] === ' ' || src[j] === '\t')){ col += src[j] === '\t' ? 4 : 1; j++; }
      if(j >= n) break;
      if(src[j] === '\n'){ i = j + 1; line++; continue; }
      if(src[j] === '#'){ while(j < n && src[j] !== '\n') j++; i = j; continue; }
      i = j; bol = false;
      if(col > indents[indents.length - 1]){ indents.push(col); push('INDENT'); }
      else {
        while(col < indents[indents.length - 1]){ indents.pop(); push('DEDENT'); }
        if(col !== indents[indents.length - 1]) throw E('SyntaxError', 'indentação inconsistente', line);
      }
    }
    const c = src[i];
    if(c === '\n'){
      i++;
      if(depth === 0){ if(toks.length && toks[toks.length - 1].t !== 'NEWLINE') push('NEWLINE'); bol = true; }
      line++;
      continue;
    }
    if(c === ' ' || c === '\t'){ i++; continue; }
    if(c === '#'){ while(i < n && src[i] !== '\n') i++; continue; }
    if(c === '\\' && src[i + 1] === '\n'){ i += 2; line++; continue; }

    // strings
    let pm = src.slice(i, i + 3).match(/^([rRbBfFuU]{1,2})?(['"])/);
    if(pm && (!pm[1] || ['r','b','f','u','rb','br','fr','rf'].includes(pm[1].toLowerCase()))){
      const pre = (pm[1] || '').toLowerCase();
      i += (pm[1] || '').length;
      const q = src[i];
      const triple = src.substr(i, 3) === q + q + q;
      i += triple ? 3 : 1;
      let s = '';
      const raw = pre.includes('r');
      const startLine = line;
      for(;;){
        if(i >= n) throw E('SyntaxError', 'string não terminada', startLine);
        const ch = src[i];
        if(triple ? src.substr(i, 3) === q + q + q : ch === q){ i += triple ? 3 : 1; break; }
        if(ch === '\n'){ if(!triple) throw E('SyntaxError', 'string não terminada', line); line++; }
        if(ch === '\\' && i + 1 < n){
          const nx = src[i + 1];
          if(raw){ s += ch + nx; i += 2; if(nx === '\n') line++; continue; }
          i += 2;
          switch(nx){
            case 'n': s += '\n'; break; case 't': s += '\t'; break; case 'r': s += '\r'; break;
            case '0': s += '\0'; break; case '\\': s += '\\'; break; case "'": s += "'"; break; case '"': s += '"'; break;
            case 'a': s += '\x07'; break; case 'b': s += '\b'; break;
            case '\n': line++; break;
            case 'x': s += String.fromCharCode(parseInt(src.substr(i, 2), 16)); i += 2; break;
            case 'u': s += String.fromCharCode(parseInt(src.substr(i, 4), 16)); i += 4; break;
            default: s += '\\' + nx;
          }
          continue;
        }
        s += ch; i++;
      }
      push('STR', s, { f: pre.includes('f'), b: pre.includes('b'), raw: raw });
      continue;
    }
    if(/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))){
      const m = src.slice(i).match(/^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)/)[0];
      const clean = m.replace(/_/g, '');
      let v;
      if(/^0[xX]/.test(clean)) v = parseInt(clean, 16);
      else if(/^0[bB]/.test(clean)) v = parseInt(clean.slice(2), 2);
      else if(/^0[oO]/.test(clean)) v = parseInt(clean.slice(2), 8);
      else v = parseFloat(clean);
      push('NUM', v);
      i += m.length;
      continue;
    }
    if(/[A-Za-z_À-￿]/.test(c)){
      let j = i + 1;
      while(j < n && /[A-Za-z0-9_À-￿]/.test(src[j])) j++;
      push('NAME', src.slice(i, j));
      i = j;
      continue;
    }
    const s3 = src.substr(i, 3), s2 = src.substr(i, 2);
    if(OPS3.includes(s3)){ push('OP', s3); i += 3; continue; }
    if(OPS2.includes(s2)){ push('OP', s2); i += 2; continue; }
    if('+-*/%<>=()[]{},.:;@&|^~!'.includes(c)){
      if('([{'.includes(c)) depth++;
      else if(')]}'.includes(c)) depth = Math.max(0, depth - 1);
      push('OP', c); i++;
      continue;
    }
    throw E('SyntaxError', 'caractere inválido: ' + c, line);
  }
  if(toks.length && toks[toks.length - 1].t !== 'NEWLINE') push('NEWLINE');
  while(indents.length > 1){ indents.pop(); push('DEDENT'); }
  push('END');
  return toks;
}

/* ---------- parser ---------- */
function parse(toks){
  let p = 0;
  const peek = () => toks[p];
  const isOp = v => toks[p].t === 'OP' && toks[p].v === v;
  const isKw = v => toks[p].t === 'NAME' && toks[p].v === v;
  const err = (m, tk) => E('SyntaxError', m, (tk || toks[p]).line);
  function eat(t, v){
    const tk = toks[p];
    if(tk.t !== t || (v !== undefined && tk.v !== v)) throw err('esperava "' + (v || t) + '" mas veio "' + (tk.v != null ? tk.v : tk.t) + '"');
    p++; return tk;
  }
  const acceptOp = v => { if(isOp(v)){ p++; return true; } return false; };
  const acceptKw = v => { if(isKw(v)){ p++; return true; } return false; };

  const KEYWORDS = new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']);

  function block(){
    eat('OP', ':');
    if(peek().t !== 'NEWLINE'){ const st = simpleLine(); return st; }
    eat('NEWLINE'); eat('INDENT');
    const out = [];
    while(peek().t !== 'DEDENT' && peek().t !== 'END') out.push(...statement());
    if(peek().t === 'DEDENT') p++;
    return out;
  }
  function simpleLine(){
    const out = [];
    for(;;){
      out.push(simple());
      if(acceptOp(';')){ if(peek().t === 'NEWLINE') break; continue; }
      break;
    }
    if(peek().t === 'NEWLINE') p++;
    return out;
  }
  function statement(){
    const tk = peek();
    if(tk.t === 'NAME'){
      switch(tk.v){
        case 'if': return [ifStmt()];
        case 'while': { p++; const cond = expr(); const body = block(); let els = null; if(isKw('else')){ p++; els = block(); } return [{ t: 'while', cond, body, els, line: tk.line }]; }
        case 'for': { p++; const target = targetList(); eat('NAME', 'in'); const it = exprList(); const body = block(); let els = null; if(isKw('else')){ p++; els = block(); } return [{ t: 'for', target, it, body, els, line: tk.line }]; }
        case 'def': return [defStmt([])];
        case 'class': return [classStmt([])];
        case 'try': return [tryStmt()];
        case 'with': {
          p++;
          const items = [];
          do { const e = expr(); let tg = null; if(acceptKw('as')) tg = targetOne(); items.push([e, tg]); } while(acceptOp(','));
          return [{ t: 'with', items, body: block(), line: tk.line }];
        }
        case 'async': throw err('async não é suportado');
      }
    }
    if(isOp('@')){
      const decs = [];
      while(acceptOp('@')){ decs.push(expr()); eat('NEWLINE'); }
      if(isKw('def')) return [defStmt(decs)];
      if(isKw('class')) return [classStmt(decs)];
      throw err('decorador deve preceder def/class');
    }
    return simpleLine();
  }
  function ifStmt(){
    const tk = eat('NAME'); // if
    const cond = expr();
    const body = block();
    const elifs = [];
    let els = null;
    while(isKw('elif')){ p++; const c = expr(); elifs.push([c, block()]); }
    if(isKw('else')){ p++; els = block(); }
    return { t: 'if', cond, body, elifs, els, line: tk.line };
  }
  function params(end){
    const ps = [];
    while(!isOp(end)){
      if(acceptOp('**')){ ps.push({ name: eat('NAME').v, dstar: true }); }
      else if(acceptOp('*')){ if(peek().t === 'NAME') ps.push({ name: eat('NAME').v, star: true }); else ps.push({ name: null, star: true }); }
      else {
        const nm = eat('NAME').v;
        if(end === ')' && acceptOp(':')) expr(); // anotação
        let def = null;
        if(acceptOp('=')) def = expr();
        ps.push({ name: nm, def });
      }
      if(!acceptOp(',')) break;
    }
    return ps;
  }
  function defStmt(decs){
    const tk = eat('NAME', 'def');
    const name = eat('NAME').v;
    eat('OP', '(');
    const ps = params(')');
    eat('OP', ')');
    if(acceptOp('->')) expr();
    const body = block();
    return { t: 'def', name, params: ps, body, decs, line: tk.line };
  }
  function classStmt(decs){
    const tk = eat('NAME', 'class');
    const name = eat('NAME').v;
    const bases = [];
    if(acceptOp('(')){ while(!isOp(')')){ bases.push(expr()); if(!acceptOp(',')) break; } eat('OP', ')'); }
    return { t: 'class', name, bases, body: block(), decs, line: tk.line };
  }
  function tryStmt(){
    const tk = eat('NAME', 'try');
    const body = block();
    const handlers = [];
    let els = null, fin = null;
    while(isKw('except')){
      p++;
      let type = null, name = null;
      if(!isOp(':')){ type = expr(); if(acceptKw('as')) name = eat('NAME').v; }
      handlers.push({ type, name, body: block() });
    }
    if(isKw('else')){ p++; els = block(); }
    if(isKw('finally')){ p++; fin = block(); }
    if(!handlers.length && !fin) throw err('try sem except/finally', tk);
    return { t: 'try', body, handlers, els, fin, line: tk.line };
  }
  function simple(){
    const tk = peek();
    if(tk.t === 'NAME'){
      switch(tk.v){
        case 'pass': p++; return { t: 'pass', line: tk.line };
        case 'break': p++; return { t: 'break', line: tk.line };
        case 'continue': p++; return { t: 'continue', line: tk.line };
        case 'return': {
          p++;
          let v = null;
          if(peek().t !== 'NEWLINE' && !isOp(';') && peek().t !== 'END') v = exprList();
          return { t: 'return', v, line: tk.line };
        }
        case 'global': case 'nonlocal': {
          p++; const names = [];
          do { names.push(eat('NAME').v); } while(acceptOp(','));
          return { t: tk.v, names, line: tk.line };
        }
        case 'del': { p++; const ts = [targetOne()]; while(acceptOp(',')) ts.push(targetOne()); return { t: 'del', ts, line: tk.line }; }
        case 'assert': { p++; const c = expr(); let m = null; if(acceptOp(',')) m = expr(); return { t: 'assert', c, m, line: tk.line }; }
        case 'raise': {
          p++;
          let e = null, cause = null;
          if(peek().t !== 'NEWLINE' && !isOp(';')){ e = expr(); if(acceptKw('from')) cause = expr(); }
          return { t: 'raise', e, line: tk.line };
        }
        case 'import': {
          p++; const names = [];
          do {
            let m = eat('NAME').v;
            while(acceptOp('.')) m += '.' + eat('NAME').v;
            let al = null;
            if(acceptKw('as')) al = eat('NAME').v;
            names.push([m, al]);
          } while(acceptOp(','));
          return { t: 'import', names, line: tk.line };
        }
        case 'from': {
          p++;
          let m = '';
          while(isOp('.')){ p++; m += '.'; }
          if(peek().t === 'NAME' && !isKw('import')){ m += eat('NAME').v; while(acceptOp('.')) m += '.' + eat('NAME').v; }
          eat('NAME', 'import');
          if(acceptOp('*')) return { t: 'from', mod: m, names: '*', line: tk.line };
          const paren = acceptOp('(');
          const names = [];
          do {
            if(paren && isOp(')')) break;
            const nm = eat('NAME').v; let al = null;
            if(acceptKw('as')) al = eat('NAME').v;
            names.push([nm, al]);
          } while(acceptOp(','));
          if(paren) eat('OP', ')');
          return { t: 'from', mod: m, names, line: tk.line };
        }
        case 'yield': throw err('geradores (yield) ainda não são suportados');
      }
    }
    const first = exprList();
    if(isOp('=')){
      const targets = [first];
      let val;
      while(acceptOp('=')){ val = exprList(); if(isOp('=')) targets.push(val); }
      return { t: 'assign', targets, val, line: tk.line };
    }
    if(peek().t === 'OP' && ['+=', '-=', '*=', '/=', '//=', '%=', '**=', '&=', '|=', '^=', '<<=', '>>='].includes(peek().v)){
      const op = peek().v.slice(0, -1);
      p++;
      return { t: 'aug', target: first, op, val: exprList(), line: tk.line };
    }
    if(isOp(':') && first.t === 'name'){ p++; expr(); if(acceptOp('=')) return { t: 'assign', targets: [first], val: exprList(), line: tk.line }; return { t: 'pass', line: tk.line }; }
    return { t: 'expr', e: first, line: tk.line };
  }
  function targetOne(){ return postfix(); }
  function targetList(){
    const first = targetItem();
    if(!isOp(',')) return first;
    const items = [first];
    while(acceptOp(',')){ if(isKw('in')) break; items.push(targetItem()); }
    return { t: 'tuple', items };
  }
  function targetItem(){
    if(acceptOp('(')){ const t = targetList(); eat('OP', ')'); return t; }
    if(acceptOp('[')){ const t = targetList(); eat('OP', ']'); return t; }
    if(acceptOp('*')){ const t = postfix(); return { t: 'starred', v: t }; }
    return postfix();
  }

  /* expressões */
  function exprList(){
    const first = expr();
    if(!isOp(',')) return first;
    const items = [first];
    while(acceptOp(',')){
      if(peek().t === 'NEWLINE' || isOp(')') || isOp('=') || isOp(';') || peek().t === 'END') break;
      items.push(expr());
    }
    return { t: 'tuple', items };
  }
  function expr(){
    if(isKw('lambda')){
      const tk = peek(); p++;
      const ps = params(':');
      eat('OP', ':');
      const body = expr();
      return { t: 'lambda', params: ps, body, line: tk.line };
    }
    const c = orE();
    if(isKw('if')){
      p++; const cond = orE(); eat('NAME', 'else'); const b = expr();
      return { t: 'ternary', cond, a: c, b };
    }
    return c;
  }
  function orE(){ let l = andE(); while(isKw('or')){ p++; l = { t: 'or', a: l, b: andE() }; } return l; }
  function andE(){ let l = notE(); while(isKw('and')){ p++; l = { t: 'and', a: l, b: notE() }; } return l; }
  function notE(){ if(isKw('not')){ p++; return { t: 'not', a: notE() }; } return cmpE(); }
  function cmpE(){
    const l = bitOr();
    const ops = [];
    for(;;){
      const tk = peek();
      let op = null;
      if(tk.t === 'OP' && ['==', '!=', '<', '>', '<=', '>='].includes(tk.v)){ op = tk.v; p++; }
      else if(tk.t === 'NAME' && tk.v === 'in'){ op = 'in'; p++; }
      else if(tk.t === 'NAME' && tk.v === 'not' && toks[p + 1].t === 'NAME' && toks[p + 1].v === 'in'){ op = 'not in'; p += 2; }
      else if(tk.t === 'NAME' && tk.v === 'is'){ p++; if(isKw('not')){ p++; op = 'is not'; } else op = 'is'; }
      if(!op) break;
      ops.push([op, bitOr()]);
    }
    return ops.length ? { t: 'cmp', first: l, ops, line: peek().line } : l;
  }
  function bin(next, ops){
    return function(){
      let l = next();
      while(peek().t === 'OP' && ops.includes(peek().v)){ const op = peek().v; const line = peek().line; p++; l = { t: 'bin', op, a: l, b: next(), line }; }
      return l;
    };
  }
  const unary = () => {
    if(isOp('-')){ p++; return { t: 'neg', a: unary() }; }
    if(isOp('+')){ p++; return { t: 'pos', a: unary() }; }
    if(isOp('~')){ p++; return { t: 'inv', a: unary() }; }
    return power();
  };
  function power(){
    const b = postfix();
    if(isOp('**')){ const line = peek().line; p++; return { t: 'bin', op: '**', a: b, b: unary(), line }; }
    return b;
  }
  const term = bin(unary, ['*', '/', '//', '%', '@']);
  const arith = bin(term, ['+', '-']);
  const shift = bin(arith, ['<<', '>>']);
  const bitAnd = bin(shift, ['&']);
  const bitXor = bin(bitAnd, ['^']);
  var bitOr = bin(bitXor, ['|']);

  function postfix(){
    let e = atom();
    for(;;){
      const tk = peek();
      if(isOp('(')){
        p++;
        const args = [];
        while(!isOp(')')){
          if(acceptOp('**')) args.push({ v: expr(), dstar: true });
          else if(acceptOp('*')) args.push({ v: expr(), star: true });
          else if(peek().t === 'NAME' && toks[p + 1].t === 'OP' && toks[p + 1].v === '=' ){ const k = eat('NAME').v; p++; args.push({ k, v: expr() }); }
          else {
            const v = expr();
            if(isKw('for')){ args.push({ v: compFor({ t: 'listcomp', elt: v }) }); }
            else args.push({ v });
          }
          if(!acceptOp(',')) break;
        }
        eat('OP', ')');
        e = { t: 'call', fn: e, args, line: tk.line };
      } else if(isOp('.')){
        p++; const n = eat('NAME').v;
        e = { t: 'attr', obj: e, name: n, line: tk.line };
      } else if(isOp('[')){
        p++;
        const idx = sliceOrExpr();
        eat('OP', ']');
        e = { t: 'item', obj: e, idx, line: tk.line };
      } else break;
    }
    return e;
  }
  function sliceOrExpr(){
    const parts = [];
    let cur = null, colons = 0;
    const first = [];
    // parse a[i], a[i:j], a[i:j:k], a[i, j]
    const one = () => (isOp(':') || isOp(']') || isOp(',')) ? null : expr();
    let lo = one();
    if(isOp(':')){
      p++; colons = 1;
      const hi = one();
      let st = null;
      if(isOp(':')){ p++; st = one(); }
      return { t: 'slice', lo, hi, st };
    }
    if(isOp(',')){
      const items = [lo];
      while(acceptOp(',')){ if(isOp(']')) break; items.push(expr()); }
      return { t: 'tuple', items };
    }
    return lo;
  }
  function compFor(node){
    const gens = [];
    while(isKw('for')){
      p++;
      const target = targetList();
      eat('NAME', 'in');
      const it = orE();
      const ifs = [];
      while(isKw('if')){ p++; ifs.push(orE()); }
      gens.push({ target, it, ifs });
    }
    node.gens = gens;
    return node;
  }
  function fstring(s, line){
    const parts = [];
    let i = 0, lit = '';
    while(i < s.length){
      const c = s[i];
      if(c === '{'){
        if(s[i + 1] === '{'){ lit += '{'; i += 2; continue; }
        if(lit){ parts.push(lit); lit = ''; }
        let depth = 1, j = i + 1, q = null;
        while(j < s.length && depth){
          const ch = s[j];
          if(q){ if(ch === q) q = null; }
          else if(ch === '"' || ch === "'") q = ch;
          else if('{[('.includes(ch)) depth++;
          else if('}])'.includes(ch)) depth--;
          if(depth) j++;
        }
        let inner = s.slice(i + 1, j);
        let spec = null, conv = null;
        // separar !r e :spec no nível superior
        let d2 = 0, q2 = null, cut = -1;
        for(let k = 0; k < inner.length; k++){
          const ch = inner[k];
          if(q2){ if(ch === q2) q2 = null; continue; }
          if(ch === '"' || ch === "'"){ q2 = ch; continue; }
          if('([{'.includes(ch)) d2++;
          else if(')]}'.includes(ch)) d2--;
          else if(d2 === 0 && ch === ':'){ cut = k; break; }
          else if(d2 === 0 && ch === '!' && inner[k + 1] !== '='){ conv = inner[k + 1]; spec = inner.slice(k + 2); cut = -2; if(spec[0] === ':') spec = spec.slice(1); inner = inner.slice(0, k); break; }
        }
        if(cut >= 0){ spec = inner.slice(cut + 1); inner = inner.slice(0, cut); }
        let selfDoc = false;
        if(/=\s*$/.test(inner) && !/[=!<>]=\s*$/.test(inner)){ selfDoc = true; inner = inner.replace(/=\s*$/, ''); }
        const sub = parse(tokenize(inner.trim()));
        const ex = sub[0] && sub[0].t === 'expr' ? sub[0].e : null;
        if(!ex) throw E('SyntaxError', 'expressão inválida em f-string', line);
        const specParts = spec && spec.includes('{') ? fstring(spec, line) : spec;
        if(selfDoc) parts.push(inner.trim() + '=');
        parts.push({ t: 'fval', e: ex, spec: specParts, conv: conv || (selfDoc && !spec ? 'r' : null) });
        i = j + 1;
      } else if(c === '}'){ lit += '}'; i += s[i + 1] === '}' ? 2 : 1; }
      else { lit += c; i++; }
    }
    if(lit) parts.push(lit);
    return parts;
  }
  function atom(){
    const tk = peek();
    switch(tk.t){
      case 'NUM': p++; return { t: 'num', v: tk.v };
      case 'STR': {
        let node = null;
        const parts = [];
        let isB = false;
        while(peek().t === 'STR'){
          const t = toks[p++];
          if(t.f) parts.push(...fstring(t.v, t.line)); else parts.push(t.v);
          isB = isB || t.b;
        }
        if(isB) return { t: 'bytes', v: parts.join('') };
        if(parts.every(x => typeof x === 'string')) return { t: 'str', v: parts.join('') };
        return { t: 'fstr', parts };
      }
      case 'NAME': {
        if(tk.v === 'True'){ p++; return { t: 'const', v: true }; }
        if(tk.v === 'False'){ p++; return { t: 'const', v: false }; }
        if(tk.v === 'None'){ p++; return { t: 'const', v: null }; }
        if(KEYWORDS.has(tk.v)) throw err('sintaxe inválida perto de "' + tk.v + '"');
        p++; return { t: 'name', v: tk.v, line: tk.line };
      }
      case 'OP': {
        if(tk.v === '('){
          p++;
          if(acceptOp(')')) return { t: 'tuple', items: [] };
          const first = expr();
          if(isKw('for')){ const n = compFor({ t: 'listcomp', elt: first }); eat('OP', ')'); return n; }
          if(isOp(',')){
            const items = [first];
            while(acceptOp(',')){ if(isOp(')')) break; items.push(expr()); }
            eat('OP', ')');
            return { t: 'tuple', items };
          }
          eat('OP', ')');
          return first;
        }
        if(tk.v === '['){
          p++;
          const items = [];
          if(acceptOp(']')) return { t: 'list', items };
          const first = expr();
          if(isKw('for')){ const n = compFor({ t: 'listcomp', elt: first }); eat('OP', ']'); return n; }
          items.push(first);
          while(acceptOp(',')){ if(isOp(']')) break; items.push(expr()); }
          eat('OP', ']');
          return { t: 'list', items };
        }
        if(tk.v === '{'){
          p++;
          if(acceptOp('}')) return { t: 'dict', items: [] };
          const first = expr();
          if(acceptOp(':')){
            const v = expr();
            if(isKw('for')){ const n = compFor({ t: 'dictcomp', k: first, v }); eat('OP', '}'); return n; }
            const items = [[first, v]];
            while(acceptOp(',')){ if(isOp('}')) break; const k = expr(); eat('OP', ':'); items.push([k, expr()]); }
            eat('OP', '}');
            return { t: 'dict', items };
          }
          if(isKw('for')){ const n = compFor({ t: 'setcomp', elt: first }); eat('OP', '}'); return n; }
          const items = [first];
          while(acceptOp(',')){ if(isOp('}')) break; items.push(expr()); }
          eat('OP', '}');
          return { t: 'set', items };
        }
        if(tk.v === '...'){ p++; return { t: 'const', v: null }; }
      }
    }
    throw err('expressão inesperada: "' + (tk.v != null ? tk.v : tk.t) + '"');
  }

  const body = [];
  while(peek().t !== 'END'){
    if(peek().t === 'NEWLINE'){ p++; continue; }
    body.push(...statement());
  }
  return body;
}

/* ---------- escopos ---------- */
class Scope {
  constructor(parent, kind){ this.v = new Map(); this.parent = parent; this.kind = kind || 'fn'; this.glob = null; this.nonl = null; this.fn = null; this.root = parent ? parent.root : this; }
}
function lookupScope(sc, name){
  if(sc.glob && sc.glob.has(name)) return sc.root.v.has(name) ? sc.root : null;
  let s = sc, first = true;
  while(s){
    if((first || s.kind !== 'class') && s.v.has(name)) return s;
    first = false;
    s = s.parent;
  }
  return null;
}
function setVar(sc, name, val){
  if(sc.glob && sc.glob.has(name)){ sc.root.v.set(name, val); return; }
  if(sc.nonl && sc.nonl.has(name)){
    let s = sc.parent;
    while(s){ if(s.v.has(name) && s.kind !== 'class'){ s.v.set(name, val); return; } s = s.parent; }
  }
  sc.v.set(name, val);
}

/* ---------- utilidades de execução ---------- */
const BUILTIN = new Map();
let RT = null; // runtime atual

let _yieldCh = null, _yieldRes = null;
function fastYield(){
  if(typeof MessageChannel === 'undefined') return new Promise(r => setTimeout(r, 0));
  if(!_yieldCh){ _yieldCh = new MessageChannel(); _yieldCh.port1.onmessage = () => { const r = _yieldRes; _yieldRes = null; if(r) r(); }; }
  return new Promise(r => { _yieldRes = r; _yieldCh.port2.postMessage(0); });
}
let lastYield = 0;
async function maybeYield(){
  const t = performance.now();
  if(t - lastYield > 10){
    if(typeof RUN !== 'undefined' && !RUN.on) throw new PyStop();
    await new Promise(r => setTimeout(r, 0));
    lastYield = performance.now();
  }
}

function iterOf(v, line){
  if(Array.isArray(v)) return v;
  if(typeof v === 'string') return [...v];
  if(v instanceof PyDict) return v.keys();
  if(v instanceof PySet) return v.vals();
  if(v instanceof Uint8Array) return [...v];
  if(v && typeof v[Symbol.iterator] === 'function') return [...v];
  if(v instanceof PyObj){
    const it = v.cls.find('__iter__');
    if(it && it.__sync){ const r = it.__sync(v); return iterOf(r, line); }
  }
  throw E('TypeError', "objeto '" + typeName(v) + "' não é iterável", line);
}
function typeName(v){
  if(v === null || v === undefined) return 'NoneType';
  if(typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  if(typeof v === 'boolean') return 'bool';
  if(typeof v === 'string') return 'str';
  if(isTup(v)) return 'tuple';
  if(Array.isArray(v)) return 'list';
  if(v instanceof PyDict) return 'dict';
  if(v instanceof PySet) return 'set';
  if(v instanceof PyObj) return v.cls.name;
  if(v instanceof PyClass) return 'type';
  if(typeof v === 'function') return 'function';
  return 'object';
}

function eq(a, b){
  if(a === b) return true;
  if(a === null || b === null || a === undefined || b === undefined) return false;
  if(typeof a === 'boolean') a = +a;
  if(typeof b === 'boolean') b = +b;
  if(a === b) return true;
  if(Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => eq(x, b[i]));
  if(a instanceof PyDict && b instanceof PyDict) return a.size === b.size && a.keys().every(k => b.has(k) && eq(a.get(k), b.get(k)));
  if(a instanceof PyObj){ const f = a.cls.find('__eq__'); if(f && f.__sync) return truthy(f.__sync(a, b)); }
  return false;
}
function lt(a, b, line){
  if(typeof a === 'boolean') a = +a;
  if(typeof b === 'boolean') b = +b;
  if(typeof a === 'number' && typeof b === 'number') return a < b;
  if(typeof a === 'string' && typeof b === 'string') return a < b;
  if(Array.isArray(a) && Array.isArray(b)){
    for(let i = 0; i < Math.min(a.length, b.length); i++){
      if(eq(a[i], b[i])) continue;
      return lt(a[i], b[i], line);
    }
    return a.length < b.length;
  }
  throw E('TypeError', "'<' não suportado entre '" + typeName(a) + "' e '" + typeName(b) + "'", line);
}
function cmpOp(op, a, b, line){
  switch(op){
    case '==': return eq(a, b);
    case '!=': return !eq(a, b);
    case '<': return lt(a, b, line);
    case '>': return lt(b, a, line);
    case '<=': return lt(a, b, line) || eq(a, b);
    case '>=': return lt(b, a, line) || eq(a, b);
    case 'is': return a === b || (a == null && b == null);
    case 'is not': return !(a === b || (a == null && b == null));
    case 'in': return contains(b, a, line);
    case 'not in': return !contains(b, a, line);
  }
}
function contains(c, v, line){
  if(typeof c === 'string'){ if(typeof v !== 'string') throw E('TypeError', "'in <string>' requer string", line); return c.includes(v); }
  if(Array.isArray(c)) return c.some(x => eq(x, v));
  if(c instanceof PyDict || c instanceof PySet) return c.has(v);
  if(c instanceof Uint8Array) return c.includes(v);
  throw E('TypeError', "argumento de tipo '" + typeName(c) + "' não é iterável", line);
}
function binOp(op, a, b, line){
  if(typeof a === 'boolean') a = +a;
  if(typeof b === 'boolean') b = +b;
  switch(op){
    case '+':
      if(typeof a === 'number' && typeof b === 'number') return a + b;
      if(typeof a === 'string' && typeof b === 'string') return a + b;
      if(Array.isArray(a) && Array.isArray(b)){ const r = a.concat(b); return isTup(a) ? tup(r) : r; }
      if(a instanceof Uint8Array && b instanceof Uint8Array){ const r = new Uint8Array(a.length + b.length); r.set(a); r.set(b, a.length); return r; }
      if(a instanceof PyObj){ const f = a.cls.find('__add__'); if(f && f.__sync) return f.__sync(a, b); }
      throw E('TypeError', "tipos não suportados para +: '" + typeName(a) + "' e '" + typeName(b) + "'", line);
    case '-':
      if(typeof a === 'number' && typeof b === 'number') return a - b;
      if(a instanceof PySet && b instanceof PySet) return new PySet(a.vals().filter(x => !b.has(x)));
      throw E('TypeError', "tipos não suportados para -: '" + typeName(a) + "' e '" + typeName(b) + "'", line);
    case '*':
      if(typeof a === 'number' && typeof b === 'number') return a * b;
      if(typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, b | 0));
      if(typeof b === 'string' && typeof a === 'number') return b.repeat(Math.max(0, a | 0));
      if(Array.isArray(a) && typeof b === 'number'){ let r = []; for(let i = 0; i < b; i++) r = r.concat(a); return isTup(a) ? tup(r) : r; }
      if(Array.isArray(b) && typeof a === 'number') return binOp('*', b, a, line);
      throw E('TypeError', "tipos não suportados para *: '" + typeName(a) + "' e '" + typeName(b) + "'", line);
    case '/':
      if(typeof a !== 'number' || typeof b !== 'number') throw E('TypeError', "tipos não suportados para /", line);
      if(b === 0) throw E('ZeroDivisionError', 'division by zero', line);
      return a / b;
    case '//':
      if(b === 0) throw E('ZeroDivisionError', 'integer division or modulo by zero', line);
      return Math.floor(a / b);
    case '%':
      if(typeof a === 'string') return pctFormat(a, b);
      if(b === 0) throw E('ZeroDivisionError', 'integer division or modulo by zero', line);
      return ((a % b) + b) % b;
    case '**': return Math.pow(a, b);
    case '&': if(a instanceof PySet) return new PySet(a.vals().filter(x => b.has(x))); return Number(BigInt.asIntN(53, BigInt(Math.trunc(a)) & BigInt(Math.trunc(b)))) | 0 || (Math.trunc(a) & Math.trunc(b)) >>> 0;
    case '|': if(a instanceof PySet) return new PySet([...a.vals(), ...b.vals()]); return (Math.trunc(a) | Math.trunc(b)) >>> 0 > 0x7fffffff ? ((Math.trunc(a) | Math.trunc(b)) >>> 0) : (Math.trunc(a) | Math.trunc(b));
    case '^': return (Math.trunc(a) ^ Math.trunc(b));
    case '<<': return Math.trunc(a) * Math.pow(2, b);
    case '>>': return Math.floor(a / Math.pow(2, b));
    case '@': throw E('TypeError', 'operador @ não suportado', line);
  }
  throw E('SyntaxError', 'operador desconhecido ' + op, line);
}
// versões bit a bit seguras (inteiros de até 32 bits sem sinal + sinal)
function bitop(op, a, b){
  a = Math.trunc(a); b = Math.trunc(b);
  const big = Math.abs(a) > 0x7fffffff || Math.abs(b) > 0x7fffffff;
  if(!big){
    switch(op){ case '&': return a & b; case '|': return a | b; case '^': return a ^ b; }
  }
  const A = BigInt(a), B = BigInt(b);
  switch(op){ case '&': return Number(A & B); case '|': return Number(A | B); case '^': return Number(A ^ B); }
}
const _binOp = binOp;
binOp = function(op, a, b, line){
  if((op === '&' || op === '|' || op === '^') && typeof a === 'number' && typeof b === 'number') return bitop(op, a, b);
  return _binOp(op, a, b, line);
};

function getIndex(o, i, line){
  if(Array.isArray(o) || typeof o === 'string' || o instanceof Uint8Array){
    if(typeof i === 'boolean') i = +i;
    if(typeof i !== 'number') throw E('TypeError', 'índices devem ser inteiros', line);
    i = Math.trunc(i);
    if(i < 0) i += o.length;
    if(i < 0 || i >= o.length) throw E('IndexError', (typeof o === 'string' ? 'string' : Array.isArray(o) ? (isTup(o) ? 'tuple' : 'list') : 'bytes') + ' index out of range', line);
    return o[i];
  }
  if(o instanceof PyDict){
    if(!o.has(i)) throw mkKeyErr(i, line);
    return o.get(i);
  }
  if(o instanceof PyObj){
    const f = o.cls.find('__getitem__');
    if(f && f.__sync) return f.__sync(o, i);
  }
  if(o && typeof o === 'object' && i in o) return o[i];
  throw E('TypeError', "'" + typeName(o) + "' não suporta indexação", line);
}
function mkKeyErr(k, line){ const e = E('KeyError', pyRepr(k), line); return e; }
function doSlice(o, s, line){
  const len = o.length;
  const st = s.st == null ? 1 : s.st;
  if(st === 0) throw E('ValueError', 'slice step não pode ser zero', line);
  let lo = s.lo, hi = s.hi;
  const norm = (v, def) => { if(v == null) return def; v = Math.trunc(v); if(v < 0) v += len; return v; };
  let out = [];
  if(st > 0){
    lo = clamp(norm(lo, 0), 0, len); hi = clamp(norm(hi, len), 0, len);
    for(let i = lo; i < hi; i += st) out.push(o[i]);
  } else {
    lo = norm(lo, len - 1); hi = s.hi == null ? -1 : norm(hi, -1);
    lo = Math.min(lo, len - 1);
    for(let i = lo; i > hi; i += st) out.push(o[i]);
  }
  if(typeof o === 'string') return out.join('');
  if(o instanceof Uint8Array) return Uint8Array.from(out);
  return isTup(o) ? tup(out) : out;
}

/* ---------- métodos de tipos nativos ---------- */
const NO_KW = a => a;
function splitKw(args){
  if(args.length && args[args.length - 1] instanceof KW) return [args.slice(0, -1), args[args.length - 1]];
  return [args, {}];
}
const STR_M = {
  upper: s => s.toUpperCase(), lower: s => s.toLowerCase(), title: s => s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  capitalize: s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s, swapcase: s => [...s].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''),
  strip: (s, c) => c == null ? s.trim() : s.replace(new RegExp('^[' + escRe(c) + ']+|[' + escRe(c) + ']+$', 'g'), ''),
  lstrip: (s, c) => c == null ? s.trimStart() : s.replace(new RegExp('^[' + escRe(c) + ']+'), ''),
  rstrip: (s, c) => c == null ? s.trimEnd() : s.replace(new RegExp('[' + escRe(c) + ']+$'), ''),
  split: (s, sep, mx) => {
    if(sep && typeof sep === 'object') sep = sep.sep;
    if(sep == null) return s.trim() === '' ? [] : s.trim().split(/\s+/);
    const parts = s.split(sep);
    if(mx != null && mx >= 0 && parts.length > mx + 1) return parts.slice(0, mx).concat(parts.slice(mx).join(sep));
    return parts;
  },
  rsplit: (s, sep, mx) => { const parts = STR_M.split(s, sep); if(mx != null && mx >= 0 && parts.length > mx + 1) return [parts.slice(0, parts.length - mx).join(sep)].concat(parts.slice(parts.length - mx)); return parts; },
  splitlines: s => s.split(/\r?\n/), join: (s, it) => iterOf(it).map(x => { if(typeof x !== 'string') throw E('TypeError', 'join espera strings'); return x; }).join(s),
  replace: (s, a, b, n) => n == null || n < 0 ? s.split(a).join(b) : (() => { let out = s, c = 0, r = ''; let i; while(c < n && (i = out.indexOf(a)) >= 0){ r += out.slice(0, i) + b; out = out.slice(i + a.length); c++; } return r + out; })(),
  startswith: (s, p) => Array.isArray(p) ? p.some(x => s.startsWith(x)) : s.startsWith(p),
  endswith: (s, p) => Array.isArray(p) ? p.some(x => s.endsWith(x)) : s.endsWith(p),
  find: (s, x, a) => s.indexOf(x, a || 0), rfind: (s, x) => s.lastIndexOf(x),
  index: (s, x) => { const i = s.indexOf(x); if(i < 0) throw E('ValueError', 'substring not found'); return i; },
  count: (s, x) => x === '' ? s.length + 1 : s.split(x).length - 1,
  isdigit: s => /^\d+$/.test(s), isalpha: s => /^[A-Za-zÀ-￿]+$/.test(s), isalnum: s => /^[A-Za-z0-9À-￿]+$/.test(s),
  isspace: s => /^\s+$/.test(s), isupper: s => s !== s.toLowerCase() && s === s.toUpperCase(), islower: s => s !== s.toUpperCase() && s === s.toLowerCase(),
  zfill: (s, w) => { const sg = /^[+-]/.test(s) ? s[0] : ''; return sg + s.slice(sg.length).padStart(w - sg.length, '0'); },
  ljust: (s, w, c) => s.padEnd(w, c || ' '), rjust: (s, w, c) => s.padStart(w, c || ' '),
  center: (s, w, c) => { c = c || ' '; const pad = Math.max(0, w - s.length); return c.repeat(Math.floor(pad / 2)) + s + c.repeat(Math.ceil(pad / 2)); },
  format: (s, ...a) => strFormat(s, a),
  encode: s => Uint8Array.from([...unescape(encodeURIComponent(s))].map(c => c.charCodeAt(0))),
  partition: (s, sep) => { const i = s.indexOf(sep); return tup(i < 0 ? [s, '', ''] : [s.slice(0, i), sep, s.slice(i + sep.length)]); },
  expandtabs: s => s.replace(/\t/g, '    ')
};
function escRe(s){ return s.replace(/[\\\]\[^-]/g, '\\$&'); }
function strFormat(s, args){
  const [pos, kw] = splitKw(args);
  let auto = 0;
  return s.replace(/\{\{|\}\}|\{([^{}!:]*)(?:!([rs]))?(?::([^{}]*))?\}/g, (all, key, conv, spec) => {
    if(all === '{{') return '{';
    if(all === '}}') return '}';
    let v;
    if(key === '' || key === undefined) v = pos[auto++];
    else {
      const parts = key.split(/[.\[]/);
      const base = parts[0];
      v = /^\d+$/.test(base) ? pos[+base] : kw[base];
      let rest = key.slice(base.length);
      const am = rest.matchAll(/\.(\w+)|\[(\w+)\]/g);
      for(const m of am) v = m[1] ? (v instanceof PyObj ? v.attrs.get(m[1]) : v[m[1]]) : getIndex(v, /^\d+$/.test(m[2]) ? +m[2] : m[2]);
    }
    if(conv === 'r') v = pyRepr(v);
    return fmtSpec(v, spec);
  });
}
const LIST_M = {
  append: (l, x) => { l.push(x); return null; }, extend: (l, it) => { l.push(...iterOf(it)); return null; },
  pop: (l, i) => { if(!l.length) throw E('IndexError', 'pop from empty list'); if(i == null) return l.pop(); if(i < 0) i += l.length; if(i < 0 || i >= l.length) throw E('IndexError', 'pop index out of range'); return l.splice(i, 1)[0]; },
  insert: (l, i, x) => { if(i < 0) i = Math.max(0, i + l.length); l.splice(i, 0, x); return null; },
  remove: (l, x) => { const i = l.findIndex(y => eq(x, y)); if(i < 0) throw E('ValueError', 'list.remove(x): x not in list'); l.splice(i, 1); return null; },
  index: (l, x) => { const i = l.findIndex(y => eq(x, y)); if(i < 0) throw E('ValueError', pyRepr(x) + ' is not in list'); return i; },
  count: (l, x) => l.filter(y => eq(x, y)).length, reverse: l => { l.reverse(); return null; },
  copy: l => l.slice(), clear: l => { l.length = 0; return null; },
  sort: null // tratado em callMethod (precisa key/reverse e pode ser assíncrono)
};
const DICT_M = {
  get: (d, k, def) => d.has(k) ? d.get(k) : (def === undefined ? null : def),
  keys: d => d.keys(), values: d => d.vals(), items: d => d.items(),
  pop: (d, k, def) => { if(d.has(k)){ const v = d.get(k); d.del(k); return v; } if(def !== undefined) return def; throw mkKeyErr(k); },
  popitem: d => { const it = d.items(); if(!it.length) throw E('KeyError', 'popitem(): dictionary is empty'); const e = it[it.length - 1]; d.del(e[0]); return e; },
  setdefault: (d, k, def) => { if(!d.has(k)) d.set(k, def === undefined ? null : def); return d.get(k); },
  update: (d, o) => { if(o instanceof PyDict) for(const [k, v] of o.items()) d.set(k, v); else if(o instanceof KW) for(const k in o) d.set(k, o[k]); else for(const e of iterOf(o)) d.set(e[0], e[1]); return null; },
  clear: d => { d.m.clear(); return null; }, copy: d => { const n = new PyDict(); for(const [k, v] of d.items()) n.set(k, v); return n; }
};
const SET_M = {
  add: (s, v) => { s.add(v); return null; }, remove: (s, v) => { if(!s.has(v)) throw mkKeyErr(v); s.m.delete(nk(v)); return null; },
  discard: (s, v) => { s.m.delete(nk(v)); return null; }, pop: s => { const v = s.vals()[0]; s.m.delete(nk(v)); return v; },
  union: (s, o) => new PySet([...s.vals(), ...iterOf(o)]), intersection: (s, o) => { const t = new PySet(iterOf(o)); return new PySet(s.vals().filter(x => t.has(x))); },
  difference: (s, o) => { const t = new PySet(iterOf(o)); return new PySet(s.vals().filter(x => !t.has(x))); },
  update: (s, o) => { for(const v of iterOf(o)) s.add(v); return null; }, clear: s => { s.m.clear(); return null; }, copy: s => new PySet(s.vals()),
  issubset: (s, o) => { const t = new PySet(iterOf(o)); return s.vals().every(x => t.has(x)); }
};
const BYTES_M = {
  decode: b => decodeURIComponent(escape(String.fromCharCode(...b))), hex: b => [...b].map(c => c.toString(16).padStart(2, '0')).join(''),
  append: (b, x) => { throw E('TypeError', 'bytearray literal de tamanho fixo'); }
};
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

/* ---------- avaliador ---------- */
async function ev(n, sc){
  switch(n.t){
    case 'num': case 'const': return n.v;
    case 'str': return n.v;
    case 'bytes': return Uint8Array.from([...n.v].map(c => c.charCodeAt(0) & 255));
    case 'fstr': {
      let out = '';
      for(const part of n.parts){
        if(typeof part === 'string'){ out += part; continue; }
        let v = await ev(part.e, sc);
        if(part.conv === 'r') v = pyRepr(v);
        else if(part.conv === 's') v = pyStr(v);
        let spec = part.spec;
        if(Array.isArray(spec)){ spec = await evParts(spec, sc); }
        out += fmtSpec(v, spec);
      }
      return out;
    }
    case 'name': {
      const s = lookupScope(sc, n.v);
      if(s) return s.v.get(n.v);
      if(BUILTIN.has(n.v)) return BUILTIN.get(n.v);
      throw E('NameError', "name '" + n.v + "' isn't defined", n.line);
    }
    case 'list': { const a = []; for(const it of n.items){ if(it.t === 'starred') a.push(...iterOf(await ev(it.v, sc))); else a.push(await ev(it, sc)); } return a; }
    case 'tuple': { const a = []; for(const it of n.items){ if(it.t === 'starred') a.push(...iterOf(await ev(it.v, sc))); else a.push(await ev(it, sc)); } return tup(a); }
    case 'set': { const s = new PySet(); for(const it of n.items) s.add(await ev(it, sc)); return s; }
    case 'dict': {
      const d = new PyDict();
      for(const [k, v] of n.items){ if(k.t === 'dstar'){ continue; } d.set(await ev(k, sc), await ev(v, sc)); }
      return d;
    }
    case 'listcomp': case 'setcomp': case 'dictcomp': {
      const inner = new Scope(sc, 'comp');
      inner.root = sc.root;
      const out = n.t === 'dictcomp' ? new PyDict() : [];
      const loop = async (gi) => {
        if(gi === n.gens.length){
          if(n.t === 'dictcomp') out.set(await ev(n.k, inner), await ev(n.v, inner));
          else out.push(await ev(n.elt, inner));
          return;
        }
        const g = n.gens[gi];
        const seq = iterOf(await ev(g.it, gi === 0 ? sc : inner), n.line);
        for(const item of seq){
          await assignTarget(g.target, item, inner);
          let ok = true;
          for(const c of g.ifs){ if(!truthy(await ev(c, inner))){ ok = false; break; } }
          if(ok) await loop(gi + 1);
        }
        await maybeYield();
      };
      await loop(0);
      if(n.t === 'setcomp') return new PySet(out);
      return out;
    }
    case 'neg': { const v = await ev(n.a, sc); if(typeof v === 'boolean') return -(+v); if(v instanceof PyObj){ const f = v.cls.find('__neg__'); if(f) return callFn(f, [v]); } return -v; }
    case 'pos': return +(await ev(n.a, sc));
    case 'inv': return ~Math.trunc(await ev(n.a, sc));
    case 'not': return !truthy(await ev(n.a, sc));
    case 'and': { const a = await ev(n.a, sc); return truthy(a) ? ev(n.b, sc) : a; }
    case 'or': { const a = await ev(n.a, sc); return truthy(a) ? a : ev(n.b, sc); }
    case 'ternary': return truthy(await ev(n.cond, sc)) ? ev(n.a, sc) : ev(n.b, sc);
    case 'bin': {
      const a = await ev(n.a, sc), b = await ev(n.b, sc);
      if(a instanceof PyObj){
        const nm = { '+': '__add__', '-': '__sub__', '*': '__mul__', '/': '__truediv__' }[n.op];
        const f = nm && a.cls.find(nm);
        if(f) return callFn(f, [a, b], null, n.line);
      }
      return binOp(n.op, a, b, n.line);
    }
    case 'cmp': {
      let left = await ev(n.first, sc);
      for(const [op, e] of n.ops){
        const right = await ev(e, sc);
        if(!cmpOp(op, left, right, n.line)) return false;
        left = right;
      }
      return true;
    }
    case 'lambda': return makeFn({ name: '<lambda>', params: n.params, body: [{ t: 'return', v: n.body, line: n.line }], line: n.line }, sc);
    case 'attr': return getAttr(await ev(n.obj, sc), n.name, n.line);
    case 'item': {
      const o = await ev(n.obj, sc);
      if(n.idx.t === 'slice'){
        const s = { lo: n.idx.lo ? await ev(n.idx.lo, sc) : null, hi: n.idx.hi ? await ev(n.idx.hi, sc) : null, st: n.idx.st ? await ev(n.idx.st, sc) : null };
        if(!(Array.isArray(o) || typeof o === 'string' || o instanceof Uint8Array)) throw E('TypeError', 'objeto não suporta slice', n.line);
        return doSlice(o, s, n.line);
      }
      return getIndex(o, await ev(n.idx, sc), n.line);
    }
    case 'call': return evCall(n, sc);
    case 'starred': return ev(n.v, sc);
  }
  throw E('SyntaxError', 'nó desconhecido: ' + n.t, n.line);
}
async function evParts(parts, sc){
  let out = '';
  for(const part of parts){
    if(typeof part === 'string'){ out += part; continue; }
    let v = await ev(part.e, sc);
    out += fmtSpec(v, part.spec);
  }
  return out;
}

async function evCall(n, sc){
  // super()
  if(n.fn.t === 'name' && n.fn.v === 'super' && !lookupScope(sc, 'super')){
    let s = sc; while(s && !s.fnCls) s = s.parent;
    if(!s) throw E('RuntimeError', 'super(): sem classe', n.line);
    return new PySuper(s.fnCls, s.fnSelf);
  }
  let fnObj = null, fn;
  if(n.fn.t === 'attr'){
    fnObj = await ev(n.fn.obj, sc);
    // métodos nativos de str/list/dict etc.
    const r = await nativeMethodCall(fnObj, n.fn.name, n, sc);
    if(r !== NOT_NATIVE) return r;
    fn = getAttr(fnObj, n.fn.name, n.fn.line);
  } else fn = await ev(n.fn, sc);
  const args = [];
  let kw = null;
  for(const a of n.args){
    if(a.star) args.push(...iterOf(await ev(a.v, sc), n.line));
    else if(a.dstar){ const d = await ev(a.v, sc); kw = kw || {}; if(d instanceof PyDict) for(const [k, v] of d.items()) kw[k] = v; }
    else if(a.k !== undefined){ kw = kw || {}; kw[a.k] = await ev(a.v, sc); }
    else args.push(await ev(a.v, sc));
  }
  return callFn(fn, args, kw, n.line, fnObj);
}

const NOT_NATIVE = Symbol('nn');
async function nativeMethodCall(o, name, n, sc){
  let tbl = null;
  if(typeof o === 'string') tbl = STR_M;
  else if(Array.isArray(o)) tbl = LIST_M;
  else if(o instanceof PyDict) tbl = DICT_M;
  else if(o instanceof PySet) tbl = SET_M;
  else if(o instanceof Uint8Array) tbl = BYTES_M;
  else return NOT_NATIVE;
  if(Array.isArray(o) && isTup(o) && !['index', 'count'].includes(name)) throw E('AttributeError', "'tuple' object has no attribute '" + name + "'", n.line);
  if(!(name in tbl) && !(Array.isArray(o) && name === 'sort')) throw E('AttributeError', "'" + typeName(o) + "' object has no attribute '" + name + "'", n.line);
  const args = [];
  let kw = null;
  for(const a of n.args){
    if(a.star) args.push(...iterOf(await ev(a.v, sc)));
    else if(a.k !== undefined){ kw = kw || {}; kw[a.k] = await ev(a.v, sc); }
    else args.push(await ev(a.v, sc));
  }
  if(name === 'sort' && Array.isArray(o)){
    await sortList(o, kw && kw.key, kw && truthy(kw.reverse));
    return null;
  }
  if(typeof o === 'string' && name === 'format'){ return strFormat(o, kw ? args.concat([new KW(kw)]) : args); }
  if(typeof o === 'string' && (name === 'split' || name === 'rsplit') && kw){ return STR_M[name](o, kw.sep !== undefined ? kw.sep : args[0], kw.maxsplit !== undefined ? kw.maxsplit : args[1]); }
  try { return tbl[name](o, ...args); }
  catch(e){ if(e instanceof PyExc && !e.line) e.line = n.line; throw e; }
}
async function sortList(arr, key, rev){
  const keys = [];
  for(const x of arr) keys.push(key ? await callFn(key, [x]) : x);
  const idx = arr.map((_, i) => i);
  idx.sort((a, b) => lt(keys[a], keys[b]) ? -1 : lt(keys[b], keys[a]) ? 1 : a - b);
  if(rev) idx.reverse();
  const copy = arr.slice();
  for(let i = 0; i < idx.length; i++) arr[i] = copy[idx[i]];
}

async function callFn(fn, args, kw, line, thisObj){
  if(typeof fn === 'function'){
    if(fn.__def) return callUser(fn, args, kw, line);
    const a = kw ? args.concat([new KW(kw)]) : args;
    try { return await fn.apply(thisObj, a); }
    catch(e){ if(e instanceof PyExc && !e.line) e.line = line; throw e; }
  }
  if(fn instanceof PyClass){
    if(EXC[fn.name] === fn || fn.mro().includes(EXC.BaseException)){
      const o = new PyObj(fn);
      o.attrs.set('args', tup(args.slice()));
      const init = fn.find('__init__');
      if(init) await callUser(init, [o, ...args], kw, line);
      return o;
    }
    const o = new PyObj(fn);
    const init = fn.find('__init__');
    if(init) await callUser(init, [o, ...args], kw, line);
    return o;
  }
  if(fn instanceof PyObj){
    const c = fn.cls.find('__call__');
    if(c) return callUser(c, [fn, ...args], kw, line);
  }
  throw E('TypeError', "'" + typeName(fn) + "' objeto não é chamável", line);
}

function makeFn(def, closure){
  let cl = closure;
  while(cl && cl.kind === 'class') cl = cl.parent;
  const f = async function(...args){
    const last = args[args.length - 1];
    if(last instanceof KW) return callUser(f, args.slice(0, -1), Object.assign({}, last));
    return callUser(f, args);
  };
  f.__def = def; f.__clo = cl || closure; f.__name = def.name;
  // versão síncrona para dunder (apenas corpos triviais)
  f.__sync = function(...args){ return syncCall(f, args); };
  return f;
}

async function callUser(f, args, kw, line){
  const def = f.__def;
  const sc = new Scope(f.__clo, 'fn');
  if(f.__self !== undefined) args = [f.__self, ...args];
  if(f.__cls){ sc.fnCls = f.__cls; sc.fnSelf = args[0]; }
  const ps = def.params;
  let ai = 0;
  let starName = null, dstarName = null;
  const named = new Set();
  for(const p of ps){
    if(p.dstar){ dstarName = p.name; continue; }
    if(p.star){ if(p.name){ starName = p.name; sc.v.set(p.name, tup(args.slice(ai))); } ai = args.length; continue; }
    named.add(p.name);
    if(ai < args.length){ sc.v.set(p.name, args[ai++]); }
    else if(kw && p.name in kw){ sc.v.set(p.name, kw[p.name]); }
    else if(p.def){
      if(!('_dv' in p)) p._dv = await ev(p.def, f.__clo);
      sc.v.set(p.name, p._dv);
    } else throw E('TypeError', def.name + "() faltando argumento '" + p.name + "'", line);
  }
  if(ai < args.length && !starName) throw E('TypeError', def.name + '() recebeu ' + args.length + ' argumentos posicionais (aceita ' + ps.filter(p => !p.star && !p.dstar).length + ')', line);
  if(kw){
    const rest = new PyDict();
    for(const k in kw){ if(named.has(k)) continue; if(dstarName) rest.set(k, kw[k]); else throw E('TypeError', def.name + "() argumento inesperado '" + k + "'", line); }
    if(dstarName) sc.v.set(dstarName, rest);
  } else if(dstarName) sc.v.set(dstarName, new PyDict());
  if(++RT.depth > 120){ RT.depth--; throw E('RuntimeError', 'maximum recursion depth exceeded', line); }
  try {
    const r = await execBlock(def.body, sc);
    return r && r.k === 'ret' ? r.v : null;
  } finally { RT.depth--; }
}

// execução síncrona (usada em __str__, __repr__, __eq__ etc.) — roda o corpo via promise "resolvida" não é possível;
// por isso avaliamos de forma síncrona apenas expressões simples.
function syncCall(f, args){
  const def = f.__def;
  const sc = new Scope(f.__clo, 'fn');
  if(f.__cls){ sc.fnCls = f.__cls; sc.fnSelf = args[0]; }
  def.params.forEach((p, i) => { if(!p.star && !p.dstar) sc.v.set(p.name, args[i]); });
  const r = execSync(def.body, sc);
  return r && r.k === 'ret' ? r.v : null;
}
// avaliador síncrono mínimo (suficiente para __str__/__repr__/__eq__/__getitem__/__len__)
function execSync(body, sc){
  for(const s of body){
    if(s.t === 'return') return { k: 'ret', v: s.v ? evSync(s.v, sc) : null };
    if(s.t === 'expr') { evSync(s.e, sc); continue; }
    if(s.t === 'assign'){ const v = evSync(s.val, sc); for(const t of s.targets) assignSync(t, v, sc); continue; }
    if(s.t === 'if'){
      if(truthy(evSync(s.cond, sc))){ const r = execSync(s.body, sc); if(r) return r; }
      else {
        let done = false;
        for(const [c, b] of s.elifs){ if(truthy(evSync(c, sc))){ const r = execSync(b, sc); if(r) return r; done = true; break; } }
        if(!done && s.els){ const r = execSync(s.els, sc); if(r) return r; }
      }
      continue;
    }
    if(s.t === 'pass') continue;
    throw E('RuntimeError', 'instrução não suportada em método especial: ' + s.t, s.line);
  }
  return null;
}
function assignSync(t, v, sc){
  if(t.t === 'name') setVar(sc, t.v, v);
  else if(t.t === 'attr'){ const o = evSync(t.obj, sc); if(o instanceof PyObj) o.attrs.set(t.name, v); else o[t.name] = v; }
  else throw E('RuntimeError', 'atribuição não suportada em método especial');
}
function evSync(n, sc){
  switch(n.t){
    case 'num': case 'const': case 'str': return n.v;
    case 'name': { const s = lookupScope(sc, n.v); if(s) return s.v.get(n.v); if(BUILTIN.has(n.v)) return BUILTIN.get(n.v); throw E('NameError', "name '" + n.v + "' isn't defined", n.line); }
    case 'attr': return getAttr(evSync(n.obj, sc), n.name, n.line);
    case 'bin': return binOp(n.op, evSync(n.a, sc), evSync(n.b, sc), n.line);
    case 'cmp': { let l = evSync(n.first, sc); for(const [op, e] of n.ops){ const r = evSync(e, sc); if(!cmpOp(op, l, r, n.line)) return false; l = r; } return true; }
    case 'and': { const a = evSync(n.a, sc); return truthy(a) ? evSync(n.b, sc) : a; }
    case 'or': { const a = evSync(n.a, sc); return truthy(a) ? a : evSync(n.b, sc); }
    case 'not': return !truthy(evSync(n.a, sc));
    case 'neg': return -evSync(n.a, sc);
    case 'item': return getIndex(evSync(n.obj, sc), evSync(n.idx, sc), n.line);
    case 'tuple': return tup(n.items.map(i => evSync(i, sc)));
    case 'list': return n.items.map(i => evSync(i, sc));
    case 'ternary': return truthy(evSync(n.cond, sc)) ? evSync(n.a, sc) : evSync(n.b, sc);
    case 'fstr': return n.parts.map(p => typeof p === 'string' ? p : fmtSpec(p.conv === 'r' ? pyRepr(evSync(p.e, sc)) : evSync(p.e, sc), typeof p.spec === 'string' ? p.spec : null)).join('');
    case 'call': {
      const fn = evSync(n.fn, sc);
      const args = n.args.map(a => evSync(a.v, sc));
      if(typeof fn === 'function' && !fn.__def){ const r = fn(...args); return r; }
      if(typeof fn === 'function' && fn.__def) return fn.__sync(...args);
      throw E('TypeError', 'chamada não suportada em método especial');
    }
  }
  throw E('RuntimeError', 'expressão não suportada em método especial: ' + n.t, n.line);
}

function getAttr(o, name, line){
  if(o === null || o === undefined) throw E('AttributeError', "'NoneType' object has no attribute '" + name + "'", line);
  if(o instanceof PyObj){
    if(o.attrs.has(name)) return o.attrs.get(name);
    const v = o.cls.find(name);
    if(v !== undefined) return bindMethod(v, o, o.cls, name);
    if(name === '__class__') return o.cls;
    if(name === '__name__') return o.cls.name;
    throw E('AttributeError', "'" + o.cls.name + "' object has no attribute '" + name + "'", line);
  }
  if(o instanceof PySuper){
    const mro = o.cls.mro();
    for(let i = 1; i < mro.length; i++) if(mro[i].ns.has(name)) return bindMethod(mro[i].ns.get(name), o.self, mro[i], name);
    if(name === '__init__') return async function(){};
    throw E('AttributeError', "'super' object has no attribute '" + name + "'", line);
  }
  if(o instanceof PyClass){
    if(name === '__name__') return o.name;
    const v = o.find(name);
    if(v !== undefined){ if(v && v.__static) return v.__fn; if(v && v.__classm) return bindClassM(v.__fn, o); return v; }
    throw E('AttributeError', "type object '" + o.name + "' has no attribute '" + name + "'", line);
  }
  if(typeof o === 'string' || Array.isArray(o) || o instanceof PyDict || o instanceof PySet || o instanceof Uint8Array){
    if(name === '__len__') return () => o.length;
    // método sem chamada (ex.: bound) — retorna wrapper
    const tbl = typeof o === 'string' ? STR_M : Array.isArray(o) ? LIST_M : o instanceof PyDict ? DICT_M : o instanceof PySet ? SET_M : BYTES_M;
    if(name in tbl && tbl[name]) return (...a) => tbl[name](o, ...a);
    if(Array.isArray(o) && name === 'sort') return async function(...a){ const [pa, kw] = splitKw(a); await sortList(o, kw.key, truthy(kw.reverse)); return null; };
    throw E('AttributeError', "'" + typeName(o) + "' object has no attribute '" + name + "'", line);
  }
  if(typeof o === 'function'){
    if(name === '__name__') return o.__name || o.name;
    if(name in o) return o[name];
    throw E('AttributeError', "'function' object has no attribute '" + name + "'", line);
  }
  if(typeof o === 'object' || typeof o === 'number' || typeof o === 'boolean'){
    if(typeof o === 'number' || typeof o === 'boolean') throw E('AttributeError', "'" + typeName(o) + "' object has no attribute '" + name + "'", line);
    const v = o[name];
    if(v !== undefined) return v;
    if(name in o) return v;
    throw E('AttributeError', "'" + (o.constructor && o.constructor.name !== 'Object' ? o.constructor.name : 'object') + "' object has no attribute '" + name + "'", line);
  }
  throw E('AttributeError', "atributo '" + name + "' não existe", line);
}
function bindMethod(v, self, cls, name){
  if(v && v.__static) return v.__fn;
  if(v && v.__classm) return bindClassM(v.__fn, self instanceof PyObj ? self.cls : self);
  if(v && v.__prop){ return syncCall(v.__prop.get, [self]); }
  if(typeof v === 'function' && v.__def){
    const b = async function(...args){
      const last = args[args.length - 1];
      let kw = null;
      if(last instanceof KW){ kw = Object.assign({}, last); args = args.slice(0, -1); }
      return callUser(Object.assign(Object.create(null), { __def: v.__def, __clo: v.__clo, __cls: v.__cls || cls, __self: self, __name: v.__name }), args, kw);
    };
    b.__def = v.__def; b.__clo = v.__clo; b.__cls = v.__cls || cls; b.__self = self; b.__name = v.__name;
    b.__sync = (...a) => syncCall({ __def: v.__def, __clo: v.__clo, __cls: v.__cls || cls }, [self, ...a]);
    return b;
  }
  return v;
}
function bindClassM(fn, cls){
  const b = async function(...args){ const last = args[args.length - 1]; let kw = null; if(last instanceof KW){ kw = Object.assign({}, last); args = args.slice(0, -1); } return callUser(fn, [cls, ...args], kw); };
  return b;
}

async function setAttr(o, name, val, line){
  if(o instanceof PyObj){
    const pr = o.cls.find(name);
    if(pr && pr.__prop && pr.__prop.set){ await callUser(pr.__prop.set, [o, val]); return; }
    o.attrs.set(name, val); return;
  }
  if(o instanceof PyClass){ o.ns.set(name, val); return; }
  if(o === null || o === undefined) throw E('AttributeError', "'NoneType' object has no attribute '" + name + "'", line);
  o[name] = val;
}

async function assignTarget(t, val, sc){
  switch(t.t){
    case 'name': setVar(sc, t.v, val); return;
    case 'attr': await setAttr(await ev(t.obj, sc), t.name, val, t.line); return;
    case 'item': {
      const o = await ev(t.obj, sc);
      if(t.idx.t === 'slice'){
        const lo = t.idx.lo ? await ev(t.idx.lo, sc) : 0, hi = t.idx.hi ? await ev(t.idx.hi, sc) : o.length;
        const a = iterOf(val); o.splice(lo < 0 ? lo + o.length : lo, (hi < 0 ? hi + o.length : hi) - (lo < 0 ? lo + o.length : lo), ...a);
        return;
      }
      const i = await ev(t.idx, sc);
      if(Array.isArray(o)){
        if(isTup(o)) throw E('TypeError', "'tuple' object does not support item assignment", t.line);
        let k = Math.trunc(i); if(k < 0) k += o.length;
        if(k < 0 || k >= o.length) throw E('IndexError', 'list assignment index out of range', t.line);
        o[k] = val;
      } else if(o instanceof Uint8Array){ let k = Math.trunc(i); if(k < 0) k += o.length; if(k < 0 || k >= o.length) throw E('IndexError', 'index out of range', t.line); o[k] = val; }
      else if(o instanceof PyDict) o.set(i, val);
      else if(o instanceof PyObj){ const f = o.cls.find('__setitem__'); if(!f) throw E('TypeError', 'não suporta atribuição por índice', t.line); await callUser(f, [o, i, val]); }
      else if(o && typeof o === 'object') o[i] = val;
      else throw E('TypeError', "'" + typeName(o) + "' não suporta atribuição por índice", t.line);
      return;
    }
    case 'tuple': case 'list': {
      const items = iterOf(val);
      const star = t.items.findIndex(x => x.t === 'starred');
      if(star < 0){
        if(items.length !== t.items.length) throw E('ValueError', (items.length < t.items.length ? 'not enough values to unpack (expected ' + t.items.length + ', got ' + items.length + ')' : 'too many values to unpack (expected ' + t.items.length + ')'), t.line);
        for(let i = 0; i < t.items.length; i++) await assignTarget(t.items[i], items[i], sc);
      } else {
        const after = t.items.length - star - 1;
        for(let i = 0; i < star; i++) await assignTarget(t.items[i], items[i], sc);
        await assignTarget(t.items[star].v, items.slice(star, items.length - after), sc);
        for(let i = 0; i < after; i++) await assignTarget(t.items[star + 1 + i], items[items.length - after + i], sc);
      }
      return;
    }
  }
  throw E('SyntaxError', 'alvo de atribuição inválido', t.line);
}

/* ---------- execução de statements ---------- */
async function execBlock(body, sc){
  for(const s of body){
    const r = await execStmt(s, sc);
    if(r) return r;
  }
  return null;
}
const BRK = { k: 'brk' }, CNT = { k: 'cnt' };

async function execStmt(s, sc){
  if(!RUN.on) throw new PyStop();
  if(++RT.steps % 64 === 0) await maybeYield();
  try { return await execStmt2(s, sc); }
  catch(e){ if(e instanceof PyExc && !e.line) e.line = s.line; throw e; }
}
async function execStmt2(s, sc){
  switch(s.t){
    case 'expr': await ev(s.e, sc); return null;
    case 'pass': return null;
    case 'assign': {
      const v = await ev(s.val, sc);
      for(const t of s.targets) await assignTarget(t, v, sc);
      return null;
    }
    case 'aug': {
      const t = s.target;
      let cur = await ev(t, sc);
      const rhs = await ev(s.val, sc);
      let nv;
      if(Array.isArray(cur) && !isTup(cur) && s.op === '+'){ cur.push(...iterOf(rhs)); nv = cur; }
      else if(cur instanceof PyObj){ const f = cur.cls.find('__i' + { '+': 'add', '-': 'sub', '*': 'mul' }[s.op] + '__') || cur.cls.find('__' + { '+': 'add', '-': 'sub', '*': 'mul' }[s.op] + '__'); nv = f ? await callUser(f, [cur, rhs]) : binOp(s.op, cur, rhs, s.line); }
      else nv = binOp(s.op, cur, rhs, s.line);
      await assignTarget(t, nv, sc);
      return null;
    }
    case 'if': {
      if(truthy(await ev(s.cond, sc))) return execBlock(s.body, sc);
      for(const [c, b] of s.elifs) if(truthy(await ev(c, sc))) return execBlock(b, sc);
      if(s.els) return execBlock(s.els, sc);
      return null;
    }
    case 'while': {
      let g = 0;
      while(truthy(await ev(s.cond, sc))){
        const r = await execBlock(s.body, sc);
        if(r){ if(r.k === 'brk') return null; if(r.k === 'ret') return r; }
        if(++g % 16 === 0) await maybeYield();
      }
      if(s.els) return execBlock(s.els, sc);
      return null;
    }
    case 'for': {
      const seq = iterOf(await ev(s.it, sc), s.line);
      let broke = false, g = 0;
      for(const v of seq){
        await assignTarget(s.target, v, sc);
        const r = await execBlock(s.body, sc);
        if(r){ if(r.k === 'brk'){ broke = true; break; } if(r.k === 'ret') return r; }
        if(++g % 16 === 0) await maybeYield();
      }
      if(!broke && s.els) return execBlock(s.els, sc);
      return null;
    }
    case 'break': return BRK;
    case 'continue': return CNT;
    case 'return': return { k: 'ret', v: s.v ? await ev(s.v, sc) : null };
    case 'def': {
      let f = makeFn(s, sc);
      for(let i = s.decs.length - 1; i >= 0; i--){
        const d = s.decs[i];
        if(d.t === 'name' && d.v === 'staticmethod'){ f = { __static: true, __fn: f }; continue; }
        if(d.t === 'name' && d.v === 'classmethod'){ f = { __classm: true, __fn: f }; continue; }
        if(d.t === 'name' && d.v === 'property'){ f = { __prop: { get: f, set: null }, __fn: f }; continue; }
        if(d.t === 'attr' && d.name === 'setter'){ const base = sc.v.get(d.obj.v); if(base && base.__prop){ base.__prop.set = f; f = base; continue; } }
        const dec = await ev(d, sc);
        f = await callFn(dec, [f]);
      }
      setVar(sc, s.name, f);
      return null;
    }
    case 'class': {
      const bases = [];
      for(const b of s.bases) bases.push(await ev(b, sc));
      const csc = new Scope(sc, 'class');
      await execBlock(s.body, csc);
      const ns = new Map();
      for(const [k, v] of csc.v) ns.set(k, v);
      const cls = new PyClass(s.name, bases.length ? bases : [], ns);
      for(const v of ns.values()){
        const fn = v && (v.__fn || v);
        if(fn && fn.__def) fn.__cls = cls;
        if(v && v.__prop){ if(v.__prop.get) v.__prop.get.__cls = cls; if(v.__prop.set) v.__prop.set.__cls = cls; }
      }
      let c = cls;
      for(let i = s.decs.length - 1; i >= 0; i--) c = await callFn(await ev(s.decs[i], sc), [c]);
      setVar(sc, s.name, c);
      return null;
    }
    case 'global': sc.glob = sc.glob || new Set(); s.names.forEach(n => sc.glob.add(n)); return null;
    case 'nonlocal': sc.nonl = sc.nonl || new Set(); s.names.forEach(n => sc.nonl.add(n)); return null;
    case 'del': {
      for(const t of s.ts){
        if(t.t === 'name'){ const sco = lookupScope(sc, t.v); if(!sco) throw E('NameError', "name '" + t.v + "' isn't defined", s.line); sco.v.delete(t.v); }
        else if(t.t === 'item'){ const o = await ev(t.obj, sc); const i = await ev(t.idx, sc); if(o instanceof PyDict){ if(!o.del(i)) throw mkKeyErr(i, s.line); } else if(Array.isArray(o)){ let k = i < 0 ? i + o.length : i; if(k < 0 || k >= o.length) throw E('IndexError', 'list assignment index out of range', s.line); o.splice(k, 1); } }
        else if(t.t === 'attr'){ const o = await ev(t.obj, sc); if(o instanceof PyObj) o.attrs.delete(t.name); else delete o[t.name]; }
      }
      return null;
    }
    case 'assert': if(!truthy(await ev(s.c, sc))) throw E('AssertionError', s.m ? pyStr(await ev(s.m, sc)) : '', s.line); return null;
    case 'raise': {
      if(!s.e){ if(RT.cur) throw RT.cur; throw E('RuntimeError', 'No active exception to reraise', s.line); }
      let v = await ev(s.e, sc);
      if(v instanceof PyClass) v = await callFn(v, []);
      throw toExc(v, s.line);
    }
    case 'try': return execTry(s, sc);
    case 'with': {
      const entered = [];
      try {
        for(const [e, tg] of s.items){
          const m = await ev(e, sc);
          let val = m;
          if(m instanceof PyObj && m.cls.find('__enter__')) val = await callUser(m.cls.find('__enter__'), [m]);
          else if(m && typeof m.__enter__ === 'function') val = await m.__enter__();
          entered.push(m);
          if(tg) await assignTarget(tg, val, sc);
        }
        return await execBlock(s.body, sc);
      } finally {
        for(const m of entered.reverse()){
          if(m instanceof PyObj && m.cls.find('__exit__')) await callUser(m.cls.find('__exit__'), [m, null, null, null]);
          else if(m && typeof m.__exit__ === 'function') await m.__exit__();
        }
      }
    }
    case 'import': {
      for(const [m, al] of s.names){
        const root = m.split('.')[0];
        const mod = RT.mods[root];
        if(mod === undefined) throw E('ImportError', "módulo '" + m + "' não encontrado — instale a biblioteca no Seletor", s.line);
        let target = mod;
        if(al && m.includes('.')){ target = m.split('.').slice(1).reduce((o, k) => o && o[k], mod); if(target === undefined) throw E('ImportError', "módulo '" + m + "' não encontrado", s.line); }
        setVar(sc, al || root, target);
      }
      return null;
    }
    case 'from': {
      const parts = s.mod.replace(/^\.+/, '');
      let mod = RT.mods[parts];
      if(mod === undefined && parts.includes('.')){ mod = parts.split('.').reduce((o, k) => o && o[k], RT.mods); }
      if(mod === undefined) throw E('ImportError', "módulo '" + s.mod + "' não encontrado — verifique as Bibliotecas", s.line);
      if(s.names === '*'){ for(const k of Object.keys(mod)) if(!k.startsWith('_')) setVar(sc, k, mod[k]); return null; }
      for(const [nm, al] of s.names){
        if(!(nm in mod)){
          const sub = mod[nm];
          throw E('ImportError', "não foi possível importar '" + nm + "' de '" + s.mod + "'", s.line);
        }
        setVar(sc, al || nm, mod[nm]);
      }
      return null;
    }
  }
  throw E('SyntaxError', 'instrução desconhecida: ' + s.t, s.line);
}

function toExc(v, line){
  if(v instanceof PyExc) return v;
  if(v instanceof PyObj && v.cls.mro().includes(EXC.BaseException)){
    const e = new PyExc(v.cls.name, pyStr(v), line);
    e.obj = v;
    return e;
  }
  return E('TypeError', 'exceptions must derive from BaseException', line);
}
function excClass(e){
  if(e.obj) return e.obj.cls;
  return EXC[e.pyType] || EXC.Exception;
}
async function execTry(s, sc){
  let result = null;
  try {
    try {
      result = await execBlock(s.body, sc);
      if(!result && s.els) result = await execBlock(s.els, sc);
    } catch(err){
      if(err instanceof PyStop) throw err;
      let e = err;
      if(!(e instanceof PyExc)){
        if(e instanceof RangeError) e = E('RuntimeError', 'maximum recursion depth exceeded', s.line);
        else if(e && e.__pyCtl) throw e;
        else e = E('Exception', String(e && e.message || e), s.line);
      }
      const cls = excClass(e);
      let handled = false;
      for(const h of s.handlers){
        let match = true;
        if(h.type){
          const t = await ev(h.type, sc);
          const list = Array.isArray(t) ? t : [t];
          match = list.some(c => c instanceof PyClass && cls.mro().includes(c));
        }
        if(match){
          handled = true;
          if(h.name){
            let obj = e.obj;
            if(!obj){ obj = new PyObj(cls); obj.attrs.set('args', tup([e.pyMsg])); }
            setVar(sc, h.name, obj);
          }
          const prev = RT.cur; RT.cur = e;
          try { result = await execBlock(h.body, sc); } finally { RT.cur = prev; }
          break;
        }
      }
      if(!handled) throw e;
    }
  } finally {
    if(s.fin){
      const r = await execBlock(s.fin, sc);
      if(r) return r;
    }
  }
  return result;
}

/* ---------- builtins ---------- */
function defB(name, fn){ fn.__name = name; BUILTIN.set(name, fn); }
(function(){
  for(const k in EXC) BUILTIN.set(k, EXC[k]);
  BUILTIN.set('object', new PyClass('object', [], new Map()));
  defB('print', (...a) => {
    const [pa, kw] = splitKw(a);
    const sep = kw.sep != null ? kw.sep : ' ';
    const end = kw.end != null ? kw.end : '\n';
    RT.out(pa.map(pyStr).join(sep), end);
    return null;
  });
  defB('len', x => {
    if(x == null) throw E('TypeError', "object of type 'NoneType' has no len()");
    if(typeof x === 'string' || Array.isArray(x) || x instanceof Uint8Array) return x.length;
    if(x instanceof PyDict || x instanceof PySet) return x.size;
    if(x instanceof PyObj){ const f = x.cls.find('__len__'); if(f && f.__sync) return f.__sync(x); }
    throw E('TypeError', "object of type '" + typeName(x) + "' has no len()");
  });
  defB('range', (...a) => {
    const [pa] = splitKw(a);
    let s = 0, e, st = 1;
    if(pa.length === 1) e = pa[0]; else { s = pa[0]; e = pa[1]; if(pa.length > 2) st = pa[2]; }
    if(st === 0) throw E('ValueError', 'range() arg 3 must not be zero');
    const out = [];
    if(st > 0) for(let i = s; i < e; i += st){ out.push(i); if(out.length > 3e6) throw E('MemoryError', 'range muito grande'); }
    else for(let i = s; i > e; i += st){ out.push(i); if(out.length > 3e6) throw E('MemoryError', 'range muito grande'); }
    return out;
  });
  defB('str', (x, ...r) => x === undefined ? '' : (x instanceof Uint8Array ? BYTES_M.decode(x) : pyStr(x)));
  defB('repr', x => pyRepr(x));
  defB('int', (x, b) => {
    if(b instanceof KW) b = b.base;
    if(x === undefined) return 0;
    if(typeof x === 'string'){
      const s = x.trim().replace(/_/g, '');
      const base = b || 10;
      const ok = base === 10 ? /^[+-]?\d+$/ : base === 16 ? /^[+-]?(0x)?[0-9a-fA-F]+$/ : base === 2 ? /^[+-]?(0b)?[01]+$/ : /^[+-]?\w+$/;
      if(!ok.test(s)) throw E('ValueError', "invalid literal for int() with base " + base + ": " + quote(x));
      return parseInt(s, base);
    }
    if(typeof x === 'boolean') return +x;
    if(typeof x === 'number'){ if(!Number.isFinite(x)) throw E('OverflowError', 'cannot convert float infinity or nan to integer'); return Math.trunc(x); }
    throw E('TypeError', "int() argument must be a string or a number, not '" + typeName(x) + "'");
  });
  defB('float', x => {
    if(x === undefined) return 0;
    if(typeof x === 'string'){ const s = x.trim().toLowerCase(); if(s === 'nan') return NaN; if(s === 'inf' || s === '+inf') return Infinity; if(s === '-inf') return -Infinity; if(!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(s)) throw E('ValueError', 'could not convert string to float: ' + quote(x)); return parseFloat(s); }
    if(typeof x === 'boolean') return +x;
    if(typeof x === 'number') return x;
    throw E('TypeError', "float() argument must be a string or a number, not '" + typeName(x) + "'");
  });
  defB('bool', x => truthy(x));
  defB('list', x => x === undefined ? [] : iterOf(x).slice());
  defB('tuple', x => tup(x === undefined ? [] : iterOf(x).slice()));
  defB('set', x => new PySet(x === undefined ? [] : iterOf(x)));
  defB('frozenset', x => new PySet(x === undefined ? [] : iterOf(x)));
  defB('dict', (...a) => {
    const [pa, kw] = splitKw(a);
    const d = new PyDict();
    if(pa[0]){ if(pa[0] instanceof PyDict) for(const [k, v] of pa[0].items()) d.set(k, v); else for(const e of iterOf(pa[0])) d.set(e[0], e[1]); }
    for(const k in kw) d.set(k, kw[k]);
    return d;
  });
  defB('bytes', x => x === undefined ? new Uint8Array(0) : typeof x === 'number' ? new Uint8Array(x) : Uint8Array.from(iterOf(x).map(c => typeof c === 'string' ? c.charCodeAt(0) : c)));
  defB('bytearray', x => x === undefined ? new Uint8Array(0) : typeof x === 'number' ? new Uint8Array(x) : Uint8Array.from(iterOf(x).map(c => typeof c === 'string' ? c.charCodeAt(0) : c)));
  defB('abs', x => { if(typeof x !== 'number' && typeof x !== 'boolean') throw E('TypeError', "bad operand type for abs(): '" + typeName(x) + "'"); return Math.abs(x); });
  defB('min', (...a) => mm(a, -1)); defB('max', (...a) => mm(a, 1));
  async function mm(a, dir){
    const [pa, kw] = splitKw(a);
    const seq = pa.length === 1 ? iterOf(pa[0]) : pa;
    if(!seq.length){ if(kw.default !== undefined) return kw.default; throw E('ValueError', (dir > 0 ? 'max' : 'min') + '() arg is an empty sequence'); }
    const keys = [];
    for(const x of seq) keys.push(kw.key ? await callFn(kw.key, [x]) : x);
    let bi = 0;
    for(let i = 1; i < seq.length; i++){ if(dir > 0 ? lt(keys[bi], keys[i]) : lt(keys[i], keys[bi])) bi = i; }
    return seq[bi];
  }
  defB('sum', (it, st) => iterOf(it).reduce((s, v) => binOp('+', s, v), st instanceof KW ? (st.start || 0) : (st || 0)));
  defB('sorted', async (...a) => { const [pa, kw] = splitKw(a); const r = iterOf(pa[0]).slice(); await sortList(r, kw.key, truthy(kw.reverse)); return r; });
  defB('reversed', x => iterOf(x).slice().reverse());
  defB('enumerate', (x, s) => iterOf(x).map((v, i) => tup([i + (typeof s === 'number' ? s : (s && s.start) || 0), v])));
  defB('zip', (...a) => { const [pa] = splitKw(a); if(!pa.length) return []; const ls = pa.map(x => iterOf(x)); const n = Math.min(...ls.map(l => l.length)); return Array.from({ length: n }, (_, i) => tup(ls.map(l => l[i]))); });
  defB('map', async (f, ...its) => { const ls = its.map(iterOf); const n = Math.min(...ls.map(l => l.length)); const out = []; for(let i = 0; i < n; i++) out.push(await callFn(f, ls.map(l => l[i]))); return out; });
  defB('filter', async (f, it) => { const out = []; for(const x of iterOf(it)) if(truthy(f == null ? x : await callFn(f, [x]))) out.push(x); return out; });
  defB('any', it => iterOf(it).some(truthy)); defB('all', it => iterOf(it).every(truthy));
  defB('round', (x, n) => { if(n == null || n instanceof KW){ const f = Math.floor(x), d = x - f; if(d < 0.5) return f; if(d > 0.5) return f + 1; return f % 2 === 0 ? f : f + 1; } const m = Math.pow(10, n); return Math.round(x * m) / m; });
  defB('divmod', (a, b) => { if(b === 0) throw E('ZeroDivisionError', 'integer division or modulo by zero'); return tup([Math.floor(a / b), ((a % b) + b) % b]); });
  defB('pow', (a, b, m) => m != null ? Number((BigInt(a) ** BigInt(b)) % BigInt(m)) : Math.pow(a, b));
  defB('hex', x => (x < 0 ? '-0x' : '0x') + Math.abs(Math.trunc(x)).toString(16));
  defB('oct', x => '0o' + Math.trunc(x).toString(8)); defB('bin', x => (x < 0 ? '-0b' : '0b') + Math.abs(Math.trunc(x)).toString(2));
  defB('chr', x => String.fromCharCode(x)); defB('ord', x => { if(typeof x !== 'string' || x.length !== 1) throw E('TypeError', 'ord() espera um caractere'); return x.charCodeAt(0); });
  defB('isinstance', (o, c) => {
    const cl = Array.isArray(c) && !(c instanceof PyClass) ? c : [c];
    return cl.some(k => {
      if(k instanceof PyClass) return o instanceof PyObj && o.cls.mro().includes(k);
      if(k === BUILTIN.get('int')) return typeof o === 'number' && Number.isInteger(o);
      if(k === BUILTIN.get('float')) return typeof o === 'number';
      if(k === BUILTIN.get('str')) return typeof o === 'string';
      if(k === BUILTIN.get('bool')) return typeof o === 'boolean';
      if(k === BUILTIN.get('list')) return Array.isArray(o) && !isTup(o);
      if(k === BUILTIN.get('tuple')) return isTup(o);
      if(k === BUILTIN.get('dict')) return o instanceof PyDict;
      if(k === BUILTIN.get('set')) return o instanceof PySet;
      return false;
    });
  });
  defB('issubclass', (a, b) => a instanceof PyClass && a.mro().includes(b));
  defB('hasattr', (o, n) => { try { getAttr(o, n); return true; } catch(e){ return false; } });
  defB('getattr', (o, n, d) => { try { return getAttr(o, n); } catch(e){ if(d !== undefined && !(d instanceof KW)) return d; throw e; } });
  defB('setattr', (o, n, v) => { if(o instanceof PyObj) o.attrs.set(n, v); else o[n] = v; return null; });
  defB('callable', f => typeof f === 'function' || f instanceof PyClass);
  defB('type', x => { const n = typeName(x); return { __typeName: n, toString: () => "<class '" + n + "'>" }; });
  defB('id', x => (x && typeof x === 'object') ? (x.__id || (x.__id = Math.floor(Math.random() * 1e9))) : Math.floor(Math.abs(+x) || 0));
  defB('iter', x => iterOf(x).slice()); defB('next', (x, d) => { if(Array.isArray(x) && x.length) return x.shift(); if(d !== undefined) return d; throw E('StopIteration', ''); });
  defB('input', () => ''); defB('format', (v, s) => fmtSpec(v, s));
  defB('hash', x => { let h = 0; const s = pyRepr(x); for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; });
  defB('globals', () => { const d = new PyDict(); for(const [k, v] of RT.root.v) d.set(k, v); return d; });
  defB('staticmethod', f => ({ __static: true, __fn: f })); defB('classmethod', f => ({ __classm: true, __fn: f }));
  defB('property', f => ({ __prop: { get: f, set: null }, __fn: f }));
  BUILTIN.set('__name__', '__main__');
})();

/* ---------- API pública ---------- */
async function runPython(src, mods, out){
  const toks = tokenize(src);
  const ast = parse(toks);
  RT = { mods: mods, depth: 0, steps: 0, out: out, cur: null, root: null };
  const sc = new Scope(null, 'module');
  RT.root = sc;
  lastYield = performance.now();
  const r = await execBlock(ast, sc);
  return r;
}

window.KezlePy = { runPython, PyExc, KW, PyDict, PySet, PyObj, PyClass, tup, isTup, pyStr, pyRepr, fmtNum, truthy, iterOf, callFn, tokenize, parse, builtins: BUILTIN, EXC, lastLine: null };
window.pyTokenize = tokenize;
window.pyParse = parse;

/* substitui "wait" por versão precisa (sleep_ms(1) real) e que respeita Parar */
window.wait = async function(ms){
  if(!(ms > 0)){ await fastYield(); if(!RUN.on) throw new PyStop(); return; }
  const t0 = performance.now();
  for(;;){
    if(!RUN.on) throw new PyStop();
    const left = ms - (performance.now() - t0);
    if(left <= 0) break;
    await new Promise(r => setTimeout(r, Math.min(left, 40)));
  }
};
window.tick = async function(){ if(!RUN.on) throw new PyStop(); await fastYield(); };

/* ---------- runCode (MicroPython) usa o novo interpretador ---------- */
const _origRunCode = window.runCode;
window.runCode = async function(srcOverride){
  const lang = $('#pyLang').value;
  if(lang === 'cpp') return _origRunCode.apply(this, arguments);
  const src = srcOverride != null ? srcOverride : $('#pyEditor').value;
  stopCode();

  const a = analyzeHardware(src);
  renderHwCheck();
  if(a.errors.length){ toast(a.errors[0], 'err'); serialOut('⛔ ' + a.errors[0], 'err'); return; }
  const miss = checkLibs(src);
  if(miss){
    toast('Biblioteca "' + ((LIBMAP[miss] && LIBMAP[miss].nm) || miss) + '" não instalada — abra 📖 Bibliotecas', 'err');
    serialOut('⛔ Biblioteca ausente: ' + ((LIBMAP[miss] && LIBMAP[miss].nm) || miss) + '. Instale-a no Seletor de Bibliotecas.', 'err');
    return;
  }
  RUN.on = true;
  setRunUI(true);
  serialOut('— compilação MicroPython iniciada (' + $('#pyTarget').value + ') —', 'sys');
  try {
    MODS = makeModules();
    for(const k in IRQMAP) delete IRQMAP[k];
    if(window.KezleScreens) KezleScreens.onRunStart();
    let pending = '';
    await runPython(src, MODS, (txt, end) => {
      if(end === '\n') serialOut(pending + txt), pending = '';
      else pending += txt + (end === '\n' ? '' : end);
    });
    if(pending) serialOut(pending);
    serialOut('— programa finalizado normalmente —', 'ok');
  } catch(e){
    if(e instanceof PyStop) serialOut('— execução interrompida pelo usuário —', 'dim');
    else if(e instanceof PyExc){
      serialOut('⛔ Traceback (linha ' + (e.line || '?') + '):  ' + e.pyType + (e.pyMsg ? ': ' + e.pyMsg : ''), 'err');
      toast('Erro de execução — veja o console', 'err');
    } else {
      serialOut('⛔ Erro interno: ' + (e && e.message || e), 'err');
      console.error(e);
      toast('Erro de execução — veja o console', 'err');
    }
  }
  RUN.on = false;
  setRunUI(false);
};

})();
