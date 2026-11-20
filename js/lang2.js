/* =========================================================================
   Kezle Lab Pro — C, C++ (Arduino), Go (TinyGo) e Rust: transpiladores para JS
   assíncrono + API Arduino/HAL. (Lua e BASIC: lang3.js)
   ========================================================================= */
(function(){
'use strict';
const HAL = KezleHAL;
const RUNNERS = window.KEZLE_RUNNERS;
const AF = Object.getPrototypeOf(async function(){}).constructor;
const KW_ = new Set(['if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default', 'return', 'break', 'continue', 'goto', 'sizeof', 'new', 'delete', 'typedef', 'struct', 'class', 'enum', 'union', 'namespace', 'using', 'template', 'public', 'private', 'protected', 'try', 'catch', 'throw', 'true', 'false', 'NULL', 'nullptr', 'this', 'else']);

/* ======================== tokenizador C-like ======================== */
function ctok(src){
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  const OPS3 = ['<<=', '>>=', '...', '->*'];
  const OPS2 = ['->', '++', '--', '&&', '||', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '::', ':=', '=>', '..'];
  while(i < n){
    const c = src[i];
    if(c === '\n'){ line++; i++; continue; }
    if(c === ' ' || c === '\t' || c === '\r'){ i++; continue; }
    if(c === '/' && src[i + 1] === '/'){ while(i < n && src[i] !== '\n') i++; continue; }
    if(c === '/' && src[i + 1] === '*'){ i += 2; while(i < n && !(src[i] === '*' && src[i + 1] === '/')){ if(src[i] === '\n') line++; i++; } i += 2; continue; }
    if(c === '#' && (out.length === 0 || out[out.length - 1].line < line || true) && /^\s*#/.test(src.slice(src.lastIndexOf('\n', i - 1) + 1, i + 1))){
      let j = i, txt = '';
      while(j < n){ if(src[j] === '\\' && src[j + 1] === '\n'){ j += 2; line++; continue; } if(src[j] === '\n') break; txt += src[j]; j++; }
      out.push({ t: 'pp', v: txt.replace(/\/\/.*$/, '').trim(), line }); i = j; continue;
    }
    if(c === '"'){
      let j = i + 1, s = '';
      while(j < n && src[j] !== '"'){ if(src[j] === '\\'){ s += src[j] + (src[j + 1] || ''); j += 2; } else { s += src[j]; j++; } }
      out.push({ t: 'str', v: s, line }); i = j + 1; continue;
    }
    if(c === '`'){ let j = i + 1, s = ''; while(j < n && src[j] !== '`'){ if(src[j] === '\n') line++; s += src[j]; j++; } out.push({ t: 'raw', v: s, line }); i = j + 1; continue; }
    if(c === "'"){
      let j = i + 1, s = '';
      while(j < n && src[j] !== "'"){ if(src[j] === '\\'){ s += src[j] + (src[j + 1] || ''); j += 2; } else { s += src[j]; j++; } }
      let ch;
      if(s[0] === '\\'){ const m = { n: 10, t: 9, r: 13, '0': 0, '\\': 92, "'": 39, '"': 34, a: 7, b: 8 }; ch = s[1] in m ? m[s[1]] : s.charCodeAt(1); if(s[1] === 'x') ch = parseInt(s.slice(2), 16); }
      else ch = s.charCodeAt(0);
      out.push({ t: 'chr', v: ch, ch: s, line }); i = j + 1; continue;
    }
    if(/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))){
      const m = src.slice(i).match(/^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*(?:\.(?!\.)[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)([uUlLfF]*|_?(?:[iuf](?:8|16|32|64|128|size)))/);
      let t = m[1].replace(/_/g, '');
      const isF = !/^0[xXbB]/.test(t) && (/[.eE]/.test(t) || /[fF]/.test(m[2]) && !/^0[xX]/.test(t) || /^_?f/.test(m[2]));
      if(/^0[bB]/.test(t)) t = String(parseInt(t.slice(2), 2));
      out.push({ t: 'num', v: t, f: isF, line }); i += m[0].length; continue;
    }
    if(/[A-Za-z_]/.test(c)){ let j = i + 1; while(j < n && /[A-Za-z0-9_]/.test(src[j])) j++; out.push({ t: 'id', v: src.slice(i, j), line }); i = j; continue; }
    const s3 = src.substr(i, 3), s2 = src.substr(i, 2);
    if(OPS3.includes(s3)){ out.push({ t: 'op', v: s3, line }); i += 3; continue; }
    if(OPS2.includes(s2)){ out.push({ t: 'op', v: s2, line }); i += 2; continue; }
    out.push({ t: 'op', v: c, line }); i++;
  }
  return out;
}

/* ======================== API Arduino / HAL ======================== */
const ST = (name, ...a) => new (CPP_CLASSES[name] ? function(){ return CPP_CLASSES[name](a); } : Object)();
function numFmt(v, d){
  if(typeof v === 'number'){
    if(d !== undefined && d !== null && !(d >= 8)) return Number.isInteger(v) && d === 0 ? String(v) : v.toFixed(d);
    if(d === 16) return (v >>> 0).toString(16).toUpperCase(); if(d === 2) return (v >>> 0).toString(2); if(d === 8) return (v >>> 0).toString(8);
    return Number.isInteger(v) ? String(v) : (Math.abs(v) < 1e15 ? v.toFixed(2) : String(v));
  }
  if(v === true) return '1'; if(v === false) return '0';
  if(v === null || v === undefined) return '';
  return String(v);
}
function makeSerial(){
  const o = {
    begin: b => { HAL.write(''); return 0; }, end: () => 0, setTimeout: () => 0, setRxBufferSize: () => 0,
    print: (v, d) => { HAL.write(numFmt(v, d === 10 ? undefined : (d === 16 || d === 2 || d === 8 ? d : d))); return 0; },
    println: (v, d) => { HAL.write((v === undefined ? '' : numFmt(v, d === 10 ? undefined : d)) + '\n'); return 0; },
    printf: (f, ...a) => { HAL.write(HAL.printf(f, ...a)); return 0; }, write: v => { HAL.write(typeof v === 'number' ? String.fromCharCode(v) : String(v)); return 1; },
    flush: () => 0, available: () => 0, read: () => -1, peek: () => -1, readString: () => '', readStringUntil: () => '', parseInt: () => 0, parseFloat: () => 0, readBytes: () => 0, find: () => false
  };
  return o;
}
const NEOPIXEL = function(n, pin){
  const cols = Array.from({ length: n }, () => [0, 0, 0]); let br = 255;
  const self = {
    begin: () => 0, show: () => { const o = stripPart(); if(o){ o.state.colors = cols.map(c => c.map(v => Math.round(v * br / 255))); refreshAllVisuals(); } },
    setPixelColor: (i, r, g, b) => { if(g === undefined){ cols[i] = [(r >> 16) & 255, (r >> 8) & 255, r & 255]; } else cols[i] = [r, g, b]; }, setBrightness: v => { br = v; }, clear: () => { cols.forEach((c, i) => cols[i] = [0, 0, 0]); },
    fill: (c, f, cnt) => { for(let i = f || 0; i < (cnt ? (f || 0) + cnt : n); i++) cols[i] = [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }, numPixels: () => n, Color: (r, g, b) => (r << 16) | (g << 8) | b,
    ColorHSV: (h) => { const c = hueRGB(((h / 65535) * 360) % 360); return (c[0] << 16) | (c[1] << 8) | c[2]; }, getPixelColor: i => (cols[i][0] << 16) | (cols[i][1] << 8) | cols[i][2], rainbow: () => 0, updateLength: () => 0, gamma32: c => c
  };
  return self;
};
function lcdI2C(addr, cols, rows){
  const o = lcdPart(); const R = o ? o.def.rows || rows || 2 : rows || 2, C = o ? o.def.cols || cols || 16 : cols || 16;
  const buf = Array.from({ length: R }, () => ' '.repeat(C)); let r = 0, c = 0;
  const push = () => { if(o){ o.state.lcdText = buf.join(''); lcdSetText(o, o.state.lcdText); } };
  const put = ch => { if(ch === '\n'){ r = Math.min(R - 1, r + 1); c = 0; return; } if(c < C){ buf[r] = buf[r].slice(0, c) + ch + buf[r].slice(c + 1); c++; } };
  return { init: () => 0, begin: () => 0, backlight: () => 0, noBacklight: () => 0, display: () => 0, noDisplay: () => 0, cursor: () => 0, noCursor: () => 0, blink: () => 0, noBlink: () => 0, createChar: () => 0, setBacklight: () => 0,
    setCursor: (x, y) => { c = x; r = y; }, home: () => { r = c = 0; }, clear: () => { for(let i = 0; i < R; i++) buf[i] = ' '.repeat(C); r = c = 0; push(); },
    print: v => { for(const ch of numFmt(v)) put(ch); push(); return 0; }, println: v => { for(const ch of numFmt(v)) put(ch); push(); return 0; }, write: v => { put(typeof v === 'number' ? String.fromCharCode(v) : v); push(); }, printstr: v => { for(const ch of String(v)) put(ch); push(); } };
}
function gfxClass(ctrls, extra){
  return function(...a){
    const g = HAL.gfx(ctrls);
    let tt = null;
    g.getTouch = (rx, ry) => { tt = tt || HAL.touch(); return tt ? tt.getTouch(rx, ry) : false; };
    g.touch_calibrate = g.calibrateTouch = g.setTouch = () => 0;
    g.getTouchRaw = (rx, ry) => { tt = tt || HAL.touch(); const p = tt && tt.getTouchRaw(); if(rx && rx.set && p){ rx.set(p.x); ry.set(p.y); } return !!(tt && tt.touched()); };
    if(extra) Object.assign(g, extra);
    return g;
  };
}
function touchClass(raw){
  return function(){
    const t = HAL.touch();
    if(!t) return { begin: () => true, touched: () => false, getPoint: () => ({ x: 0, y: 0, z: 0 }), setRotation: () => 0 };
    if(raw){
      const sc = KezleScreens.get(t._inst);
      const conv = p => ({ x: Math.round(150 + (p.x / sc.W) * 3650), y: Math.round(150 + (p.y / sc.H) * 3650), z: p.z });
      return Object.assign({}, t, { getPoint: () => conv(t.getPoint()), bufferSize: () => (t.touched() ? 1 : 0), bufferEmpty: () => !t.touched(), tirqTouched: () => t.touched() });
    }
    return t;
  };
}
function cApi(src){
  const sw = HAL.colorConsts();
  const mcu = CIRCUIT.primaryMcu();
  const isAVR = mcu && /uno|nano|mega|leonardo|pro_mini|attiny/.test(mcu.def.id);
  const analog = ANALOG();
  function ANALOG(){ return isAVR ? [14, 15, 16, 17, 18, 19, 20, 21] : (mcu && /pico|rp2040/.test(mcu.def.id) ? [26, 27, 28, 29] : [36, 39, 34, 35, 32, 33, 25, 26]); }
  const Serial = makeSerial();
  const api = Object.assign({}, sw, {
    HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, INPUT_PULLDOWN: 3, LED_BUILTIN: pinId('LED'), RISING: 'rising', FALLING: 'falling', CHANGE: 'change', DEC: 10, HEX: 16, BIN: 2, OCT: 8,
    PI: Math.PI, TWO_PI: 2 * Math.PI, HALF_PI: Math.PI / 2, DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI, SDA: 21, SCL: 22, MOSI: 23, MISO: 19, SCK: 18, SS: 5, LSBFIRST: 0, MSBFIRST: 1, true: true, false: false, NULL: null, nullptr: null, INT_MAX: 2147483647, UINT8_MAX: 255, UINT16_MAX: 65535,
    TFT_BL: 21, TFT_CS: 15, TFT_DC: 2, TFT_RST: -1, ESP32: 1, ARDUINO: 10819, F_CPU: 240000000,
    GPIO_OUT: 1, GPIO_IN: 0, true_: true,
    pinMode: (p, m) => HAL.pinMode(p, m), digitalWrite: (p, v) => HAL.digitalWrite(p, v), digitalRead: p => HAL.digitalRead(p), analogRead: p => HAL.analogRead(p),
    analogWrite: (p, v) => HAL.analogWrite(p, v, 255), analogReference: () => 0, analogReadResolution: () => 0, analogWriteResolution: () => 0, analogSetAttenuation: () => 0, analogSetWidth: () => 0,
    delay: ms => HAL.delay(ms), delayMicroseconds: us => HAL.delayUs(us), millis: () => HAL.millis(), micros: () => HAL.micros(), yield: () => tick(),
    tone: (p, f, d) => HAL.tone(p, f, d), noTone: p => HAL.noTone(p), pulseIn: (p, l, t) => HAL.pulseIn(p, l, (t || 1000000) / 1000),
    random: (a, b) => b == null ? Math.floor(Math.random() * a) : Math.floor(a + Math.random() * (b - a)), randomSeed: () => 0,
    map: (v, a, b, c, d) => Math.trunc((v - a) * (d - c) / (b - a) + c), constrain: (v, a, b) => Math.max(a, Math.min(b, v)),
    abs: Math.abs, min: Math.min, max: Math.max, sq: x => x * x, sqrt: Math.sqrt, pow: Math.pow, sin: Math.sin, cos: Math.cos, tan: Math.tan, atan2: Math.atan2, atan: Math.atan, asin: Math.asin, acos: Math.acos, exp: Math.exp, log: Math.log, log10: Math.log10, floor: Math.floor, ceil: Math.ceil, round: Math.round, fabs: Math.abs, fmod: (a, b) => a % b, trunc: Math.trunc, radians: x => x * Math.PI / 180, degrees: x => x * 180 / Math.PI, isnan: Number.isNaN, isinf: x => !Number.isFinite(x) && !Number.isNaN(x),
    bitRead: (v, b) => (v >> b) & 1, bitWrite: (v, b, x) => x ? v | (1 << b) : v & ~(1 << b), bitSet: (v, b) => v | (1 << b), bitClear: (v, b) => v & ~(1 << b), bit: b => 1 << b, lowByte: v => v & 255, highByte: v => (v >> 8) & 255, _BV: b => 1 << b,
    attachInterrupt: (p, f, m) => HAL.attach(p, f, m), detachInterrupt: () => 0, digitalPinToInterrupt: p => p, interrupts: () => 0, noInterrupts: () => 0, cli: () => 0, sei: () => 0,
    isDigit: c => c >= 48 && c <= 57, isAlpha: c => /[A-Za-z]/.test(String.fromCharCode(c)), toupper: c => String.fromCharCode(c).toUpperCase().charCodeAt(0), tolower: c => String.fromCharCode(c).toLowerCase().charCodeAt(0),
    Serial, Serial1: makeSerial(), Serial2: makeSerial(),
    Wire: { begin: () => 0, beginTransmission: () => 0, endTransmission: () => 0, write: () => 1, requestFrom: () => 0, read: () => 0, available: () => 0, setClock: () => 0 }, SPI: { begin: () => 0, transfer: v => v, beginTransaction: () => 0, endTransaction: () => 0, setBitOrder: () => 0, setClockDivider: () => 0, setDataMode: () => 0 },
    EEPROM: { begin: () => 0, read: () => 0, write: () => 0, commit: () => 0, put: () => 0, get: () => 0, update: () => 0 },
    WiFi: { begin: () => 0, status: () => 3, localIP: () => '192.168.4.22', mode: () => 0, disconnect: () => 0, RSSI: () => -52, SSID: () => 'KezleLab', softAP: () => true }, WL_CONNECTED: 3,
    ESP: { restart: () => { RUN.on = false; }, getFreeHeap: () => 180000 }, esp_random: () => Math.floor(Math.random() * 4294967295),
    __idiv: (a, b) => { if(b === 0) throw new Error('divisão inteira por zero'); return Math.trunc(a / b); }, __int: v => Math.trunc(+v) || 0, __chr: v => typeof v === 'number' ? String.fromCharCode(v) : v, __sizeof: x => Array.isArray(x) ? x.length : (typeof x === 'string' ? x.length + 1 : 1),
    __R: (get, set) => ({ get, set, get v(){ return get(); }, set v(x){ set(x); } }), __D: p => (p && p.get) ? p.get() : p,
    __cout: (...a) => { HAL.write(a.map(x => numFmt(x)).join('')); }, endl: '\n', cout: null,
    printf: (f, ...a) => { HAL.write(HAL.printf(f, ...a)); return 0; }, puts: s => { HAL.write(s + '\n'); return 0; }, putchar: c => { HAL.write(String.fromCharCode(c)); return c; }, sprintf: (b, f, ...a) => HAL.printf(f, ...a), snprintf: (b, n, f, ...a) => HAL.printf(f, ...a),
    atoi: s => parseInt(s) || 0, atof: s => parseFloat(s) || 0, strlen: s => String(s).length, strcmp: (a, b) => a < b ? -1 : a > b ? 1 : 0, rand: () => Math.floor(Math.random() * 32768), srand: () => 0, RAND_MAX: 32767, abs_: Math.abs, itoa: (v, b, r) => (v).toString(r || 10),
    // pico-sdk / AVR C
    stdio_init_all: () => 0, gpio_init: p => HAL.pinMode(p, 'in'), gpio_set_dir: (p, d) => HAL.pinMode(p, d ? 'out' : 'in'), gpio_put: (p, v) => HAL.digitalWrite(p, v), gpio_get: p => HAL.digitalRead(p), gpio_pull_up: p => HAL.pinMode(p, 'in_up'), gpio_pull_down: p => HAL.pinMode(p, 'in_down'), gpio_disable_pulls: () => 0, gpio_set_function: () => 0, gpio_toggle: p => HAL.digitalWrite(p, (PINS[p] && PINS[p].v) ? 0 : 1),
    sleep_ms: ms => HAL.delay(ms), sleep_us: us => HAL.delayUs(us), busy_wait_ms: ms => HAL.delay(ms), busy_wait_us: us => HAL.delayUs(us), tight_loop_contents: () => 0, to_ms_since_boot: () => HAL.millis(), time_us_32: () => HAL.micros(), get_absolute_time: () => HAL.micros(), absolute_time_diff_us: (a, b) => b - a,
    adc_init: () => 0, adc_gpio_init: () => 0, adc_select_input: n => { api.__adcSel = n; }, adc_read: () => HAL.analogRead(isAVR ? 14 + api.__adcSel : [26, 27, 28][api.__adcSel] || 26) * (isAVR ? 1 : 1), adc_set_temp_sensor_enabled: () => 0,
    pwm_gpio_to_slice_num: p => p >> 1, pwm_gpio_to_channel: p => p & 1, pwm_set_wrap: (s, w) => { api.__wrap = w; }, pwm_set_gpio_level: (p, l) => HAL.analogWrite(p, l, (api.__wrap || 65535)), pwm_set_chan_level: () => 0, pwm_set_enabled: () => 0, pwm_set_clkdiv: () => 0, pwm_config_set_clkdiv: () => 0, pwm_config_set_wrap: () => 0, pwm_init: () => 0, pwm_get_default_config: () => ({}), pwm_set_freq_duty: () => 0, GPIO_FUNC_PWM: 4, GPIO_FUNC_I2C: 3, GPIO_FUNC_SPI: 1, GPIO_FUNC_UART: 2, PICO_DEFAULT_LED_PIN: 25, CYW43_WL_GPIO_LED_PIN: 0,
    i2c_init: () => 0, spi_init: () => 0, uart_init: () => 0, i2c_default: 0, spi_default: 0, i2c0: 0, i2c1: 1, spi0: 0, spi1: 1, uart0: 0, uart1: 1, cyw43_arch_init: () => 0, cyw43_arch_gpio_put: (p, v) => HAL.digitalWrite(25, v),
    DDRB: 0, PORTB: 0, PINB: 0, DDRD: 0, PORTD: 0, PIND: 0, DDRC: 0, PORTC: 0, PB5: 5, PD2: 2, PD3: 3,
    // classes (acessíveis com new)
    TFT_eSPI: gfxClass(['st7789', 'ili9341', 'ili9488', 'st7735', 'st7796', 'gc9a01', 'tdisp', 'cyd', 'm5', 'mcu', 'generic']),
    Adafruit_SSD1306: gfxClass(['ssd1306', 'sh1106']), Adafruit_SH1106G: gfxClass(['sh1106', 'ssd1306']), Adafruit_SH110X: gfxClass(['sh1106', 'ssd1306']),
    Adafruit_ST7789: gfxClass(['st7789', 'tdisp', 'cyd', 'gc9a01']), Adafruit_ST7735: gfxClass(['st7735', 'st7789']), Adafruit_ILI9341: gfxClass(['ili9341', 'cyd']), Adafruit_ILI9488: gfxClass(['ili9488', 'ili9341']), Adafruit_ST7796S: gfxClass(['st7796']), Adafruit_GC9A01A: gfxClass(['gc9a01']), Adafruit_SSD1331: gfxClass(['ssd1331']), Adafruit_SSD1351: gfxClass(['ssd1351']), Adafruit_PCD8544: gfxClass(['pcd8544']), Adafruit_GFX: gfxClass(null),
    U8G2: gfxClass(['ssd1306', 'sh1106', 'st7920', 'pcd8544']), GxEPD2_BW: gfxClass(['epd']), GxEPD2_3C: gfxClass(['epd']), GxEPD2_7C: gfxClass(['epd']), LGFX: gfxClass(null), Arduino_GFX: gfxClass(null), Arduino_TFT: gfxClass(null), Arduino_ST7789: gfxClass(['st7789']), Arduino_DataBus: function(){ return {}; },
    XPT2046_Touchscreen: touchClass(true), Adafruit_FT6206: touchClass(false), FT6336U: touchClass(false), CST816S: touchClass(false), GT911: touchClass(false), TAMC_GT911: touchClass(false), FT6x36: touchClass(false), TouchScreen: touchClass(true), Touch: touchClass(false), TS_Point: function(x, y, z){ return { x: x || 0, y: y || 0, z: z || 0 }; },
    LiquidCrystal_I2C: function(a, c, r){ return lcdI2C(a, c, r); }, LiquidCrystal: function(){ return lcdI2C(0, 16, 2); }, hd44780_I2Cexp: function(){ return lcdI2C(0, 16, 2); },
    Servo: function(){ let pin = null, ang = 90; return { attach: p => { pin = p; HAL.pinMode(p, 'out'); return 1; }, write: a => { ang = a; if(pin != null) HAL.servoWrite(pin, a); }, writeMicroseconds: us => { ang = (us - 500) / 2000 * 180; if(pin != null) HAL.servoWrite(pin, ang); }, read: () => ang, detach: () => 0, attached: () => pin != null }; },
    Adafruit_NeoPixel: NEOPIXEL, NEO_GRB: 0, NEO_KHZ800: 0, NEO_RGB: 1, NEO_GRBW: 2, NEO_KHZ400: 0, FastLED: { addLeds: () => 0, show: () => 0, setBrightness: () => 0, clear: () => 0 },
    DHT: function(...a){ return CPP_CLASSES.DHT(a); }, Adafruit_BMP280: function(...a){ return CPP_CLASSES.Adafruit_BMP280(a); }, Adafruit_MPU6050: function(...a){ return CPP_CLASSES.Adafruit_MPU6050(a); }, DHT11: 11, DHT22: 22, DHT21: 21,
    Adafruit_BME280: function(){ return { begin: () => true, readTemperature: () => round1(readKind('bme').temperature || 0), readHumidity: () => round1(readKind('bme').humidity || 0), readPressure: () => round1((readKind('bme').pressure || 0) * 100), readAltitude: () => round1(readKind('bme').altitude || 0) }; },
    BH1750: function(){ return { begin: () => true, readLightLevel: () => Math.round((readKind('lux').lux != null ? readKind('lux').lux : (readKind('luxA').lux || 0))) }; },
    DS18B20: function(){ return {}; }, OneWire: function(){ return {}; }, DallasTemperature: function(){ return { begin: () => 0, requestTemperatures: () => 0, getTempCByIndex: () => round1(readKind('t1w').temperature || 0), getTempC: () => round1(readKind('t1w').temperature || 0) }; },
    Ticker: function(){ return { attach_ms: (ms, f) => HAL.every(ms, f), detach: () => 0, attach: (s, f) => HAL.every(s * 1000, f) }; },
    String_: String
  });
  api.A0 = analog[0]; api.A1 = analog[1]; api.A2 = analog[2]; api.A3 = analog[3]; api.A4 = analog[4]; api.A5 = analog[5]; api.A6 = analog[6]; api.A7 = analog[7];
  for(let i = 0; i < 40; i++){ api['GPIO' + i] = i; api['GP' + i] = i; api['D' + i] = i; api['IO' + i] = i; api['PIN_' + i] = i; }
  api.cout = { __cout: true };
  const gen = window.KEZLE_CPP_CLASSES || {};
  for(const k in gen) if(!(k in api) && /^[A-Za-z_]\w*$/.test(k)) api[k] = gen[k];
  if(/\bM5\b|M5Stack|M5Unified|M5Core/.test(src)) api.M5 = makeM5();
  // C helpers para display (estilo "tft_*")
  let g_ = null;
  const G = () => g_ || (g_ = HAL.gfx(null));
  let T_ = null;
  Object.assign(api, { tft_touched: (rx, ry) => { T_ = T_ || HAL.touch(); return T_ && T_.getTouch(rx, ry) ? 1 : 0; }, tft_init: () => { G(); }, tft_fill: c => G().fillScreen(c), tft_text: (s, x, y, c) => G().drawString(s, x, y) || (G().setTextColor(c), G().drawString(s, x, y)), tft_circle: (x, y, r, c) => G().fillCircle(x, y, r, c), tft_rect: (x, y, w, h, c) => G().fillRect(x, y, w, h, c), tft_line: (a, b, c, d, e) => G().drawLine(a, b, c, d, e), tft_pixel: (x, y, c) => G().drawPixel(x, y, c) });
  return api;
}
function makeM5(){
  let g = null, t = null;
  const gx = () => g || (g = HAL.gfx(['m5', 'mcu', 'cyd', 'tdisp']));
  const lcd = new Proxy({}, { get: (_, k) => { const x = gx(); const v = x[k]; return typeof v === 'function' ? v.bind(x) : v; } });
  const mkBtn = n => HAL.button(n);
  const T = () => t || (t = HAL.touch());
  const tp = () => { const x = T(); const p = x && x.touched() ? x.get_point() : null; return p; };
  const detail = () => { const p = tp(); const was = { v: false }; return { x: p ? p.x : -1, y: p ? p.y : -1, isPressed: () => !!p, wasPressed: () => !!p, wasReleased: () => false, isHolding: () => !!p, wasClicked: () => !!p, id: 0 }; };
  return { begin: () => 0, update: () => 0, Lcd: lcd, Display: lcd, BtnA: mkBtn('A'), BtnB: mkBtn('B'), BtnC: mkBtn('C'), Touch: { ispressed: () => !!tp(), getCount: () => (tp() ? 1 : 0), getDetail: () => detail(), getPressPoint: () => { const p = tp(); return p ? { x: p.x, y: p.y } : { x: -1, y: -1 }; }, update: () => 0 }, Power: { getBatteryLevel: () => 87, isCharging: () => false, setPowerBoostKeepOn: () => 0 }, Speaker: { tone: (f, d) => HAL.tone(25, f, d), setVolume: () => 0, begin: () => 0, mute: () => 0 }, Imu: { getAccelData: () => 0, begin: () => 0 }, config: () => ({}), Rtc: {} };
}

/* ======================== transpilador C / C++ ======================== */
const T_BASE = new Set(['int', 'long', 'short', 'char', 'float', 'double', 'bool', 'boolean', 'byte', 'word', 'void', 'unsigned', 'signed', 'size_t', 'auto', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'uint', 'uint8', 'uint16', 'uint32', 'ssize_t', 'intptr_t', 'uintptr_t', 'String', 'string', 'uint_fast8_t', 'uint_least8_t']);
const T_QUAL = new Set(['const', 'static', 'volatile', 'extern', 'inline', 'register', 'constexpr', 'PROGMEM', 'IRAM_ATTR', 'RTC_DATA_ATTR', 'struct', 'class', 'union', 'enum', 'typename', 'mutable', '__attribute__']);
const INTLIKE = new Set(['int', 'long', 'short', 'char', 'byte', 'word', 'unsigned', 'signed', 'size_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'uint', 'uint8', 'uint16', 'uint32', 'ssize_t', 'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'usize', 'isize', 'int8', 'int16', 'int32', 'int64', 'uintptr_t', 'rune']);
const FLOATLIKE = new Set(['float', 'double', 'f32', 'f64', 'float32', 'float64']);
const AWAIT_FN = new Set(['delay', 'delayMicroseconds', 'yield', 'pulseIn', 'sleep_ms', 'sleep_us', 'busy_wait_ms', 'busy_wait_us']);

function cTranspile(src, opts){
  opts = opts || {};
  const api = opts.api;
  const libClasses = new Set(Object.keys(api).filter(k => typeof api[k] === 'function' && /^[A-Z]/.test(k)));
  let toks = ctok(src);
  // pré-processador: #define / #if
  const defs = new Set(['ARDUINO', 'ESP32', 'ESP_PLATFORM', '__AVR__']);
  const filtered = [];
  const stack = [];
  const active = () => stack.every(s => s.on);
  for(const tk of toks){
    if(tk.t !== 'pp'){ if(active()) filtered.push(tk); continue; }
    const m = tk.v.match(/^#\s*(\w+)\s*(.*)$/);
    if(!m){ continue; }
    const d = m[1], rest = m[2];
    if(d === 'ifdef') stack.push({ on: defs.has(rest.trim()) || libClasses.has(rest.trim()), done: false });
    else if(d === 'ifndef') stack.push({ on: !defs.has(rest.trim()) && !libClasses.has(rest.trim()), done: false });
    else if(d === 'if') stack.push({ on: !/^\s*0\s*$/.test(rest) && !/^defined\s*\(\s*(__?\w*SKIP\w*)\s*\)/.test(rest), done: false });
    else if(d === 'else'){ const s = stack[stack.length - 1]; if(s) s.on = !s.on; }
    else if(d === 'elif'){ const s = stack[stack.length - 1]; if(s) s.on = !s.on && !/^\s*0\s*$/.test(rest); }
    else if(d === 'endif') stack.pop();
    else if(active() && d === 'define'){ const mm = rest.match(/^(\w+)(\([^)]*\))?\s*(.*)$/); if(mm){ defs.add(mm[1]); filtered.push({ t: 'def', name: mm[1], params: mm[2], body: mm[3], line: tk.line }); } }
  }
  toks = filtered;
  const userFns = new Set(), userTypes = new Set(), types = new Map(); // nome -> 'int'|'float'|'str'|'bool'|'other'
  // varredura: funções e structs
  for(let i = 0; i < toks.length; i++){
    const t = toks[i];
    if(t.t === 'id' && (t.v === 'struct' || t.v === 'class' || t.v === 'union' || t.v === 'enum') && toks[i + 1] && toks[i + 1].t === 'id') userTypes.add(toks[i + 1].v);
    if(t.t === 'id' && t.v === 'typedef'){ let j = i; let d = 0; while(j < toks.length){ if(toks[j].v === '{') d++; if(toks[j].v === '}') d--; if(toks[j].v === ';' && d === 0) break; j++; } if(toks[j - 1] && toks[j - 1].t === 'id') userTypes.add(toks[j - 1].v); }
  }
  // funções: ID ID ( ... ) {  no nível 0
  {
    let depth = 0;
    for(let i = 0; i < toks.length; i++){
      const t = toks[i];
      if(t.v === '{' && t.t === 'op') depth++; else if(t.v === '}' && t.t === 'op') depth--;
      else if(depth === 0 && t.t === 'id' && toks[i + 1] && toks[i + 1].v === '(' && i > 0 && (toks[i - 1].t === 'id' || toks[i - 1].v === '*' || toks[i - 1].v === '&') && !KW_.has(t.v) && !KW_.has(toks[i - 1].v)){
        let j = i + 1, d = 0; while(j < toks.length){ if(toks[j].v === '(') d++; if(toks[j].v === ')'){ d--; if(!d) break; } j++; }
        let k = j + 1; while(toks[k] && toks[k].t === 'id' && /^(const|override|noexcept)$/.test(toks[k].v)) k++;
        if(toks[k] && toks[k].v === '{') userFns.add(t.v);
      }
    }
  }
  let p = 0;
  const peek = (o) => toks[p + (o || 0)];
  const isOp = (v, o) => { const t = toks[p + (o || 0)]; return t && t.t === 'op' && t.v === v; };
  function err(msg, t){ const e = new Error(msg); e.line = (t || toks[p] || {}).line; return e; }

  const isTypeWord = (t) => t && t.t === 'id' && (T_BASE.has(t.v) || T_QUAL.has(t.v) || userTypes.has(t.v) || libClasses.has(t.v));
  // tenta reconhecer "tipo [*&] NOME" a partir de q; devolve {end, baseType, name, isCtorType}
  function matchDecl(q){
    let i = q, base = null, sawType = false, last = null;
    while(toks[i] && toks[i].t === 'id' && (T_QUAL.has(toks[i].v) || T_BASE.has(toks[i].v) || userTypes.has(toks[i].v) || libClasses.has(toks[i].v))){
      if(!T_QUAL.has(toks[i].v)){ sawType = true; if(!base || /^(unsigned|signed|long|short)$/.test(base)) base = toks[i].v; last = toks[i].v; }
      i++;
      // template args
      if(toks[i] && toks[i].v === '<' && last && /^(GxEPD2_BW|GxEPD2_3C|GxEPD2_7C|vector|array|map|std)$/.test(last)){ let d = 0; while(toks[i]){ if(toks[i].v === '<') d++; if(toks[i].v === '>'){ d--; if(!d){ i++; break; } } if(toks[i].v === '>>'){ d -= 2; if(d <= 0){ i++; break; } } i++; } }
      if(toks[i] && toks[i].v === '::' ){ i++; } // std::string etc
    }
    // tipo desconhecido: ID ID (= ; , [ ( )
    if(!sawType && toks[i] && toks[i].t === 'id' && !KW_.has(toks[i].v) && toks[i + 1]){
      let j = i + 1;
      while(toks[j] && (toks[j].v === '*' || toks[j].v === '&')) j++;
      if(toks[j] && toks[j].t === 'id' && !KW_.has(toks[j].v) && toks[j + 1] && /^(=|;|,|\[|\()$/.test(toks[j + 1].v) && !AWAIT_FN.has(toks[i].v)){
        sawType = true; base = toks[i].v; i = j - 0; i = toks[i - 1] && (toks[i - 1].v === '*' || toks[i - 1].v === '&') ? i : i;
        // reposiciona: i aponta para o NOME após stars
        let k = q; while(k < toks.length && !(toks[k].t === 'id' && toks[k] === toks[j])) k++;
        return { end: k, name: toks[j].v, base, hasStar: toks.slice(q, j).some(t => t.v === '*'), unknownType: true, nameTok: toks[j] };
      }
    }
    if(!sawType) return null;
    let star = false;
    while(toks[i] && (toks[i].v === '*' || toks[i].v === '&' || toks[i].v === '&&' || (toks[i].t === 'id' && /^(const|volatile)$/.test(toks[i].v)))){ if(toks[i].v === '*') star = true; i++; }
    if(toks[i] && toks[i].t === 'id' && !KW_.has(toks[i].v)) return { end: i, name: toks[i].v, base, hasStar: star, nameTok: toks[i] };
    return null;
  }
  const kindOf = (base, star) => star && base === 'char' ? 'str' : INTLIKE.has(base) ? 'int' : FLOATLIKE.has(base) ? 'float' : (base === 'bool' || base === 'boolean') ? 'bool' : (base === 'String' || base === 'string') ? 'str' : 'other';
  const zeroOf = k => k === 'int' || k === 'float' ? '0' : k === 'bool' ? 'false' : k === 'str' ? '""' : 'null';

  /* ----- conversão de expressão (tokens -> JS) ----- */
  function conv(tk){
    const out = [];
    const L = tk.length;
    const prevIsValue = j => { const t = tk[j - 1]; return t && (t.t === 'id' && !KW_.has(t.v) || t.t === 'num' || t.t === 'str' || t.t === 'chr' || t.v === ')' || t.v === ']'); };
    const tyOf = t => { if(!t) return null; if(t.t === 'num') return t.f ? 'float' : 'int'; if(t.t === 'chr') return 'int'; if(t.t === 'id') return types.get(t.v) || null; return null; };
    for(let j = 0; j < L; j++){
      const t = tk[j], nx = tk[j + 1], pv = tk[j - 1];
      if(t.t === 'num'){ out.push(t.v); continue; }
      if(t.t === 'str'){ out.push('"' + t.v.replace(/"/g, '\\"') + '"'); continue; }
      if(t.t === 'raw'){ out.push('`' + t.v + '`'); continue; }
      if(t.t === 'chr'){ out.push(String(t.v)); continue; }
      if(t.t === 'id'){
        // casts: ( tipo ) expr
        if(t.v === 'sizeof'){ out.push('__sizeof'); continue; }
        if((t.v === 'F' || t.v === 'PSTR' || t.v === 'PROGMEM_STR') && nx && nx.v === '('){ out.push(''); continue; }
        if(t.v === 'std' && nx && nx.v === '::'){ j++; continue; }
        if(t.v === 'true' || t.v === 'false'){ out.push(t.v); continue; }
        if(t.v === 'NULL' || t.v === 'nullptr'){ out.push('null'); continue; }
        if(t.v === 'new' && nx && nx.t === 'id'){ out.push('new'); continue; }
        if(t.v === 'this'){ out.push('this'); continue; }
        if(nx && nx.v === '(' && userFns.has(t.v) && !(pv && (pv.v === '.' || pv.v === '->' || pv.v === '::'))){ out.push('(await ' + t.v); // fecha ao achar ')' correspondente
          let d = 0, k = j + 1; for(; k < L; k++){ if(tk[k].v === '(') d++; if(tk[k].v === ')'){ d--; if(!d) break; } } tk[k] = Object.assign({}, tk[k], { closeAwait: true }); continue; }
        if(nx && nx.v === '(' && AWAIT_FN.has(t.v) && !(pv && pv.v === '.')){ out.push('(await ' + t.v); let d = 0, k = j + 1; for(; k < L; k++){ if(tk[k].v === '(') d++; if(tk[k].v === ')'){ d--; if(!d) break; } } tk[k] = Object.assign({}, tk[k], { closeAwait: true }); continue; }
        if(nx && nx.v === '(' && libClasses.has(t.v) && !(pv && (pv.v === '.' || pv.v === 'new'))){ out.push('new ' + t.v); continue; }
        if(nx && nx.v === '(' && pv && pv.v === '.' && /^(length|size)$/.test(t.v) && tk[j + 2] && tk[j + 2].v === ')'){ out.pop(); out.push('.length'); j += 2; continue; }
        if(nx && nx.v === '(' && pv && pv.v === '.' && /^c_str$/.test(t.v) && tk[j + 2] && tk[j + 2].v === ')'){ out.pop(); j += 2; continue; }
        if(nx && nx.v === '(' && pv && pv.v === '.' && t.v === 'toInt'){ out.push('toInt'); continue; }
        out.push(t.v); continue;
      }
      // operadores
      const v = t.v;
      if(t.closeAwait && v === ')'){ out.push('))'); continue; }
      if(v === '::'){ out.push('.'); continue; }
      if(v === '->'){ out.push('.'); continue; }
      if(v === '(' && nx && nx.t === 'id' && !prevIsValue(j)){
        // cast?
        let k = j + 1, ok = false, isInt = false, isFlt = false;
        if(tk[j + 1].v === 'char' && tk[j + 2] && tk[j + 2].v === ')' && tk[j + 3] && tk[j + 3].t === 'id'){
          let e = j + 4; // id ( [..] | (..) | .id )*
          for(;;){ if(tk[e] && (tk[e].v === '[' || tk[e].v === '(')){ const o = tk[e].v, cl = o === '[' ? ']' : ')'; let d = 0; for(; e < L; e++){ if(tk[e].v === o) d++; if(tk[e].v === cl){ d--; if(!d){ e++; break; } } } } else if(tk[e] && tk[e].v === '.' && tk[e + 1] && tk[e + 1].t === 'id') e += 2; else break; }
          out.push('__chr(' + conv(tk.slice(j + 3, e)) + ')'); j = e - 1; continue;
        }
        while(tk[k] && tk[k].t === 'id' && (T_BASE.has(tk[k].v) || T_QUAL.has(tk[k].v))){ if(INTLIKE.has(tk[k].v)) isInt = true; if(FLOATLIKE.has(tk[k].v)) isFlt = true; k++; ok = true; }
        while(tk[k] && tk[k].v === '*') k++;
        if(ok && tk[k] && tk[k].v === ')' && tk[k + 1] && (tk[k + 1].t === 'id' || tk[k + 1].t === 'num' || tk[k + 1].v === '(' || tk[k + 1].v === '-' || tk[k + 1].t === 'chr')){
          out.push(isInt ? '~~' : isFlt ? '+' : ''); j = k; continue;
        }
      }
      if(v === '&' && !prevIsValue(j) && nx && nx.t === 'id' && !(tk[j + 2] && (tk[j + 2].v === '[' || tk[j + 2].v === '.' || tk[j + 2].v === '('))){ out.push(`__R(() => ${nx.v}, (__v) => ${nx.v} = __v)`); j++; continue; }
      if(v === '&' && !prevIsValue(j)){ continue; }
      if(v === '*' && !prevIsValue(j) && nx && nx.t === 'id'){ out.push('__D(' + nx.v + ')'); j++; continue; }
      if(v === '*' && !prevIsValue(j)){ continue; }
      if(v === '/' && pv && nx && tyOf(pv) === 'int' && tyOf(nx) === 'int' && !(tk[j + 2] && /^(\(|\.|\[)$/.test(tk[j + 2].v)) && !(tk[j - 2] && /^(\.|\*|\/|%)$/.test(tk[j - 2].v))){
        const left = out.pop(); out.push('__idiv(' + left + ', ' + (nx.t === 'num' ? nx.v : nx.t === 'chr' ? nx.v : nx.v) + ')'); j++; continue;
      }
      if(v === '{'){ out.push('['); continue; }
      if(v === '}'){ out.push(']'); continue; }
      if(v === '<<' && opts.cout && out.length && /^(cout|__cout)/.test(out[0])){ out.push(','); continue; }
      out.push(v === '<<' && false ? ',' : v);
    }
    let s = out.join(' ').replace(/\s+\./g, '.').replace(/\.\s+/g, '.').replace(/\s+\(/g, '(').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+,/g, ',').replace(/\s+\[/g, '[').replace(/\s+\]/g, ']').replace(/\[\s+/g, '[').replace(/~~\s+/g, '~~').replace(/\bnew\s+/g, 'new ').replace(/\+\s+(?=[\w(])/g, (m, off, str) => m);
    s = s.replace(/\(await\s+(\w+)\s*\(/g, '(await $1(');
    return s;
  }
  function slice(stops){ // consome tokens até um stop (nível 0) — retorna array de tokens
    const r = []; let d = 0;
    while(p < toks.length){
      const t = toks[p];
      if(t.t === 'op'){
        if('([{'.includes(t.v)) d++;
        else if(')]}'.includes(t.v)){ if(d === 0 && stops.includes(t.v)) break; d--; }
        else if(d === 0 && stops.includes(t.v)) break;
      }
      r.push(t); p++;
    }
    return r;
  }
  function expectOp(v){ if(!isOp(v)) throw err('esperava "' + v + '" mas veio "' + (peek() ? (peek().v) : 'fim') + '"'); p++; }

  /* ----- declarações ----- */
  function parseParams(){
    // posicionado após '(' ; consome até ')'
    const ps = []; let cur = [];
    let d = 0;
    while(p < toks.length){
      const t = toks[p];
      if(t.v === '(' ) d++;
      if(t.v === ')'){ if(d === 0) break; d--; }
      if(t.v === ',' && d === 0){ ps.push(cur); cur = []; p++; continue; }
      cur.push(t); p++;
    }
    if(cur.length) ps.push(cur);
    expectOp(')');
    const names = [];
    for(const pr of ps){
      if(pr.length === 1 && pr[0].v === 'void') continue;
      let eq = pr.findIndex(t => t.v === '=');
      const decl = eq >= 0 ? pr.slice(0, eq) : pr;
      let nm = null, idx = -1;
      for(let i = decl.length - 1; i >= 0; i--){ if(decl[i].t === 'id' && !T_QUAL.has(decl[i].v)){ nm = decl[i].v; idx = i; break; } }
      if(!nm) continue;
      const baseTok = decl.find(t => t.t === 'id' && T_BASE.has(t.v));
      const star = decl.some(t => t.v === '*');
      types.set(nm, decl.some(t => t.v === '[') ? 'other' : kindOf(baseTok ? baseTok.v : null, star));
      if(decl.length === 1) types.set(nm, 'other'); // sem tipo: provavelmente lambda param
      names.push(nm + (eq >= 0 ? ' = ' + conv(pr.slice(eq + 1)) : ''));
    }
    return names;
  }
  function declStmt(info, inFor){
    // p está no início do tipo; processa declaradores
    const startTok = toks[p];
    let q = p;
    const base = info.base;
    const typeIsClass = libClasses.has(base) || userTypes.has(base) || base === 'String';
    p = info.end;
    const parts = [];
    let first = true;
    for(;;){
      let nameTok = toks[p];
      if(!first){
        while(toks[p] && (toks[p].v === '*' || toks[p].v === '&')) p++;
        nameTok = toks[p];
      }
      if(!nameTok || nameTok.t !== 'id') throw err('nome de variável esperado');
      const name = nameTok.v; p++;
      first = false;
      const star = first ? info.hasStar : false;
      const kind = kindOf(base, info.hasStar);
      // ctor Type name(args)
      if(isOp('(') && (typeIsClass)){
        p++; const a = slice([')']); expectOp(')');
        types.set(name, 'other');
        parts.push(`let ${name} = new ${base}(${conv(a)})`);
      } else {
        const dims = [];
        while(isOp('[')){ p++; const a = slice([']']); expectOp(']'); dims.push(a); }
        let init = null;
        if(isOp('=')){ p++; const a = slice([',', ';', ')']); init = a; }
        else if(isOp('{') && typeIsClass){ p++; const a = slice(['}']); expectOp('}'); init = [{ t: 'id', v: 'new' }, { t: 'id', v: base }, { t: 'op', v: '(' }, ...a, { t: 'op', v: ')' }]; }
        let js;
        const k2 = dims.length ? 'other' : kind;
        types.set(name, k2);
        if(dims.length){
          if(init && init[0] && init[0].v === '{') js = `let ${name} = ${conv(init)}`;
          else if(init && init.length && init[0].t === 'str') js = `let ${name} = ${conv(init)}`;
          else if(dims[0].length){ const dd = dims.map(conv); js = dd.length === 1 ? `let ${name} = new Array(${dd[0]}).fill(${zeroOf(kind)})` : `let ${name} = Array.from({length:${dd[0]}},()=>new Array(${dd[1]}).fill(${zeroOf(kind)}))`; }
          else js = `let ${name} = []`;
        } else if(init){
          let e = conv(init);
          if(init[0] && init[0].v === '{' && typeIsClass && !libClasses.has(base)) e = '(' + e + ')';
          if(libClasses.has(base) && init.length && init[0].t === 'id' && init[0].v === base && !/^new /.test(e)) e = 'new ' + e;
          if(k2 === 'int' && !(init.length === 1 && init[0].t === 'num' && !init[0].f)) e = `__int(${e})`;
          js = `let ${name} = ${e}`;
        } else if(libClasses.has(base)) js = `let ${name} = new ${base}()`;
        else if(userTypes.has(base) && !T_BASE.has(base)) js = `let ${name} = {}`;
        else if(base === 'String') js = `let ${name} = ""`;
        else js = `let ${name} = ${zeroOf(kind)}`;
        parts.push(js);
      }
      if(isOp(',')){ p++; continue; }
      break;
    }
    if(!inFor){ if(isOp(';')) p++; }
    return parts.join('; ') + (inFor ? '' : ';');
  }
  function skipBlockDecl(){
    // struct/class/union/enum NAME { ... } [declaradores] ;
    let out = '';
    const kw = toks[p].v; p++;
    let nm = null; if(toks[p] && toks[p].t === 'id') { nm = toks[p].v; p++; }
    if(isOp(':')){ while(toks[p] && !isOp('{')) p++; }
    if(!isOp('{')){ while(toks[p] && !isOp(';')) p++; if(isOp(';')) p++; return ''; }
    p++;
    if(kw === 'enum'){
      let n = 0;
      while(toks[p] && !isOp('}')){
        const nameTok = toks[p]; p++;
        if(isOp('=')){ p++; const a = slice([',', '}']); out += `const ${nameTok.v} = ${conv(a)}; `; n = 1; types.set(nameTok.v, 'int'); }
        else { out += `const ${nameTok.v} = ${n++}; `; types.set(nameTok.v, 'int'); }
        if(isOp(',')) p++;
      }
      p++;
    } else {
      let d = 1;
      while(toks[p] && d){ if(toks[p].v === '{') d++; if(toks[p].v === '}') d--; p++; }
    }
    // declaradores
    while(toks[p] && !isOp(';')){ if(toks[p].t === 'id' && nm){ out += `let ${toks[p].v} = {}; `; types.set(toks[p].v, 'other'); } p++; }
    if(isOp(';')) p++;
    return out;
  }
  function block(){
    expectOp('{');
    const out = [];
    while(p < toks.length && !isOp('}')) out.push(stmt());
    expectOp('}');
    return '{' + out.join('\n') + '}';
  }
  function body(){ return isOp('{') ? block() : '{' + stmt() + '}'; }
  function exprStmt(){
    const a = slice([';']);
    if(isOp(';')) p++;
    if(!a.length) return ';';
    // atribuição a variável int: wrap
    if(a.length > 2 && a[0].t === 'id' && a[1].v === '=' && types.get(a[0].v) === 'int' && !(a.length === 3 && a[2].t === 'num' && !a[2].f)) return `${a[0].v} = __int(${conv(a.slice(2))});`;
    if(a.length > 2 && a[0].t === 'id' && a[1].v === '/=' && types.get(a[0].v) === 'int') return `${a[0].v} = __idiv(${a[0].v}, ${conv(a.slice(2))});`;
    if(a[0].v === '*' && a[1] && a[1].t === 'id' && a[2] && a[2].v === '=') return `${a[1].v}.set(${conv(a.slice(3))});`;
    if(opts.cout && a[0] && (a[0].v === 'cout' || (a[0].v === 'std' && a[2] && a[2].v === 'cout'))){
      const parts = []; let cur = []; let st = a[0].v === 'cout' ? 1 : 3;
      for(let i = st; i < a.length; i++){ if(a[i].v === '<<'){ if(cur.length) parts.push(cur); cur = []; } else cur.push(a[i]); }
      if(cur.length) parts.push(cur);
      return `__cout(${parts.map(conv).join(', ')});`;
    }
    return conv(a) + ';';
  }
  function stmt(){
    const t = peek();
    if(!t) return '';
    if(t.t === 'def'){
      p++;
      if(t.params){
        const ps = t.params.slice(1, -1);
        return `const ${t.name} = (${ps}) => (${conv(ctok(t.body))});`;
      }
      const e = t.body.trim() ? conv(ctok(t.body)) : '1';
      types.set(t.name, /^-?\d+$/.test(e.trim()) ? 'int' : /^-?[\d.]+$/.test(e.trim()) ? 'float' : 'other');
      return `const ${t.name} = ${e};`;
    }
    if(t.t === 'op'){
      if(t.v === '{') return block();
      if(t.v === ';'){ p++; return ';'; }
    }
    if(t.t === 'id'){
      switch(t.v){
        case 'if': { p++; expectOp('('); const c = slice([')']); expectOp(')'); let s = `if (${conv(c)}) ${body()}`; if(peek() && peek().v === 'else' && peek().t === 'id'){ p++; s += ' else ' + (peek().v === 'if' ? stmt() : body()); } return s; }
        case 'while': { p++; expectOp('('); const c = slice([')']); expectOp(')'); return `while (${conv(c)}) ${body()}`; }
        case 'do': { p++; const b = body(); if(!(peek() && peek().v === 'while')) throw err('do sem while'); p++; expectOp('('); const c = slice([')']); expectOp(')'); if(isOp(';')) p++; return `do ${b} while (${conv(c)});`; }
        case 'for': {
          p++; expectOp('(');
          let init = '';
          if(!isOp(';')){ const info = matchDecl(p); if(info){ init = declStmt(info, true); } else { const a = slice([';']); init = conv(a); } }
          expectOp(';');
          const cond = conv(slice([';'])); expectOp(';');
          const post = conv(slice([')'])); expectOp(')');
          // ranged-for C++: for (auto x : arr)
          return `for (${init}; ${cond}; ${post}) ${body()}`;
        }
        case 'switch': { p++; expectOp('('); const c = slice([')']); expectOp(')'); return `switch (${conv(c)}) ${block()}`; }
        case 'case': { p++; const a = slice([':']); expectOp(':'); return `case ${conv(a)}:`; }
        case 'default': { if(toks[p + 1] && toks[p + 1].v === ':'){ p += 2; return 'default:'; } break; }
        case 'return': { p++; const a = slice([';']); if(isOp(';')) p++; return a.length ? `return ${conv(a)};` : 'return;'; }
        case 'break': case 'continue': { p++; if(isOp(';')) p++; return t.v + ';'; }
        case 'goto': throw err('goto não é suportado');
        case 'typedef': { p++; if(toks[p] && /^(struct|union|enum)$/.test(toks[p].v)){ const r = skipBlockDecl(); return r; } while(toks[p] && !isOp(';')) p++; p++; return ''; }
        case 'struct': case 'class': case 'union': case 'enum': {
          if(toks[p + 1] && toks[p + 1].t === 'id' && (toks[p + 2] && (toks[p + 2].v === '{' || toks[p + 2].v === ':' || toks[p + 2].v === ';'))) return skipBlockDecl();
          if(t.v === 'enum' && toks[p + 1] && toks[p + 1].v === '{') return skipBlockDecl();
          break;
        }
        case 'using': case 'namespace': { while(toks[p] && !isOp(';')) p++; p++; return ''; }
        case 'template': throw err('templates C++ não são suportados');
        case 'try': case 'catch': case 'throw': throw err('exceções C++ não são suportadas');
      }
    }
    const info = matchDecl(p);
    if(info){
      const nameTok = info.nameTok;
      const after = toks[info.end + 1];
      if(after && after.v === '(' && !(libClasses.has(info.base) || userTypes.has(info.base) || info.base === 'String')){
        // função: tipo NOME ( params ) { ... }   ou protótipo
        p = info.end + 2;
        const sv = new Map(types);
        const names = parseParams();
        while(toks[p] && toks[p].t === 'id' && /^(const|override|noexcept)$/.test(toks[p].v)) p++;
        if(isOp('{')){
          const b = block();
          for(const [k, v] of types) if(!sv.has(k) || sv.get(k) !== v) { /* locais permanecem: aceitável */ }
          return `async function ${nameTok.v}(${names.join(', ')}) ${b}`;
        }
        // protótipo
        while(toks[p] && !isOp(';')) p++; p++; return '';
      }
      if(after && after.v === '(' && (libClasses.has(info.base) || userTypes.has(info.base) || info.base === 'String')){
        // objeto com construtor OU função retornando objeto/String
        let q = info.end + 1, d = 0; while(toks[q]){ if(toks[q].v === '(') d++; if(toks[q].v === ')'){ d--; if(!d) break; } q++; }
        let r = q + 1; while(toks[r] && toks[r].t === 'id' && /^(const|override|noexcept)$/.test(toks[r].v)) r++;
        if(toks[r] && toks[r].v === '{'){ p = info.end + 2; const names = parseParams(); while(toks[p] && toks[p].t === 'id' && /^(const|override|noexcept)$/.test(toks[p].v)) p++; const b = block(); return `async function ${nameTok.v}(${names.join(', ')}) ${b}`; }
      }
      return declStmt(info, false);
    }
    return exprStmt();
  }

  const outStmts = [];
  while(p < toks.length) outStmts.push(stmt());
  return { code: outStmts.join('\n'), userFns, hasSetup: userFns.has('setup'), hasLoop: userFns.has('loop'), hasMain: userFns.has('main') };
}

async function runCFamily(src, lang){
  const api = cApi(src);
  const isCpp = lang === 'cpp';
  const r = cTranspile(src, { api, cout: isCpp });
  const names = Object.keys(api).filter(n => !/^(true|false|NULL|nullptr|true_|abs_|String_|cout)$/.test(n) || n === 'cout');
  const code = r.code + '\n;return { setup: typeof setup === "function" ? setup : null, loop: typeof loop === "function" ? loop : null, main: typeof main === "function" ? main : null };';
  let fn;
  try { fn = new AF(...names.filter(n => /^[A-Za-z_$][\w$]*$/.test(n)), code); }
  catch(e){ const err = new Error('erro de compilação (' + (lang === 'cpp' ? 'C++' : 'C') + '): ' + e.message); console.warn(code); throw err; }
  String.prototype.toInt = function(){ return parseInt(this) || 0; };
  String.prototype.toFloat = function(){ return parseFloat(this) || 0; };
  String.prototype.equals = function(o){ return String(this) === String(o); };
  String.prototype.toUpperCase_ = String.prototype.toUpperCase;
  const entry = await fn(...names.filter(n => /^[A-Za-z_$][\w$]*$/.test(n)).map(n => api[n]));
  if(entry.main && !entry.setup){ serialOut('— main() —', 'dim'); await entry.main(); return; }
  if(entry.setup) await entry.setup();
  if(!entry.loop){ if(!entry.setup) throw new Error('void loop() não encontrada (nem main())'); return; }
  let g = 0;
  while(RUN.on){ await entry.loop(); if(++g % 1 === 0) await new Promise(r => setTimeout(r, 0)); if(g > 5e6) break; }
}
RUNNERS.cpp = src => runCFamily(src, 'cpp');
RUNNERS.c = src => runCFamily(src, 'c');
window.KezleLang = { cTranspile, ctok, cApi, AF };
})();
