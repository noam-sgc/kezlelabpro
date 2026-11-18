/* =========================================================================
   Kezle Lab Pro — Telas realistas com touch de verdade
   - Tamanho físico proporcional (3,6 px/mm) e resolução nativa real
   - Framebuffer por tela; OLED, TFT, e-Paper, redondas, touch capacitivo
     (multitoque) e resistivo (XPT2046: x/y/z brutos)
   - Toque do mouse/dedo -> código em execução (Python, C++, JS, Lua...)
   - Firmware "idle" interativo quando nenhum código usa a tela
   - Lupa: tela ampliada com toque idêntico
   ========================================================================= */
(function(){
'use strict';
const MM = 3.6;
const px = mm => Math.round(mm * MM / 2) * 2;

/* ---------- catálogo: telas e módulos com tela ---------- */
const SPI = ['VCC', 'GND', 'CS', 'RST', 'DC', 'SDA', 'SCL', 'BLK'];
const SPI_T = SPI.concat(['T_CLK', 'T_CS', 'T_DIN', 'T_DO', 'T_IRQ']);
const I2C = ['GND', 'VCC', 'SCL', 'SDA'];
const I2C_CT = ['VCC', 'GND', 'SCL', 'SDA', 'RST', 'INT'];
const EPD = ['VCC', 'GND', 'DIN', 'CLK', 'CS', 'DC', 'RST', 'BUSY'];

function scrDef(o){
  const d = {
    id: o.id, n: o.n, cat: 'display', brand: o.brand || 'Genérico', vcc: o.vcc || 3.3, lib: o.lib || 'ssd1306', kind: 'screen',
    desc: o.desc, w: px(o.pcb[0]), h: px(o.pcb[1]), pinNames: o.pins, pins: o.pins.length, iq: o.iq,
    scr: { x: px(o.act[0]), y: px(o.act[1]), w: px(o.act[2]), h: px(o.act[3]), W: o.res[0], H: o.res[1], type: o.type || 'tft', touch: o.touch || null, round: !!o.round, ctrl: o.ctrl || 'generic', fg: o.fg || '#e8f6ff', bg: o.bg || '#000', pcb: o.pcbColor || '#14233f', tri: o.tri || null }
  };
  if(o.i2c) d.i2c = o.i2c;
  return d;
}
const SCREENS = [
  // OLEDs
  scrDef({ id: 'oled1306', n: 'OLED SSD1306 0.96" 128×64', brand: 'Solomon', pcb: [27.3, 27.8], act: [2.8, 6.5, 21.7, 10.9], res: [128, 64], type: 'oled', ctrl: 'ssd1306', pins: I2C, i2c: 0x3C, desc: '128×64 I2C monocromático', fg: '#9ad7ff', pcbColor: '#0e2a52', iq: 0.012 }),
  scrDef({ id: 'oled_yellow', n: 'OLED SSD1306 0.96" Amarelo/Azul', brand: 'Solomon', pcb: [27.3, 27.8], act: [2.8, 6.5, 21.7, 10.9], res: [128, 64], type: 'oled', ctrl: 'ssd1306', pins: I2C, i2c: 0x3C, desc: 'Faixa amarela + azul', fg: '#ffd84a', pcbColor: '#0e2a52', iq: 0.012 }),
  scrDef({ id: 'oled1106', n: 'OLED SH1106 1.3" 128×64', brand: 'Sino', pcb: [35.4, 33.5], act: [3, 8, 29, 14.5], res: [128, 64], type: 'oled', ctrl: 'sh1106', pins: I2C, i2c: 0x3C, desc: '128×64 I2C', fg: '#e8f6ff', pcbColor: '#1a2f57', iq: 0.015 }),
  scrDef({ id: 'oled_128x32', n: 'OLED SSD1306 0.91" 128×32', brand: 'Solomon', pcb: [38, 12], act: [7, 1, 22.4, 5.6], res: [128, 32], type: 'oled', ctrl: 'ssd1306', pins: I2C, i2c: 0x3C, desc: '128×32 I2C', fg: '#e8f6ff', pcbColor: '#0e2a52', iq: 0.01 }),
  scrDef({ id: 'oled_spi', n: 'OLED SSD1306 0.96" SPI 7 pinos', brand: 'Solomon', pcb: [27.3, 27.8], act: [2.8, 6.5, 21.7, 10.9], res: [128, 64], type: 'oled', ctrl: 'ssd1306', pins: ['GND', 'VCC', 'D0', 'D1', 'RES', 'DC', 'CS'], desc: '128×64 SPI', fg: '#e8f6ff', pcbColor: '#0e2a52', iq: 0.012 }),
  scrDef({ id: 'ssd1331', n: 'OLED colorido SSD1331 0.95" 96×64', brand: 'Solomon', pcb: [29, 26], act: [3.5, 4, 19.2, 12.8], res: [96, 64], type: 'tft', ctrl: 'ssd1331', pins: ['GND', 'VCC', 'SCL', 'SDA', 'RES', 'DC', 'CS'], desc: 'RGB 65k cores SPI', pcbColor: '#111827', iq: 0.02 }),
  scrDef({ id: 'ssd1351', n: 'OLED colorido SSD1351 1.5" 128×128', brand: 'Solomon', pcb: [39, 40], act: [4.5, 6, 26.9, 26.9], res: [128, 128], type: 'tft', ctrl: 'ssd1351', pins: ['GND', 'VCC', 'SCL', 'SDA', 'DC', 'CS', 'RST'], desc: 'RGB OLED SPI', pcbColor: '#111827', iq: 0.03 }),
  scrDef({ id: 'ssd1322', n: 'OLED SSD1322 3.12" 256×64', brand: 'Solomon', pcb: [88, 36], act: [8, 5, 76.8, 19.2], res: [256, 64], type: 'oled', ctrl: 'ssd1322', pins: ['GND', 'VCC', 'SCL', 'SDA', 'RES', 'DC', 'CS'], desc: '4 níveis de cinza', fg: '#c8ff6a', pcbColor: '#111827', iq: 0.05 }),
  scrDef({ id: 'pcd8544', n: 'Nokia 5110 LCD 84×48', brand: 'Philips', pcb: [43, 43], act: [6, 5, 30, 22], res: [84, 48], type: 'mono', ctrl: 'pcd8544', pins: ['RST', 'CE', 'DC', 'DIN', 'CLK', 'VCC', 'BL', 'GND'], desc: 'LCD monocromático SPI', fg: '#1b2a1a', bg: '#a9c27a', pcbColor: '#7a1d1d', iq: 0.008 }),
  scrDef({ id: 'lcd12864', n: 'LCD gráfico ST7920 128×64', brand: 'Sitronix', vcc: 5, pcb: [93, 70], act: [8, 9, 70, 40], res: [128, 64], type: 'mono', ctrl: 'st7920', pins: ['GND', 'VCC', 'V0', 'RS', 'RW', 'E', 'PSB', 'RST', 'BLA', 'BLK'], desc: 'LCD gráfico azul', fg: '#dff3ff', bg: '#1f5fa8', pcbColor: '#0e3a5c', iq: 0.04 }),
  // TFT/IPS SPI
  scrDef({ id: 'tft7789', n: 'TFT ST7789 1.3" 240×240', brand: 'Sitronix', pcb: [36, 33], act: [6, 3, 23.4, 23.4], res: [240, 240], ctrl: 'st7789', pins: SPI.slice(0, 7), desc: 'IPS 240×240 SPI', pcbColor: '#161b22', iq: 0.03 }),
  scrDef({ id: 'tft_st7789_135', n: 'TFT ST7789 1.14" 135×240', brand: 'Sitronix', pcb: [23.5, 31], act: [2.5, 3, 14.9, 25.6], res: [135, 240], ctrl: 'st7789', pins: SPI.slice(0, 7), desc: 'IPS 135×240', pcbColor: '#161b22', iq: 0.025 }),
  scrDef({ id: 'tft_st7789_2', n: 'TFT ST7789 2.0" 240×320', brand: 'Sitronix', pcb: [40, 53], act: [4, 5, 30.6, 40.8], res: [240, 320], ctrl: 'st7789', pins: SPI.slice(0, 7), desc: 'IPS 240×320 SPI', pcbColor: '#161b22', iq: 0.04 }),
  scrDef({ id: 'tft160', n: 'TFT ST7789 1.69" 240×280', brand: 'Sitronix', pcb: [32, 42], act: [3, 4, 27, 31.5], res: [240, 280], ctrl: 'st7789', pins: SPI.slice(0, 7), desc: 'IPS 240×280 cantos redondos', pcbColor: '#161b22', iq: 0.035 }),
  scrDef({ id: 'tft_st7735', n: 'TFT ST7735 1.8" 128×160', brand: 'Sitronix', pcb: [34.5, 56], act: [3, 8, 28, 35], res: [128, 160], ctrl: 'st7735', pins: SPI, desc: 'TFT 128×160 SPI', pcbColor: '#7a1d1d', iq: 0.03 }),
  scrDef({ id: 'tft_st7735_096', n: 'TFT ST7735 0.96" 80×160', brand: 'Sitronix', pcb: [26, 42], act: [3, 6, 10.8, 21.7], res: [80, 160], ctrl: 'st7735', pins: SPI.slice(0, 7), desc: 'IPS 80×160', pcbColor: '#161b22', iq: 0.02 }),
  scrDef({ id: 'gc9a01', n: 'TFT redondo GC9A01 1.28" 240×240', brand: 'Galaxycore', pcb: [38, 38], act: [3, 3, 32, 32], res: [240, 240], ctrl: 'gc9a01', round: true, pins: SPI.slice(0, 7), desc: 'IPS redondo SPI', pcbColor: '#161b22', iq: 0.03 }),
  scrDef({ id: 'tft9341', n: 'TFT ILI9341 2.8" 240×320 + Touch', brand: 'Ilitek', pcb: [50, 86], act: [3.5, 7, 43.2, 57.6], res: [240, 320], ctrl: 'ili9341', touch: 'res', pins: SPI_T, desc: 'SPI + touch resistivo XPT2046', pcbColor: '#7a1d1d', iq: 0.08 }),
  scrDef({ id: 'tft9341_24', n: 'TFT ILI9341 2.4" 240×320 + Touch', brand: 'Ilitek', pcb: [42, 60], act: [3, 6, 36.7, 48.9], res: [240, 320], ctrl: 'ili9341', touch: 'res', pins: SPI_T, desc: 'SPI + touch resistivo', pcbColor: '#7a1d1d', iq: 0.07 }),
  scrDef({ id: 'tft_ili9341_noTouch', n: 'TFT ILI9341 2.2" 240×320', brand: 'Ilitek', pcb: [40, 56], act: [3, 6, 33.4, 44.5], res: [240, 320], ctrl: 'ili9341', pins: SPI, desc: 'SPI sem touch', pcbColor: '#7a1d1d', iq: 0.06 }),
  scrDef({ id: 'tft9488', n: 'TFT ILI9488 3.5" 320×480 + Touch', brand: 'Ilitek', pcb: [56, 98], act: [4, 9, 48.9, 73.4], res: [320, 480], ctrl: 'ili9488', touch: 'res', pins: SPI_T, desc: 'SPI + touch resistivo', pcbColor: '#7a1d1d', iq: 0.1 }),
  scrDef({ id: 'tft_st7796', n: 'TFT ST7796S 4.0" 320×480 + Touch cap.', brand: 'Sitronix', pcb: [63, 104], act: [4, 8, 55.2, 82.8], res: [320, 480], ctrl: 'st7796', touch: 'cap', pins: SPI.concat(['SDA_T', 'SCL_T', 'RST_T', 'INT_T']), desc: 'SPI + touch capacitivo FT6336', pcbColor: '#161b22', iq: 0.1 }),
  scrDef({ id: 'ft6206_28', n: 'TFT 2.8" Capacitivo Adafruit (FT6206)', brand: 'Adafruit', pcb: [52, 85], act: [3, 8, 43.2, 57.6], res: [240, 320], ctrl: 'ili9341', touch: 'cap', pins: SPI.concat(['SDA_T', 'SCL_T']), desc: 'ILI9341 + FT6206 multitoque', pcbColor: '#7a1d1d', iq: 0.08 }),
  scrDef({ id: 'gc9a01_touch', n: 'TFT redondo 1.28" Touch CST816S', brand: 'Waveshare', pcb: [40, 40], act: [4, 4, 32, 32], res: [240, 240], ctrl: 'gc9a01', touch: 'cap', round: true, pins: SPI.slice(0, 7).concat(['TSDA', 'TSCL', 'TINT', 'TRST']), desc: 'Redondo capacitivo c/ gestos', pcbColor: '#161b22', iq: 0.04 }),
  scrDef({ id: 'nextion35', n: 'Nextion NX4832T035 3.5" Touch', brand: 'Nextion', vcc: 5, pcb: [93, 58], act: [4, 4.5, 73.4, 49], res: [480, 320], ctrl: 'nextion', touch: 'res', pins: ['5V', 'TX', 'RX', 'GND'], desc: 'HMI serial 480×320 resistivo', pcbColor: '#111827', iq: 0.15, lib: 'machine' }),
  scrDef({ id: 'nextion5', n: 'Nextion NX8048T050 5.0" Touch', brand: 'Nextion', vcc: 5, pcb: [126, 76], act: [5, 5, 108.7, 65.5], res: [800, 480], ctrl: 'nextion', touch: 'cap', pins: ['5V', 'TX', 'RX', 'GND'], desc: 'HMI serial 800×480 capacitivo', pcbColor: '#111827', iq: 0.25, lib: 'machine' }),
  // e-Paper
  scrDef({ id: 'epd154', n: 'e-Paper 1.54" 200×200', brand: 'Waveshare', pcb: [37, 40], act: [3.5, 4, 27.6, 27.6], res: [200, 200], type: 'epd', ctrl: 'epd', pins: EPD, desc: 'P&B SPI', pcbColor: '#1f2937', iq: 0.002 }),
  scrDef({ id: 'eink213', n: 'e-Paper 2.13" 250×122', brand: 'Waveshare', pcb: [59.2, 29.2], act: [4.5, 2.6, 48.5, 23.8], res: [250, 122], type: 'epd', ctrl: 'epd', pins: EPD, desc: 'P&B SPI', pcbColor: '#1f2937', iq: 0.002 }),
  scrDef({ id: 'epaper', n: 'e-Paper 2.9" 296×128', brand: 'Waveshare', pcb: [89.5, 38], act: [7, 3, 66.9, 29.1], res: [296, 128], type: 'epd', ctrl: 'epd', pins: EPD, desc: 'P&B SPI', pcbColor: '#1f2937', iq: 0.002 }),
  scrDef({ id: 'epd29_bwr', n: 'e-Paper 2.9" Tricolor (P/B/V)', brand: 'Waveshare', pcb: [89.5, 38], act: [7, 3, 66.9, 29.1], res: [296, 128], type: 'epd', ctrl: 'epd', tri: '#d1202b', pins: EPD, desc: 'Preto/branco/vermelho', pcbColor: '#1f2937', iq: 0.002 }),
  scrDef({ id: 'epd42', n: 'e-Paper 4.2" 400×300', brand: 'Waveshare', pcb: [91, 77], act: [6, 5, 84.8, 63.6], res: [400, 300], type: 'epd', ctrl: 'epd', pins: EPD, desc: 'P&B SPI', pcbColor: '#1f2937', iq: 0.003 }),
  scrDef({ id: 'epd75', n: 'e-Paper 7.5" 800×480', brand: 'Waveshare', pcb: [170, 111], act: [5, 5, 163.2, 97.9], res: [800, 480], type: 'epd', ctrl: 'epd', pins: EPD, desc: 'P&B SPI', pcbColor: '#1f2937', iq: 0.004 })
];
// atualiza peças existentes / adiciona novas (mantendo a mesma posição na lista)
for(const d of SCREENS){
  const i = PARTS.findIndex(p => p.id === d.id);
  if(i >= 0){ delete PARTMAP[d.id]; PARTS[i] = d; } else PARTS.push(d);
  PARTMAP[d.id] = d;
}
// módulos de microcontrolador COM tela (a tela é parte do MCU)
function mcuScr(o){
  const base = PARTMAP[o.base] || {};
  const d = Object.assign({}, base, {
    id: o.id, n: o.n, cat: 'mcu', brand: o.brand, vcc: o.vcc || 5, lib: 'wifi', chip: o.chip, ant: 1, core: o.core, w: px(o.pcb[0]), h: px(o.pcb[1]),
    pinNames: o.pins, pins: o.pins.length, pinLayout: o.layout || null, desc: o.desc,
    scr: { x: px(o.act[0]), y: px(o.act[1]), w: px(o.act[2]), h: px(o.act[3]), W: o.res[0], H: o.res[1], type: 'tft', touch: o.touch || null, round: !!o.round, ctrl: o.ctrl || 'mcu', fg: '#fff', bg: '#000', pcb: o.pcbColor || '#111', btns: o.btns || null, imu: o.imu }
  });
  if(o.img === false) d.img = false;
  const i = PARTS.findIndex(p => p.id === d.id);
  if(i >= 0){ delete PARTMAP[d.id]; PARTS[i] = d; } else PARTS.push(d);
  PARTMAP[d.id] = d;
}
const ESP_PINS = n => Array.from({ length: n }, (_, i) => 'IO' + i);
mcuScr({ id: 'cyd', n: 'ESP32 CYD 3.5" Touch (320×480)', brand: 'Sunton', base: 'esp32', chip: 'ESP32-WROOM-32', core: 'Tela IPS 3.5" + touch capacitivo GT911', pcb: [55, 98], act: [3.5, 6, 48, 73], res: [320, 480], touch: 'cap', ctrl: 'cyd', layout: 'bottom', pins: ['GND', '5V', '3V3', 'IO21', 'IO22', 'IO27', 'IO35', 'IO17', 'IO16', 'IO4', 'IO2', 'IO12', 'IO13', 'IO14', 'IO15', 'EN'], desc: 'ESP32 com display e touch integrados', pcbColor: '#0b3a2e' });
mcuScr({ id: 'cyd28', n: 'ESP32 CYD 2.8" Touch (240×320)', brand: 'Sunton', base: 'esp32', chip: 'ESP32-WROOM-32', core: 'ILI9341 + touch resistivo XPT2046', pcb: [50, 86], act: [3.5, 7, 43.2, 57.6], res: [240, 320], touch: 'res', ctrl: 'cyd', layout: 'bottom', pins: ['GND', '5V', '3V3', 'IO21', 'IO22', 'IO27', 'IO35', 'IO17', 'IO16', 'IO4', 'IO2', 'IO12', 'IO13', 'IO14', 'IO15', 'EN'], desc: 'O "CYD" clássico', pcbColor: '#0b3a2e' });
mcuScr({ id: 'm5stack_core', n: 'M5Stack Core (320×240)', brand: 'M5Stack', base: 'esp32', chip: 'ESP32', core: 'Tela 2.0" + 3 botões físicos', pcb: [54, 54], act: [6.5, 6, 40.8, 30.6], res: [320, 240], ctrl: 'm5', btns: ['A', 'B', 'C'], pins: ['3V3', 'GND', 'IO0', 'IO1', 'IO2', 'IO3', 'IO5', 'IO12', 'IO13', 'IO14', 'IO15', 'IO16', 'IO17', 'IO18', 'IO19', 'IO21', 'IO22', 'IO23', 'IO25', 'IO26', 'IO27', 'IO34', 'IO35', '5V'], desc: 'Core Basic', pcbColor: '#c2410c' });
mcuScr({ id: 'm5core2', n: 'M5Stack Core2 Touch (320×240)', brand: 'M5Stack', base: 'esp32', chip: 'ESP32-D0WDQ6', core: 'Tela 2.0" capacitiva FT6336U', pcb: [54, 54], act: [6.5, 6, 40.8, 30.6], res: [320, 240], touch: 'cap', ctrl: 'm5', btns: ['A', 'B', 'C'], pins: ['3V3', 'GND', 'IO0', 'IO1', 'IO2', 'IO3', 'IO5', 'IO13', 'IO14', 'IO15', 'IO18', 'IO19', 'IO21', 'IO22', 'IO23', 'IO25', 'IO26', 'IO27', 'IO32', 'IO33', 'IO34', 'IO35', '5V', 'VIN'], desc: 'Core2 com toque', pcbColor: '#1e293b' });
mcuScr({ id: 'm5cores3', n: 'M5Stack CoreS3 Touch (320×240)', brand: 'M5Stack', base: 'esp32s3', chip: 'ESP32-S3', core: 'Tela 2.0" + câmera + touch', pcb: [54, 54], act: [6.5, 6, 40.8, 30.6], res: [320, 240], touch: 'cap', ctrl: 'm5', pins: ['3V3', 'GND', 'IO1', 'IO2', 'IO3', 'IO4', 'IO5', 'IO6', 'IO7', 'IO8', 'IO9', 'IO10', 'IO11', 'IO12', 'IO13', 'IO14', '5V', 'VIN'], desc: 'CoreS3', pcbColor: '#1e293b' });
mcuScr({ id: 'm5dial', n: 'M5Dial redondo Touch (240×240)', brand: 'M5Stack', base: 'esp32s3', chip: 'ESP32-S3', core: 'Tela 1.28" redonda + encoder', pcb: [47, 47], act: [3.5, 3.5, 40, 40], res: [240, 240], touch: 'cap', round: true, ctrl: 'm5', layout: 'bottom', pins: ['3V3', 'GND', 'G13', 'G15', 'G1', 'G2', 'G3', 'G4', '5V'].map(s => s.replace(/^G/, 'IO')), desc: 'Dial com touch', pcbColor: '#1e293b' });
mcuScr({ id: 'm5stick', n: 'M5StickC Plus2 (135×240)', brand: 'M5Stack', base: 'esp32', chip: 'ESP32-PICO-V3-02', core: 'Tela 1.14" + IMU + 2 botões', pcb: [25, 48], act: [3, 4, 14.9, 25.6], res: [135, 240], ctrl: 'm5', btns: ['A', 'B'], layout: 'bottom', pins: ['3V3', 'GND', 'IO0', 'IO25', 'IO26', 'IO32', 'IO33', '5V'], desc: 'StickC', pcbColor: '#c2410c' });
mcuScr({ id: 'tdisplay_s3', n: 'LilyGO T-Display S3 (170×320)', brand: 'LilyGO', base: 'esp32s3', chip: 'ESP32-S3R8', core: 'Tela 1.9" IPS + 2 botões', pcb: [25.5, 62], act: [3, 8, 17.5, 33], res: [170, 320], ctrl: 'tdisp', btns: ['BOOT', 'KEY'], pins: ['3V3', 'GND', 'IO1', 'IO2', 'IO3', 'IO10', 'IO11', 'IO12', 'IO13', 'IO16', 'IO17', 'IO18', 'IO21', '5V'], desc: 'T-Display S3', pcbColor: '#111827' });
mcuScr({ id: 'tdisplay_s3_touch', n: 'LilyGO T-Display S3 Touch', brand: 'LilyGO', base: 'esp32s3', chip: 'ESP32-S3R8', core: 'Tela 1.9" IPS + touch CST816', pcb: [25.5, 62], act: [3, 8, 17.5, 33], res: [170, 320], touch: 'cap', ctrl: 'tdisp', btns: ['BOOT', 'KEY'], pins: ['3V3', 'GND', 'IO1', 'IO2', 'IO3', 'IO10', 'IO11', 'IO12', 'IO13', 'IO16', 'IO17', 'IO18', 'IO21', '5V'], desc: 'Variante touch', pcbColor: '#111827' });
mcuScr({ id: 'ws_s3_43', n: 'Waveshare ESP32-S3 Touch LCD 4.3" (800×480)', brand: 'Waveshare', base: 'esp32s3', chip: 'ESP32-S3-N16R8', core: 'RGB 4.3" + GT911 multitoque', pcb: [108, 67], act: [6.5, 6.5, 95, 54], res: [800, 480], touch: 'cap', ctrl: 'rgbpanel', layout: 'bottom', pins: ['5V', 'GND', 'IO19', 'IO20', 'IO8', 'IO9', 'IO43', 'IO44', '3V3'], desc: 'Painel RGB 800×480', pcbColor: '#0b3a2e' });
mcuScr({ id: 'crowpanel7', n: 'Elecrow CrowPanel 7.0" (800×480)', brand: 'Elecrow', base: 'esp32s3', chip: 'ESP32-S3-WROOM-1', core: 'HMI 7" + GT911 multitoque', pcb: [165, 100], act: [5.5, 6.5, 154, 86], res: [800, 480], touch: 'cap', ctrl: 'rgbpanel', layout: 'bottom', pins: ['5V', 'GND', 'IO19', 'IO20', 'IO38', 'IO39', 'IO44', 'IO43', '3V3'], desc: 'HMI 7"', pcbColor: '#111827' });
mcuScr({ id: 'ws_round_128', n: 'Waveshare ESP32-S3 Touch LCD 1.28" redondo', brand: 'Waveshare', base: 'esp32s3', chip: 'ESP32-S3R2', core: 'Redondo 240×240 + CST816S', pcb: [42, 42], act: [3, 3, 36, 36], res: [240, 240], touch: 'cap', round: true, ctrl: 'tdisp', layout: 'bottom', pins: ['3V3', 'GND', 'IO6', 'IO7', 'IO8', 'IO9', 'IO10', '5V'], desc: 'Redondo capacitivo', pcbColor: '#111827' });
PARTS.forEach(p => { if(!p.pinNames) p.pinNames = autoPinNames(p); });

/* ---------- arte da placa ---------- */
const _svgDisplay = window.svgDisplay;
window.svgDisplay = function(d){
  if(!d.scr) return _svgDisplay(d);
  const s = d.scr;
  const pad = 5;
  let art = `<rect x="1" y="1" width="${d.w - 2}" height="${d.h - 2}" rx="${Math.min(8, d.h / 6)}" fill="${s.pcb}" stroke="#000a"/>`;
  art += `<rect x="${s.x - 4}" y="${s.y - 4}" width="${s.w + 8}" height="${s.h + 8}" rx="${s.round ? (s.w + 8) / 2 : 5}" fill="#050505" stroke="#2b2b2b"/>`;
  art += `<text x="${d.w / 2}" y="${d.h - 11}" text-anchor="middle" font-size="6.5" fill="#fff9" font-family="monospace">${d.n.replace(/\s*\(.*$/, '').slice(0, 34)}</text>`;
  art += `<text x="${d.w / 2}" y="${d.h - 19}" text-anchor="middle" font-size="5.5" fill="#fff6" font-family="monospace">${s.W}×${s.H}${s.touch ? ' · touch ' + (s.touch === 'cap' ? 'capacitivo' : 'resistivo') : ''}</text>`;
  return `<svg width="${d.w}" height="${d.h}">${art}</svg>`;
};


/* placas com tela embutida (CYD, M5Stack, T-Display...) — corrige svgCustomMCUWithScreen inexistente */
const _svgMCU = window.svgMCU;
window.svgMCU = function(d){
  if(!d.scr) return _svgMCU(d);
  const s = d.scr;
  let art = `<rect x="1" y="1" width="${d.w - 2}" height="${d.h - 2}" rx="9" fill="${s.pcb}" stroke="#000b"/>`;
  art += `<rect x="${s.x - 5}" y="${s.y - 5}" width="${s.w + 10}" height="${s.h + 10}" rx="${s.round ? (s.w + 10) / 2 : 6}" fill="#050505" stroke="#2b2b2b"/>`;
  const by = d.h - 22;
  art += `<rect x="${d.w / 2 - 12}" y="${d.h - 9}" width="24" height="9" rx="2" fill="#9ca3af" stroke="#4b5563"/>`;
  art += `<rect x="${d.w - 46}" y="${by - 4}" width="30" height="16" rx="2" fill="#1f2937" stroke="#6b7280"/><text x="${d.w - 31}" y="${by + 7}" text-anchor="middle" font-size="6" fill="#9ca3af" font-family="monospace">${(d.chip || 'ESP32').slice(0, 9)}</text>`;
  art += `<text x="14" y="${by + 6}" font-size="6.5" fill="#ffffffcc" font-family="monospace">${d.n.replace(/\s*\(.*$/, '').slice(0, 26)}</text>`;
  return `<svg width="${d.w}" height="${d.h}">${art}</svg>`;
};

/* ---------- motor gráfico ---------- */
const col565 = new Array(65536);
function rgb565(c){
  if(col565[c]) return col565[c];
  const r = ((c >> 11) & 31) * 255 / 31, g = ((c >> 5) & 63) * 255 / 63, b = (c & 31) * 255 / 31;
  return col565[c] = 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}
const glyphCache = new Map();
function glyph(ch, color, size){
  const key = ch + '|' + color + '|' + size;
  let c = glyphCache.get(key);
  if(c) return c;
  let mask = glyphCache.get('m|' + ch);
  if(!mask){
    mask = document.createElement('canvas'); mask.width = 6; mask.height = 8;
    const g = mask.getContext('2d', { willReadFrequently: true });
    g.font = '8px "DejaVu Sans Mono", "Courier New", monospace';
    g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
    g.fillText(ch, 0.4, 7);
    const im = g.getImageData(0, 0, 6, 8);
    for(let i = 0; i < im.data.length; i += 4){ const a = im.data[i + 3] > 95 ? 255 : 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = a; }
    g.putImageData(im, 0, 0);
    glyphCache.set('m|' + ch, mask);
  }
  c = document.createElement('canvas'); c.width = 6 * size; c.height = 8 * size;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(mask, 0, 0, 6 * size, 8 * size);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  glyphCache.set(key, c);
  return c;
}

const SCR = window.KezleScreens = { list: [], magnified: null };

function getScr(inst){
  if(inst.scr) return inst.scr;
  const spec = inst.def.scr;
  const buf = document.createElement('canvas');
  buf.width = spec.W; buf.height = spec.H;
  const sc = { inst, spec, W: spec.W, H: spec.H, buf, g: buf.getContext('2d'), rot: 0, user: false, dirty: true, views: new Set(), touch: { pts: new Map(), down: false, last: null, gesture: 0, lastT: 0, events: [] },
    cursor: { x: 0, y: 0 }, textColor: spec.fg || '#fff', textBg: null, textSize: 1, backlight: 1, invert: false, idle: null, wasPow: false, brightness: 1, epdShown: false };
  sc.g.fillStyle = spec.bg || '#000'; sc.g.fillRect(0, 0, sc.W, sc.H);
  inst.scr = sc;
  return sc;
}
SCR.get = getScr;

function applyTransform(sc){
  const g = sc.g, W = sc.W, H = sc.H;
  switch(sc.rot & 3){
    case 0: g.setTransform(1, 0, 0, 1, 0, 0); break;
    case 1: g.setTransform(0, 1, -1, 0, W, 0); break;
    case 2: g.setTransform(-1, 0, 0, -1, W, H); break;
    case 3: g.setTransform(0, -1, 1, 0, 0, H); break;
  }
}
const logicalW = sc => (sc.rot & 1) ? sc.H : sc.W;
const logicalH = sc => (sc.rot & 1) ? sc.W : sc.H;

function cssColor(sc, c){
  if(c == null) return sc.spec.fg || '#fff';
  if(typeof c === 'string') return c;
  if(Array.isArray(c)) return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  if(typeof c === 'boolean') c = c ? 1 : 0;
  const t = sc.spec.type;
  if(t === 'oled' || t === 'mono'){ return c ? (sc.spec.fg || '#fff') : (t === 'mono' ? (sc.spec.bg || '#000') : '#000'); }
  if(t === 'epd'){
    if(c === 0 || c === 0x0000) return '#111';
    if(c === 1 || c === 0xFF || c === 0xFFFF) return '#f2efe6';
    if(c === 2 && sc.spec.tri) return sc.spec.tri;
    if(sc.spec.tri && c === 0xF800) return sc.spec.tri;
    return rgb565(c & 0xFFFF) === 'rgb(0,0,0)' ? '#111' : (c & 0xFFFF) > 0x8000 ? '#f2efe6' : '#111';
  }
  return rgb565(c & 0xFFFF);
}
function markDirty(sc){
  sc.dirty = true;
  if(!SCR._raf){ SCR._raf = requestAnimationFrame(flush); }
}
function flush(){
  SCR._raf = 0;
  for(const sc of SCR.list){
    if(!sc.dirty) continue;
    sc.dirty = false;
    for(const v of sc.views){
      const c = v.cv; if(!c.isConnected && v !== sc.mag) continue;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = !(v.cv.clientWidth / sc.W >= 1.4);
      g.drawImage(sc.buf, 0, 0);
    }
  }
}
function claimUser(sc){
  if(!sc.user){ sc.user = true; sc.g.setTransform(1, 0, 0, 1, 0, 0); sc.g.fillStyle = sc.spec.bg || '#000'; sc.g.fillRect(0, 0, sc.W, sc.H); markDirty(sc); }
}

/* API de desenho (coordenadas lógicas após rotação) */
function makeGfx(inst, opt){
  opt = opt || {};
  const sc = getScr(inst);
  const gx = {
    inst, sc,
    claim(){ if(!opt.idle) claimUser(sc); },
    g(){ applyTransform(sc); return sc.g; },
    width: () => logicalW(sc), height: () => logicalH(sc),
    setRotation(r){ sc.rot = ((+r || 0) % 4 + 4) % 4; gx.claim(); },
    fill(c){ gx.claim(); const g = gx.g(); g.fillStyle = cssColor(sc, c); g.fillRect(0, 0, logicalW(sc), logicalH(sc)); gx.dirty(); },
    dirty(){ if(sc.spec.type === 'epd' && !opt.noEpd) { markDirtyLazy(sc); return; } markDirty(sc); },
    px(x, y, c){ gx.claim(); const g = gx.g(); g.fillStyle = cssColor(sc, c); g.fillRect(Math.round(x), Math.round(y), 1, 1); gx.dirty(); },
    fillRect(x, y, w, h, c){ gx.claim(); const g = gx.g(); g.fillStyle = cssColor(sc, c); g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); gx.dirty(); },
    rect(x, y, w, h, c, fill){ if(fill) return gx.fillRect(x, y, w, h, c); gx.claim(); const g = gx.g(); g.fillStyle = cssColor(sc, c); x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h); gx.dirty(); },
    hline(x, y, w, c){ gx.fillRect(x, y, w, 1, c); },
    vline(x, y, h, c){ gx.fillRect(x, y, 1, h, c); },
    line(x0, y0, x1, y1, c){
      gx.claim(); const g = gx.g(); g.fillStyle = cssColor(sc, c);
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, n = 0;
      for(;;){ g.fillRect(x0, y0, 1, 1); if(x0 === x1 && y0 === y1 || ++n > 5000) break; const e2 = 2 * err; if(e2 >= dy){ err += dy; x0 += sx; } if(e2 <= dx){ err += dx; y0 += sy; } }
      gx.dirty();
    },
    circle(cx, cy, r, c, fill){
      gx.claim(); const g = gx.g(); g.fillStyle = cssColor(sc, c);
      cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
      let x = r, y = 0, err = 1 - r;
      while(x >= y){
        if(fill){ g.fillRect(cx - x, cy + y, 2 * x + 1, 1); g.fillRect(cx - x, cy - y, 2 * x + 1, 1); g.fillRect(cx - y, cy + x, 2 * y + 1, 1); g.fillRect(cx - y, cy - x, 2 * y + 1, 1); }
        else { for(const [a, b] of [[x, y], [y, x], [-x, y], [-y, x], [x, -y], [y, -x], [-x, -y], [-y, -x]]) g.fillRect(cx + a, cy + b, 1, 1); }
        y++; if(err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
      }
      gx.dirty();
    },
    fillCircle(cx, cy, r, c){ gx.circle(cx, cy, r, c, true); },
    ellipse(cx, cy, rx, ry, c, fill){ gx.claim(); const g = gx.g(); g.fillStyle = cssColor(sc, c); g.strokeStyle = g.fillStyle; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, Math.max(rx, .5), Math.max(ry, .5), 0, 0, 7); fill ? g.fill() : g.stroke(); gx.dirty(); },
    roundRect(x, y, w, h, r, c, fill){ gx.claim(); const g = gx.g(); g.fillStyle = g.strokeStyle = cssColor(sc, c); g.lineWidth = 1; g.beginPath(); g.roundRect(x + .5, y + .5, w - 1, h - 1, r); fill ? g.fill() : g.stroke(); gx.dirty(); },
    triangle(x0, y0, x1, y1, x2, y2, c, fill){ if(!fill){ gx.line(x0, y0, x1, y1, c); gx.line(x1, y1, x2, y2, c); gx.line(x2, y2, x0, y0, c); return; } gx.claim(); const g = gx.g(); g.fillStyle = cssColor(sc, c); g.beginPath(); g.moveTo(x0 + .5, y0 + .5); g.lineTo(x1 + .5, y1 + .5); g.lineTo(x2 + .5, y2 + .5); g.closePath(); g.fill(); gx.dirty(); },
    poly(pts, c, fill){ gx.claim(); const g = gx.g(); g.fillStyle = g.strokeStyle = cssColor(sc, c); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] + .5, p[1] + .5) : g.moveTo(p[0] + .5, p[1] + .5)); g.closePath(); fill ? g.fill() : g.stroke(); gx.dirty(); },
    char(ch, x, y, fg, bg, size, cw){
      const g = gx.g(); size = size || 1; cw = cw || 6;
      if(bg != null) { g.fillStyle = cssColor(sc, bg); g.fillRect(x, y, cw * size, 8 * size); }
      if(ch === ' ') return;
      const gl = glyph(ch, cssColor(sc, fg), size);
      g.drawImage(gl, x + Math.floor((cw - 6) / 2) * size, y);
    },
    text(s, x, y, fg, bg, size, cw){
      gx.claim(); s = String(s); size = size || 1; cw = cw || 6;
      for(let i = 0; i < s.length; i++){ const ch = s[i]; if(ch === '\n'){ y += 8 * size; x -= i * cw * size; continue; } gx.char(ch, x + i * cw * size, y, fg == null ? sc.textColor : fg, bg, size, cw); }
      gx.dirty();
      return s.length * cw * size;
    },
    textW: (s, size, cw) => String(s).length * (cw || 6) * (size || 1),
    // cursor + print (estilo Adafruit_GFX)
    setCursor(x, y){ sc.cursor.x = x; sc.cursor.y = y; },
    setTextColor(fg, bg){ sc.textColor = fg; sc.textBg = bg == null ? null : bg; },
    setTextSize(s){ sc.textSize = Math.max(1, +s || 1); },
    print(s){
      gx.claim(); s = String(s); const sz = sc.textSize;
      for(const ch of s){
        if(ch === '\n'){ sc.cursor.x = 0; sc.cursor.y += 8 * sz; continue; }
        if(ch === '\r') continue;
        if(sc.cursor.x + 6 * sz > logicalW(sc)){ sc.cursor.x = 0; sc.cursor.y += 8 * sz; }
        gx.char(ch, sc.cursor.x, sc.cursor.y, sc.textColor, sc.textBg, sz, 6);
        sc.cursor.x += 6 * sz;
      }
      gx.dirty();
    },
    println(s){ gx.print(s === undefined ? '' : s); gx.print('\n'); },
    blit(x, y, w, h, data){ // RGB565 array (big-endian bytes ou uint16)
      gx.claim(); const g = gx.g(); const im = g.createImageData(w, h);
      for(let i = 0; i < w * h; i++){ const v = data instanceof Uint8Array ? (data[2 * i] << 8 | data[2 * i + 1]) : data[i]; const c = rgb565(v & 0xFFFF).match(/\d+/g); im.data[4 * i] = +c[0]; im.data[4 * i + 1] = +c[1]; im.data[4 * i + 2] = +c[2]; im.data[4 * i + 3] = 255; }
      const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').putImageData(im, 0, 0);
      g.drawImage(t, x, y); gx.dirty();
    },
    scroll(dx, dy){ gx.claim(); const g = gx.g(); const t = document.createElement('canvas'); t.width = sc.W; t.height = sc.H; t.getContext('2d').drawImage(sc.buf, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(t, dx, dy); gx.dirty(); },
    invert(v){ sc.invert = v == null ? !sc.invert : !!v; SCR.updateLook(sc); },
    backlight(v){ sc.backlight = clamp(v == null ? 1 : +v, 0, 1); SCR.updateLook(sc); },
    show(){ if(sc.spec.type === 'epd'){ epdRefresh(sc); } else markDirty(sc); },
    clear(c){ gx.fill(c == null ? 0 : c); },
    color565: (r, g, b) => ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
  };
  return gx;
}
SCR.makeGfx = makeGfx;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

