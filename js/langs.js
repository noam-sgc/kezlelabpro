/* =========================================================================
   Kezle Lab Pro — 9 linguagens: registro, módulos Python/CircuitPython,
   runner JavaScript, despacho de execução e modelos de código.
   (Lua, BASIC, C, C++, Go e Rust ficam em lang2.js)
   ========================================================================= */
(function(){
'use strict';
const HAL = KezleHAL;
const { KW, PyDict, tup } = KezlePy;
const LANGS = window.KEZLE_LANGS = {
  py:  { name: 'MicroPython',            ico: '🐍', ext: 'py' },
  cpy: { name: 'CircuitPython',          ico: '🟣', ext: 'py' },
  cpp: { name: 'C++ (Arduino)',          ico: '⚙️', ext: 'ino' },
  c:   { name: 'C (Pico SDK / AVR)',     ico: '🔧', ext: 'c' },
  js:  { name: 'JavaScript (Espruino)',  ico: '🟨', ext: 'js' },
  lua: { name: 'Lua (NodeMCU)',          ico: '🌙', ext: 'lua' },
  bas: { name: 'BASIC',                  ico: '📟', ext: 'bas' },
  go:  { name: 'Go (TinyGo)',            ico: '🐹', ext: 'go' },
  rs:  { name: 'Rust (embedded)',        ico: '🦀', ext: 'rs' }
};
const RUNNERS = window.KEZLE_RUNNERS = {};   // lang -> async (src) => void  (preenchido aqui e em lang2.js)

/* ---------- UI: lista de linguagens, MCUs, modelos ---------- */
$('#pyLang').innerHTML = Object.keys(LANGS).map(k => `<option value="${k}">${LANGS[k].ico} ${LANGS[k].name}</option>`).join('');
$('#pyTarget').innerHTML = PARTS.filter(p => p.cat === 'mcu').map(m => '<option>' + m.n + '</option>').join('');
window.refreshTpl = function(){
  const lang = $('#pyLang').value;
  $('#pyTpl').innerHTML = '<option value="">📄 Modelos de código…</option>' + TPLS.filter(t => t.lng === lang).map(t => '<option value="' + t.k + '">' + t.label + '</option>').join('');
  const sl = $('#stLang');
  if(sl) sl.textContent = LANGS[lang].ico + ' ' + LANGS[lang].name;
};
$('#pyLang').onchange = function(){ refreshTpl(); renderImpChips(); renderHwCheck(); };
$('#pyLang').value = 'py';
const _rhw = window.renderImpChips;

/* ---------- módulos Python / CircuitPython ---------- */
function kwSplit(a){ return a.length && a[a.length - 1] instanceof KW ? [a.slice(0, -1), a[a.length - 1]] : [a, {}]; }
function ledPin(){ const m = CIRCUIT.primaryMcu(); return m && /pico|rp2040/.test(m.def.id) ? 25 : 2; }
const ANALOG_MAP = () => {
  const m = CIRCUIT.primaryMcu(); const id = m ? m.def.id : 'esp32';
  if(/pico|rp2040/.test(id)) return [26, 27, 28, 29];
  if(/uno|nano|mega|leonardo|pro_mini/.test(id)) return [14, 15, 16, 17, 18, 19, 20, 21];
  return [36, 39, 34, 35, 32, 33, 25, 26];
};
function pinId(p){
  if(p && typeof p === 'object' && p._id != null) return p._id;
  if(p === 'LED') return ledPin();
  if(typeof p === 'string'){ const m = p.match(/^(?:GP|GPIO|IO|D|P)?(\d+)$/i); if(m) return +m[1]; }
  return +p;
}
function mkPinA(a){
  const [pa, kw] = kwSplit(a);
  const id = pinId(pa[0]);
  const self = {
    _id: id,
    id: () => id,
    init: function(...b){ const [pb, k2] = kwSplit(b); const mode = k2.mode !== undefined ? k2.mode : pb[0]; const pull = k2.pull !== undefined ? k2.pull : pb[1]; apply(mode, pull); if(k2.value !== undefined) HAL.digitalWrite(id, k2.value); },
    value: function(v){ if(v === undefined || v instanceof KW) return HAL.digitalRead(id); HAL.digitalWrite(id, v ? 1 : 0); },
    on: () => HAL.digitalWrite(id, 1), off: () => HAL.digitalWrite(id, 0), high: () => HAL.digitalWrite(id, 1), low: () => HAL.digitalWrite(id, 0),
    toggle: () => HAL.digitalWrite(id, (PINS[id] && PINS[id].v) ? 0 : 1),
    mode: () => (PINS[id] && PINS[id].mode === 'out') ? 1 : 0, pull: () => PINS[id] && PINS[id].pull === 'up' ? 1 : null,
    irq: function(...b){ const [pb, k2] = kwSplit(b); const h = k2.handler || pb[0]; const trig = k2.trigger !== undefined ? k2.trigger : (pb[1] !== undefined ? pb[1] : 2); if(!h) return null; HAL.attach(id, () => h(self), trig === 3 ? 'change' : trig === 1 ? 'rising' : 'falling'); return null; }
  };
  function apply(mode, pull){
    if(mode === 1 || mode === 2) HAL.pinMode(id, 'out');
    else if(mode === 0 || mode === 3) HAL.pinMode(id, pull === 1 ? 'in_up' : pull === 2 ? 'in_down' : 'in');
  }
  const mode = kw.mode !== undefined ? kw.mode : pa[1], pull = kw.pull !== undefined ? kw.pull : pa[2];
  if(mode !== undefined && mode !== -1) apply(mode, pull);
  if(kw.value !== undefined) HAL.digitalWrite(id, kw.value);
  return self;
}
const mkPin = Object.assign((...a) => mkPinA(a), { IN: 0, OUT: 1, OPEN_DRAIN: 2, ALT: 3, PULL_UP: 1, PULL_DOWN: 2, IRQ_RISING: 1, IRQ_FALLING: 2 });

function mkPWMA(a){
  const [pa, kw] = kwSplit(a);
  const id = pinId(pa[0]);
  const o = (kw.freq !== undefined ? kw : (pa[1] && typeof pa[1] === 'object' ? pa[1] : {}));
  HAL.pinMode(id, 'out');
  let freq = o.freq || pa[1] && typeof pa[1] === 'number' && pa[1] || 1000, duty = 0;
  const self = {
    freq: f => { if(f === undefined || f instanceof KW) return freq; freq = f; (PINS[id] = PINS[id] || {}).freq = f; HAL.pwm(id, f, duty); },
    duty: d => { if(d === undefined || d instanceof KW) return duty; duty = d; HAL.pwm(id, freq, d); },
    duty_u16: d => { if(d === undefined || d instanceof KW) return Math.round(duty / 1023 * 65535); duty = d / 65535 * 1023; HAL.pwm(id, freq, duty); },
    duty_ns: ns => { duty = ns * 1e-9 * freq * 1023; HAL.pwm(id, freq, duty); },
    deinit: () => { HAL.pwm(id, freq, 0); pinWrite(id, 0); PINS[id].duty = undefined; }, init: () => 0
  };
  (PINS[id] = PINS[id] || {}).freq = freq;
  if(o.duty !== undefined) self.duty(o.duty); else if(o.duty_u16 !== undefined) self.duty_u16(o.duty_u16);
  return self;
}
function mkADCA(a){
  const id = pinId(a[0]);
  return { atten: () => 0, width: () => 0, read: () => HAL.analogRead(id), read_u16: () => Math.round(HAL.analogRead(id) / (/uno|nano|mega|leonardo|pro_mini|attiny/.test((CIRCUIT.primaryMcu() || { def: { id: '' } }).def.id) ? 1023 : 4095) * 65535), read_uv: () => Math.round(HAL.analogRead(id) / 4095 * 3300000) };
}
const mkADC = Object.assign((...a) => mkADCA(a), { ATTN_0DB: 0, ATTN_2_5DB: 1, ATTN_6DB: 2, ATTN_11DB: 3, WIDTH_12BIT: 3 });
const mkPWM = (...a) => mkPWMA(a);
function mkTimerA(a){
  let h = null;
  const self = {
    init: function(...b){ const [pb, k] = kwSplit(b); const period = k.period !== undefined ? k.period : pb[0]; const mode = k.mode !== undefined ? k.mode : 1; const cb = k.callback || pb[1]; if(h) clearInterval(h); h = HAL.every(period, () => cb(self), mode === 0); },
    deinit: () => { if(h) { clearInterval(h); clearTimeout(h); h = null; } }
  };
  return self;
}
const mkTimer = Object.assign((...a) => mkTimerA(a), { ONE_SHOT: 0, PERIODIC: 1 });

function fontObj(w, h){ return { WIDTH: w, HEIGHT: h, MAP: '', BPP: 1, FIRST: 32, LAST: 127 }; }

function patchModules(mods){
  const old = mods.machine;
  mods.machine = Object.assign({}, old, {
    Pin: mkPin, PWM: mkPWM, ADC: mkADC, Timer: mkTimer,
    I2C: function(){ return { scan: () => { const a = [...new Set(BENCH.parts.filter(p => p.def.i2c && CIRCUIT.powered(p)).map(p => p.def.i2c))]; return a; }, readfrom_mem: () => new Uint8Array(0), writeto_mem: () => 0, writeto: () => 0, readfrom: () => new Uint8Array(0), readfrom_mem_into: () => 0, init: () => 0, deinit: () => 0 }; },
    SPI: function(){ return { init: () => 0, deinit: () => 0, write: () => 0, read: () => new Uint8Array(0), readinto: () => 0, write_readinto: () => 0 }; },
    UART: function(){ return { init: () => 0, write: s => { HAL.write(typeof s === 'string' ? s : String.fromCharCode(...s)); return 0; }, read: () => null, readline: () => null, any: () => 0, deinit: () => 0 }; },
    ADCBlock: mkADC, unique_id: () => new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x12, 0x34]), idle: () => 0, lightsleep: () => 0, deepsleep: () => { RUN.on = false; }, bootloader: () => 0, disable_irq: () => 0, enable_irq: () => 0,
    time_pulse_us: async (pin, level, timeout) => HAL.pulseIn(pinId(pin), level, (timeout || 1000000) / 1000),
    freq: () => 240000000, reset: () => { RUN.on = false; }, soft_reset: () => { RUN.on = false; }, mem32: {}
  });
  mods.machine.SoftI2C = mods.machine.I2C; mods.machine.SoftSPI = mods.machine.SPI;
  mods.machine.RTC = function(){ return { datetime: () => { const d = new Date(); return tup([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getDay(), d.getHours(), d.getMinutes(), d.getSeconds(), 0]); } }; };
  mods.machine.WDT = function(){ return { feed: () => 0 }; };
  mods.machine.TouchPad = function(pin){ return { read: () => 800 }; };

  // time
  const t = mods.time;
  Object.assign(t, {
    ticks_us: () => HAL.micros(), ticks_ms: () => HAL.millis(), ticks_cpu: () => HAL.micros(), ticks_add: (a, b) => a + b, ticks_diff: (a, b) => a - b,
    monotonic: () => performance.now() / 1000, monotonic_ns: () => Math.floor(performance.now() * 1e6), time_ns: () => Date.now() * 1e6, perf_counter: () => performance.now() / 1000,
    localtime: s => { const d = s != null ? new Date(s * 1000) : new Date(); return tup([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), (d.getDay() + 6) % 7, 1]); },
    strftime: (f, tt) => f, sleep: async s => { await wait(s * 1000); }, sleep_ms: async ms => { await wait(ms); }, sleep_us: async us => { await wait(us / 1000); }
  });
  mods.utime = t;
  mods.gc = { collect: () => 0, mem_free: () => 120000, mem_alloc: () => 40000, enable: () => 0, disable: () => 0 };
  mods.micropython = { const: x => x, opt_level: () => 0, mem_info: () => 0 };
  mods.sys = { platform: 'esp32', version: '3.4.0', implementation: 'micropython', modules: new PyDict(), exit: () => { RUN.on = false; }, path: [], argv: [] };
  mods.os = { uname: () => ({ sysname: 'Kezle', machine: (CIRCUIT.primaryMcu() || { def: { n: 'MCU' } }).def.n, release: '1.1.7' }), listdir: () => [], getcwd: () => '/' };
  mods.random.getrandbits = n => Math.floor(Math.random() * Math.pow(2, n)); mods.random.randrange = (a, b, c) => { if(b === undefined){ b = a; a = 0; } return a + Math.floor(Math.random() * (b - a)); };
  mods.math.isnan = Number.isNaN; mods.math.isinf = x => !Number.isFinite(x) && !Number.isNaN(x); mods.math.asin = Math.asin; mods.math.acos = Math.acos; mods.math.atan = Math.atan; mods.math.exp = Math.exp; mods.math.sinh = Math.sinh; mods.math.cosh = Math.cosh; mods.math.tanh = Math.tanh; mods.math.hypot = Math.hypot; mods.math.trunc = Math.trunc; mods.math.log2 = Math.log2; mods.math.fmod = (a, b) => a % b; mods.math.inf = Infinity; mods.math.nan = NaN; mods.math.copysign = (a, b) => Math.sign(b) * Math.abs(a);
  mods.json = { dumps: v => JSON.stringify(toJs(v)), loads: s => fromJs(JSON.parse(s)) }; mods.ujson = mods.json;
  mods.network = { STA_IF: 0, AP_IF: 1, WLAN: function(){ let on = false, conn = false; return { active: v => { if(v !== undefined) on = !!v; return on; }, connect: () => { conn = true; serialOut('[wifi] conectado (simulado)', 'dim'); }, isconnected: () => conn, ifconfig: () => tup(['192.168.4.' + (20 + Math.floor(Math.random() * 200)), '255.255.255.0', '192.168.4.1', '8.8.8.8']), scan: () => [], disconnect: () => { conn = false; }, config: () => 'KezleLab', status: () => conn ? 3 : 0 }; } };
  mods.ntptime = { settime: () => 0 };
  mods.bluetooth = { BLE: function(){ return { active: () => 0, gap_advertise: () => 0, irq: () => 0 }; } };
  mods.esp = { osdebug: () => 0, flash_size: () => 4194304 };
  mods.esp32.raw_temperature = () => 128; mods.esp32.NVS = function(){ return { get_i32: () => 0, set_i32: () => 0, commit: () => 0 }; };

  // framebuf
  mods.framebuf = {
    MONO_VLSB: 0, MONO_HLSB: 3, MONO_HMSB: 4, RGB565: 1, GS8: 6, GS4_HMSB: 2,
    FrameBuffer: function(buf, w, h){ return Object.assign(HAL.gfx(['ssd1306', 'sh1106', 'pcd8544', 'st7920', 'generic']), { _w: w, _h: h }); }
  };

  // displays
  const dispCtor = ctrls => function(...a){
    const [pa, kw] = kwSplit(a);
    const g = HAL.gfx(ctrls);
    const rot = kw.rotation !== undefined ? kw.rotation : undefined;
    if(rot !== undefined) g.setRotation(rot);
    return g;
  };
  const C = HAL.COLORS;
  const colorMod = o => Object.assign({}, C, { color565: (r, g, b) => ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3) }, o);
  mods.ssd1306 = { SSD1306_I2C: dispCtor(['ssd1306', 'sh1106']), SSD1306_SPI: dispCtor(['ssd1306', 'sh1106']), SSD1306: dispCtor(['ssd1306']) };
  mods.sh1106 = { SH1106_I2C: dispCtor(['sh1106', 'ssd1306']), SH1106_SPI: dispCtor(['sh1106', 'ssd1306']), SH1106: dispCtor(['sh1106']) };
  mods.st7789 = colorMod({ ST7789: dispCtor(['st7789', 'tdisp', 'mcu', 'cyd', 'gc9a01', 'generic']), BGR: 8, RGB: 0 });
  mods.ili9341 = colorMod({ ILI9341: dispCtor(['ili9341', 'cyd']), Display: dispCtor(['ili9341', 'cyd']), color565: (r, g, b) => ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3) });
  mods.ili9488 = colorMod({ ILI9488: dispCtor(['ili9488', 'ili9341', 'cyd']), Display: dispCtor(['ili9488', 'ili9341', 'cyd']) });
  mods.st7735 = colorMod({ ST7735: dispCtor(['st7735']), TFT: dispCtor(['st7735']), TFTColor: (r, g, b) => ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3) });
  mods.st7796 = colorMod({ ST7796: dispCtor(['st7796']), Display: dispCtor(['st7796']) });
  mods.gc9a01 = colorMod({ GC9A01: dispCtor(['gc9a01']) });
  mods.ssd1331 = colorMod({ SSD1331: dispCtor(['ssd1331']) });
  mods.ssd1351 = colorMod({ SSD1351: dispCtor(['ssd1351']) });
  mods.pcd8544 = { PCD8544: dispCtor(['pcd8544']), PCD8544_FB: dispCtor(['pcd8544']) };
  mods.st7920 = { ST7920: dispCtor(['st7920']) };
  const epdMod = { EPD: dispCtor(['epd']), EPD_2in9: dispCtor(['epd']), EPD_2in13: dispCtor(['epd']), EPD_1in54: dispCtor(['epd']), EPD_4in2: dispCtor(['epd']), EPD_7in5: dispCtor(['epd']), BLACK: 0, WHITE: 1, RED: 2, FULL_UPDATE: 0, PART_UPDATE: 1 };
  ['epaper', 'epaper2in9', 'epaper2in13', 'epaper1in54', 'epaper4in2', 'epaper7in5', 'epd2in9', 'epd2in13', 'epd1in54', 'epd4in2', 'epd7in5', 'waveshare_epd', 'EPD_2in9', 'EPD_2in13'].forEach(n => mods[n] = epdMod);
  mods.vga1_8x8 = fontObj(8, 8); mods.vga1_8x16 = fontObj(8, 16); mods.vga1_16x16 = fontObj(16, 16); mods.vga1_16x32 = fontObj(16, 32); mods.vga2_8x8 = fontObj(8, 8); mods.vga2_8x16 = fontObj(8, 16); mods.vga2_16x16 = fontObj(16, 16); mods.vga2_16x32 = fontObj(16, 32);
  mods.vga1_bold_16x16 = fontObj(16, 16); mods.vga1_bold_16x32 = fontObj(16, 32); mods.vga2_bold_16x16 = fontObj(16, 16); mods.vga2_bold_16x32 = fontObj(16, 32); mods.chango_16 = fontObj(16, 16); mods.chango_32 = fontObj(32, 32); mods.romanc = fontObj(8, 8); mods.italicc = fontObj(8, 8);
  mods.xglcd_font = { XglcdFont: () => fontObj(8, 8) };

  // touch
  const touchCtor = () => function(){ return HAL.touch() || {}; };
  mods.xpt2046 = { Touch: touchCtor(), XPT2046: touchCtor(), XPT2046_Touch: touchCtor() };
  ['ft6x36', 'ft6336', 'ft6206', 'ft5x06', 'gt911', 'cst816', 'cst816s', 'cst226', 'touch', 'touchscreen', 'ns2009', 'chsc6x'].forEach(n => {
    mods[n] = { FT6x36: touchCtor(), FT6336: touchCtor(), FT6206: touchCtor(), FT5x06: touchCtor(), GT911: touchCtor(), CST816: touchCtor(), CST816S: touchCtor(), CST226: touchCtor(), Touch: touchCtor(), Touchscreen: touchCtor(), NS2009: touchCtor(), CHSC6x: touchCtor(),
      GESTURE_NONE: 0, GESTURE_SWIPE_UP: 2, GESTURE_SWIPE_DOWN: 1, GESTURE_SWIPE_LEFT: 4, GESTURE_SWIPE_RIGHT: 3, GESTURE_CLICK: 5 };
  });
  // servo
  const servoCtor = function(...a){ const [pa, kw] = kwSplit(a); const id = pinId(pa[0]); HAL.pinMode(id, 'out'); const self = { write: ang => HAL.servoWrite(id, ang), write_angle: ang => HAL.servoWrite(id, ang), angle: ang => { HAL.servoWrite(id, ang); }, deinit: () => 0, duty: d => HAL.pwm(id, 50, d) }; return self; };
  mods.servo = { Servo: servoCtor }; mods.machine_servo = mods.servo;

  // neopixel (Proxy: aceita np[i] = (r,g,b))
  const npCtor = function(...a){
    const [pa, kw] = kwSplit(a);
    const n = pa[1] != null ? pa[1] : 8;
    const bright = kw.brightness != null ? kw.brightness : 1;
    const cols = Array.from({ length: n }, () => [0, 0, 0]);
    const auto = kw.auto_write != null ? !!kw.auto_write : false;
    const push = () => { const o = stripPart(); if(o){ o.state.colors = cols.map(c => c.map(v => Math.round(Math.min(255, v * (self.brightness == null ? bright : self.brightness))))); refreshAllVisuals(); } };
    const self = { n, brightness: bright, write: push, show: push, fill: c => { for(let i = 0; i < n; i++) cols[i] = [c[0] || 0, c[1] || 0, c[2] || 0]; if(auto) push(); }, __len__: () => n, deinit: () => 0 };
    return new Proxy(self, {
      get: (t, k) => (typeof k === 'string' && /^-?\d+$/.test(k)) ? tup(cols[((+k % n) + n) % n].slice()) : t[k],
      has: (t, k) => (typeof k === 'string' && /^-?\d+$/.test(k)) || k in t,
      set: (t, k, v) => { if(typeof k === 'string' && /^-?\d+$/.test(k)){ const c = Array.isArray(v) ? v : [(v >> 16) & 255, (v >> 8) & 255, v & 255]; cols[((+k % n) + n) % n] = [c[0] || 0, c[1] || 0, c[2] || 0]; if(auto) push(); } else t[k] = v; return true; }
    });
  };
  mods.neopixel = { NeoPixel: npCtor, GRB: 'GRB', RGB: 'RGB', GRBW: 'GRBW', RGBW: 'RGBW' };

  // lcd i2c (MicroPython: lcd_api / i2c_lcd)
  const lcdCtor = function(){
    const o = lcdPart(); const rows = o ? o.def.rows || 2 : 2, cols = o ? o.def.cols || 16 : 16;
    const buf = Array.from({ length: rows }, () => ' '.repeat(cols));
    let r = 0, c = 0;
    const push = () => { if(o) { o.state.lcdText = buf.join(''); lcdSetText(o, o.state.lcdText); } };
    const put = ch => { if(ch === '\n'){ r = Math.min(rows - 1, r + 1); c = 0; return; } if(c < cols){ buf[r] = buf[r].slice(0, c) + ch + buf[r].slice(c + 1); c++; } };
    const self = { putstr: s => { for(const ch of String(s)) put(ch); push(); }, print: s => { for(const ch of String(s)) put(ch); push(); }, move_to: (x, y) => { c = x; r = y; }, clear: () => { for(let i = 0; i < rows; i++) buf[i] = ' '.repeat(cols); r = c = 0; push(); }, backlight_on: () => 0, backlight_off: () => 0, hide_cursor: () => 0, show_cursor: () => 0, blink_cursor_on: () => 0, custom_char: () => 0, putchar: ch => { put(ch); push(); }, set_cursor: (x, y) => { c = x; r = y; }, home: () => { r = c = 0; } };
    return self;
  };
  mods.i2c_lcd = { I2cLcd: lcdCtor }; mods.lcd_api = { LcdApi: lcdCtor }; mods.machine_i2c_lcd = mods.i2c_lcd; mods.pico_i2c_lcd = mods.i2c_lcd; mods.lcd1602 = Object.assign(mods.lcd1602 || {}, { LCD: lcdCtor, I2cLcd: lcdCtor });

  /* ----- CircuitPython ----- */
  const boardObj = new Proxy({}, {
    has: () => true,
    get: (t, k) => {
      if(typeof k !== 'string') return undefined;
      let m;
      if(k === 'LED' || k === 'L' || k === 'NEOPIXEL' && false) return { _id: ledPin() };
      if((m = k.match(/^(?:D|IO|GP|GPIO)(\d+)$/))) return { _id: +m[1] };
      if((m = k.match(/^A(\d+)$/))) return { _id: ANALOG_MAP()[+m[1]] != null ? ANALOG_MAP()[+m[1]] : 34 };
      const defs = { SDA: 21, SCL: 22, MOSI: 23, MISO: 19, SCK: 18, TX: 1, RX: 3, BUTTON: 0, BOOT: 0, NEOPIXEL: 48, SPEAKER: 26, TFT_CS: 15, TFT_DC: 2, TFT_BACKLIGHT: 21 };
      const m2 = CIRCUIT.primaryMcu();
      if(m2 && /pico|rp2040/.test(m2.def.id)){ Object.assign(defs, { SDA: 4, SCL: 5, TX: 0, RX: 1, SCK: 18, MOSI: 19, MISO: 16 }); }
      if(m2 && /uno|nano|mega|leonardo/.test(m2.def.id)){ Object.assign(defs, { SDA: 18, SCL: 19, MOSI: 11, MISO: 12, SCK: 13 }); }
      if(k in defs) return { _id: defs[k] };
      return undefined;
    }
  });
  const Direction = { INPUT: 0, OUTPUT: 1 }, Pull = { UP: 1, DOWN: 2 };
  const dio = function(p){
    const id = pinId(p); let dir = 0, pull = null, val = false;
    const o = { deinit: () => 0, switch_to_output: (value) => { o.direction = 1; if(value !== undefined) o.value = !!value; }, switch_to_input: (pl) => { o.direction = 0; if(pl) o.pull = pl; } };
    Object.defineProperties(o, {
      direction: { get: () => dir, set: v => { dir = v; if(v === 1) HAL.pinMode(id, 'out'); else HAL.pinMode(id, pull === 1 ? 'in_up' : pull === 2 ? 'in_down' : 'in'); } },
      pull: { get: () => pull, set: v => { pull = v; if(dir === 0) HAL.pinMode(id, v === 1 ? 'in_up' : v === 2 ? 'in_down' : 'in'); } },
      value: { get: () => !!HAL.digitalRead(id), set: v => { val = !!v; if(dir === 1) HAL.digitalWrite(id, v ? 1 : 0); } }
    });
    return o;
  };
  mods.board = boardObj;
  mods.microcontroller = { pin: boardObj, cpu: { frequency: 240000000, temperature: 38.2 }, delay_us: () => 0 };
  mods.digitalio = { DigitalInOut: dio, Direction, Pull, DriveMode: { PUSH_PULL: 0, OPEN_DRAIN: 1 } };
  mods.analogio = {
    AnalogIn: function(p){ const id = pinId(p); const o = { deinit: () => 0 }; Object.defineProperty(o, 'value', { get: () => Math.round(HAL.analogRead(id) / (/uno|nano|mega|leonardo|pro_mini|attiny/.test((CIRCUIT.primaryMcu() || { def: { id: '' } }).def.id) ? 1023 : 4095) * 65535) }); Object.defineProperty(o, 'reference_voltage', { get: () => CIRCUIT.vdd() }); return o; },
    AnalogOut: function(p){ const id = pinId(p); const o = {}; Object.defineProperty(o, 'value', { set: v => HAL.analogWrite(id, v, 65535), get: () => 0 }); return o; }
  };
  mods.pwmio = { PWMOut: function(...a){ const [pa, kw] = kwSplit(a); const id = pinId(pa[0]); let f = kw.frequency || 500, d = kw.duty_cycle || 0; HAL.pinMode(id, 'out'); const o = { deinit: () => 0 }; const upd = () => HAL.pwm(id, f, d / 65535 * 1023); Object.defineProperties(o, { duty_cycle: { get: () => d, set: v => { d = v; upd(); } }, frequency: { get: () => f, set: v => { f = v; upd(); } } }); upd(); return o; } };
  mods.busio = { I2C: mods.machine.I2C, SPI: function(){ return { try_lock: () => true, unlock: () => 0, configure: () => 0, write: () => 0 }; }, UART: mods.machine.UART };
  mods.touchio = { TouchIn: function(p){ const o = {}; Object.defineProperties(o, { value: { get: () => { const t = BENCH.parts.find(q => q.def.sk === 'touch' || q.def.id === 'ttp223'); return !!(t && t.state.pressed); } }, raw_value: { get: () => 500 } }); return o; } };
  mods.adafruit_motor = { servo: { Servo: function(pwm){ const o = { }; Object.defineProperty(o, 'angle', { set: v => { if(pwm && pwm.duty_cycle !== undefined) { const pulse = 0.5 + v / 180 * 2; pwm.duty_cycle = Math.round(pulse / 20 * 65535); (PINS[pwm._id || 0] || {}).angle = v; } }, get: () => 90 }); return o; } } };
  mods.adafruit_ssd1306 = { SSD1306_I2C: dispCtor(['ssd1306', 'sh1106']), SSD1306_SPI: dispCtor(['ssd1306', 'sh1106']) };
  mods.adafruit_ft6206 = { Adafruit_FT6206: touchCtor() }; mods.adafruit_focaltouch = mods.adafruit_ft6206; mods.adafruit_stmpe610 = mods.adafruit_ft6206;
  mods.supervisor = { runtime: { serial_connected: true }, reload: () => 0 };
  mods.storage = {}; mods.usb_hid = {}; mods.rtc = { RTC: () => ({}) };
  mods.keypad = { Keys: function(){ return { events: { get: () => null } }; } };
  return mods;
}
function toJs(v){ if(v instanceof PyDict){ const o = {}; for(const [k, x] of v.items()) o[k] = toJs(x); return o; } if(Array.isArray(v)) return v.map(toJs); return v; }
function fromJs(v){ if(Array.isArray(v)) return v.map(fromJs); if(v && typeof v === 'object'){ const d = new PyDict(); for(const k in v) d.set(k, fromJs(v[k])); return d; } return v; }
const _mm = window.makeModules;
window.makeModules = function(){ return patchModules(_mm()); };
window.pinId = pinId;

