/* =========================================================================
   Kezle Lab Pro — HAL compartilhado por TODAS as linguagens
   (MicroPython, CircuitPython, C++/Arduino, C, JavaScript, Lua, BASIC, Go, Rust)
   Pinos, PWM, ADC, interrupções, servo, tone, displays (GFX) e touch.
   ========================================================================= */
(function(){
'use strict';
const HAL = window.KezleHAL = { timers: [], watchers: [] };
const SC = () => window.KezleScreens;

/* ---------- ciclo de vida da execução ---------- */
HAL.begin = function(){
  HAL.cleanup();
  RUN.t0 = performance.now();
  for(const k in PINS) delete PINS[k];
  for(const k in IRQMAP) delete IRQMAP[k];
  if(SC()) SC().onRunStart();
  CIRCUIT.request();
};
HAL.cleanup = function(){
  HAL.timers.forEach(t => { clearInterval(t); clearTimeout(t); });
  HAL.timers = [];
  HAL.watchers.forEach(t => clearInterval(t));
  HAL.watchers = [];
};
const origStop = window.stopCode;
window.stopCode = function(){ origStop(); HAL.cleanup(); };

/* ---------- pinos ---------- */
const MODE = { 0: 'in', 1: 'out', 2: 'in_up', 3: 'in_down', in: 'in', out: 'out', INPUT: 'in', OUTPUT: 'out', INPUT_PULLUP: 'in_up', INPUT_PULLDOWN: 'in_down' };
HAL.pinMode = function(p, m){
  p = +p;
  const md = MODE[m] || 'in';
  const ps = PINS[p] = PINS[p] || {};
  if(md === 'out'){ ps.mode = 'out'; ps.pull = null; if(ps.v == null) ps.v = 0; }
  else { ps.mode = 'in'; ps.pull = md === 'in_up' ? 'up' : md === 'in_down' ? 'down' : null; ps.duty = undefined; }
  CIRCUIT.request();
};
HAL.digitalWrite = function(p, v){
  p = +p;
  const ps = PINS[p] = PINS[p] || {};
  if(ps.mode === 'in'){ ps.pull = v ? 'up' : null; CIRCUIT.request(); return; }
  pinWrite(p, v ? 1 : 0);
};
HAL.digitalRead = function(p){ return HWRead.digital(+p); };
HAL.analogRead = function(p){
  p = +p;
  // A0..An -> GPIO
  const mcu = CIRCUIT.primaryMcu();
  if(p >= 100 && mcu){ const nm = (mcu.def.pinNames || []).find(n => n === 'A' + (p - 100)); if(nm) p = CIRCUIT.gpioOf(mcu.def, nm); }
  return readADC(p);
};
HAL.analogWrite = function(p, v, max){
  p = +p; max = max || 255;
  const ps = PINS[p] = PINS[p] || {};
  ps.mode = 'out';
  v = clamp(+v || 0, 0, max);
  ps.freq = ps.freq || 490;
  pwmWrite(p, v / max * 1023);
  if(v >= max) pinWrite(p, 1); else if(v <= 0) pinWrite(p, 0);
};
HAL.pwm = function(p, freq, duty1023){
  p = +p;
  const ps = PINS[p] = PINS[p] || {};
  ps.mode = 'out'; if(freq) ps.freq = freq;
  duty1023 = clamp(+duty1023 || 0, 0, 1023);
  if(ps.freq >= 40 && ps.freq <= 60){ const pulse = duty1023 / 1023 * 1000 / ps.freq; ps.angle = clamp((pulse - 0.5) / 2 * 180, 0, 180); }
  pwmWrite(p, duty1023);
  if(duty1023 >= 1023) pinWrite(p, 1);
};
HAL.servoWrite = function(p, angle){
  p = +p;
  const ps = PINS[p] = PINS[p] || {};
  ps.mode = 'out'; ps.freq = 50; ps.angle = clamp(+angle || 0, 0, 180);
  pwmWrite(p, 25 + ps.angle / 180 * 103);
  ps.angle = clamp(+angle || 0, 0, 180);
};
HAL.tone = function(p, f, dur){
  p = +p;
  const ps = PINS[p] = PINS[p] || {};
  ps.mode = 'out'; ps.freq = +f; pwmWrite(p, 512);
  if(dur) setTimeout(() => HAL.noTone(p), dur);
};
HAL.noTone = function(p){ p = +p; const ps = PINS[p] = PINS[p] || {}; ps.freq = 0; pwmWrite(p, 0); pinWrite(p, 0); };
HAL.delay = ms => wait(+ms || 0);
HAL.delayUs = us => wait((+us || 0) / 1000);
HAL.millis = () => Math.floor(performance.now() - (RUN.t0 || 0));
HAL.micros = () => Math.floor((performance.now() - (RUN.t0 || 0)) * 1000);
HAL.pulseIn = async function(p, level, timeout){ // mede largura real de pulso observando o pino
  const t0 = performance.now(); let tStart = null;
  while(performance.now() - t0 < (timeout || 1000) / 1000 * 1000 + 50){
    const v = HAL.digitalRead(p);
    if(tStart == null && v === level) tStart = performance.now();
    else if(tStart != null && v !== level) return Math.round((performance.now() - tStart) * 1000);
    await wait(1);
  }
  return 0;
};
HAL.attach = function(p, cb, edge){ // edge: 'rising'|'falling'|'change'
  p = +p;
  let last = HAL.digitalRead(p);
  const t = setInterval(() => {
    if(!RUN.on) return;
    const v = HAL.digitalRead(p);
    if(v !== last){
      const r = last === 0 && v === 1, f = last === 1 && v === 0;
      last = v;
      if(edge === 'change' || (edge === 'rising' && r) || (edge === 'falling' && f)){ try { const x = cb(p, v); if(x && x.catch) x.catch(() => {}); } catch(e){} }
    }
  }, 4);
  HAL.watchers.push(t);
  return t;
};
HAL.every = function(ms, cb, once){
  const t = once ? setTimeout(() => { if(RUN.on) call(cb); }, ms) : setInterval(() => { if(RUN.on) call(cb); }, ms);
  HAL.timers.push(t);
  return t;
  function call(f){ try { const r = f(); if(r && r.catch) r.catch(e => serialOut('⛔ ' + (e.message || e), 'err')); } catch(e){ serialOut('⛔ ' + (e.message || e), 'err'); } }
};

/* ---------- saída serial ---------- */
let line = '';
HAL.write = function(s){
  line += s;
  let i;
  while((i = line.indexOf('\n')) >= 0){ serialOut(line.slice(0, i).replace(/\r$/, '')); line = line.slice(i + 1); }
};
HAL.flush = function(){ if(line){ serialOut(line); line = ''; } };

/* ---------- formatação estilo C ---------- */
HAL.printf = function(fmt, ...a){
  let i = 0;
  return String(fmt).replace(/%(?:(\d+)\$)?([-+ 0#]*)(\*|\d+)?(?:\.(\d+))?(hh|h|ll|l|z|j|t|L)?([diouxXeEfFgGcsp%])/g, (all, pos, flags, width, prec, len, t) => {
    if(t === '%') return '%';
    if(width === '*') width = a[i++];
    let v = a[i++], s;
    switch(t){
      case 'd': case 'i': s = String(Math.trunc(+v)); break;
      case 'u': s = String(Math.trunc(+v) >>> 0); break;
      case 'o': s = Math.trunc(v).toString(8); break;
      case 'x': s = (Math.trunc(v) >>> 0).toString(16); break;
      case 'X': s = (Math.trunc(v) >>> 0).toString(16).toUpperCase(); break;
      case 'f': case 'F': s = (+v).toFixed(prec === undefined ? 6 : +prec); break;
      case 'e': case 'E': s = (+v).toExponential(prec === undefined ? 6 : +prec).replace(/e([+-])(\d)$/, 'e$10$2'); if(t === 'E') s = s.toUpperCase(); break;
      case 'g': case 'G': s = String(+(+v).toPrecision(prec === undefined ? 6 : +prec || 1)); break;
      case 'c': s = typeof v === 'number' ? String.fromCharCode(v) : String(v)[0]; break;
      case 'p': s = '0x' + (Math.trunc(v) >>> 0).toString(16); break;
      default: s = String(v); if(prec !== undefined) s = s.slice(0, +prec);
    }
    if(flags.includes('+') && typeof v === 'number' && v >= 0 && 'dif'.includes(t)) s = '+' + s;
    if(width){
      const w = +width;
      if(s.length < w){
        if(flags.includes('-')) s = s.padEnd(w);
        else if(flags.includes('0') && !/[sc]/.test(t)){ const sg = /^[+-]/.test(s) ? s[0] : ''; s = sg + s.slice(sg.length).padStart(w - sg.length, '0'); }
        else s = s.padStart(w);
      }
    }
    return s;
  });
};

/* ---------- Display / GFX unificado (superset de nomes de várias bibliotecas) ---------- */
const COLORS = {
  BLACK: 0x0000, NAVY: 0x000F, DARKGREEN: 0x03E0, DARKCYAN: 0x03EF, MAROON: 0x7800, PURPLE: 0x780F, OLIVE: 0x7BE0, LIGHTGREY: 0xD69A,
  DARKGREY: 0x7BEF, BLUE: 0x001F, GREEN: 0x07E0, CYAN: 0x07FF, RED: 0xF800, MAGENTA: 0xF81F, YELLOW: 0xFFE0, WHITE: 0xFFFF, ORANGE: 0xFDA0,
  GREENYELLOW: 0xB7E0, PINK: 0xFE19, BROWN: 0x9A60, GOLD: 0xFEA0, SILVER: 0xC618, SKYBLUE: 0x867D, VIOLET: 0x915C
};
HAL.COLORS = COLORS;
function allColors(){
  const o = {};
  for(const k in COLORS) for(const pre of ['TFT_', 'ST77XX_', 'ILI9341_', 'ILI9488_', 'ST7735_', 'GC9A01A_', 'ST7796S_', 'HX8357_', 'RGB565_', 'COLOR_', 'GxEPD_'] ) o[pre + k] = COLORS[k];
  o.SSD1306_WHITE = 1; o.SSD1306_BLACK = 0; o.SSD1306_INVERSE = 2; o.WHITE_OLED = 1; o.SH110X_WHITE = 1; o.SH110X_BLACK = 0; o.U8G2_DRAW_ALL = 0;
  o.GxEPD_BLACK = 0x0000; o.GxEPD_WHITE = 0xFFFF; o.GxEPD_RED = 0xF800;
  return o;
}
HAL.colorConsts = allColors;

HAL.screen = function(ctrls, needTouch, hint){
  const inst = SC().findScreen(ctrls, needTouch, hint);
  return inst;
};
const sink = () => { const f = () => 0; return new Proxy({}, { get: () => f }); };

HAL.gfx = function(ctrls, opts){
  const inst = HAL.screen(ctrls, false, opts && opts.hint);
  if(!inst){ serialOut('⚠ Nenhuma tela compatível encontrada na bancada — adicione um display.', 'warn'); return sink(); }
  const gx = SC().makeGfx(inst);
  const sc = gx.sc;
  sc.claimed = true; // cada objeto de display do programa fica com uma tela diferente
  gx.claim();
  const T = { datum: 0, font: 1, wrap: true };
  const num = (a, d) => (typeof a === 'number' ? a : d);
  const colorArg = c => c;
  const sz = () => sc.textSize;
  const api = {
    _inst: inst,
    // --- geral ---
    width: () => gx.width(), height: () => gx.height(), getWidth: () => gx.width(), getHeight: () => gx.height(),
    setRotation: r => { gx.setRotation(r); return 0; }, rotation: r => { gx.setRotation(r); return 0; }, getRotation: () => sc.rot,
    init: () => 1, begin: () => 1, reset: () => 0, on: () => 0, off: () => 0, sleep: () => 0, wake: () => 0, power: () => 0, poweron: () => 0, poweroff: () => 0, sleep_mode: () => 0, cleanup: () => 0,
    initR: () => 0, setSPISpeed: () => 0, enableDisplay: () => 0, displayOn: () => 0, displayOff: () => 0, setAddrWindow: () => 0, startWrite: () => 0, endWrite: () => 0, writeCommand: () => 0, inversion_mode: v => { gx.invert(!!v); return 0; },
    invertDisplay: v => { gx.invert(!!v); return 0; }, invert: v => { gx.invert(v === undefined ? undefined : !!v); return 0; },
    setBrightness: v => { gx.backlight(v / 255); return 0; }, brightness: v => { gx.backlight(v > 1 ? v / 255 : v); return 0; }, contrast: v => { gx.backlight(0.3 + 0.7 * (v / 255)); return 0; }, backlight: v => { gx.backlight(v > 1 ? v / 255 : (v === undefined ? 1 : v)); return 0; }, setContrast: v => { gx.backlight(0.3 + 0.7 * (v / 255)); return 0; },
    ssd1306_command: () => 0, dim: v => { gx.backlight(v ? 0.35 : 1); return 0; },
    // --- limpar/preencher ---
    fill: c => { gx.fill(c == null ? 0 : c); return 0; }, fillScreen: c => { gx.fill(c); return 0; }, clear: c => { gx.fill(c == null ? 0 : c); return 0; }, clearDisplay: () => { gx.fill(0); return 0; },
    clearBuffer: () => { gx.fill(0); return 0; }, cls: c => { gx.fill(c == null ? 0 : c); return 0; }, erase: () => { gx.fill(0); return 0; },
    // --- primitivas ---
    pixel: (x, y, c) => { if(c === undefined) c = 1; gx.px(x, y, c); return 0; }, drawPixel: (x, y, c) => { gx.px(x, y, c); return 0; }, draw_pixel: (x, y, c) => { gx.px(x, y, c); return 0; }, writePixel: (x, y, c) => { gx.px(x, y, c); return 0; },
    hline: (x, y, w, c) => { gx.hline(x, y, w, c == null ? 1 : c); return 0; }, vline: (x, y, h, c) => { gx.vline(x, y, h, c == null ? 1 : c); return 0; },
    drawFastHLine: (x, y, w, c) => { gx.hline(x, y, w, c); return 0; }, drawFastVLine: (x, y, h, c) => { gx.vline(x, y, h, c); return 0; }, draw_hline: (x, y, w, c) => { gx.hline(x, y, w, c); return 0; }, draw_vline: (x, y, h, c) => { gx.vline(x, y, h, c); return 0; },
    line: (a, b, c, d, e) => { gx.line(a, b, c, d, e == null ? 1 : e); return 0; }, drawLine: (a, b, c, d, e) => { gx.line(a, b, c, d, e); return 0; }, draw_line: (a, b, c, d, e) => { gx.line(a, b, c, d, e); return 0; },
    rect: (x, y, w, h, c, f) => { gx.rect(x, y, w, h, c == null ? 1 : c, f); return 0; }, drawRect: (x, y, w, h, c) => { gx.rect(x, y, w, h, c); return 0; },
    fillRect: (x, y, w, h, c) => { gx.fillRect(x, y, w, h, c); return 0; }, fill_rect: (x, y, w, h, c) => { gx.fillRect(x, y, w, h, c == null ? 1 : c); return 0; }, fill_rectangle: (x, y, w, h, c) => { gx.fillRect(x, y, w, h, c); return 0; },
    draw_rectangle: (x, y, w, h, c) => { gx.rect(x, y, w, h, c); return 0; }, drawRectangle: (x, y, w, h, c) => { gx.rect(x, y, w, h, c); return 0; },
    circle: (x, y, r, c, f) => { gx.circle(x, y, r, c == null ? 1 : c, f); return 0; }, drawCircle: (x, y, r, c) => { gx.circle(x, y, r, c); return 0; }, draw_circle: (x, y, r, c) => { gx.circle(x, y, r, c); return 0; },
    fillCircle: (x, y, r, c) => { gx.circle(x, y, r, c, true); return 0; }, fill_circle: (x, y, r, c) => { gx.circle(x, y, r, c, true); return 0; },
    ellipse: (x, y, a, b, c, f) => { gx.ellipse(x, y, a, b, c == null ? 1 : c, f); return 0; }, draw_ellipse: (x, y, a, b, c) => { gx.ellipse(x, y, a, b, c); return 0; }, fill_ellipse: (x, y, a, b, c) => { gx.ellipse(x, y, a, b, c, true); return 0; }, drawEllipse: (x, y, a, b, c) => { gx.ellipse(x, y, a, b, c); return 0; }, fillEllipse: (x, y, a, b, c) => { gx.ellipse(x, y, a, b, c, true); return 0; },
    drawRoundRect: (x, y, w, h, r, c) => { gx.roundRect(x, y, w, h, r, c); return 0; }, fillRoundRect: (x, y, w, h, r, c) => { gx.roundRect(x, y, w, h, r, c, true); return 0; },
    drawTriangle: (a, b, c, d, e, f, g) => { gx.triangle(a, b, c, d, e, f, g); return 0; }, fillTriangle: (a, b, c, d, e, f, g) => { gx.triangle(a, b, c, d, e, f, g, true); return 0; }, triangle: (a, b, c, d, e, f, g, h) => { gx.triangle(a, b, c, d, e, f, g, h); return 0; },
    polygon: (pts, c) => { gx.poly(pts, c); return 0; }, fill_polygon: (pts, c) => { gx.poly(pts, c, true); return 0; },
    scroll: (dx, dy) => { gx.scroll(dx || 0, dy || 0); return 0; },
    // --- texto ---
    text: function(a, b, c, d, e, f){
      // framebuf/ssd1306: text(s,x,y,c)  |  st7789: text(font,s,x,y,fg,bg)
      if(typeof a !== 'string' && typeof b === 'string'){ const w = gx.text(b, c, d, e == null ? 0xFFFF : e, f, 1, 8); return w; }
      if(typeof a !== 'string') a = String(a);
      return gx.text(a, b, c, d == null ? (sc.spec.type === 'tft' ? 0xFFFF : 1) : d, undefined, 1, 8);
    },
    write: function(a, b, c, d, e, f){ if(typeof a !== 'string' && typeof b === 'string') return gx.text(b, c, d, e == null ? 0xFFFF : e, f, 1, 8); return gx.text(String(a), b, c, d == null ? 0xFFFF : d, e, 1, 8); },
    draw_text8x8: (x, y, s, c, bgc) => gx.text(s, x, y, c, bgc, 1, 8), draw_text: (x, y, s, f, c, bgc) => gx.text(s, x, y, c, bgc, 1, 8),
    drawString: (s, x, y, font) => { const w = gx.textW(s, sc.textSize); const dx = T.datum === 1 ? w / 2 : T.datum === 2 ? w : 0; gx.text(s, x - dx, y, sc.textColor, sc.textBg, sc.textSize); return w; },
    drawCentreString: (s, x, y) => { const w = gx.textW(s, sc.textSize); gx.text(s, x - w / 2, y, sc.textColor, sc.textBg, sc.textSize); return w; }, drawCenterString: (s, x, y) => { const w = gx.textW(s, sc.textSize); gx.text(s, x - w / 2, y, sc.textColor, sc.textBg, sc.textSize); return w; },
    drawRightString: (s, x, y) => { const w = gx.textW(s, sc.textSize); gx.text(s, x - w, y, sc.textColor, sc.textBg, sc.textSize); return w; },
    drawNumber: (n, x, y) => gx.text(String(n), x, y, sc.textColor, sc.textBg, sc.textSize), drawFloat: (n, d, x, y) => gx.text((+n).toFixed(d), x, y, sc.textColor, sc.textBg, sc.textSize),
    drawChar: (x, y, ch, fg, bg, size) => { if(typeof x === 'string'){ const t = x; x = y; y = ch; ch = t; } gx.text(typeof ch === 'number' ? String.fromCharCode(ch) : ch, x, y, fg, bg, size || 1); return 0; },
    setTextDatum: d => { T.datum = d; return 0; }, setTextFont: f => { T.font = f; return 0; }, setFreeFont: () => 0, setFont: () => 0, setTextWrap: w => { T.wrap = w; return 0; }, setTextPadding: () => 0, loadFont: () => 0, unloadFont: () => 0,
    setCursor: (x, y) => { gx.setCursor(x, y); return 0; }, setTextColor: (f, b) => { gx.setTextColor(f, b); return 0; }, setTextSize: s => { gx.setTextSize(s); return 0; }, setTextBg: b => { sc.textBg = b; return 0; },
    print: s => { gx.print(typeof s === 'number' && !Number.isInteger(s) ? s.toFixed(2) : s); return 0; }, println: s => { gx.println(s === undefined ? '' : (typeof s === 'number' && !Number.isInteger(s) ? s.toFixed(2) : s)); return 0; }, printf: (f, ...a) => { gx.print(HAL.printf(f, ...a)); return 0; },
    getCursorX: () => sc.cursor.x, getCursorY: () => sc.cursor.y,
    textWidth: s => gx.textW(String(s), sc.textSize), fontHeight: () => 8 * sc.textSize, textHeight: () => 8 * sc.textSize,
    drawStr: (x, y, s) => { gx.text(s, x, y - 8, 1, null, 1); return 0; }, drawUTF8: (x, y, s) => { gx.text(s, x, y - 8, 1, null, 1); return 0; }, // u8g2 (y = linha de base)
    getStrWidth: s => 6 * String(s).length,
    drawFrame: (x, y, w, h) => { gx.rect(x, y, w, h, 1); return 0; }, drawBox: (x, y, w, h) => { gx.fillRect(x, y, w, h, 1); return 0; }, drawHLine: (x, y, w) => { gx.hline(x, y, w, 1); return 0; }, drawVLine: (x, y, h) => { gx.vline(x, y, h, 1); return 0; },
    drawDisc: (x, y, r) => { gx.circle(x, y, r, 1, true); return 0; }, drawCircleU: (x, y, r) => { gx.circle(x, y, r, 1); return 0; },
    // --- imagem ---
    blit_buffer: (buf, x, y, w, h) => { gx.blit(x, y, w, h, buf); return 0; }, pushImage: (x, y, w, h, buf) => { gx.blit(x, y, w, h, buf); return 0; }, drawRGBBitmap: (x, y, buf, w, h) => { gx.blit(x, y, w, h, buf); return 0; },
    draw_image: () => 0, drawBitmap: () => 0, bitmap: () => 0, jpg: () => 0, png: () => 0, blit: () => 0,
    // --- cores ---
    color565: (r, g, b) => gx.color565(r, g, b), Color565: (r, g, b) => gx.color565(r, g, b), color: (r, g, b) => gx.color565(r, g, b), color565_swapped: (r, g, b) => gx.color565(r, g, b),
    // --- atualização ---
    show: () => { gx.show(); return 0; }, display: () => { gx.show(); return 0; }, sendBuffer: () => { gx.show(); return 0; }, update: () => { gx.show(); return 0; }, refresh: () => { gx.show(); return 0; }, display_frame: () => { gx.show(); return 0; },
    displayFrame: () => { gx.show(); return 0; }, display_frame_buf: () => { gx.show(); return 0; }, set_frame_memory: () => 0, setFullWindow: () => 0, setPartialWindow: () => 0, firstPage: () => 1, nextPage: () => { gx.show(); return 0; }, hibernate: () => 0,
    swap_buffers: () => { gx.show(); return 0; }, drawImage: () => 0
  };
  return api;
};

/* ---------- Touch unificado ---------- */
HAL.touch = function(){
  const inst = HAL.screen(null, true);
  if(!inst){ serialOut('⚠ Nenhuma tela com touch na bancada — adicione CYD, M5Core2, ILI9341 touch etc.', 'warn'); return null; }
  const S = SC();
  const sc = S.get(inst);
  const rd = () => S.readTouch(inst);
  const first = () => { const r = rd(); return r.n ? r.pts[0] : null; };
  const raw = p => p ? [Math.round(100 + (p.x / sc.W) * 1800), Math.round(100 + (p.y / sc.H) * 1800)] : null;
  const o = {
    _inst: inst,
    // genérico
    touched: () => rd().n > 0, is_touched: () => rd().n > 0, isTouched: () => rd().n > 0, tirqTouched: () => rd().n > 0, pressed: () => rd().n > 0, available: () => rd().n > 0, dataAvailable: () => rd().n > 0, touch_pressed: () => rd().n > 0,
    get_touch: () => { const p = first(); return p ? KezlePyTuple([p.x, p.y]) : null; },
    read: () => { const p = first(); return p ? KezlePyTuple([p.x, p.y]) : null; },
    raw_touch: () => { const p = first(); return p ? KezlePyTuple(raw(p)) : null; },
    get_point: () => { const p = first(); return p ? { x: p.x, y: p.y, z: p.z } : null; },
    getPoint: () => { const p = first() || { x: 0, y: 0, z: 0 }; return { x: p.x, y: p.y, z: p.z }; },
    getTouchRaw: () => { const p = first(); return p ? { x: raw(p)[0], y: raw(p)[1], z: p.z } : { x: 0, y: 0, z: 0 }; },
    get_positions: () => rd().pts.map(p => KezlePyTuple([p.x, p.y])),
    get_touches: () => rd().pts.map(p => KezlePyTuple([p.x, p.y])),
    getTouches: () => rd().n, touches: () => rd().n, getTouchCount: () => rd().n, num_touches: () => rd().n,
    getX: i => { const r = rd(); return r.pts[i || 0] ? r.pts[i || 0].x : 0; }, getY: i => { const r = rd(); return r.pts[i || 0] ? r.pts[i || 0].y : 0; },
    gesture: () => rd().gesture || 0, finger: () => rd().n,
    // TFT_eSPI: bool getTouch(&x,&y,threshold) — recebe referências
    getTouch: (rx, ry) => { const p = first(); if(!p) return false; if(rx && rx.set){ rx.set(p.x); ry.set(p.y); } return true; },
    // controladores
    begin: () => true, start: () => true, init: () => true, setRotation: () => 0, setCalibration: () => 0, calibrate: () => 0, setThreshold: () => 0, wakeup: () => 0
  };
  Object.defineProperties(o, {
    x: { get: () => { const p = first(); return p ? p.x : 0; } }, y: { get: () => { const p = first(); return p ? p.y : 0; } },
    z: { get: () => { const p = first(); return p ? p.z : 0; } },
    points: { get: () => rd().pts.map(p => KezlePyTuple([p.x, p.y])) },
    state: { get: () => rd().n ? 1 : 0 }, event: { get: () => rd().n ? 1 : 0 }, touchCount: { get: () => rd().n }
  });
  return o;
};
function KezlePyTuple(a){ return window.KezlePy ? KezlePy.tup(a) : a; }
HAL.KezlePyTuple = KezlePyTuple;

/* botões físicos (M5/T-Display) */
HAL.button = function(name){
  const inst = BENCH.parts.find(p => p.def.scr && p.def.scr.btns && p.def.scr.btns.includes(name));
  const was = { v: false, pressedAt: 0 };
  return {
    isPressed: () => !!(inst && SIM.on && inst.state.mbtn && inst.state.mbtn[name]),
    wasPressed: function(){ const v = !!(inst && SIM.on && inst.state.mbtn && inst.state.mbtn[name]); const r = v && !was.v; was.v = v; return r; },
    wasReleased: function(){ const v = !!(inst && SIM.on && inst.state.mbtn && inst.state.mbtn[name]); const r = !v && was.v; was.v = v; return r; }
  };
};
// GPIO39/38/37 do M5Core = botões A/B/C (ativo baixo)
const _hwd = window.HWRead.digital;
window.HWRead.digital = function(id){
  const m = CIRCUIT.primaryMcu();
  if(m && m.def.scr && m.def.scr.btns && m.def.id.startsWith('m5')){
    const map = { 39: 'A', 38: 'B', 37: 'C' };
    if(map[id]) return (m.state.mbtn && m.state.mbtn[map[id]]) ? 0 : 1;
  }
  if(m && m.def.id === 'm5stick' && (id === 37 || id === 39)) return (m.state.mbtn && m.state.mbtn[id === 37 ? 'A' : 'B']) ? 0 : 1;
  return _hwd(id);
};

})();