/* e-Paper: só atualiza ao chamar display()/show() e pisca ao atualizar */
function markDirtyLazy(sc){ sc.epdPending = true; }
function epdRefresh(sc){
  sc.epdPending = false;
  for(const v of sc.views){ v.cv.classList.add('epdFlash'); setTimeout(() => v.cv.classList.remove('epdFlash'), 700); }
  markDirty(sc);
}

/* ---------- elemento DOM da tela + toque ---------- */
const css = document.createElement('style');
css.textContent = `
.scrWrap{position:absolute;overflow:hidden;background:#000;z-index:9}
.scrWrap canvas{width:100%;height:100%;display:block;touch-action:none;cursor:pointer}
.scrWrap.round{border-radius:50%}
.scrWrap .glass{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.13) 0%,rgba(255,255,255,0) 38%,rgba(255,255,255,0) 100%)}
.scrWrap .off{position:absolute;inset:0;background:#030507;pointer-events:none;transition:opacity .25s}
.scrWrap .off.hide{opacity:0}
.scrWrap.epd .off{background:transparent}
.scrWrap .finger{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.55),rgba(120,200,255,.2) 60%,transparent 70%);pointer-events:none;display:none;z-index:5}
.epdFlash{animation:epdf .7s steps(2)}
@keyframes epdf{0%{filter:invert(1)}50%{filter:invert(0) contrast(2)}100%{filter:none}}
.mBtns{position:absolute;display:flex;gap:6px;z-index:12}
.mBtns button{flex:1;height:100%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f5f5f5,#9ca3af);border:1px solid #111;box-shadow:0 2px 0 #4b5563;font:bold 9px var(--mono);color:#111;padding:0}
.mBtns button.down{transform:translateY(2px);box-shadow:none;background:#facc15}
#magOv{position:fixed;inset:0;background:#000b;z-index:9500;display:none;align-items:center;justify-content:center}
#magOv.on{display:flex}
#magBox{background:#0d1626;border:1px solid var(--line);border-radius:14px;padding:12px 14px;max-width:96vw;max-height:94vh;display:flex;flex-direction:column;gap:8px;box-shadow:0 30px 80px #000c}
#magBox .hd{display:flex;gap:10px;align-items:center}
#magFrame{position:relative;background:#000;border:6px solid #1b2433;border-radius:10px;overflow:hidden;align-self:center}
#magFrame.round{border-radius:50%}
#magFrame canvas{display:block;touch-action:none;cursor:crosshair}
`;
document.head.appendChild(css);

