/* =========================================================================
   Kezle Lab Pro — Go (TinyGo), Rust, Lua e BASIC
   ========================================================================= */
(function(){
'use strict';
const HAL = KezleHAL, RUNNERS = window.KEZLE_RUNNERS;
const { ctok, AF } = window.KezleLang;
const INTT = new Set(['int', 'int8', 'int16', 'int32', 'int64', 'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr', 'byte', 'rune', 'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'usize', 'isize', 'i128', 'u128']);
const FLT = new Set(['float32', 'float64', 'f32', 'f64']);
const lowerFirst = s => s[0].toLowerCase() + s.slice(1);
const camel = s => s.replace(/_([a-z0-9])/g, (m, c) => c.toUpperCase());
const analogPins = () => { const m = CIRCUIT.primaryMcu(); const id = m ? m.def.id : 'esp32'; return /pico|rp2040/.test(id) ? [26, 27, 28, 29] : /uno|nano|mega|leonardo|pro_mini/.test(id) ? [14, 15, 16, 17, 18, 19] : [36, 39, 34, 35, 32, 33]; };
const adcMax = () => { const m = CIRCUIT.primaryMcu(); return m && /uno|nano|mega|leonardo|pro_mini|attiny/.test(m.def.id) ? 1023 : 4095; };

/* Proxy que aceita nomes Go (Capitalizados) e Rust (snake_case) para métodos/campos */
function nameProxy(o){
  if(o === null || typeof o !== 'object' && typeof o !== 'function') return o;
  if(o.__np) return o;
  return new Proxy(o, {
    get(t, k){
      if(k === '__np') return true;
      if(typeof k !== 'string') return t[k];
      let v = k in t ? t[k] : (lowerFirst(k) in t ? t[lowerFirst(k)] : (camel(k) in t ? t[camel(k)] : (camel(lowerFirst(k)) in t ? t[camel(lowerFirst(k))] : undefined)));
      if(v === undefined){ const l = k.toLowerCase(); for(const kk of Object.keys(t)) if(kk.toLowerCase() === l || kk.toLowerCase() === l.replace(/_/g, '')) { v = t[kk]; break; } }
      if(typeof v === 'function' && !v.prototype) return (...a) => { const r = v.apply(t, a); return (r && typeof r === 'object' && !(r instanceof Promise)) ? nameProxy(r) : r; };
      if(typeof v === 'function') return (...a) => { const r = v.apply(t, a); return (r && typeof r === 'object' && !(r instanceof Promise)) ? nameProxy(r) : r; };
      return (v && typeof v === 'object') ? nameProxy(v) : v;
    },
    has: () => true
  });
}
function pinObj(id){
  const self = {
    id,
    Configure: cfg => { HAL.pinMode(id, (cfg && (cfg.Mode !== undefined ? cfg.Mode : cfg.mode)) || 0); }, configure: cfg => self.Configure(cfg),
    High: () => HAL.digitalWrite(id, 1), Low: () => HAL.digitalWrite(id, 0), Set: v => HAL.digitalWrite(id, v ? 1 : 0), Get: () => !!HAL.digitalRead(id),
    Toggle: () => HAL.digitalWrite(id, (PINS[id] && PINS[id].v) ? 0 : 1), set_high: () => HAL.digitalWrite(id, 1), set_low: () => HAL.digitalWrite(id, 0), is_high: () => !!HAL.digitalRead(id), is_low: () => !HAL.digitalRead(id),
    into_push_pull_output: () => { HAL.pinMode(id, 'out'); return self; }, into_pull_up_input: () => { HAL.pinMode(id, 'in_up'); return self; }, into_floating_input: () => { HAL.pinMode(id, 'in'); return self; }, into_pull_down_input: () => { HAL.pinMode(id, 'in_down'); return self; },
    SetInterrupt: (ch, cb) => { HAL.attach(id, () => cb(self), ch === 3 ? 'change' : ch === 1 ? 'rising' : 'falling'); }, toggle: () => self.Toggle()
  };
  return self;
}
function goMachine(){
  const m = { PinOutput: 1, PinInput: 0, PinInputPullup: 2, PinInputPulldown: 3, PinRising: 1, PinFalling: 2, PinToggle: 3, PinConfig: function(o){ return o; },
    InitADC: () => 0, ADCConfig: o => o, PWMConfig: o => o, I2CConfig: o => o, UARTConfig: o => o, SPIConfig: o => o,
    ADC: o => { const pin = o && (o.Pin !== undefined ? o.Pin : o.pin); const id = pin && pin.id !== undefined ? pin.id : pin; return { Configure: () => 0, Get: () => Math.round(HAL.analogRead(id) / adcMax() * 65535) }; },
    LED: pinObj(CIRCUIT.primaryMcu() && /pico|rp2040/.test(CIRCUIT.primaryMcu().def.id) ? 25 : 2),
    CPUFrequency: () => 240000000 };
  const an = analogPins();
  for(let i = 0; i < 48; i++){ m['GPIO' + i] = pinObj(i); m['GP' + i] = m['GPIO' + i]; m['D' + i] = m['GPIO' + i]; m['IO' + i] = m['GPIO' + i]; }
  for(let i = 0; i < an.length; i++) m['A' + i] = pinObj(an[i]);
  m.ADC0 = m.A0; m.ADC1 = m.A1; m.ADC2 = m.A2;
  m.PWM0 = m.PWM1 = m.PWM2 = m.TCC0 = { Configure: () => 0, Top: () => 65535, Channel: p => [p, null], Set: (ch, v) => HAL.analogWrite(ch && ch.id !== undefined ? ch.id : ch, v, 65535), SetPeriod: () => 0, Enable: () => 0, Get: () => 0 };
  m.UART0 = { Configure: () => 0, Write: s => { HAL.write(String(s)); return 0; } }; m.I2C0 = { Configure: () => 0 }; m.SPI0 = { Configure: () => 0 }; m.Serial = m.UART0;
  return m;
}
function fmtGo(fmt, args){
  let i = 0;
  return String(fmt).replace(/%([-+ 0#]*)(\d+)?(?:\.(\d+))?([vdsfxXcqtTbeEgGoUp%])/g, (all, fl, w, pr, t) => {
    if(t === '%') return '%'; let v = args[i++];
    let s;
    switch(t){ case 'v': s = typeof v === 'number' && !Number.isInteger(v) ? String(v) : (typeof v === 'object' && v ? JSON.stringify(v) : String(v)); break; case 'd': s = String(Math.trunc(+v)); break; case 'f': s = (+v).toFixed(pr === undefined ? 6 : +pr); break; case 'x': s = Math.trunc(v).toString(16); break; case 'X': s = Math.trunc(v).toString(16).toUpperCase(); break; case 'c': s = String.fromCharCode(v); break; case 'q': s = JSON.stringify(String(v)); break; case 't': s = String(v); break; case 'b': s = Math.trunc(v).toString(2); break; case 'e': s = (+v).toExponential(pr === undefined ? 6 : +pr); break; case 'g': s = String(+(+v).toPrecision(pr === undefined ? 6 : +pr)); break; default: s = String(v); if(pr !== undefined && t === 's') s = s.slice(0, +pr); }
    if(w){ const W = +w; if(s.length < W) s = fl.includes('-') ? s.padEnd(W) : (fl.includes('0') ? s.padStart(W, '0') : s.padStart(W)); }
    return s;
  });
}
const unitsGo = { Nanosecond: 1e-6, Microsecond: 0.001, Millisecond: 1, Second: 1000, Minute: 60000, Hour: 3600000 };
function goApi(){
  const toS = v => v === null || v === undefined ? '<nil>' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  const intf = v => Math.trunc(+v) || 0;
  const api = {
    machine: nameProxy(goMachine()), time: Object.assign({ Sleep: d => HAL.delay(d), Now: () => ({ UnixMilli: () => Date.now(), Unix: () => Math.floor(Date.now() / 1000) }), Since: () => 0, Duration: x => x, Tick: ms => 0 }, unitsGo),
    fmt: { Println: (...a) => HAL.write(a.map(toS).join(' ') + '\n'), Print: (...a) => HAL.write(a.map(toS).join('')), Printf: (f, ...a) => HAL.write(fmtGo(f, a)), Sprintf: (f, ...a) => fmtGo(f, a), Sprint: (...a) => a.map(toS).join(''), Sprintln: (...a) => a.map(toS).join(' ') + '\n', Errorf: (f, ...a) => fmtGo(f, a) },
    strconv: { Itoa: v => String(v), Atoi: s => [parseInt(s) || 0, isNaN(parseInt(s)) ? 'erro' : null], FormatInt: (v, b) => Math.trunc(v).toString(b), ParseFloat: s => [parseFloat(s) || 0, null] },
    math: { Sqrt: Math.sqrt, Sin: Math.sin, Cos: Math.cos, Tan: Math.tan, Abs: Math.abs, Pow: Math.pow, Floor: Math.floor, Ceil: Math.ceil, Round: Math.round, Max: Math.max, Min: Math.min, Log: Math.log, Exp: Math.exp, Pi: Math.PI, Atan2: Math.atan2, Mod: (a, b) => a % b, MaxInt32: 2147483647, Trunc: Math.trunc, Hypot: Math.hypot },
    rand: { Intn: n => Math.floor(Math.random() * n), Int: () => Math.floor(Math.random() * 2147483647), Float64: Math.random, Seed: () => 0 },
    strings: { ToUpper: s => s.toUpperCase(), ToLower: s => s.toLowerCase(), Contains: (s, x) => s.includes(x), Repeat: (s, n) => s.repeat(n), TrimSpace: s => s.trim(), Split: (s, x) => s.split(x), Join: (a, x) => a.join(x), HasPrefix: (s, x) => s.startsWith(x), HasSuffix: (s, x) => s.endsWith(x), Index: (s, x) => s.indexOf(x), Replace: (s, a, b) => s.split(a).join(b), ReplaceAll: (s, a, b) => s.split(a).join(b) },
    os: { Exit: () => { RUN.on = false; } },
    println: (...a) => HAL.write(a.map(toS).join(' ') + '\n'), print: (...a) => HAL.write(a.map(toS).join('')),
    len: x => x == null ? 0 : x.length !== undefined ? x.length : Object.keys(x).length, cap: x => x.length, append: (a, ...v) => (a || []).concat(v), make: (t, n) => (Array.isArray(t) || typeof n === 'number' ? new Array(n || 0).fill(0) : {}), copy: (d, s) => { for(let i = 0; i < Math.min(d.length, s.length); i++) d[i] = s[i]; return Math.min(d.length, s.length); }, delete: (m, k) => { delete m[k]; },
    panic: m => { throw new Error('panic: ' + toS(m)); }, new_: () => ({}), min: Math.min, max: Math.max, string: v => typeof v === 'number' ? String.fromCharCode(v) : String(v), error: null,
    int: intf, int8: v => (intf(v) << 24) >> 24, int16: v => (intf(v) << 16) >> 16, int32: v => intf(v) | 0, int64: intf, uint: v => intf(v) >>> 0, uint8: v => intf(v) & 255, byte: v => intf(v) & 255, uint16: v => intf(v) & 65535, uint32: v => intf(v) >>> 0, uint64: intf, uintptr: intf, rune: intf, float32: v => +v, float64: v => +v,
    __range: x => typeof x === 'number' ? Array.from({ length: x }, (_, i) => [i, i]) : typeof x === 'string' ? [...x].map((c, i) => [i, c.charCodeAt(0)]) : Array.isArray(x) ? x.map((v, i) => [i, v]) : Object.entries(x),
    __idiv: (a, b) => { if(b === 0) throw new Error('panic: divisão inteira por zero'); return Math.trunc(a / b); }, __int: intf,
    Display: (...a) => nameProxy(HAL.gfx(a.length ? [].concat(a) : null)), Touch: () => { const t = HAL.touch(); return t ? nameProxy(Object.assign({}, t, { GetPoint: () => { const p = t.get_point() || { x: 0, y: 0, z: 0 }; return nameProxy({ x: p.x, y: p.y, z: p.z, X: p.x, Y: p.y, Z: p.z }); } })) : nameProxy({ touched: () => false }); },
    analogWrite: (p, v) => HAL.analogWrite(p, v, 255), delay: ms => HAL.delay(ms), millis: () => HAL.millis(), tone: (p, f) => HAL.tone(p, f), digitalWrite: (p, v) => HAL.digitalWrite(p, v), digitalRead: p => HAL.digitalRead(p), pinMode: (p, m) => HAL.pinMode(p, m),
    OUTPUT: 1, INPUT: 0, INPUT_PULLUP: 2, HIGH: 1, LOW: 0, analogRead: p => HAL.analogRead(p), servoWrite: (p, a) => HAL.servoWrite(p, a), random: (a, b) => Math.floor(a + Math.random() * (b - a + 1)), mapRange: (v, a, b, c, d) => (v - a) * (d - c) / (b - a) + c,
    ts: null, nil: null, true: true, false: false, iota: 0
  };
  return api;
}

/* ======================== Go ======================== */
function goTranspile(src){
  let toks = ctok(src);
  toks = toks.filter(t => t.t !== 'pp');
  let p = 0;
  const userFns = new Set(), types = new Map();
  for(let i = 0; i < toks.length; i++){ if(toks[i].v === 'func' && toks[i + 1] && toks[i + 1].t === 'id') userFns.add(toks[i + 1].v); }
  const err = m => { const e = new Error(m); e.line = (toks[p] || {}).line; return e; };
  const isOp = (v, o) => { const t = toks[p + (o || 0)]; return t && t.t === 'op' && t.v === v; };
  const isId = (v, o) => { const t = toks[p + (o || 0)]; return t && t.t === 'id' && t.v === v; };
  const expectOp = v => { if(!isOp(v)) throw err('esperava "' + v + '" mas veio "' + (toks[p] ? toks[p].v : 'fim') + '"'); p++; };
  const endsStmt = t => t && (t.t === 'id' && !/^(else|if|for|func|var|const|switch|case|default|go|defer|range|return|import|package|type)$/.test(t.v) || t.t === 'num' || t.t === 'str' || t.t === 'chr' || t.t === 'raw' || (t.t === 'op' && /^(\)|\]|\}|\+\+|--)$/.test(t.v)));
  function slice(stops, noBraceStop){
    const r = []; let d = 0;
    while(p < toks.length){
      const t = toks[p];
      if(d === 0 && r.length && t.line > r[r.length - 1].line && (stops.includes(';')) && endsStmt(r[r.length - 1])) break;
      if(t.t === 'op'){
        if('([{'.includes(t.v)){ if(d === 0 && t.v === '{' && stops.includes('{') && !isComposite(p)) break; d++; }
        else if(')]}'.includes(t.v)){ if(d === 0 && stops.includes(t.v)) break; d--; }
        else if(d === 0 && stops.includes(t.v)) break;
      }
      r.push(t); p++;
    }
    return r;
  }
  function isComposite(i){ // '{' após tipo: []T{, map[..]..{, X{, pkg.X{
    const pv = toks[i - 1];
    if(!pv) return false;
    if(pv.t === 'id' && /^(if|for|switch|else|select|func|go|defer)$/.test(pv.v)) return false;
    if(pv.v === ']') return true;
    if(pv.t === 'id' && /^[A-Z]/.test(pv.v)) return true;
    return false;
  }
  const tyOf = t => { if(!t) return null; if(t.t === 'num') return t.f ? 'float' : 'int'; if(t.t === 'chr') return 'int'; if(t.t === 'id') return types.get(t.v) || null; return null; };
  function conv(tk){
    const out = []; const L = tk.length;
    for(let j = 0; j < L; j++){
      const t = tk[j], nx = tk[j + 1], pv = tk[j - 1];
      if(t.t === 'num'){ out.push(t.v); continue; } if(t.t === 'str'){ out.push('"' + t.v.replace(/"/g, '\\"') + '"'); continue; } if(t.t === 'raw'){ out.push('`' + t.v + '`'); continue; } if(t.t === 'chr'){ out.push(String(t.v)); continue; }
      if(t.t === 'id'){
        if(t.v === 'func' && nx && nx.v === '('){ // função literal
          let d = 0, k = j + 1; for(; k < L; k++){ if(tk[k].v === '(') d++; if(tk[k].v === ')'){ d--; if(!d) break; } }
          const params = tk.slice(j + 2, k); let b = k + 1; while(b < L && tk[b].v !== '{') b++;
          let dd = 0, e = b; for(; e < L; e++){ if(tk[e].v === '{') dd++; if(tk[e].v === '}'){ dd--; if(!dd) break; } }
          const bodyTk = tk.slice(b, e + 1);
          const saveT = toks, saveP = p; toks = bodyTk; p = 0;
          let bodyJs; try { bodyJs = block(); } finally { toks = saveT; p = saveP; }
          out.push('(async (' + goParamNames(params).join(', ') + ') => ' + bodyJs + ')'); j = e; continue;
        }
        if(t.v === 'nil'){ out.push('null'); continue; }
        if(t.v === 'new' && nx && nx.v === '('){ out.push('new_'); continue; }
        if(t.v === 'go'){ continue; }
        if(nx && nx.v === '(' && userFns.has(t.v) && !(pv && pv.v === '.')){ out.push('(await ' + t.v); let d = 0, k = j + 1; for(; k < L; k++){ if(tk[k].v === '(') d++; if(tk[k].v === ')'){ d--; if(!d) break; } } tk[k] = Object.assign({}, tk[k], { closeAwait: true }); continue; }
        if(t.v === 'time' && nx && nx.v === '.' && tk[j + 2] && tk[j + 2].v === 'Sleep'){ out.push('(await time.Sleep'); let d = 0, k = j + 3; for(; k < L; k++){ if(tk[k].v === '(') d++; if(tk[k].v === ')'){ d--; if(!d) break; } } tk[k] = Object.assign({}, tk[k], { closeAwait: true }); j += 2; continue; }
        if(t.v === 'delay' && nx && nx.v === '('){ out.push('(await delay'); let d = 0, k = j + 1; for(; k < L; k++){ if(tk[k].v === '(') d++; if(tk[k].v === ')'){ d--; if(!d) break; } } tk[k] = Object.assign({}, tk[k], { closeAwait: true }); continue; }
        out.push(t.v); continue;
      }
      const v = t.v;
      if(t.closeAwait && v === ')'){ out.push('))'); continue; }
      if(v === '[' && nx && nx.v === ']'){ // []T{...}
        let k = j + 2; while(tk[k] && (tk[k].t === 'id' || tk[k].v === '.' || tk[k].v === '*')) k++;
        if(tk[k] && tk[k].v === '{'){ // lista literal
          let d = 0, e = k; for(; e < L; e++){ if(tk[e].v === '{') d++; if(tk[e].v === '}'){ d--; if(!d) break; } }
          out.push('[' + conv(tk.slice(k + 1, e)) + ']'); j = e; continue;
        }
        j++; continue; // tipo de slice sem literal: ignora
      }
      if(v === '[' && nx && nx.t === 'num' && tk[j + 2] && tk[j + 2].v === ']' && tk[j + 3] && tk[j + 3].t === 'id'){ // [N]T{...}
        let k = j + 4; while(tk[k] && (tk[k].t === 'id' || tk[k].v === '.')) k++;
        if(tk[k] && tk[k].v === '{'){ let d = 0, e = k; for(; e < L; e++){ if(tk[e].v === '{') d++; if(tk[e].v === '}'){ d--; if(!d) break; } } out.push('[' + conv(tk.slice(k + 1, e)) + ']'); j = e; continue; }
      }
      if(v === '&' && !(pv && (pv.t === 'id' || pv.t === 'num' || pv.v === ')' || pv.v === ']'))){ continue; }
      if(v === '*' && !(pv && (pv.t === 'id' || pv.t === 'num' || pv.v === ')' || pv.v === ']'))){ continue; }
      if(v === '/' && pv && nx && tyOf(pv) === 'int' && tyOf(nx) === 'int' && !(tk[j + 2] && /^(\(|\.|\[)$/.test(tk[j + 2].v)) && !(tk[j - 2] && /^(\.|\*|\/|%)$/.test(tk[j - 2].v))){ const l = out.pop(); out.push('__idiv(' + l + ', ' + nx.v + ')'); j++; continue; }
      if(v === '{' && pv && pv.t === 'id' && /^[A-Z]/.test(pv.v) && !(tk[j - 2] && tk[j - 2].v === '.' && tk[j - 3] && tk[j - 3].v === 'machine' && pv.v === 'ADC')){
        out.pop(); if(tk[j - 2] && tk[j - 2].v === '.'){ out.pop(); out.pop(); } out.push('{'); continue;
      }
      if(v === '{' && pv && pv.t === 'id' && /^[A-Z]/.test(pv.v) && tk[j - 2] && tk[j - 2].v === '.' ){ // pkg.Type{...}
        const q = tk[j - 3] ? tk[j - 3].v + '.' + pv.v : pv.v;
        if(q === 'machine.ADC'){ let d = 0, e = j; for(; e < L; e++){ if(tk[e].v === '{') d++; if(tk[e].v === '}'){ d--; if(!d) break; } } out.pop(); out.pop(); out.pop(); out.push('machine.ADC({' + conv(tk.slice(j + 1, e)) + '})'); j = e; continue; }
      }
      out.push(v);
    }
    return out.join(' ').replace(/\s+\./g, '.').replace(/\.\s+/g, '.').replace(/\s+\(/g, '(').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+,/g, ',').replace(/\s+\[/g, '[').replace(/\[\s+/g, '[').replace(/\s+\]/g, ']').replace(/\(await\s+(\w+)\s*\(/g, '(await $1(');
  }
  function goParamNames(tk){
    // "a, b int, c string"  ->  [a,b,c]
    const names = []; let cur = []; const parts = []; let d = 0;
    for(const t of tk){ if(t.v === ',' && d === 0){ parts.push(cur); cur = []; continue; } if(t.v === '(' || t.v === '[') d++; if(t.v === ')' || t.v === ']') d--; cur.push(t); }
    if(cur.length) parts.push(cur);
    let pendingNames = [];
    for(const pr of parts){
      if(pr.length >= 2 && pr[0].t === 'id' && !(pr[0].v === 'func')){ names.push(pr[0].v); for(const pn of pendingNames){ types.set(pn, INTT.has(pr[1].v) ? 'int' : FLT.has(pr[1].v) ? 'float' : 'other'); } types.set(pr[0].v, INTT.has(pr[1].v) ? 'int' : FLT.has(pr[1].v) ? 'float' : 'other'); pendingNames = []; }
      else if(pr.length === 1 && pr[0].t === 'id'){ names.push(pr[0].v); pendingNames.push(pr[0].v); }
    }
    return names;
  }
  const scopeDecl = [new Set()];
  const declared = n => scopeDecl.some(s => s.has(n));
  function block(){ expectOp('{'); scopeDecl.push(new Set()); const out = []; let sw = []; while(p < toks.length && !isOp('}')) out.push(stmt()); expectOp('}'); scopeDecl.pop(); return '{' + out.join('\n') + '}'; }
  function typeKind(tk){ const t = tk.find(x => x.t === 'id'); return t ? (INTT.has(t.v) ? 'int' : FLT.has(t.v) ? 'float' : t.v === 'string' ? 'str' : t.v === 'bool' ? 'bool' : 'other') : 'other'; }
  const zeroOf = k => k === 'int' || k === 'float' ? '0' : k === 'str' ? '""' : k === 'bool' ? 'false' : 'null';
  function simple(stopBrace){
    const a = slice(stopBrace ? [';', '{'] : [';', '}']);
    if(isOp(';')) p++;
    return a;
  }
  function lineEnd(startTok){ while(toks[p] && toks[p].line === startTok.line && !isOp(';')) p++; if(isOp(';')) p++; }
  function simpleStmt(a, noSemi){
    if(!a.length) return '';
    const sem = noSemi ? '' : ';';
    if(a[0].v === 'go'){ return 'void (async () => { ' + conv(a.slice(1)) + '; })()' + sem; }
    if(a[0].v === 'defer'){ return ''; }
    // short var decl: a, b := x, y
    const di = a.findIndex(t => t.v === ':=');
    if(di > 0 && a.slice(0, di).every(t => t.t === 'id' || t.v === ',')){
      const names = a.slice(0, di).filter(t => t.t === 'id').map(t => t.v);
      const rhsParts = []; let cur = [], d = 0; for(const t of a.slice(di + 1)){ if(t.v === ',' && d === 0){ rhsParts.push(cur); cur = []; continue; } if('([{'.includes(t.v)) d++; if(')]}'.includes(t.v)) d--; cur.push(t); }
      rhsParts.push(cur);
      const allNew = names.every(n => !declared(n) || n === '_');
      names.forEach((n, i) => { const r = rhsParts[i] && rhsParts[i].length === 1 ? tyOf(rhsParts[i][0]) : null; if(!types.has(n) || r) types.set(n, r || (rhsParts[i] && /^(len|int|uint\d*|machine)/.test(rhsParts[i][0].v || '') && rhsParts[i][0].v !== 'machine' ? 'int' : 'other')); });
      if(names.length === 1 && rhsParts.length === 1){
        const e = conv(rhsParts[0]);
        if(declared(names[0])) return `${names[0]} = ${e}${sem}`;
        scopeDecl[scopeDecl.length - 1].add(names[0]);
        return `let ${names[0]} = ${e}${sem}`;
      }
      names.forEach(n => scopeDecl[scopeDecl.length - 1].add(n));
      const lhs = '[' + names.join(', ') + ']';
      const rhs = rhsParts.length === 1 ? conv(rhsParts[0]) : '[' + rhsParts.map(conv).join(', ') + ']';
      const seen = names.map(n => n === '_' ? '_' + Math.random().toString(36).slice(2, 5) : n);
      return `let [${seen.join(', ')}] = ${rhs}${sem}`;
    }
    // atribuição com int
    if(a.length > 2 && a[0].t === 'id' && a[1].v === '=' && types.get(a[0].v) === 'int' && !(a.length === 3 && a[2].t === 'num' && !a[2].f)) return `${a[0].v} = __int(${conv(a.slice(2))})${sem}`;
    if(a.length > 2 && a[0].t === 'id' && a[1].v === '/=' && types.get(a[0].v) === 'int') return `${a[0].v} = __idiv(${a[0].v}, ${conv(a.slice(2))})${sem}`;
    const eqi = a.findIndex(t => t.v === '=');
    if(eqi > 0 && a.slice(0, eqi).some(t => t.v === ',') ){ return `[${conv(a.slice(0, eqi))}] = [${conv(a.slice(eqi + 1))}]${sem}`; }
    return conv(a) + sem;
  }
  function stmt(){
    const t = toks[p];
    if(!t) return '';
    if(t.t === 'op'){ if(t.v === '{') return block(); if(t.v === ';'){ p++; return ';'; } }
    if(t.t === 'id'){
      switch(t.v){
        case 'package': lineEnd(t); return '';
        case 'import': { p++; if(isOp('(')){ while(toks[p] && !isOp(')')) p++; p++; } else p++; return ''; }
        case 'type': { p++; const nm = toks[p] && toks[p].v; p++; if(isId('struct') || isId('interface')){ p++; let d = 0; do { if(isOp('{')) d++; if(isOp('}')) d--; p++; } while(d > 0 && toks[p]); } else lineEnd(t); return ''; }
        case 'func': {
          p++;
          if(isOp('(')){ let d = 0; do { if(isOp('(')) d++; if(isOp(')')) d--; p++; } while(d > 0); }
          const name = toks[p].v; p++; expectOp('(');
          const ps = []; let d = 0; while(toks[p] && !(isOp(')') && d === 0)){ if(isOp('(')) d++; if(isOp(')')) d--; ps.push(toks[p]); p++; } expectOp(')');
          while(toks[p] && !isOp('{')) p++;
          scopeDecl.push(new Set(goParamNames(ps)));
          const b = block(); scopeDecl.pop();
          return `async function ${name}(${goParamNames(ps).join(', ')}) ${b}`;
        }
        case 'var': case 'const': {
          p++;
          const kw = t.v === 'const' ? 'const' : 'let';
          const one = () => {
            const names = []; while(toks[p] && toks[p].t === 'id'){ names.push(toks[p].v); p++; if(isOp(',')) p++; else break; }
            const ty = []; while(toks[p] && !isOp('=') && !isOp(';') && !isOp(')') && toks[p].line === t.line + (toks[p].line - t.line) && !(ty.length && toks[p].line !== toks[p - 1].line)){ ty.push(toks[p]); p++; }
            let init = null; if(isOp('=')){ p++; init = []; const ln = toks[p].line; init = slice([';', ')', '}']); }
            if(isOp(';')) p++;
            const k = typeKind(ty);
            return names.map((n, i) => { types.set(n, init ? (init.length === 1 && tyOf(init[0])) || k : k); scopeDecl[scopeDecl.length - 1].add(n); return `${kw} ${n} = ${init ? (types.get(n) === 'int' && !(init.length === 1 && init[0].t === 'num') ? '__int(' + conv(init) + ')' : conv(init)) : (/^\[|map|\*/.test(ty.map(x => x.v).join('')) ? (ty[0] && ty[0].v === '[' ? '[]' : '{}') : zeroOf(k))};`; }).join(' ');
          };
          if(isOp('(')){ p++; let r = ''; while(toks[p] && !isOp(')')) r += one() + ' '; p++; return r; }
          return one();
        }
        case 'if': { p++; const hdr = slice(['{']); let s; const sc = hdr.findIndex(x => x.v === ';'); if(sc > 0) s = `{ ${simpleStmt(hdr.slice(0, sc))} if (${conv(hdr.slice(sc + 1))}) ${block()}`; else s = `if (${conv(hdr)}) ${block()}`;
          if(isId('else')){ p++; s += ' else ' + (isId('if') ? stmt() : block()); }
          if(sc > 0) s += ' }'; return s; }
        case 'for': {
          p++;
          const hdr = slice(['{']);
          if(!hdr.length) return `for (;;) ${block()}`;
          const ri = hdr.findIndex(x => x.v === 'range');
          if(ri >= 0){
            const names = hdr.slice(0, ri).filter(x => x.t === 'id').map(x => x.v);
            if(names.length === 1 && !hdr.slice(0, ri).some(x => x.v === ',')) { names.push('_'); }
            const [k, v] = names.length ? names : ['_', '_'];
            const nm = [k === '_' ? '__k' : k, v === '_' ? '__v' : v];
            scopeDecl.push(new Set(nm));
            const b = block(); scopeDecl.pop();
            return `for (const [${nm[0]}, ${nm[1]}] of __range(${conv(hdr.slice(ri + 1))})) ${b}`;
          }
          const sc = []; let cur = [], d = 0; for(const x of hdr){ if(x.v === ';' && d === 0){ sc.push(cur); cur = []; continue; } if('([{'.includes(x.v)) d++; if(')]}'.includes(x.v)) d--; cur.push(x); }
          sc.push(cur);
          if(sc.length === 3){
            scopeDecl.push(new Set());
            const init = simpleStmt(sc[0], true), cond = conv(sc[1]), post = conv(sc[2]);
            const b = block(); scopeDecl.pop();
            return `for (${init}; ${cond}; ${post}) ${b}`;
          }
          return `while (${conv(hdr)}) ${block()}`;
        }
        case 'switch': {
          p++; const hdr = slice(['{']); expectOp('{');
          let out = hdr.length ? `switch (${conv(hdr)}) {` : 'switch (true) {';
          let open = false;
          while(toks[p] && !isOp('}')){
            if(isId('case') || isId('default')){
              if(open) out += ' break;';
              if(isId('default')){ p++; expectOp(':'); out += ' default:'; }
              else { p++; const a = slice([':']); expectOp(':'); const parts = []; let cur = [], d = 0; for(const x of a){ if(x.v === ',' && d === 0){ parts.push(cur); cur = []; continue; } if('([{'.includes(x.v)) d++; if(')]}'.includes(x.v)) d--; cur.push(x); } parts.push(cur); out += parts.map(pp => ` case ${conv(pp)}:`).join(''); }
              open = true;
            } else out += ' ' + stmt();
          }
          expectOp('}'); if(open) out += ' break;'; return out + ' }';
        }
        case 'return': { p++; const a = simple(false); if(!a.length) return 'return;'; const parts = []; let cur = [], d = 0; for(const x of a){ if(x.v === ',' && d === 0){ parts.push(cur); cur = []; continue; } if('([{'.includes(x.v)) d++; if(')]}'.includes(x.v)) d--; cur.push(x); } parts.push(cur); return parts.length > 1 ? `return [${parts.map(conv).join(', ')}];` : `return ${conv(parts[0])};`; }
        case 'break': case 'continue': { p++; lineEnd(t); return t.v + ';'; }
        case 'fallthrough': { p++; return ''; }
        case 'select': throw err('select/canais não suportados');
      }
    }
    const a = simple(false);
    return simpleStmt(a);
  }
  const out = [];
  while(p < toks.length) out.push(stmt());
  return { code: out.join('\n'), hasMain: userFns.has('main') };
}
RUNNERS.go = async function(src){
  const api = goApi();
  const r = goTranspile(src);
  const names = Object.keys(api).filter(n => /^[A-Za-z_$][\w$]*$/.test(n) && !['true', 'false', 'nil', 'new_', 'error', 'delete', 'new', 'class', 'var', 'let', 'const', 'default', 'switch', 'case', 'function'].includes(n));
  const code = '"use strict";\n' + r.code + '\n;return typeof main === "function" ? main : null;';
  let fn; try { fn = new AF(...names, code); } catch(e){ console.warn(code); throw new Error('erro de compilação (Go): ' + e.message); }
  const main = await fn(...names.map(n => api[n]));
  if(!main) throw new Error('func main() não encontrada');
  await main();
};

/* ======================== Rust ======================== */
function rsApi(){
  const fmtR = (f, args) => { let i = 0; return String(f).replace(/\{\{|\}\}|\{([^{}:]*)(?::([^{}]*))?\}/g, (all, name, spec) => { if(all === '{{') return '{'; if(all === '}}') return '}'; const v = args[i++]; if(!spec) return typeof v === 'object' && v !== null ? JSON.stringify(v) : (typeof v === 'boolean' ? String(v) : String(v)); const m = spec.match(/^(?:(.)?([<>^]))?(\+)?(#)?(0)?(\d+)?(?:\.(\d+))?([?xXbeo])?$/); if(!m) return String(v); let [, fill, al, plus, alt, zero, w, pr, ty] = m; let s; if(ty === '?') s = JSON.stringify(v); else if(ty === 'x') s = Math.trunc(v).toString(16); else if(ty === 'X') s = Math.trunc(v).toString(16).toUpperCase(); else if(ty === 'b') s = Math.trunc(v).toString(2); else if(ty === 'e') s = (+v).toExponential(pr === undefined ? 6 : +pr); else if(pr !== undefined) s = (+v).toFixed(+pr); else s = String(v); if(alt && ty === 'x') s = '0x' + s; if(plus && v >= 0) s = '+' + s; if(w){ const W = +w; fill = fill || (zero ? '0' : ' '); al = al || (typeof v === 'number' ? '>' : '<'); if(s.length < W){ const pad = W - s.length; s = al === '<' ? s + fill.repeat(pad) : al === '>' ? fill.repeat(pad) + s : fill.repeat(Math.floor(pad / 2)) + s + fill.repeat(Math.ceil(pad / 2)); } } return s; }); };
  const intf = v => Math.trunc(+v) || 0;
  const api = {
    HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2,
    pin_mode: (p, m) => HAL.pinMode(p, m), digital_write: (p, v) => HAL.digitalWrite(p, v), digital_read: p => HAL.digitalRead(p), analog_read: p => HAL.analogRead(p), analog_write: (p, v) => HAL.analogWrite(p, v, 255),
    delay: ms => HAL.delay(ms), delay_ms: ms => HAL.delay(ms), delay_us: us => HAL.delayUs(us), millis: () => HAL.millis(), micros: () => HAL.micros(), tone: (p, f) => HAL.tone(p, f), no_tone: p => HAL.noTone(p), servo_write: (p, a) => HAL.servoWrite(p, a), map_range: (v, a, b, c, d) => Math.trunc((v - a) * (d - c) / (b - a) + c), constrain: (v, a, b) => Math.max(a, Math.min(b, v)),
    println: (f, ...a) => HAL.write(fmtR(f === undefined ? '' : f, a) + '\n'), print: (f, ...a) => HAL.write(fmtR(f, a)), eprintln: (f, ...a) => HAL.write(fmtR(f, a) + '\n'), format: (f, ...a) => fmtR(f, a), panic: (f, ...a) => { throw new Error('panic: ' + fmtR(f, a)); }, assert: (c, f, ...a) => { if(!c) throw new Error('assertion failed' + (f ? ': ' + fmtR(f, a) : '')); }, assert_eq: (a, b) => { if(a !== b) throw new Error('assertion failed: ' + a + ' != ' + b); },
    Pin: { new: id => nameProxy(pinObj(id)) }, display: (...a) => nameProxy(HAL.gfx(a.length ? [].concat(a) : null)), touch: () => { const t = HAL.touch(); return nameProxy(t ? Object.assign({}, t, { get_point: () => { const p = t.get_point() || { x: 0, y: 0, z: 0 }; return nameProxy({ x: p.x, y: p.y, z: p.z }); } }) : { touched: () => false }); },
    __idiv: (a, b) => { if(b === 0) throw new Error('panic: divisão por zero'); return Math.trunc(a / b); }, __int: intf, __asI: v => intf(v), __asF: v => +v, __asU8: v => intf(v) & 255, __asU16: v => intf(v) & 65535, __asU32: v => intf(v) >>> 0, __asI8: v => (intf(v) << 24) >> 24, __asI16: v => (intf(v) << 16) >> 16, __asBool: v => !!v,
    delay_obj: { delay_ms: ms => HAL.delay(ms), delay_us: us => HAL.delayUs(us) }, timer: { delay_ms: ms => HAL.delay(ms) }, abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow, sin: Math.sin, cos: Math.cos, PI: Math.PI,
    __iter: x => Array.isArray(x) ? x : typeof x === 'string' ? [...x] : x, __iterRange: (a, b, incl) => { const r = []; for(let i = a; incl ? i <= b : i < b; i++) r.push(i); return r; }, rand_u32: () => Math.floor(Math.random() * 4294967296), random: Math.random, random_range: (a, b) => Math.floor(a + Math.random() * (b - a + 1)), tone_ms: (p, f, d) => HAL.tone(p, f, d)
  };
  api.delay_obj_ = api.delay_obj;
  return api;
}
function rsTranspile(src){
  let toks = ctok(src).filter(t => t.t !== 'pp');
  // ctok trata ' como char: lifetimes ('a) raras; macros: id ! (
  let p = 0;
  const userFns = new Set(), types = new Map();
  for(let i = 0; i < toks.length; i++){ if(toks[i].v === 'fn' && toks[i + 1] && toks[i + 1].t === 'id') userFns.add(toks[i + 1].v); }
  const err = m => { const e = new Error(m); e.line = (toks[p] || {}).line; return e; };
  const isOp = (v, o) => { const t = toks[p + (o || 0)]; return t && t.t === 'op' && t.v === v; };
  const isId = (v, o) => { const t = toks[p + (o || 0)]; return t && t.t === 'id' && t.v === v; };
  const expectOp = v => { if(!isOp(v)) throw err('esperava "' + v + '" mas veio "' + (toks[p] ? toks[p].v : 'fim') + '"'); p++; };
  function slice(stops){ const r = []; let d = 0; while(p < toks.length){ const t = toks[p]; if(t.t === 'op'){ if(d === 0 && '([{'.includes(t.v) && stops.includes(t.v)) break; if('([{'.includes(t.v)) d++; else if(')]}'.includes(t.v)){ if(d === 0 && stops.includes(t.v)) break; d--; } else if(d === 0 && stops.includes(t.v)) break; } r.push(t); p++; } return r; }
  const tyOf = t => { if(!t) return null; if(t.t === 'num') return t.f ? 'float' : 'int'; if(t.t === 'id') return types.get(t.v) || null; return null; };
  const kindOfT = name => INTT.has(name) ? 'int' : FLT.has(name) ? 'float' : name === 'bool' ? 'bool' : (name === 'str' || name === 'String') ? 'str' : 'other';
  function conv(tk){
    const out = []; const L = tk.length;
    for(let j = 0; j < L; j++){
      const t = tk[j], nx = tk[j + 1], pv = tk[j - 1];
      if(t.t === 'num'){ out.push(t.v); continue; } if(t.t === 'str'){ out.push('"' + t.v.replace(/"/g, '\\"') + '"'); continue; } if(t.t === 'chr'){ out.push(String(t.v)); continue; }
      if(t.t === 'id'){
        if(t.v === 'as' && nx){ // cast postfix
          // extrai o termo primário completo antes de "as": ident, chamadas f(x), índices a[i] e cadeias a.b().c
          const popOne = () => {
            const t0 = out.pop();
            if(t0 === ')' || t0 === ']'){
              const open = t0 === ')' ? '(' : '['; let d = 1; const tmp = [t0];
              while(out.length && d){ const x = out.pop(); tmp.unshift(x); if(x === t0) d++; if(x === open) d--; }
              if(out.length && /^\w+$/.test(out[out.length - 1]) && !/^(if|while|match|return|let|in|loop)$/.test(out[out.length - 1])) tmp.unshift(out.pop());
              return tmp.join('');
            }
            return t0;
          };
          let last = popOne();
          while(out.length && out[out.length - 1] === '.'){ out.pop(); last = popOne() + '.' + last; }
          const ty = nx.v; j++;
          const fn = INTT.has(ty) ? ({ u8: '__asU8', u16: '__asU16', u32: '__asU32', i8: '__asI8', i16: '__asI16' }[ty] || '__asI') : FLT.has(ty) ? '__asF' : ty === 'bool' ? '__asBool' : '';
          out.push(fn ? fn + '(' + last + ')' : last); continue;
        }
        if(nx && nx.v === '!' && tk[j + 2] && (tk[j + 2].v === '(' || tk[j + 2].v === '[')){ if(t.v === 'vec'){ out.push(''); j++; continue; } out.push(t.v); j++; continue; }
        if(t.v === 'None'){ out.push('null'); continue; } if(t.v === 'Some' && nx && nx.v === '('){ continue; }
        if(t.v === 'mut' || t.v === 'ref' || t.v === 'unsafe'){ continue; }
        if((t.v === 'unwrap' || t.v === 'expect' || t.v === 'unwrap_or_default') && pv && pv.v === '.' && nx && nx.v === '('){ let d = 0, k = j + 1; for(; k < L; k++){ if(tk[k].v === '(') d++; if(tk[k].v === ')'){ d--; if(!d) break; } } out.pop(); j = k; continue; }
        if(t.v === 'clone' && pv && pv.v === '.' && nx && nx.v === '(' ){ out.pop(); j += 2; continue; }
        if((t.v === 'len') && pv && pv.v === '.' && nx && nx.v === '(' && tk[j + 2] && tk[j + 2].v === ')'){ out.pop(); out.push('.length'); j += 2; continue; }
        if(t.v === 'delay' && nx && nx.v === '(' && !(pv && pv.v === '.')){ out.push('(await delay'); let d = 0, k = j + 1; for(; k < L; k++){ if(tk[k].v === '(') d++; if(tk[k].v === ')'){ d--; if(!d) break; } } tk[k] = Object.assign({}, tk[k], { closeAwait: true }); continue; }
        if(/^(delay_ms|delay_us)$/.test(t.v) && nx && nx.v === '('){ out.push('(await ' + (pv && pv.v === '.' ? '' : '') + t.v); let d = 0, k = j + 1; for(; k < L; k++){ if(tk[k].v === '(') d++; if(tk[k].v === ')'){ d--; if(!d) break; } } tk[k] = Object.assign({}, tk[k], { closeAwait: true }); continue; }
        if(nx && nx.v === '(' && userFns.has(t.v) && !(pv && (pv.v === '.' || pv.v === '::'))){ out.push('(await ' + t.v); let d = 0, k = j + 1; for(; k < L; k++){ if(tk[k].v === '(') d++; if(tk[k].v === ')'){ d--; if(!d) break; } } tk[k] = Object.assign({}, tk[k], { closeAwait: true }); continue; }
        out.push(t.v); continue;
      }
      const v = t.v;
      if(t.closeAwait && v === ')'){ out.push('))'); continue; }
      if(v === '::'){ out.push('.'); continue; }
      if(v === '&' && !(pv && (pv.t === 'id' || pv.t === 'num' || pv.v === ')' || pv.v === ']'))){ continue; }
      if(v === '*' && !(pv && (pv.t === 'id' || pv.t === 'num' || pv.v === ')' || pv.v === ']'))){ continue; }
      if(v === '|' && !(pv && (pv.t === 'id' || pv.t === 'num' || pv.v === ')' || pv.v === ']'))){ // closure |a, b| expr
        let k = j + 1; while(tk[k] && tk[k].v !== '|') k++;
        out.push('(async (' + tk.slice(j + 1, k).filter(x => x.t === 'id' && !/^(mut)$/.test(x.v)).map(x => x.v).join(', ') + ') =>'); // fechado abaixo
        // corpo até o fim do argumento
        let d = 0, e = k + 1; for(; e < L; e++){ if('([{'.includes(tk[e].v)) d++; if(')]}'.includes(tk[e].v)){ if(d === 0) break; d--; } if(tk[e].v === ',' && d === 0) break; }
        out.push(conv(tk.slice(k + 1, e)) + ')'); j = e - 1; continue;
      }
      if(v === '/' && pv && nx && tyOf(pv) === 'int' && tyOf(nx) === 'int' && !(tk[j + 2] && /^(\(|\.|\[)$/.test(tk[j + 2].v))){ const l = out.pop(); out.push('__idiv(' + l + ', ' + nx.v + ')'); j++; continue; }
      if(v === '..' || v === '..='){ out.push(v === '..' ? ',' : ',', ''); }
      else out.push(v);
    }
    return out.join(' ').replace(/\s+\./g, '.').replace(/\.\s+/g, '.').replace(/\s+\(/g, '(').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+,/g, ',').replace(/\s+\[/g, '[').replace(/\[\s+/g, '[').replace(/\s+\]/g, ']').replace(/\(await\s+(\w+)\s*\(/g, '(await $1(').replace(/\.\s*(\w)/g, '.$1');
  }
  function typeAfterColon(tk){ const id = tk.find(x => x.t === 'id' && !/^mut$/.test(x.v)); return id ? kindOfT(id.v) : 'other'; }
  function block(retType){
    expectOp('{'); const stmts = [];
    while(p < toks.length && !isOp('}')){ const st = stmt(); stmts.push(st); }
    expectOp('}');
    if(retType && stmts.length){ const last = stmts[stmts.length - 1]; if(last.tail) last.js = 'return ' + last.js.replace(/;$/, '') + ';'; }
    return '{' + stmts.map(s => s.js).join('\n') + '}';
  }
  function stmt(){
    const t = toks[p];
    const wrap = (js, tail) => ({ js, tail: !!tail });
    if(!t) return wrap('');
    if(t.t === 'op'){ if(t.v === '{') return wrap(block()); if(t.v === ';'){ p++; return wrap(';'); } }
    if(t.t === 'id'){
      switch(t.v){
        case 'use': case 'mod': case 'extern': { while(toks[p] && !isOp(';')){ if(isOp('{')){ let d = 0; do { if(isOp('{')) d++; if(isOp('}')) d--; p++; } while(d); break; } p++; } if(isOp(';')) p++; return wrap(''); }
        case 'fn': {
          p++; const name = toks[p].v; p++;
          if(isOp('<')){ while(toks[p] && !isOp('>')) p++; p++; }
          expectOp('('); const names = []; let cur = [], d = 0;
          const flush = () => { if(!cur.length) return; const ci = cur.findIndex(x => x.v === ':'); const nm = cur.slice(0, ci < 0 ? cur.length : ci).filter(x => x.t === 'id' && x.v !== 'mut').pop(); if(nm){ names.push(nm.v); types.set(nm.v, ci >= 0 ? typeAfterColon(cur.slice(ci + 1)) : 'other'); } cur = []; };
          while(toks[p] && !(isOp(')') && d === 0)){ if(isOp('(') || isOp('[') || isOp('<')) d++; if(isOp(')') || isOp(']') || isOp('>')) d--; if(isOp(',') && d === 0){ flush(); p++; continue; } cur.push(toks[p]); p++; }
          flush(); expectOp(')');
          let ret = false; if(isOp('->')){ ret = true; p++; while(toks[p] && !isOp('{')) p++; }
          if(!isOp('{')) throw err('fn sem corpo');
          return wrap(`async function ${name}(${names.join(', ')}) ${block(ret)}`);
        }
        case 'let': {
          p++; if(isId('mut')) p++;
          let pat = []; while(toks[p] && !isOp('=') && !isOp(':') && !isOp(';')){ pat.push(toks[p]); p++; }
          let ty = null; if(isOp(':')){ p++; const tt = []; while(toks[p] && !isOp('=') && !isOp(';')){ tt.push(toks[p]); p++; } ty = typeAfterColon(tt); }
          let init = null; if(isOp('=')){ p++; init = slice([';']); } if(isOp(';')) p++;
          const names = pat.filter(x => x.t === 'id' && x.v !== 'mut');
          const isTuple = pat.some(x => x.v === '(');
          if(names.length === 1 && !isTuple){
            const n = names[0].v; const k = ty || (init && init.length === 1 && tyOf(init[0])) || 'other'; types.set(n, k);
            if(!init) return wrap(`let ${n};`);
            // if-expression
            if(init[0] && init[0].v === 'if'){ const parsed = ifExpr(init); return wrap(`let ${n} = ${parsed};`); }
            if(init[0] && init[0].v === 'match'){ return wrap(`let ${n} = ${matchExpr(init)};`); }
            let e = conv(init); if(k === 'int' && !(init.length === 1 && init[0].t === 'num')) e = `__int(${e})`;
            return wrap(`let ${n} = ${e};`);
          }
          names.forEach(x => types.set(x.v, 'other'));
          return wrap(`let [${names.map(x => x.v).join(', ')}] = ${conv(init || [])};`);
        }
        case 'const': case 'static': { p++; if(isId('mut')) p++; const n = toks[p].v; p++; let ty = null; if(isOp(':')){ p++; const tt = []; while(toks[p] && !isOp('=')){ tt.push(toks[p]); p++; } ty = typeAfterColon(tt); } expectOp('='); const init = slice([';']); if(isOp(';')) p++; types.set(n, ty || 'other'); return wrap(`const ${n} = ${conv(init)};`); }
        case 'loop': { p++; return wrap(`for (;;) ${block()}`); }
        case 'while': { p++; const c = slice(['{']); return wrap(`while (${conv(c)}) ${block()}`); }
        case 'for': {
          p++; const names = []; while(toks[p] && !isId('in')){ if(toks[p].t === 'id' && toks[p].v !== 'mut') names.push(toks[p].v); p++; } p++;
          const hdr = slice(['{']);
          const di = hdr.findIndex(x => x.v === '..' || x.v === '..=');
          names.forEach(n => types.set(n, 'int'));
          if(di >= 0){ const a = conv(hdr.slice(0, di)), b = conv(hdr.slice(di + 1)); return wrap(`for (let ${names[0]} = ${a}; ${names[0]} ${hdr[di].v === '..=' ? '<=' : '<'} ${b}; ${names[0]}++) ${block()}`); }
          return wrap(`for (const ${names.length > 1 ? '[' + names.join(', ') + ']' : names[0]} of __iter(${conv(hdr)})) ${block()}`);
        }
        case 'if': { p++; const c = slice(['{']); let s = `if (${conv(c)}) ${block()}`; while(isId('else')){ p++; if(isId('if')){ p++; const c2 = slice(['{']); s += ` else if (${conv(c2)}) ${block()}`; } else { s += ' else ' + block(); break; } } return wrap(s); }
        case 'match': { p++; const subj = slice(['{']); return wrap(matchStmt(conv(subj))); }
        case 'return': { p++; const a = slice([';', '}']); if(isOp(';')) p++; return wrap(a.length ? `return ${conv(a)};` : 'return;'); }
        case 'break': case 'continue': { p++; if(isOp(';')) p++; return wrap(t.v + ';'); }
        case 'struct': case 'impl': case 'enum': case 'trait': case 'type': throw err('"' + t.v + '" ainda não é suportado no Rust do Kezle (use funções e variáveis)');
      }
    }
    const a = slice([';', '}']);
    const hadSemi = isOp(';'); if(hadSemi) p++;
    if(a.length > 2 && a[0].t === 'id' && a[1].v === '=' && types.get(a[0].v) === 'int' && !(a.length === 3 && a[2].t === 'num')) return wrap(`${a[0].v} = __int(${conv(a.slice(2))});`);
    if(a.length > 2 && a[0].t === 'id' && a[1].v === '/=' && types.get(a[0].v) === 'int') return wrap(`${a[0].v} = __idiv(${a[0].v}, ${conv(a.slice(2))});`);
    return wrap(conv(a) + ';', !hadSemi);
  }
  function ifExpr(tk){ // if c { a } else { b }  como expressão
    const ci = tk.findIndex((x, i) => i > 0 && x.v === '{'); const cond = conv(tk.slice(1, ci));
    let d = 0, e = ci; for(; e < tk.length; e++){ if(tk[e].v === '{') d++; if(tk[e].v === '}'){ d--; if(!d) break; } }
    const a = conv(tk.slice(ci + 1, e));
    let rest = tk.slice(e + 1);
    if(rest[0] && rest[0].v === 'else'){ rest = rest.slice(1); if(rest[0].v === 'if') return `(${cond} ? ${a} : ${ifExpr(rest)})`; const inner = rest.slice(1, rest.length - 1); return `(${cond} ? ${a} : ${conv(inner)})`; }
    return `(${cond} ? ${a} : null)`;
  }
  function armCond(subj, pat){
    const parts = []; let cur = []; for(const x of pat){ if(x.v === '|'){ parts.push(cur); cur = []; } else cur.push(x); } parts.push(cur);
    return parts.map(pp => { if(pp.length === 1 && pp[0].v === '_') return 'true'; const ri = pp.findIndex(x => x.v === '..=' || x.v === '..'); if(ri >= 0) return `(${subj} >= ${conv(pp.slice(0, ri))} && ${subj} ${pp[ri].v === '..=' ? '<=' : '<'} ${conv(pp.slice(ri + 1))})`; return `${subj} === ${conv(pp)}`; }).join(' || ');
  }
  function matchStmt(subjJs){
    expectOp('{'); let s = `{ const __m = ${subjJs}; `; let first = true;
    while(toks[p] && !isOp('}')){
      const pat = []; while(toks[p] && !isOp('=>')){ pat.push(toks[p]); p++; } p++;
      const cond = armCond('__m', pat);
      let body;
      if(isOp('{')){ body = block(); } else { const a = slice([',', '}']); body = '{ ' + conv(a) + '; }'; }
      if(isOp(',')) p++;
      s += (first ? '' : ' else ') + (cond === 'true' ? (first ? '' : '') + body : `if (${cond}) ${body}`); first = false;
    }
    expectOp('}'); return s + ' }';
  }
  function matchExpr(tk){ const saveT = toks, saveP = p; toks = tk.slice(1); p = 0; try { const ci = toks.findIndex(x => x.v === '{'); const subj = conv(toks.slice(0, ci)); p = ci; const parts = []; expectOp('{'); while(toks[p] && !isOp('}')){ const pat = []; while(toks[p] && !isOp('=>')){ pat.push(toks[p]); p++; } p++; const a = slice([',', '}']); if(isOp(',')) p++; parts.push([armCond('__m', pat), conv(a)]); } let r = 'null'; for(let i = parts.length - 1; i >= 0; i--) r = parts[i][0] === 'true' ? parts[i][1] : `(${parts[i][0]} ? ${parts[i][1]} : ${r})`; return `((__m) => ${r})(${subj})`; } finally { toks = saveT; p = saveP; } }
  const out = [];
  while(p < toks.length) out.push(stmt().js);
  return { code: out.join('\n'), hasMain: userFns.has('main') };
}
RUNNERS.rs = async function(src){
  const api = rsApi();
  const r = rsTranspile(src);
  const names = Object.keys(api).filter(n => /^[A-Za-z_$][\w$]*$/.test(n));
  const code = '"use strict";\n' + r.code + '\n;return typeof main === "function" ? main : null;';
  let fn; try { fn = new AF(...names, code); } catch(e){ console.warn(code); throw new Error('erro de compilação (Rust): ' + e.message); }
  const main = await fn(...names.map(n => api[n]));
  if(!main) throw new Error('fn main() não encontrada');
  await main();
};

window.KezleLang.goTranspile = goTranspile; window.KezleLang.rsTranspile = rsTranspile;
})();