/* ---------- runner: MicroPython e CircuitPython ---------- */
async function runPyLang(src){
  MODS = makeModules();
  let pending = '';
  await KezlePy.runPython(src, MODS, (txt, end) => { if(end === '\n'){ HAL.write(pending + txt + '\n'); pending = ''; } else pending += txt + end; });
  if(pending) HAL.write(pending);
  HAL.flush();
}
RUNNERS.py = RUNNERS.cpy = runPyLang;

/* ---------- runner: JavaScript (estilo Espruino / Node) ---------- */
RUNNERS.js = async function(src){
  const consts = HAL.colorConsts();
  const api = Object.assign({}, consts, {
    INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, INPUT_PULLDOWN: 3, HIGH: 1, LOW: 0, LED_BUILTIN: ledPin(), LED1: ledPin(), BTN1: 0,
    pinMode: (p, m) => HAL.pinMode(p, m), digitalWrite: (p, v) => HAL.digitalWrite(p, v), digitalRead: p => HAL.digitalRead(p), digitalPulse: async (p, v, ms) => { HAL.digitalWrite(p, v); await HAL.delay(ms); HAL.digitalWrite(p, v ? 0 : 1); },
    analogRead: p => HAL.analogRead(p) / (/uno|nano|mega|leonardo/.test((CIRCUIT.primaryMcu() || { def: { id: '' } }).def.id) ? 1023 : 4095), analogWrite: (p, v, o) => HAL.analogWrite(p, v * 255, 255),
    analogReadRaw: p => HAL.analogRead(p), analogWriteRaw: (p, v) => HAL.analogWrite(p, v, 255),
    servoWrite: (p, a) => HAL.servoWrite(p, a), tone: (p, f, d) => HAL.tone(p, f, d), noTone: p => HAL.noTone(p),
    delay: ms => HAL.delay(ms), sleep: ms => HAL.delay(ms), delayMicroseconds: us => HAL.delayUs(us), millis: () => HAL.millis(), micros: () => HAL.micros(), getTime: () => Date.now() / 1000,
    print: (...a) => HAL.write(a.map(String).join(' ') + '\n'), setWatch: (cb, p, o) => HAL.attach(p, cb, (o && o.edge) || 'rising'), clearWatch: () => HAL.watchers.forEach(clearInterval),
    setInterval: (f, ms) => HAL.every(ms, f), setTimeout: (f, ms) => HAL.every(ms, f, true), clearInterval: t => clearInterval(t), clearTimeout: t => clearTimeout(t),
    random: Math.random, map: (v, a, b, c, d) => c + (v - a) / (b - a) * (d - c), constrain: clamp,
    Serial: { begin: () => 0, print: (...a) => HAL.write(a.map(String).join('')), println: (...a) => HAL.write(a.map(String).join('') + '\n') },
    require: n => ({ Display: null }),
    display: (ctrls) => HAL.gfx(ctrls || null), screen: (c) => HAL.gfx(c || null), touch: () => HAL.touch(), button: n => HAL.button(n),
    Display: function(c){ return HAL.gfx(c ? [].concat(c) : null); }, Touch: function(){ return HAL.touch(); },
    NeoPixel: function(pin, n){ const m = patchModules({ time: {}, random: {}, math: {}, esp32: {}, machine: {}, lcd1602: {} }); return m.neopixel.NeoPixel(pin, n); }
  });
  const con = { log: (...a) => HAL.write(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ') + '\n'), error: (...a) => HAL.write('ERR ' + a.join(' ') + '\n'), warn: (...a) => HAL.write(a.join(' ') + '\n'), info: (...a) => HAL.write(a.join(' ') + '\n') };
  api.console = con;
  const names = Object.keys(api);
  const AF = Object.getPrototypeOf(async function(){}).constructor;
  const fn = new AF(...names, '"use strict";\n' + src);
  await fn(...names.map(n => api[n]));
  // timers/watchers mantêm o programa vivo até Parar
  while(RUN.on && (HAL.timers.length || HAL.watchers.length)) await wait(50);
  HAL.flush();
};

/* verificação de hardware: com solver real, atuadores/ADC não dependem de "props.gpio" nem de "energia" prévia */
const _ah2 = window.analyzeHardware;
window.analyzeHardware = function(src){
  const a = _ah2(src);
  a.errors = a.errors.filter(e => !/^(Atuador GPIO|Entrada analógica GPIO|DHT ligado no GPIO)/.test(e));
  a.items.forEach(it => { if(/^(Atuador|Entrada anal)/.test(it.label)){ it.powered = true; it.wired = true; } });
  return a;
};

/* ---------- despacho de execução ---------- */
window.runCode = async function(srcOverride){
  const lang = $('#pyLang').value;
  const src = srcOverride != null ? srcOverride : $('#pyEditor').value;
  stopCode();
  const a = analyzeHardware(src);
  renderHwCheck();
  if(a.errors.length){ toast(a.errors[0], 'err'); serialOut('⛔ ' + a.errors[0], 'err'); return; }
  if(lang === 'py'){
    const miss = checkLibs(src);
    if(miss){
      toast('Biblioteca "' + ((LIBMAP[miss] && LIBMAP[miss].nm) || miss) + '" não instalada — abra 📖 Bibliotecas', 'err');
      serialOut('⛔ Biblioteca ausente: ' + ((LIBMAP[miss] && LIBMAP[miss].nm) || miss) + '. Instale-a no Seletor de Bibliotecas.', 'err');
      return;
    }
  }
  const runner = RUNNERS[lang];
  if(!runner){ serialOut('⛔ Linguagem sem runner: ' + lang, 'err'); return; }
  RUN.on = true;
  setRunUI(true);
  serialOut('— ' + LANGS[lang].name + ' • iniciando (' + $('#pyTarget').value + ') —', 'sys');
  try {
    HAL.begin();
    await runner(src);
    HAL.flush();
    serialOut('— programa finalizado normalmente —', 'ok');
  } catch(e){
    HAL.flush();
    if(e instanceof PyStop) serialOut('— execução interrompida pelo usuário —', 'dim');
    else if(e instanceof KezlePy.PyExc){ serialOut('⛔ Traceback (linha ' + (e.line || '?') + '):  ' + e.pyType + (e.pyMsg ? ': ' + e.pyMsg : ''), 'err'); toast('Erro de execução — veja o console', 'err'); }
    else { serialOut('⛔ ' + (e && e.message || e) + (e && e.line ? ' (linha ' + e.line + ')' : ''), 'err'); console.error(e); toast('Erro de execução — veja o console', 'err'); }
  }
  RUN.on = false;
  HAL.cleanup();
  setRunUI(false);
};
window.runPyLang = runPyLang;

/* ---------- modelos de código (3+ por linguagem) ---------- */
const T = (lng, k, label, code) => TPLS.push({ lng, k, label, code });
// MicroPython
T('py', 'py_pot_led', '🎛 Potenciômetro → brilho do LED (PWM)', `# Potenciômetro no GPIO34 controla o LED no GPIO2 por PWM
from machine import Pin, ADC, PWM
from time import sleep_ms

pot = ADC(Pin(34))
pot.atten(ADC.ATTN_11DB)
led = PWM(Pin(2), freq=1000)

while True:
    v = pot.read()                 # 0..4095 (tensão real no pino!)
    led.duty(v * 1023 // 4095)     # 0..1023
    print("ADC:", v, "duty:", v * 1023 // 4095)
    sleep_ms(50)
`);
T('py', 'py_motor', '⚙️ Motor DC por PWM (via transistor)', `# GPIO13 -> resistor 1k -> base do NPN; motor entre 5V e coletor
from machine import Pin, PWM, ADC
from time import sleep_ms
m = PWM(Pin(13), freq=2000)
pot = ADC(Pin(34))
while True:
    m.duty(pot.read() * 1023 // 4095)
    sleep_ms(30)
`);
T('py', 'py_tft', '🖥️ TFT: texto e formas', `# Funciona com CYD, M5Stack, TFT ST7789/ILI9341 na bancada
from machine import Pin, SPI
import st7789
import vga1_16x16 as font

spi = SPI(1, baudrate=40000000, sck=Pin(18), mosi=Pin(23))
tft = st7789.ST7789(spi, 240, 320, reset=Pin(4, Pin.OUT), dc=Pin(2, Pin.OUT), cs=Pin(15, Pin.OUT), rotation=0)
tft.init()
tft.fill(st7789.BLACK)
tft.text(font, "Kezle Lab Pro", 10, 10, st7789.YELLOW, st7789.BLACK)
tft.rect(5, 40, 150, 80, st7789.CYAN)
tft.fill_circle(120, 100, 25, st7789.RED)
tft.line(0, 0, 200, 150, st7789.GREEN)
`);
T('py', 'py_touch', '👆 Pintar na tela (touch)', `# Desenhe com o dedo/mouse em tela touch (CYD, M5Core2, ILI9341 touch...)
from machine import Pin, SPI
import st7789
from xpt2046 import Touch
import vga1_8x8 as font

tft = st7789.ST7789(None, 240, 320, rotation=0)
tft.fill(st7789.BLACK)
tft.text(font, "Toque para desenhar", 10, 5, st7789.WHITE)
touch = Touch(None)
cores = [st7789.RED, st7789.GREEN, st7789.BLUE, st7789.YELLOW]
i = 0
while True:
    p = touch.get_touch()
    if p:
        x, y = p
        if y < 30:
            i = (i + 1) % 4
        else:
            tft.fill_circle(x, y, 4, cores[i])
`);
// CircuitPython
T('cpy', 'cpy_blink', '💡 Blink (CircuitPython)', `import time
import board
import digitalio

led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT
while True:
    led.value = not led.value
    print("LED:", led.value)
    time.sleep(0.5)
`);
T('cpy', 'cpy_pot', '🎛 Potenciômetro → PWM', `import time, board, analogio, pwmio
pot = analogio.AnalogIn(board.A0)
led = pwmio.PWMOut(board.D2, frequency=1000)
while True:
    led.duty_cycle = pot.value
    print((pot.value,))
    time.sleep(0.05)
`);
T('cpy', 'cpy_oled', '🖥 OLED com texto', `import board, busio
import adafruit_ssd1306
i2c = busio.I2C(board.SCL, board.SDA)
oled = adafruit_ssd1306.SSD1306_I2C(128, 64, i2c)
oled.fill(0)
oled.text("CircuitPython", 0, 0, 1)
oled.text("Kezle Lab Pro", 0, 16, 1)
oled.rect(0, 30, 128, 30, 1)
oled.show()
`);
// C++
T('cpp', 'cpp_pot_pwm', '🎛 Potenciômetro → LED PWM', `#define LED 2
#define POT 34
void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
}
void loop() {
  int v = analogRead(POT);            // tensão real no pino
  analogWrite(LED, map(v, 0, 4095, 0, 255));
  Serial.println(v);
  delay(50);
}`);
T('cpp', 'cpp_tft', '🖥 TFT_eSPI: texto e formas', `#include <TFT_eSPI.h>
TFT_eSPI tft = TFT_eSPI();
void setup() {
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_YELLOW, TFT_BLACK);
  tft.setTextSize(2);
  tft.drawString("Kezle Lab Pro", 10, 10);
  tft.drawRect(10, 50, 120, 60, TFT_CYAN);
  tft.fillCircle(200, 90, 30, TFT_RED);
}
void loop() {}`);
T('cpp', 'cpp_touch', '👆 Touch: pintar na tela', `#include <TFT_eSPI.h>
TFT_eSPI tft = TFT_eSPI();
uint16_t cores[4] = {TFT_RED, TFT_GREEN, TFT_BLUE, TFT_YELLOW};
int c = 0;
void setup() {
  tft.init();
  tft.setRotation(0);
  tft.fillScreen(TFT_BLACK);
  tft.drawString("Toque para desenhar", 5, 5);
}
void loop() {
  uint16_t x, y;
  if (tft.getTouch(&x, &y)) {
    if (y < 30) { c = (c + 1) % 4; delay(200); }
    else tft.fillCircle(x, y, 4, cores[c]);
  }
}`);
// C
T('c', 'c_blink', '💡 Blink (C estilo Pico SDK)', `#include "pico/stdlib.h"
#include <stdio.h>
int main() {
    stdio_init_all();
    const uint LED = 25;
    gpio_init(LED);
    gpio_set_dir(LED, GPIO_OUT);
    while (true) {
        gpio_put(LED, 1);
        printf("LED ON\\n");
        sleep_ms(500);
        gpio_put(LED, 0);
        printf("LED OFF\\n");
        sleep_ms(500);
    }
}`);
T('c', 'c_adc', '🎛 ADC → printf', `#include <stdio.h>
void setup() { pinMode(2, OUTPUT); }
void loop() {
    int v = analogRead(34);
    printf("ADC=%d  (%.2f V)\\n", v, v * 3.3 / 4095);
    analogWrite(2, v / 16);
    delay(200);
}`);
T('c', 'c_tft', '🖥 Display em C', `void setup() {
    TFT_eSPI tft;
    tft_init();
    tft_fill(TFT_BLACK);
    tft_text("Hello C!", 10, 10, TFT_GREEN);
    tft_circle(100, 100, 30, TFT_RED);
}
void loop() {}`);
// JavaScript
T('js', 'js_blink', '💡 Blink (JavaScript)', `// Estilo Espruino: pode usar await delay()
pinMode(LED1, OUTPUT);
let on = false;
setInterval(() => {
  on = !on;
  digitalWrite(LED1, on);
  print("LED", on ? "ON" : "OFF");
}, 500);`);
T('js', 'js_pot', '🎛 Potenciômetro → PWM', `pinMode(2, OUTPUT);
while (true) {
  const v = analogRead(34);      // 0..1
  analogWrite(2, v);
  print("pot = " + v.toFixed(3));
  await delay(50);
}`);
T('js', 'js_touch', '👆 Touch: pintar', `const g = display();
const t = touch();
g.fillScreen(0x0000);
g.drawString("Toque para desenhar", 5, 5);
while (true) {
  const p = t.getPoint();
  if (t.touched()) g.fillCircle(p.x, p.y, 4, 0xF800);
  await delay(5);
}`);
// Lua
T('lua', 'lua_blink', '💡 Blink (NodeMCU Lua)', `local led = 2
gpio.mode(led, gpio.OUTPUT)
local on = false
while true do
  on = not on
  gpio.write(led, on and gpio.HIGH or gpio.LOW)
  print("LED", on)
  delay(500)
end`);
T('lua', 'lua_pot', '🎛 ADC → PWM', `gpio.mode(2, gpio.OUTPUT)
while true do
  local v = adc.read(34)
  pwm.write(2, v * 255 // 4095)
  print("adc", v)
  delay(50)
end`);
T('lua', 'lua_touch', '👆 Touch: pintar', `tft.fill(0)
tft.text("Toque para desenhar", 5, 5, 0xFFFF)
while true do
  local x, y = touch.get()
  if x then tft.circle(x, y, 4, 0xF800, true) end
  delay(5)
end`);
// BASIC
T('bas', 'bas_blink', '💡 Blink (BASIC)', `10 PINMODE 2, OUTPUT
20 DWRITE 2, 1
30 PRINT "LED ON"
40 DELAY 500
50 DWRITE 2, 0
60 PRINT "LED OFF"
70 DELAY 500
80 GOTO 20`);
T('bas', 'bas_pot', '🎛 ADC → PWM', `10 PINMODE 2, OUTPUT
20 LET V = AREAD(34)
30 PWM 2, V / 16
40 PRINT "ADC="; V
50 DELAY 50
60 GOTO 20`);
T('bas', 'bas_touch', '👆 Touch: pintar', `10 CLS 0
20 TEXT 5, 5, "Toque para desenhar", 65535
30 IF TOUCHED() THEN CIRCLE TOUCHX(), TOUCHY(), 4, 63488, 1
40 DELAY 5
50 GOTO 30`);
// Go
T('go', 'go_blink', '💡 Blink (TinyGo)', `package main

import (
	"machine"
	"time"
)

func main() {
	led := machine.LED
	led.Configure(machine.PinConfig{Mode: machine.PinOutput})
	for {
		led.High()
		println("LED ON")
		time.Sleep(time.Millisecond * 500)
		led.Low()
		println("LED OFF")
		time.Sleep(time.Millisecond * 500)
	}
}`);
T('go', 'go_adc', '🎛 ADC → PWM', `package main

import "machine"
import "time"

func main() {
	machine.InitADC()
	pot := machine.ADC{Pin: machine.A0}
	pot.Configure(machine.ADCConfig{})
	out := machine.GPIO2
	out.Configure(machine.PinConfig{Mode: machine.PinOutput})
	for {
		v := pot.Get()
		analogWrite(2, int(v/256))
		println("adc:", v)
		time.Sleep(50 * time.Millisecond)
	}
}`);
T('go', 'go_touch', '👆 Touch: pintar', `package main

import "time"

func main() {
	tft := Display()
	ts := Touch()
	tft.FillScreen(0)
	tft.DrawString("Toque para desenhar", 5, 5)
	for {
		if ts.Touched() {
			p := ts.GetPoint()
			tft.FillCircle(p.X, p.Y, 4, 0xF800)
		}
		time.Sleep(5 * time.Millisecond)
	}
}`);
// Rust
T('rs', 'rs_blink', '💡 Blink (Rust)', `fn main() {
    let led = 2;
    pin_mode(led, OUTPUT);
    loop {
        digital_write(led, HIGH);
        println!("LED ON");
        delay(500);
        digital_write(led, LOW);
        println!("LED OFF");
        delay(500);
    }
}`);
T('rs', 'rs_adc', '🎛 ADC → PWM', `fn main() {
    pin_mode(2, OUTPUT);
    loop {
        let v: i32 = analog_read(34);
        analog_write(2, v / 16);
        println!("adc = {} ({:.2} V)", v, v as f32 * 3.3 / 4095.0);
        delay(50);
    }
}`);
T('rs', 'rs_touch', '👆 Touch: pintar', `fn main() {
    let tft = display();
    let ts = touch();
    tft.fill_screen(0);
    tft.draw_string("Toque para desenhar", 5, 5);
    loop {
        if ts.touched() {
            let p = ts.get_point();
            tft.fill_circle(p.x, p.y, 4, 0xF800);
        }
        delay(5);
    }
}`);

refreshTpl();
})();