function viewFor(inst, cv){ return { cv }; }

const _postPart2 = window.postPart;
window.postPart = function(inst, div){
  _postPart2(inst, div);
  const d = inst.def;
  if(!d.scr) return;
  const sc = getScr(inst);
  const spec = d.scr;
  const wrap = inst.wrap || div;
  const old = wrap.querySelector('.oledC, .lcdscr'); if(old) old.remove();
  const sw = document.createElement('div');
  sw.className = 'scrWrap' + (spec.round ? ' round' : '') + (spec.type === 'epd' ? ' epd' : '');
  sw.style.cssText = `left:${spec.x}px;top:${spec.y}px;width:${spec.w}px;height:${spec.h}px`;
  const cv = document.createElement('canvas'); cv.width = sc.W; cv.height = sc.H;
  cv.style.imageRendering = (spec.w / sc.W >= 1.4) ? 'pixelated' : 'auto';
  const off = document.createElement('div'); off.className = 'off';
  const glass = document.createElement('div'); glass.className = 'glass';
  const fg = document.createElement('div'); fg.className = 'finger';
  sw.append(cv, glass, off, fg);
  wrap.appendChild(sw);
  const view = { cv, off, fg, sw };
  sc.views.forEach(v => { if(!v.cv.isConnected && !v.mag) sc.views.delete(v); });
  sc.views.add(view);
  inst.scrView = view;
  if(!SCR.list.includes(sc)) SCR.list.push(sc);
  bindTouch(inst, cv, fg);
  cv.getContext('2d').drawImage(sc.buf, 0, 0);
  // botões físicos (M5 / T-Display)
  if(spec.btns){
    const bx = document.createElement('div'); bx.className = 'mBtns ctl';
    const bw = Math.min(d.w - 20, spec.btns.length * 34);
    bx.style.cssText = `left:${(d.w - bw) / 2}px;top:${spec.y + spec.h + 10}px;width:${bw}px;height:20px`;
    spec.btns.forEach(nm => {
      const b = document.createElement('button'); b.textContent = nm.length > 2 ? '' : nm; b.title = 'Botão ' + nm;
      const set = v => { inst.state.mbtn = inst.state.mbtn || {}; inst.state.mbtn[nm] = v; b.classList.toggle('down', v); };
      b.addEventListener('pointerdown', e => { e.stopPropagation(); b.setPointerCapture(e.pointerId); set(true); });
      b.addEventListener('pointerup', () => set(false)); b.addEventListener('pointercancel', () => set(false));
      b.addEventListener('mousedown', e => e.stopPropagation());
      bx.appendChild(b);
    });
    wrap.appendChild(bx);
  }
  markDirty(sc);
};

