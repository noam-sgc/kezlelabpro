/* Kezle Lab Pro — realce de sintaxe (Syntax Highlighting) para as 9 linguagens.
   Técnica: um <pre> colorido fica por baixo do <textarea> (texto transparente, cursor visível),
   com a mesma fonte/medidas, e rola junto. Funciona também para mudanças feitas por código. */
(function(){
'use strict';

const W = s => s.trim().split(/\s+/);
const set = s => new Set(W(s));

/* ---------- definições por linguagem ---------- */
const PY = {
  kw: set('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'),
  const: set('True False None'),
  builtin: set('print len range int float str bool list dict tuple set bytes bytearray abs min max sum round sorted reversed enumerate zip map filter isinstance hasattr getattr setattr open input type id hex bin oct chr ord pow divmod any all iter next repr format super object const micropython'),
  cls: set('Pin PWM ADC DAC I2C SoftI2C SPI SoftSPI UART Timer RTC WDT Signal NeoPixel DHT11 DHT22 SSD1306_I2C SSD1306_SPI ST7789 ILI9341 ST7735 TouchScreen BMP280 BME280 MPU6050 Servo Exception ValueError TypeError OSError KeyboardInterrupt'),
  self: set('self cls'),
  line: '#',
};
const CPP = {
  kw: set('alignas alignof and asm auto break case catch class const constexpr const_cast continue decltype default delete do dynamic_cast else enum explicit export extern for friend goto if inline mutable namespace new noexcept not operator or override private protected public register reinterpret_cast return sizeof static static_assert static_cast struct switch template this throw try typedef typeid typename union using virtual volatile while'),
  type: set('void bool char short int long float double signed unsigned size_t uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t byte word boolean String string wchar_t'),
  const: set('true false NULL nullptr HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN PI TRUE FALSE'),
  builtin: set('pinMode digitalWrite digitalRead analogRead analogWrite delay delayMicroseconds millis micros Serial begin println print printf attachInterrupt tone noTone map constrain random randomSeed abs min max sqrt pow setup loop main Wire SPI printf scanf malloc free'),
  cls: set('Serial Wire SPI Servo Adafruit_SSD1306 Adafruit_BMP280 DHT LiquidCrystal_I2C WiFi TFT_eSPI Adafruit_NeoPixel'),
  line: '//', block: ['/*', '*/'], pp: true,
};
const JS = {
  kw: set('async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield get set'),
  const: set('true false null undefined NaN Infinity'),
  builtin: set('console print require setTimeout setInterval clearInterval clearTimeout Math JSON Object Array String Number Promise parseInt parseFloat isNaN pinMode digitalWrite digitalRead analogRead analogWrite delay millis E'),
  cls: set('Pin Promise Array Object Map Set Date Error Number String Boolean Symbol I2C SPI Serial LED BTN'),
  line: '//', block: ['/*', '*/'], tpl: true,
};
const LUA = {
  kw: set('and break do else elseif end for function goto if in local not or repeat return then until while'),
  const: set('true false nil'),
  builtin: set('print pairs ipairs tostring tonumber type require assert error pcall select next setmetatable getmetatable string table math os io gpio tmr uart i2c adc pwm node wifi'),
  cls: set('gpio tmr uart i2c adc pwm node wifi spi ow'),
  line: '--', luaBlock: true,
};
const BAS = {
  kw: set('IF THEN ELSE ELSEIF ENDIF END FOR TO STEP NEXT WHILE WEND DO LOOP UNTIL GOTO GOSUB RETURN SUB FUNCTION DIM AS LET AND OR NOT MOD CALL SELECT CASE EXIT DATA READ RESTORE INPUT'),
  const: set('TRUE FALSE HIGH LOW'),
  builtin: set('PRINT PINMODE DIGITALWRITE DIGITALREAD ANALOGREAD ANALOGWRITE DELAY MILLIS RND INT ABS LEN LEFT$ RIGHT$ MID$ STR$ VAL CHR$ ASC SIN COS SQR TIMER SLEEP SERVOWRITE TONE'),
  cls: set(''),
  line: "'", rem: true, ci: true,
};
const GO = {
  kw: set('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var'),
  type: set('bool byte rune string int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 complex64 complex128 error any'),
  const: set('true false nil iota'),
  builtin: set('append cap close copy delete len make new panic print println recover machine time fmt main init'),
  cls: set('machine time fmt'),
  line: '//', block: ['/*', '*/'], tpl: true,
};
const RS = {
  kw: set('as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while'),
  type: set('bool char str i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 String Vec Option Result Box'),
  const: set('true false None Some Ok Err'),
  builtin: set('main'),
  cls: set('Output Input Level Pin Delay Duration'),
  line: '//', block: ['/*', '*/'], rust: true,
};
const LANG = { py: PY, cpy: PY, cpp: CPP, c: CPP, js: JS, lua: LUA, bas: BAS, go: GO, rs: RS };

/* ---------- tokenizador ---------- */
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const span = (c, s) => '<span class="hl-' + c + '">' + esc(s) + '</span>';
const reCache = {};

function build(id, L){
  if(reCache[id]) return reCache[id];
  const parts = [], kinds = [];
  const add = (kind, src) => { parts.push('(?<t' + kinds.length + '>' + src + ')'); kinds.push(kind); };
  if(L.luaBlock) add('com', '--\\[(?<e1>=*)\\[[\\s\\S]*?(?:\\]\\k<e1>\\]|$)');
  if(L.rem) add('com', '(?:\\bREM\\b[^\\n]*)');
  if(L.block) add('com', L.block[0].replace(/[*/]/g, '\\$&') + '[\\s\\S]*?(?:' + L.block[1].replace(/[*/]/g, '\\$&') + '|$)');
  if(L.line) add('com', L.line.replace(/[-/#'*]/g, '\\$&') + '[^\\n]*');
  if(L.pp) add('pp', '^[ \\t]*#[ \\t]*\\w+(?:[^\\n]*)');
  if(id === 'py' || id === 'cpy'){
    add('str', '[rRbBfFuU]{0,2}(?:"""[\\s\\S]*?(?:"""|$)|\'\'\'[\\s\\S]*?(?:\'\'\'|$))');
    add('str', '[rRbBfFuU]{0,2}"(?:\\\\.|[^"\\\\\\n])*"?');
    add('str', "[rRbBfFuU]{0,2}'(?:\\\\.|[^'\\\\\\n])*'?");
    add('dec', '@[A-Za-z_][\\w.]*');
  } else if(L.luaBlock){
    add('str', '\\[(?<e2>=*)\\[[\\s\\S]*?(?:\\]\\k<e2>\\]|$)');
    add('str', '"(?:\\\\.|[^"\\\\\\n])*"?');
    add('str', "'(?:\\\\.|[^'\\\\\\n])*'?");
  } else if(L.rust){
    add('str', 'b?"(?:\\\\.|[^"\\\\])*"?');
    add('str', "b?'(?:\\\\(?:x[0-9a-fA-F]{2}|u\\{[0-9a-fA-F]+\\}|.)|[^'\\\\\\n])'");
    add('lt', "'[A-Za-z_]\\w*");
  } else if(L.tpl){
    add('str', '`(?:\\\\[\\s\\S]|[^`\\\\])*`?');
    add('str', '"(?:\\\\.|[^"\\\\\\n])*"?');
    add('str', "'(?:\\\\.|[^'\\\\\\n])*'?");
  } else {
    add('str', '"(?:\\\\.|[^"\\\\\\n])*"?');
    add('str', "'(?:\\\\.|[^'\\\\\\n])*'?");
  }
  add('num', '\\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\\d[\\d_]*\\.?\\d*(?:[eE][+-]?\\d+)?|\\.\\d+(?:[eE][+-]?\\d+)?)(?:[uUlLfF]{0,3}|[iu](?:8|16|32|64|size))\\b');
  if(L.rust) add('mac', '\\b[A-Za-z_]\\w*!(?=[\\s(\\[{])');
  add('id', '[A-Za-z_$][\\w$]*');
  const re = new RegExp(parts.join('|'), (L.ci ? 'i' : '') + 'gm');
  return (reCache[id] = { re, kinds });
}

function html(code, lang){
  const L = LANG[lang];
  if(!L) return esc(code);
  const { re, kinds } = build(lang, L);
  re.lastIndex = 0;
  let out = '', last = 0, m, prevWord = '';
  while((m = re.exec(code))){
    if(m[0] === ''){ re.lastIndex++; continue; }
    if(m.index > last) out += esc(code.slice(last, m.index));
    const text = m[0];
    let kind = 'id';
    for(let k = 0; k < kinds.length; k++) if(m.groups['t' + k] !== undefined){ kind = kinds[k]; break; }
    if(kind === 'id'){
      const key = L.ci ? text.toUpperCase() : text;
      const after = code.charAt(re.lastIndex);
      let c = null;
      if(L.kw.has(key)) c = 'kw';
      else if(L.const && L.const.has(key)) c = 'const';
      else if(L.type && L.type.has(key)) c = 'type';
      else if(L.self && L.self.has(key)) c = 'self';
      else if(L.cls && L.cls.has(key)) c = 'cls';
      else if(L.builtin && L.builtin.has(key)) c = 'bi';
      else if(/^(def|class|fn|func|function|sub)$/i.test(prevWord)) c = 'fn';
      else if(after === '(') c = 'call';
      else if(/^[A-Z][A-Z0-9_]{2,}$/.test(text)) c = 'const';
      else if(/^[A-Z]/.test(text) && (lang === 'py' || lang === 'cpy' || lang === 'cpp' || lang === 'c' || lang === 'rs' || lang === 'go')) c = 'cls';
      out += c ? span(c, text) : esc(text);
      prevWord = text;
    } else {
      out += span(kind, text);
      if(kind !== 'com') prevWord = '';
    }
    last = re.lastIndex;
  }
  out += esc(code.slice(last));
  return out;
}

/* ---------- integração com o editor ---------- */
function currentLang(){ const s = document.getElementById('pyLang'); return s ? s.value : 'py'; }

function install(){
  const ed = document.getElementById('pyEditor');
  const wrap = document.getElementById('edWrap');
  if(!ed || !wrap || document.getElementById('hlLayer')) return;
  const stack = document.createElement('div');
  stack.id = 'edStack';
  const pre = document.createElement('pre');
  pre.id = 'hlLayer'; pre.setAttribute('aria-hidden', 'true');
  pre.innerHTML = '<code></code>';
  wrap.insertBefore(stack, ed);
  stack.appendChild(pre);
  stack.appendChild(ed);
  ed.classList.add('hlOn');
  const code = pre.firstChild;
  let raf = 0;
  const paint = () => {
    raf = 0;
    const v = ed.value;
    code.innerHTML = html(v, currentLang()) + (v.endsWith('\n') ? ' ' : '\n');
    pre.scrollTop = ed.scrollTop; pre.scrollLeft = ed.scrollLeft;
  };
  const sched = () => { if(!raf) raf = requestAnimationFrame(paint); };
  const sync = () => { pre.scrollTop = ed.scrollTop; pre.scrollLeft = ed.scrollLeft; };
  ed.addEventListener('input', paint);
  ed.addEventListener('scroll', sync);
  // mudanças programáticas em .value (abrir projeto, modelos, exemplos…)
  const d = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  Object.defineProperty(ed, 'value', { configurable: true, get(){ return d.get.call(this); }, set(v){ d.set.call(this, v); sched(); } });
  const lang = document.getElementById('pyLang');
  if(lang) lang.addEventListener('change', sched);
  new MutationObserver(sched).observe(lang || document.body, { attributes: true, attributeFilter: ['value'] });
  window.addEventListener('resize', sync);
  paint();
  window.KezleHL.repaint = paint;
}

/* realce de um bloco de código estático (ex.: prévia do editor de blocos) */
function apply(el, text, lang){ el.innerHTML = html(text, lang); el.classList.add('hlStatic'); }

window.KezleHL = { html, apply, langs: Object.keys(LANG), repaint(){} };
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