/* ---------- toque ---------- */
function toLogical(sc, nx, ny){
  const W = sc.W, H = sc.H;
  switch(sc.rot & 3){
    case 0: return [nx, ny];
    case 1: return [ny, W - nx];
    case 2: return [W - nx, H - ny];
    case 3: return [H - ny, nx];
  }
}
function powered(inst){ return typeof CIRCUIT !== 'undefined' ? CIRCUIT.powered(inst) : SIM.on; }

function bindTouch(inst, cv, fingerEl){
  const sc = getScr(inst);
  const pos = e => {
    const r = cv.getBoundingClientRect();
    let fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    // elemento rotacionado: usa offsetX/Y (coordenadas locais) quando possível
    if(typeof e.offsetX === 'number' && e.target === cv && cv.clientWidth){ fx = e.offsetX / cv.clientWidth; fy = e.offsetY / cv.clientHeight; }
    fx = clampN(fx, 0, 0.9999); fy = clampN(fy, 0, 0.9999);
    return { nx: fx * sc.W, ny: fy * sc.H, fx, fy };
  };
  const place = (p) => { if(fingerEl){ fingerEl.style.display = 'block'; fingerEl.style.left = (p.fx * 100) + '%'; fingerEl.style.top = (p.fy * 100) + '%'; } };
  const hide = () => { if(fingerEl) fingerEl.style.display = 'none'; };
  const t = sc.touch;
  cv.addEventListener('mousedown', e => { if(BENCH && BENCH.mode === 'erase') return; e.stopPropagation(); if(inst.el) { BENCH.selWire = null; BENCH.sel = inst; $$('.part.sel').forEach(x => x.classList.remove('sel')); inst.el.classList.add('sel'); renderProps(); } });
  cv.addEventListener('pointerdown', e => {
    if(BENCH && BENCH.mode === 'erase') return;
    e.preventDefault(); e.stopPropagation();
    cv.setPointerCapture(e.pointerId);
    if(!SIM.on || !powered(inst)){ if(!sc.warned){ sc.warned = 1; toast('Tela sem energia — ligue a ⏻ Simulação e alimente o módulo para usar o toque', 'warn'); setTimeout(() => sc.warned = 0, 4000); } return; }
    if(!sc.spec.touch){ if(!sc.warnedT){ sc.warnedT = 1; toast(inst.def.n + ' não tem touch (apenas exibição).', 'warn'); setTimeout(() => sc.warnedT = 0, 4000); } return; }
    const p = pos(e); place(p);
    const [lx, ly] = toLogical(sc, p.nx, p.ny);
    t.pts.set(e.pointerId, { x: lx, y: ly, nx: p.nx, ny: p.ny, id: e.pointerId, t0: performance.now(), x0: lx, y0: ly });
    t.down = true; t.last = { x: lx, y: ly }; t.lastT = performance.now(); t.gesture = 0;
    t.events.push({ type: 'down', x: lx, y: ly, t: performance.now() });
    inst.state.touching = true;
    if(window.PINS && sc.spec.touch){ const ir = tIrqGpio(inst); if(ir != null){ PINS[ir] = Object.assign(PINS[ir] || {}, { _touchIrq: 1 }); } }
    idleTouch(inst, 'down', lx, ly);
  });
  cv.addEventListener('pointermove', e => {
    const pt = t.pts.get(e.pointerId); if(!pt) return;
    const p = pos(e); place(p);
    const [lx, ly] = toLogical(sc, p.nx, p.ny);
    pt.x = lx; pt.y = ly; pt.nx = p.nx; pt.ny = p.ny;
    t.last = { x: lx, y: ly }; t.lastT = performance.now();
    idleTouch(inst, 'move', lx, ly);
  });
  const up = e => {
    const pt = t.pts.get(e.pointerId); if(!pt) return;
    t.pts.delete(e.pointerId);
    const dx = pt.x - pt.x0, dy = pt.y - pt.y0, dt = performance.now() - pt.t0;
    if(Math.hypot(dx, dy) > 30 && dt < 700){ t.gesture = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 4) : (dy > 0 ? 1 : 2); } // CST816: 1 cima? usamos 1=baixo 2=cima 3=dir 4=esq
    else if(dt < 300) t.gesture = 5; // toque simples
    t.gestureT = performance.now();
    t.events.push({ type: 'up', x: pt.x, y: pt.y, t: performance.now() });
    if(t.events.length > 64) t.events.shift();
    t.down = t.pts.size > 0;
    inst.state.touching = t.down;
    if(!t.down) hide();
    idleTouch(inst, 'up', pt.x, pt.y);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
function tIrqGpio(inst){ const i = (inst.def.pinNames || []).findIndex(n => /^(T_IRQ|TINT|INT|INT_T)$/i.test(n)); return i >= 0 && window.CIRCUIT ? CIRCUIT.gpioOfPin(inst, i) : null; }

/* leitura do toque pelo código (coordenadas lógicas) */
SCR.readTouch = function(inst){
  const sc = getScr(inst), t = sc.touch;
  if(!SIM.on || !powered(inst) || !sc.spec.touch) return { n: 0, pts: [] };
  const pts = [...t.pts.values()].slice(0, sc.spec.touch === 'cap' ? 5 : 1);
  return { n: pts.length, pts: pts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), id: p.id, z: sc.spec.touch === 'res' ? 1200 : 40 })), gesture: (performance.now() - (t.gestureT || 0) < 600) ? t.gesture : 0 };
};
SCR.touchScreens = () => BENCH.parts.filter(p => p.def.scr && p.def.scr.touch);
SCR.findScreen = function(ctrls, needTouch){
  const all = BENCH.parts.filter(p => p.def.scr);
  const pw = all.filter(p => powered(p));
  const pool = pw.length ? pw : all;
  let r = null;
  if(needTouch) r = pool.find(p => p.def.scr.touch) || all.find(p => p.def.scr.touch);
  if(!r && ctrls && ctrls.length) r = pool.find(p => ctrls.includes(p.def.scr.ctrl)) || all.find(p => ctrls.includes(p.def.scr.ctrl));
  if(!r) r = pool[0] || all[0] || null;
  return r;
};

/* ---------- firmware "idle" interativo ---------- */
const PAL = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff'];
function idleDraw(inst){
  const sc = getScr(inst);
  if(sc.user) return;
  const gx = makeGfx(inst, { idle: true });
  const W = gx.width(), H = gx.height(), spec = sc.spec;
  const g = gx.g();
  sc.g.setTransform(1, 0, 0, 1, 0, 0);
  const isMono = spec.type === 'oled' || spec.type === 'mono';
  if(!sc.idle) sc.idle = { sw: [1, 0, 1, 1, 0, 0], bright: 80, color: 3, w: [] };
  const I = sc.idle;
  I.w = [];
  if(spec.type === 'epd'){
    gx.fill(1); gx.text('Kezle Lab Pro', 6, 6, 0, null, Math.max(1, Math.round(W / 140)));
    gx.rect(2, 2, W - 4, H - 4, 0); gx.text(spec.W + 'x' + spec.H + ' e-Paper', 6, H - 16, 0); gx.text('aguardando programa', 6, 26, 0);
    epdRefresh(sc); return;
  }
  if(isMono){
    gx.fill(0);
    gx.rect(0, 0, W, H, 1);
    const s = W >= 200 ? 2 : 1;
    gx.text('Kezle Lab Pro', Math.max(3, (W - 13 * 6 * s) / 2), 4, 1, null, s);
    gx.text(spec.W + 'x' + spec.H, 4, H - 12, 1);
    gx.text(inst.def.n.split(' ')[0] + ' ok', 4, 4 + 10 * s + 4, 1);
    // barra animada
    const bw = W - 8; gx.rect(4, H / 2 + 6, bw, 6, 1);
    gx.fillRect(4, H / 2 + 6, Math.round(bw * ((Date.now() / 40) % 100) / 100), 6, 1);
    markDirty(sc); sc.idleAnim = true; return;
  }
  const bg = '#0b1220';
  gx.fill(bg);
  const S = Math.max(1, Math.round(Math.min(W, H) / 160));
  const hh = Math.round(Math.min(H * 0.1, 18 * S + 4));
  gx.fillRect(0, 0, W, hh, '#1d4ed8');
  gx.text('Kezle Touch', 6 * S, Math.round((hh - 8 * S) / 2), '#fff', null, S);
  const now = new Date().toTimeString().slice(0, 5);
  gx.text(now, W - 6 * S - 5 * 6 * S, Math.round((hh - 8 * S) / 2), '#bfdbfe', null, S);
  if(!spec.touch){
    gx.text(spec.W + 'x' + spec.H + ' sem touch', 6 * S, hh + 8 * S, '#94a3b8', null, S);
    gx.text('aguardando programa...', 6 * S, hh + 20 * S, '#64748b', null, S);
    const cx = W / 2, cy = H * 0.65, r = Math.min(W, H) * 0.22;
    for(let i = 0; i < 6; i++) gx.fillCircle(cx + Math.cos(i * 1.047) * r, cy + Math.sin(i * 1.047) * r, Math.max(2, r / 6), PAL[i]);
    markDirty(sc); return;
  }
  // grade de botões
  const labels = ['LED', 'Wi-Fi', 'BLE', 'Backlight', 'Buzzer', 'Reset'];
  const cols = W > H ? 3 : 2, rows = Math.ceil(labels.length / cols);
  const gridH = Math.round((H - hh) * (W > H ? 0.42 : 0.34));
  const gap = 4 * S, bw = Math.floor((W - gap * (cols + 1)) / cols), bh = Math.floor((gridH - gap * (rows + 1)) / rows);
  labels.forEach((lb, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = gap + c * (bw + gap), y = hh + gap + r * (bh + gap);
    const on = I.sw[i];
    gx.fillRect(x, y, bw, bh, on ? '#16a34a' : '#1e293b');
    gx.rect(x, y, bw, bh, on ? '#4ade80' : '#334155');
    const tw = lb.length * 6 * S;
    gx.text(lb, x + Math.max(2, (bw - tw) / 2), y + (bh - 8 * S) / 2, '#fff', null, S);
    I.w.push({ x, y, w: bw, h: bh, i, k: 'btn' });
  });
  // slider de brilho
  const sy = hh + gridH + 6 * S, sx = 10 * S, sw = W - 20 * S;
  gx.text('Brilho ' + I.bright + '%', sx, sy - 9 * S, '#94a3b8', null, S);
  gx.fillRect(sx, sy + 2 * S, sw, 4 * S, '#1e293b');
  gx.fillRect(sx, sy + 2 * S, Math.round(sw * I.bright / 100), 4 * S, '#3b82f6');
  gx.fillCircle(sx + Math.round(sw * I.bright / 100), sy + 4 * S, 5 * S, '#e2e8f0');
  I.w.push({ x: sx - 6, y: sy - 4, w: sw + 12, h: 16 * S, k: 'slider', sx, sw });
  // área de desenho
  const py = sy + 16 * S, ph = H - py - 4;
  if(ph > 20 * S){
    gx.fillRect(4, py, W - 8, ph, '#0f172a'); gx.rect(4, py, W - 8, ph, '#334155');
    gx.text('desenhe com o dedo', 8, py + 4, '#334155', null, S);
    PAL.forEach((c, i) => { const px0 = W - 4 - (PAL.length - i) * (9 * S + 2); gx.fillRect(px0, py + 3, 9 * S, 7 * S, c); if(i === I.color) gx.rect(px0 - 1, py + 2, 9 * S + 2, 7 * S + 2, '#fff'); I.w.push({ x: px0, y: py + 3, w: 9 * S, h: 7 * S, k: 'pal', i }); });
    gx.fillRect(8, py + ph - 10 * S - 2, 30 * S, 9 * S, '#7f1d1d'); gx.text('limpar', 10, py + ph - 9 * S - 1, '#fff', null, S);
    I.w.push({ x: 8, y: py + ph - 10 * S - 2, w: 30 * S, h: 9 * S, k: 'clr' });
    I.pad = { x: 4, y: py, w: W - 8, h: ph };
  } else I.pad = null;
  I.S = S;
  markDirty(sc);
}
function idleTouch(inst, type, x, y){
  const sc = getScr(inst);
  if(sc.user || !sc.idle || !SIM.on) return;
  const I = sc.idle, gx = makeGfx(inst, { idle: true });
  const hit = I.w.find(w => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h);
  if(type === 'down' || (type === 'move' && I.drag)){
    if(hit && hit.k === 'btn' && type === 'down'){ I.sw[hit.i] ^= 1; idleDraw(inst); if(hit.i === 3){ sc.backlight = I.sw[3] ? I.bright / 100 : 0.15; SCR.updateLook(sc); } if(hit.i === 5){ I.sw = [0, 0, 0, 0, 0, 0]; I.bright = 80; sc.backlight = 0.8; SCR.updateLook(sc); idleDraw(inst); } return; }
    if(hit && hit.k === 'pal' && type === 'down'){ I.color = hit.i; idleDraw(inst); return; }
    if(hit && hit.k === 'clr' && type === 'down'){ idleDraw(inst); return; }
    if((hit && hit.k === 'slider') || I.drag === 'slider'){
      I.drag = 'slider';
      const w = I.w.find(q => q.k === 'slider');
      I.bright = clampN(Math.round((x - w.sx) / w.sw * 100), 5, 100);
      sc.backlight = I.bright / 100; SCR.updateLook(sc); idleDraw(inst); return;
    }
    if(I.pad && ((x >= I.pad.x && x < I.pad.x + I.pad.w && y >= I.pad.y + 12 && y < I.pad.y + I.pad.h) || I.drag === 'pad')){
      if(type === 'down') I.drag = 'pad';
      const r = 2 * (I.S || 1);
      gx.fillCircle(x, y, r, PAL[I.color]);
      if(I.last && type === 'move'){ gx.line(I.last.x, I.last.y, x, y, PAL[I.color]); gx.line(I.last.x + 1, I.last.y, x + 1, y, PAL[I.color]); }
      I.last = { x, y };
    }
  }
  if(type === 'up'){ I.drag = null; I.last = null; }
}
SCR.idleDraw = idleDraw;

/* ---------- aparência: backlight, inversão, energia ---------- */
SCR.updateLook = function(sc){
  for(const v of sc.views){
    const dim = sc.backlight * (sc.spec.type === 'epd' ? 1 : 1);
    v.cv.style.filter = `brightness(${0.15 + 0.85 * dim})${sc.invert ? ' invert(1)' : ''}`;
  }
};
const _refreshAll2 = window.refreshAllVisuals;
window.refreshAllVisuals = function(){
  _refreshAll2();
  for(const p of BENCH.parts){
    if(!p.def.scr || !p.el) continue;
    const sc = getScr(p);
    const pw = powered(p);
    const v = p.scrView;
    if(v){
      const epd = sc.spec.type === 'epd';
      v.off.classList.toggle('hide', pw || epd);
      v.sw.title = pw ? p.def.n + ' — ' + sc.W + '×' + sc.H + (sc.spec.touch ? ' (toque ativo)' : '') : 'sem energia';
    }
    if(pw && !sc.wasPow){ sc.wasPow = true; if(!sc.user) idleDraw(p); SCR.updateLook(sc); }
    if(!pw && sc.wasPow){ sc.wasPow = false; sc.user = false; sc.touch.pts.clear(); sc.idle = null; if(sc.spec.type !== 'epd'){ sc.g.setTransform(1, 0, 0, 1, 0, 0); sc.g.fillStyle = sc.spec.bg || '#000'; sc.g.fillRect(0, 0, sc.W, sc.H); markDirty(sc); } }
    if(v && p.scrView && !v._init){ v._init = 1; SCR.updateLook(sc); }
  }
};
// animação do idle mono (barra)
setInterval(() => { for(const p of BENCH.parts){ if(p.scr && p.scr.idleAnim && !p.scr.user && powered(p) && SIM.on) idleDraw(p); } }, 250);
setInterval(() => { for(const p of BENCH.parts){ if(p.scr && !p.scr.user && p.scr.idle && p.scr.spec.touch && powered(p) && !p.scr.touch.down) { const T = new Date().toTimeString().slice(0, 5); if(p.scr._t !== T){ p.scr._t = T; idleDraw(p); } } } }, 5000);

SCR.onRunStart = function(){
  for(const p of BENCH.parts){ if(p.scr){ p.scr.user = false; p.scr.rot = 0; p.scr.cursor = { x: 0, y: 0 }; p.scr.textColor = p.def.scr.fg || '#fff'; p.scr.textBg = null; p.scr.textSize = 1; p.scr.backlight = 1; p.scr.invert = false; SCR.updateLook(p.scr); } }
};

/* OLED legado (demo / dblclick / SSD1306 antigo) escreve no framebuffer novo */
window.oledRender = function(inst){
  if(!inst.def.scr) return;
  const sc = getScr(inst);
  if(sc.user) return;
  const gx = makeGfx(inst, { idle: true });
  sc.g.setTransform(1, 0, 0, 1, 0, 0);
  if(POWER && !POWER.powered(inst.id)) return;
  gx.fill(0);
  const fb = inst.state.fb || { texts: [], px: [] };
  for(const t of fb.texts) gx.text(t.s, t.x, t.y, 1, null, 1);
  for(const q of fb.px) gx.px(q[0], q[1], 1);
  markDirty(sc);
};

/* ---------- lupa (tela ampliada) ---------- */
SCR.openMagnifier = function(inst){
  if(!inst.def.scr){ return; }
  const sc = getScr(inst);
  let ov = document.getElementById('magOv');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'magOv';
    ov.innerHTML = '<div id="magBox"><div class="hd"><b id="magT"></b><span class="small" id="magR"></span><span style="flex:1"></span><button class="btn" id="magX">✕ Fechar</button></div><div id="magFrame"><canvas id="magC"></canvas><div class="finger" style="position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.55),rgba(120,200,255,.2) 60%,transparent 70%);pointer-events:none;display:none"></div></div><div class="small" id="magH"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', e => { if(e.target === ov) SCR.closeMagnifier(); });
    ov.querySelector('#magX').onclick = () => SCR.closeMagnifier();
  }
  SCR.closeMagnifier();
  const cv = ov.querySelector('#magC'), fr = ov.querySelector('#magFrame'), fg = fr.querySelector('.finger');
  const maxW = window.innerWidth * 0.86, maxH = window.innerHeight * 0.72;
  let s = Math.min(maxW / sc.W, maxH / sc.H);
  if(s >= 1) s = Math.floor(s) || 1;
  cv.width = sc.W; cv.height = sc.H;
  cv.style.width = Math.round(sc.W * s) + 'px'; cv.style.height = Math.round(sc.H * s) + 'px';
  cv.style.imageRendering = s >= 2 ? 'pixelated' : 'auto';
  fr.classList.toggle('round', !!sc.spec.round);
  ov.querySelector('#magT').textContent = inst.def.n;
  ov.querySelector('#magR').textContent = `${sc.W}×${sc.H}px · ${(sc.spec.w / MM).toFixed(1)}×${(sc.spec.h / MM).toFixed(1)} mm físicos · ampliada ${s.toFixed(2)}×`;
  ov.querySelector('#magH').textContent = sc.spec.touch ? '👆 Toque na tela: o toque chega ao código em execução (multitoque com vários dedos em telas capacitivas).' : 'Tela somente de exibição (sem touch).';
  const view = { cv, mag: true };
  sc.views.add(view); sc.mag = view;
  bindTouch(inst, cv, fg);
  cv.getContext('2d').drawImage(sc.buf, 0, 0);
  ov.classList.add('on');
  SCR.magnified = inst;
};
SCR.closeMagnifier = function(){
  const ov = document.getElementById('magOv'); if(!ov) return;
  ov.classList.remove('on');
  if(SCR.magnified){ const sc = getScr(SCR.magnified); if(sc.mag){ sc.views.delete(sc.mag); sc.mag = null; } SCR.magnified = null; }
};
document.addEventListener('keydown', e => { if(e.key === 'Escape') SCR.closeMagnifier(); });

/* botão da lupa no painel de propriedades */
const _rp = window.renderProps;
window.renderProps = function(){
  _rp();
  const inst = BENCH.sel;
  if(!inst || !inst.def.scr || BENCH.selWire) return;
  const sc = getScr(inst), box = document.getElementById('props');
  const el = document.createElement('div');
  el.className = 'propRow';
  el.innerHTML = `<div style="background:#0f172a;padding:10px;border-radius:8px;margin-top:10px;border:1px solid var(--line)">
    <b style="color:var(--ac)">🖥️ Tela ${sc.W}×${sc.H}</b>
    <p class="small">${(sc.spec.w / MM).toFixed(1)} × ${(sc.spec.h / MM).toFixed(1)} mm físicos · ${sc.spec.touch ? (sc.spec.touch === 'cap' ? '👆 touch capacitivo multitoque' : '👆 touch resistivo') : 'sem touch'}</p>
    <button class="btn prime" id="btnMag" style="width:100%;margin-top:6px">🔍 Abrir tela ampliada${sc.spec.touch ? ' (com toque)' : ''}</button>
    <button class="btn" id="btnScrReset" style="width:100%;margin-top:6px">↺ Reiniciar tela (firmware demo)</button></div>`;
  box.appendChild(el);
  document.getElementById('btnMag').onclick = () => SCR.openMagnifier(inst);
  document.getElementById('btnScrReset').onclick = () => { sc.user = false; sc.idle = null; sc.rot = 0; sc.backlight = 1; SCR.updateLook(sc); if(powered(inst)) idleDraw(inst); };
};

/* verificação de hardware: displays exigem a peça */
const _ah = window.analyzeHardware;
window.analyzeHardware = function(src){
  const a = _ah(src);
  const want = [];
  if(/ST7789|ILI9341|ILI9488|ST7735|GC9A01|ST7796|SSD1331|SSD1351|TFT_eSPI|tft\.|Adafruit_ST|Adafruit_ILI|Adafruit_GC9|PCD8544|ST7920|u8g2|U8G2|GxEPD|epd\b|EPD\(|M5\.|M5Cell|lgfx|LGFX|lv_/.test(src)) want.push('display');
  if(want.length){
    const scr = BENCH.parts.find(p => p.def.scr);
    if(!scr) a.errors.push('Código usa display/tela, mas nenhuma tela está na bancada — adicione um TFT/OLED/CYD.');
    else if(!powered(scr) && SIM.on && !a.errors.some(e => /sem energia/.test(e))) a.errors.push(scr.def.n + ' sem energia — alimente o módulo (VCC/GND) ou ligue a simulação.');
  }
  return a;
};

/* ---------- o catálogo mudou: reaproveita a lista de paleta ---------- */
try { if(typeof renderPalette === 'function') renderPalette(); if(typeof renderCatalog === 'function') renderCatalog(); } catch(e){}
})();
