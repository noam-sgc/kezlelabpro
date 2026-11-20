/* =========================================================================
   Kezle Lab Pro — Expansão MASSIVA do catálogo (+400 peças)
   Todas as peças entram no solver de circuito (alimentação, sinais, corrente)
   e, quando têm dados, expõem bibliotecas Python/C++ genéricas.
   ========================================================================= */
(function(){
'use strict';
const before = PARTS.length;
const sf0 = window.sensFields, fb0 = window.fmtBadge;
const F = (k, u, base, n, cl) => ({ k, u, base, n, cl });
const t = Date.now();

/* ---------- novos tipos de sensor (campos simulados) ---------- */
const rndw = (a, b) => () => a + (b - a) * (0.5 + 0.5 * Math.sin(Date.now() / 4000));
const EXTRA_SK = {
  uv: () => [F('uv', 'idx', () => clamp(dayLight() * 9, 0, 11.5), .25, [0, 12]), F('mv', 'mV', () => clamp(dayLight() * 900, 0, 1200), 20, [0, 1300])],
  hr: () => [F('bpm', 'bpm', () => 72, 2.2, [45, 160]), F('spo2', '%', () => 97, .4, [85, 100]), F('ir', '', () => 52000, 800, [0, 262143]), F('red', '', () => 48000, 800, [0, 262143])],
  ecg: () => [F('mv', 'mV', () => { const ph = (Date.now() % 850) / 850; return ph < .08 ? 1.2 * Math.sin(ph / .08 * Math.PI) : ph > .28 && ph < .4 ? .25 * Math.sin((ph - .28) / .12 * Math.PI) : 0; }, .02, [-1, 2]), F('bpm', 'bpm', () => 70, 2, [40, 180])],
  mag: () => [F('heading', '°', () => (Date.now() / 600) % 360, 1.2, [0, 360]), F('x', 'µT', () => 22, 1.5), F('y', 'µT', () => -8, 1.5), F('z', 'µT', () => -38, 1.5)],
  flow: () => [F('flow', 'L/min', () => 3 + 2 * Math.sin(Date.now() / 3000), .2, [0, 30]), F('total', 'L', () => (Date.now() - t) / 60000 * 3, 0)],
  thermal: () => [F('min', '°C', () => BASE.t != null ? BASE.t - 2 : 20, .2), F('max', '°C', () => 36.5, .3), F('avg', '°C', () => BASE.t != null ? BASE.t + 1.5 : 26, .2)],
  gps: () => [F('lat', '°', () => LOC.on ? LOC.lat : -23.5505, .00002), F('lon', '°', () => LOC.on ? LOC.lon : -46.6333, .00002), F('alt', 'm', () => LOC.on ? (LOC.alt || 760) : 760, .5), F('speed', 'km/h', () => 0, .15, [0, 200]), F('sats', '', () => 9, .3, [4, 14])],
  color: () => [F('r', '', () => 180, 6, [0, 255]), F('g', '', () => 90, 6, [0, 255]), F('b', '', () => 40, 6, [0, 255]), F('c', '', () => 3000, 40, [0, 65535])],
  pm: () => [F('pm1', 'µg/m³', () => 7, 1, [0, 500]), F('pm25', 'µg/m³', () => 14, 1.6, [0, 600]), F('pm10', 'µg/m³', () => 21, 2, [0, 800])],
  co2: () => [F('co2', 'ppm', () => 520 + 80 * Math.sin(Date.now() / 7000), 12, [400, 5000]), F('temperature', '°C', () => BASE.t != null ? BASE.t : 24, .2), F('humidity', '%', () => BASE.h != null ? BASE.h : 50, 1, [5, 99])],
  pwr: () => [F('vbus', 'V', () => 5.0, .01), F('current', 'mA', () => 120, 4, [0, 3200]), F('power', 'mW', () => 600, 20)],
  adc16: () => [F('ch0', 'V', () => 0, 0), F('ch1', 'V', () => 0, 0), F('ch2', 'V', () => 0, 0), F('ch3', 'V', () => 0, 0)],
  prox: () => [F('prox', '', () => 1200, 60, [0, 65535]), F('lux', 'lx', () => (BASE.lux != null ? BASE.lux : 20000) * dayLight(), 300, [0, 120000])],
  flame: () => [F('flame', '', () => 0, 0), F('ir', '', () => 12, 3, [0, 1023])],
  rfid: () => [F('present', '', () => 0, 0), F('uid', '', () => 0xDEADBEEF, 0)],
  tilt: () => [F('tilt', '', () => 0, 0)],
  rtc: () => [F('temperature', '°C', () => 28, .1)],
  vib: () => [F('vib', '', () => 0, 0)],
  gest: () => [F('gesture', '', () => 0, 0), F('prox', '', () => 120, 5, [0, 255]), F('r', '', () => 120, 4), F('g', '', () => 110, 4), F('b', '', () => 90, 4)]
};
window.sensFields = function(def){ if(def && EXTRA_SK[def.sk]) return EXTRA_SK[def.sk](def); return sf0(def); };
window.fmtBadge = function(p){
  const v = p.state.vals, r = x => Math.round(x * 10) / 10;
  switch(p.def.sk){
    case 'uv': return '☀ UV ' + r(v.uv);
    case 'hr': return '❤ ' + Math.round(v.bpm) + ' bpm · SpO₂ ' + Math.round(v.spo2) + '%';
    case 'ecg': return '🫀 ' + (v.mv || 0).toFixed(2) + ' mV';
    case 'mag': return '🧭 ' + Math.round(v.heading) + '°';
    case 'flow': return '🚰 ' + r(v.flow) + ' L/min';
    case 'thermal': return '🌡 ' + r(v.min) + '…' + r(v.max) + '°C';
    case 'gps': return '🛰 ' + (v.lat || 0).toFixed(4) + ', ' + (v.lon || 0).toFixed(4);
    case 'color': return 'RGB ' + Math.round(v.r) + ',' + Math.round(v.g) + ',' + Math.round(v.b);
    case 'pm': return 'PM2.5 ' + Math.round(v.pm25);
    case 'co2': return 'CO₂ ' + Math.round(v.co2) + ' ppm';
    case 'pwr': return r(v.vbus) + ' V · ' + Math.round(v.current) + ' mA';
    case 'adc16': return 'A0 ' + (v.ch0 || 0).toFixed(2) + ' V';
    case 'prox': return 'prox ' + Math.round(v.prox);
    case 'rfid': return v.present ? '🏷 cartão' : '— sem cartão';
    case 'rtc': return '🕒 ' + new Date().toLocaleTimeString('pt-BR');
    case 'flame': return v.flame ? '🔥 chama' : '— sem chama';
    case 'tilt': return v.tilt ? '↗ inclinado' : '— nivelado';
    case 'vib': return v.vib ? '〰 vibração' : '— parado';
    case 'gest': return 'gesto ' + Math.round(v.gesture || 0);
    case 'touch': return v.touch ? '👆 tocado' : '— livre';
  }
  return fb0(p);
};

/* ---------- construtores ---------- */
function add(d){
  if(PARTMAP[d.id]) return null;
  d.pinNames = d.pinNames || autoPinNames(d);
  d.pins = d.pinNames.length;
  if(!d.w) d.w = Math.max(80, d.pins * 8 + 20);
  if(!d.h) d.h = 58;
  PARTS.push(d); PARTMAP[d.id] = d;
  return d;
}
const I2C = ['VCC', 'GND', 'SCL', 'SDA'], I2CI = ['VCC', 'GND', 'SCL', 'SDA', 'INT'], SPI = ['VCC', 'GND', 'SCK', 'MISO', 'MOSI', 'CS'], ANA = ['VCC', 'GND', 'AO'], ANAD = ['VCC', 'GND', 'DO', 'AO'], DIG = ['VCC', 'OUT', 'GND'], UART = ['VCC', 'GND', 'TX', 'RX'];
const S = (id, n, brand, vcc, pins, sk, o) => add(Object.assign({ id, n, cat: 'sensor', brand, vcc, lib: 'machine', pinNames: pins, sk, iq: 0.006 }, o || {}));
const D = (id, n, brand, vcc, pins, o) => add(Object.assign({ id, n, cat: 'display', brand, vcc, lib: 'machine', pinNames: pins }, o || {}));
const A = (id, n, brand, vcc, pins, kind, o) => add(Object.assign({ id, n, cat: 'act', brand, vcc, lib: 'machine', pinNames: pins, kind }, o || {}));
const IO = (id, n, brand, vcc, pins, kind, o) => add(Object.assign({ id, n, cat: 'io', brand, vcc, lib: 'machine', pinNames: pins, kind }, o || {}));
const C = (id, n, brand, vcc, pins, o) => add(Object.assign({ id, n, cat: 'comm', brand, vcc, lib: 'wifi', pinNames: pins, iq: 0.08 }, o || {}));
const P = (id, n, brand, pins, kind, o) => add(Object.assign({ id, n, cat: 'passive', brand, lib: 'machine', pinNames: pins, kind, w: 50, h: 20 }, o || {}));
const PW = (id, n, brand, pins, kind, o) => add(Object.assign({ id, n, cat: 'power', brand, pinNames: pins, kind, w: 60, h: 50 }, o || {}));

/* ===== SENSORES — temperatura / umidade / pressão ===== */
S('bme688', 'BME688 (VOC+T+U+P)', 'Bosch', 3.3, I2C, 'bme', { i2c: 0x76, desc: 'Gás, temperatura, umidade e pressão' });
S('htu21d', 'HTU21D', 'TE', 3.3, I2C, 'dht', { i2c: 0x40, desc: 'Temp/umidade I2C' });
S('si7021', 'Si7021', 'Silicon Labs', 3.3, I2C, 'dht', { i2c: 0x40 });
S('sht35', 'SHT35', 'Sensirion', 3.3, I2C, 'dht', { i2c: 0x44, desc: '±0.1 °C' });
S('sht45', 'SHT45', 'Sensirion', 3.3, I2C, 'dht', { i2c: 0x44 });
S('hdc1080', 'HDC1080', 'TI', 3.3, I2C, 'dht', { i2c: 0x40 });
S('am2320', 'AM2320', 'Aosong', 3.3, I2C, 'dht', { i2c: 0x5C });
S('am2301', 'AM2301 (DHT21)', 'Aosong', 5, ['VCC', 'DATA', 'GND'], 'dht', { dgpio: 4, vr: 21 });
S('dht12', 'DHT12', 'Aosong', 3.3, I2C, 'dht', { i2c: 0x5C });
S('lps22hb', 'LPS22HB', 'ST', 3.3, I2C, 'bmp', { i2c: 0x5C, desc: 'Barômetro 260-1260 hPa' });
S('lps25h', 'LPS25H', 'ST', 3.3, I2C, 'bmp', { i2c: 0x5D });
S('ms5611', 'MS5611', 'TE', 3.3, I2C, 'bmp', { i2c: 0x77, desc: 'Altímetro de precisão' });
S('bmp180', 'BMP180', 'Bosch', 3.3, I2C, 'bmp', { i2c: 0x77 });
S('bmp388', 'BMP388', 'Bosch', 3.3, I2C, 'bmp', { i2c: 0x77 });
S('bmp390', 'BMP390', 'Bosch', 3.3, I2C, 'bmp', { i2c: 0x77 });
S('dps310', 'DPS310', 'Infineon', 3.3, I2C, 'bmp', { i2c: 0x77 });
S('mcp9808', 'MCP9808', 'Microchip', 3.3, I2C, 'ta', { i2c: 0x18, desc: '±0.25 °C' });
S('tmp102', 'TMP102', 'TI', 3.3, I2C, 'ta', { i2c: 0x48 });
S('tmp117', 'TMP117', 'TI', 3.3, I2C, 'ta', { i2c: 0x48, desc: '±0.1 °C' });
S('lm75', 'LM75', 'TI', 3.3, I2C, 'ta', { i2c: 0x48 });
S('max6675', 'MAX6675 + Termopar K', 'Maxim', 5, ['VCC', 'GND', 'SCK', 'CS', 'SO'], 'ta', { desc: '0–1024 °C' });
S('max31855', 'MAX31855 + Termopar K', 'Maxim', 3.3, ['VIN', 'GND', 'SCK', 'CS', 'DO'], 'ta');
S('max31865', 'MAX31865 + PT100', 'Maxim', 3.3, ['VIN', 'GND', 'SCK', 'MISO', 'MOSI', 'CS'], 'ta');
S('ds18b20_wp', 'DS18B20 à prova d\'água', 'Maxim', 3.3, ['VCC', 'OUT', 'GND'], 't1w', { desc: 'Sonda inox 1 m' });
S('ds1621', 'DS1621', 'Maxim', 3.3, I2C, 'ta', { i2c: 0x48 });
S('lm335', 'LM335', 'TI', 5, ['VCC', 'OUT', 'GND'], 'ta', { desc: '10 mV/K' });
S('tmp36', 'TMP36', 'ADI', 3.3, ['VCC', 'OUT', 'GND'], 'ta', { desc: '10 mV/°C, offset 500 mV' });
S('ntc10k', 'Termistor NTC 10 kΩ', 'Genérico', 3.3, ['A', 'B'], 'ta', { kind: 'ntc', iq: 0, desc: 'Resistivo B=3950' });
S('ntc_mod', 'Módulo NTC (KY-013)', 'Genérico', 5, ['−', 'VCC', 'S'].map((n, i) => ['GND', 'VCC', 'AO'][i]), 'luxA', { desc: 'Divisor com NTC' });
/* ===== luz / UV / cor / proximidade ===== */
S('veml7700', 'VEML7700', 'Vishay', 3.3, I2CI, 'lux', { i2c: 0x10, desc: 'Luz ambiente 120 klx' });
S('opt3001', 'OPT3001', 'TI', 3.3, I2CI, 'lux', { i2c: 0x44 });
S('tsl2591', 'TSL2591', 'AMS', 3.3, I2CI, 'lux', { i2c: 0x29, desc: '600M:1 dinâmica' });
S('max44009', 'MAX44009', 'Maxim', 3.3, I2CI, 'lux', { i2c: 0x4A });
S('ltr390', 'LTR-390 UV', 'Lite-On', 3.3, I2CI, 'uv', { i2c: 0x53, desc: 'UV + luz ambiente' });
S('guva_s12sd', 'GUVA-S12SD UV', 'Genérico', 3.3, ANA, 'uv', { desc: 'UV analógico' });
S('ml8511', 'ML8511 UV', 'LAPIS', 3.3, ANA, 'uv');
S('si1145', 'Si1145 UV/IR', 'Silicon Labs', 3.3, I2C, 'uv', { i2c: 0x60 });
S('apds9960', 'APDS-9960 gesto/cor', 'Broadcom', 3.3, I2CI, 'gest', { i2c: 0x39, desc: 'Gestos, proximidade e cor' });
S('paj7620', 'PAJ7620 gestos', 'PixArt', 3.3, I2CI, 'gest', { i2c: 0x73, desc: '9 gestos' });
S('tcs3200', 'TCS3200 cor', 'AMS', 5, ['VCC', 'GND', 'S0', 'S1', 'S2', 'S3', 'OUT', 'OE'], 'color');
S('as7341', 'AS7341 espectral', 'AMS', 3.3, I2CI, 'color', { i2c: 0x39 });
S('vcnl4040', 'VCNL4040 proximidade', 'Vishay', 3.3, I2CI, 'prox', { i2c: 0x60 });
S('vcnl4010', 'VCNL4010 proximidade', 'Vishay', 3.3, I2CI, 'prox', { i2c: 0x13 });
S('fc51', 'Sensor IR obstáculo FC-51', 'Genérico', 5, ['VCC', 'GND', 'OUT'], 'motion', { desc: 'Digital' });
S('tcrt5000', 'TCRT5000 seguidor de linha', 'Vishay', 5, ANAD, 'prox');
S('flame_ir', 'Sensor de chama IR', 'Genérico', 5, ANAD, 'flame', { desc: 'Detecta chama 760-1100 nm' });
S('photodiode', 'Fotodiodo BPW34', 'Vishay', 5, ['A', 'K'], 'luxA', { iq: 0 });
/* ===== distância / presença ===== */
S('vl53l0x', 'VL53L0X ToF', 'ST', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'XSHUT', 'GPIO1'], 'distTof', { i2c: 0x29, desc: 'Até 2 m' });
S('vl53l1x', 'VL53L1X ToF', 'ST', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'XSHUT', 'GPIO1'], 'distTof', { i2c: 0x29, desc: 'Até 4 m' });
S('vl6180x', 'VL6180X', 'ST', 3.3, I2C, 'distTof', { i2c: 0x29, desc: '0–100 mm + luz' });
S('tfluna', 'TF-Luna LiDAR', 'Benewake', 5, UART, 'distTof', { desc: '8 m UART/I2C' });
S('a02yyuw', 'A02YYUW ultrassom', 'DFRobot', 5, UART, 'dist', { desc: 'À prova d\'água UART' });
S('us100', 'US-100 ultrassônico', 'Genérico', 5, ['VCC', 'TRIG', 'ECHO', 'GND'], 'dist', { w: 86 });
S('gp2y0a21', 'Sharp GP2Y0A21 IR', 'Sharp', 5, ['VCC', 'GND', 'AO'], 'dist', { desc: '10–80 cm analógico' });
S('gp2y0a02', 'Sharp GP2Y0A02 IR', 'Sharp', 5, ['VCC', 'GND', 'AO'], 'dist', { desc: '20–150 cm' });
S('rcwl0516', 'RCWL-0516 radar', 'Genérico', 5, ['VIN', 'OUT', 'GND'], 'motion', { desc: 'Radar Doppler 3 GHz' });
S('ld2410', 'LD2410 mmWave', 'HiLink', 5, ['VCC', 'GND', 'TX', 'RX', 'OUT'], 'motion', { desc: 'Presença 24 GHz' });
S('ld2450', 'LD2450 mmWave', 'HiLink', 5, ['VCC', 'GND', 'TX', 'RX'], 'motion');
S('pir_hcsr501', 'PIR HC-SR501', 'Genérico', 5, ['VCC', 'OUT', 'GND'], 'motion', { desc: 'Infravermelho passivo' });
S('pir_am312', 'PIR AM312', 'Genérico', 3.3, ['VCC', 'OUT', 'GND'], 'motion', { desc: 'Mini PIR 3.3 V' });
/* ===== IMU / bússola ===== */
S('mpu6500', 'MPU6500', 'InvenSense', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'AD0', 'INT'], 'imu', { i2c: 0x68 });
S('icm20948', 'ICM-20948 9 eixos', 'TDK', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'ADO', 'INT'], 'imu', { i2c: 0x69 });
S('icm42688', 'ICM-42688', 'TDK', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'INT'], 'imu', { i2c: 0x68 });
S('lsm9ds1', 'LSM9DS1 9 eixos', 'ST', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'INT1', 'INT2'], 'imu', { i2c: 0x6B });
S('lis2dh12', 'LIS2DH12', 'ST', 3.3, I2CI, 'imu', { i2c: 0x19 });
S('mma8452', 'MMA8452Q', 'NXP', 3.3, I2CI, 'imu', { i2c: 0x1D });
S('adxl335', 'ADXL335 analógico', 'ADI', 3.3, ['VCC', 'GND', 'X', 'Y', 'Z'], 'imu', { desc: '3 eixos analógicos' });
S('adxl362', 'ADXL362', 'ADI', 3.3, SPI, 'imu');
S('bmi160', 'BMI160', 'Bosch', 3.3, I2CI, 'imu', { i2c: 0x69 });
S('bmi270', 'BMI270', 'Bosch', 3.3, I2CI, 'imu', { i2c: 0x68 });
S('hmc5883l', 'HMC5883L bússola', 'Honeywell', 3.3, I2CI, 'mag', { i2c: 0x1E });
S('qmc5883l', 'QMC5883L bússola', 'QST', 3.3, I2CI, 'mag', { i2c: 0x0D });
S('mmc5603', 'MMC5603 magnetômetro', 'Memsic', 3.3, I2C, 'mag', { i2c: 0x30 });
S('lis3mdl', 'LIS3MDL', 'ST', 3.3, I2CI, 'mag', { i2c: 0x1C });
/* ===== gás / ar ===== */
['2:Fumaça/GLP', '3:Álcool', '4:Metano', '5:GLP/gás natural', '6:GLP', '7:Monóxido CO', '8:Hidrogênio', '9:CO/gás inflamável', '135:Qualidade do ar'].forEach(s => { const [n, d] = s.split(':'); S('mq' + n, 'MQ-' + n, 'Hanwei', 5, ANAD, 'gas', { g: n === '7' ? 'CO' : n === '3' ? 'álcool' : 'ar', desc: d }); });
S('ens160', 'ENS160 qualidade do ar', 'ScioSense', 3.3, I2CI, 'co2', { i2c: 0x53 });
S('scd40', 'SCD40 CO₂', 'Sensirion', 3.3, I2C, 'co2', { i2c: 0x62, desc: 'CO₂ fotoacústico' });
S('scd41', 'SCD41 CO₂', 'Sensirion', 3.3, I2C, 'co2', { i2c: 0x62 });
S('mhz19b', 'MH-Z19B CO₂', 'Winsen', 5, ['VIN', 'GND', 'TX', 'RX', 'PWM'], 'co2', { desc: 'NDIR UART/PWM' });
S('mhz14a', 'MH-Z14A CO₂', 'Winsen', 5, ['VIN', 'GND', 'TX', 'RX'], 'co2');
S('pms5003', 'PMS5003 partículas', 'Plantower', 5, ['VCC', 'GND', 'RX', 'TX', 'SET', 'RST'], 'pm', { desc: 'PM1.0/2.5/10' });
S('pms7003', 'PMS7003', 'Plantower', 5, ['VCC', 'GND', 'RX', 'TX'], 'pm');
S('sds011', 'SDS011', 'Nova Fitness', 5, ['5V', 'GND', 'TX', 'RX'], 'pm');
S('sps30', 'SPS30', 'Sensirion', 5, ['VDD', 'RX', 'TX', 'SEL', 'GND'], 'pm');
S('hm3301', 'HM3301 (Grove)', 'Seeed', 5, I2C, 'pm', { i2c: 0x40 });
S('gp2y1010', 'GP2Y1010AU0F poeira', 'Sharp', 5, ['VCC', 'GND', 'AO', 'LED'], 'dust');
S('ze03_o3', 'ZE03 Ozônio', 'Winsen', 5, UART, 'gas', { g: 'ar' });
S('mics5524', 'MiCS-5524', 'SGX', 5, ANA, 'gas', { g: 'CO' });
/* ===== som / toque / magnético ===== */
S('ky038', 'Microfone KY-038', 'Genérico', 5, ANAD, 'snd');
S('max4466', 'Microfone MAX4466', 'Maxim', 3.3, ANA, 'snd', { desc: 'Amp. ajustável' });
S('max9814', 'Microfone MAX9814 AGC', 'Maxim', 3.3, ['VDD', 'GND', 'OUT', 'GAIN', 'AR'], 'snd');
S('inmp441', 'Microfone I2S INMP441', 'TDK', 3.3, ['VDD', 'GND', 'SCK', 'WS', 'SD', 'L/R'], 'snd');
S('ttp229', 'Teclado capacitivo TTP229 16 teclas', 'Tontek', 3.3, ['VCC', 'GND', 'SCL', 'SDO'], 'touch');
S('mpr121', 'MPR121 12 canais capacitivos', 'NXP', 3.3, I2CI, 'touch', { i2c: 0x5A });
S('hall_a3144', 'Hall A3144', 'Allegro', 5, DIG, 'hall');
S('hall_ss49e', 'Hall linear SS49E', 'Honeywell', 5, DIG, 'hall');
S('hall_ky003', 'Hall KY-003', 'Genérico', 5, ['−', 'VCC', 'S'].map((n, i) => ['GND', 'VCC', 'OUT'][i]), 'hall');
S('reed', 'Reed switch (ampola)', 'Genérico', 5, ['A', 'B'], 'hall', { kind: 'sw', iq: 0 });
S('tilt_sw520', 'Tilt SW-520D', 'Genérico', 5, ['VCC', 'OUT', 'GND'], 'tilt');
S('vib_sw420', 'Vibração SW-420', 'Genérico', 5, ['VCC', 'GND', 'DO', 'AO'].slice(0, 3), 'vib');
/* ===== corrente / tensão / ADC ===== */
S('ina219', 'INA219 corrente/tensão', 'TI', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'VIN+', 'VIN−'], 'pwr', { i2c: 0x40 });
S('ina226', 'INA226', 'TI', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'ALERT', 'VIN+', 'VIN−'], 'pwr', { i2c: 0x40 });
S('ina260', 'INA260', 'TI', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'ALERT', 'IN+', 'IN−'], 'pwr', { i2c: 0x40 });
S('ina3221', 'INA3221 3 canais', 'TI', 3.3, I2C, 'pwr', { i2c: 0x40 });
S('acs712_5', 'ACS712 5 A', 'Allegro', 5, ANA, 'curr', { desc: '185 mV/A' });
S('acs712_20', 'ACS712 20 A', 'Allegro', 5, ANA, 'curr');
S('acs712_30', 'ACS712 30 A', 'Allegro', 5, ANA, 'curr');
S('zmpt101b', 'ZMPT101B tensão AC', 'Genérico', 5, ANA, 'volt');
S('pzem004t', 'PZEM-004T v3 energia AC', 'Peacefair', 5, UART, 'pwr', { desc: 'V, A, W, kWh' });
S('sct013', 'SCT-013 + condicionador', 'YHDC', 3.3, ANA, 'curr');
S('ads1115', 'ADS1115 ADC 16 bits', 'TI', 3.3, ['VDD', 'GND', 'SCL', 'SDA', 'ADDR', 'ALRT', 'A0', 'A1', 'A2', 'A3'], 'adc16', { i2c: 0x48, desc: '4 canais — lê tensão REAL do circuito' });
S('ads1015', 'ADS1015 ADC 12 bits', 'TI', 3.3, ['VDD', 'GND', 'SCL', 'SDA', 'ADDR', 'ALRT', 'A0', 'A1', 'A2', 'A3'], 'adc16', { i2c: 0x48 });
S('max471', 'MAX471 corrente', 'Maxim', 5, ['VCC', 'GND', 'VT', 'AT'], 'curr');
S('voltdiv', 'Divisor de tensão 0–25 V', 'Genérico', 3.3, ['S', 'GND', 'VIN+'].map((n, i) => ['AO', 'GND', 'VCC'][i]), 'volt');
/* ===== água / solo ===== */
S('yfs201', 'Fluxo de água YF-S201', 'Genérico', 5, ['VCC', 'OUT', 'GND'], 'flow', { desc: '1–30 L/min' });
S('turbidity', 'Turbidez SEN0189', 'DFRobot', 5, ANA, 'tds');
S('ec_sensor', 'Condutividade EC', 'DFRobot', 5, ANA, 'tds');
S('soil_cap', 'Umidade solo capacitivo v1.2', 'Genérico', 3.3, ANA, 'soil');
S('soil_npk', 'Solo NPK (RS485)', 'Genérico', 12, ['VCC', 'GND', 'A', 'B'], 'soil');
S('rain_gauge', 'Pluviômetro basculante', 'Genérico', 3.3, ['A', 'B'], 'rain', { kind: 'sw', iq: 0 });
S('anemometer', 'Anemômetro (reed)', 'Genérico', 3.3, ['A', 'B'], 'flow', { kind: 'sw', iq: 0 });
/* ===== GPS / tempo / RFID / bio ===== */
S('neo6m', 'GPS NEO-6M', 'u-blox', 3.3, ['VCC', 'GND', 'TXD', 'RXD', 'PPS'], 'gps', { desc: 'Usa a localização do simulador' });
S('neo_m8n', 'GPS NEO-M8N', 'u-blox', 3.3, ['VCC', 'GND', 'TXD', 'RXD', 'PPS'], 'gps');
S('atgm336h', 'GPS ATGM336H', 'Zhongke', 3.3, ['VCC', 'GND', 'TXD', 'RXD'], 'gps');
S('bn220', 'GPS BN-220', 'Beitian', 3.3, ['VCC', 'GND', 'TXD', 'RXD'], 'gps');
S('ds3231', 'RTC DS3231', 'Maxim', 3.3, ['VCC', 'GND', 'SCL', 'SDA', '32K', 'SQW'], 'rtc', { i2c: 0x68, desc: 'Relógio de precisão ±2 ppm' });
S('ds1307', 'RTC DS1307', 'Maxim', 5, ['VCC', 'GND', 'SCL', 'SDA', 'SQW'], 'rtc', { i2c: 0x68 });
S('pcf8523', 'RTC PCF8523', 'NXP', 3.3, I2C, 'rtc', { i2c: 0x68 });
S('rc522', 'RFID RC522', 'NXP', 3.3, ['VCC', 'GND', 'SCK', 'MISO', 'MOSI', 'SDA', 'RST', 'IRQ'], 'rfid', { desc: 'Clique no ícone para aproximar cartão' });
S('pn532', 'NFC PN532', 'NXP', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'IRQ', 'RST'], 'rfid', { i2c: 0x24 });
S('r307', 'Leitor de digital R307', 'Genérico', 5, UART, 'rfid');
S('max30102', 'MAX30102 pulso/SpO₂', 'Maxim', 3.3, ['VIN', 'GND', 'SCL', 'SDA', 'INT'], 'hr', { i2c: 0x57 });
S('max30100', 'MAX30100 pulso/SpO₂', 'Maxim', 3.3, ['VIN', 'GND', 'SCL', 'SDA', 'INT'], 'hr', { i2c: 0x57 });
S('ad8232', 'AD8232 ECG', 'ADI', 3.3, ['3.3V', 'GND', 'OUTPUT', 'LO−', 'LO+', 'SDN'].map((n, i) => ['VCC', 'GND', 'AO', 'LO-', 'LO+', 'SDN'][i]), 'ecg');
S('mlx90640', 'MLX90640 câmera térmica 32×24', 'Melexis', 3.3, I2C, 'thermal', { i2c: 0x33 });
S('amg8833', 'AMG8833 térmica 8×8', 'Panasonic', 3.3, I2CI, 'thermal', { i2c: 0x69 });
S('ov7670', 'Câmera OV7670', 'OmniVision', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'VS', 'HS', 'PCLK', 'XCLK', 'D0', 'D1'], 'prox');

/* ===== DISPLAYS (caracteres / segmentos / matriz) ===== */
D('lcd1602_blue', 'LCD 16×2 (azul) I2C', 'HD44780', 5, I2C, { kind: 'lcd', i2c: 0x27, cols: 16, rows: 2, w: 288, h: 130, iq: 0.03 });
D('lcd1604', 'LCD 16×4 I2C', 'HD44780', 5, I2C, { kind: 'lcd', i2c: 0x27, cols: 16, rows: 4, w: 288, h: 180, iq: 0.03 });
D('lcd2002', 'LCD 20×2 I2C', 'HD44780', 5, I2C, { kind: 'lcd', i2c: 0x27, cols: 20, rows: 2, w: 330, h: 130, iq: 0.03 });
D('lcd0802', 'LCD 8×2 I2C', 'HD44780', 5, I2C, { kind: 'lcd', i2c: 0x27, cols: 8, rows: 2, w: 200, h: 120, iq: 0.02 });
D('seg7_4', '7 segmentos 4 dígitos (multiplex)', 'Genérico', 5, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP', 'D1', 'D2', 'D3', 'D4'], { kind: 'seg4', w: 140, h: 70 });
D('ht16k33_seg', 'HT16K33 7 seg. 4 dígitos I2C', 'Holtek', 5, I2C, { kind: 'seg4', i2c: 0x70, w: 140, h: 70 });
D('tm1638', 'TM1638 8 dígitos + teclas', 'Titan', 5, ['VCC', 'GND', 'STB', 'CLK', 'DIO'], { kind: 'seg4', w: 190, h: 70 });
D('max7219_4', 'MAX7219 matriz 8×32 (4 em 1)', 'Maxim', 5, ['VCC', 'GND', 'DIN', 'CS', 'CLK'], { kind: 'matrix', w: 240, h: 70 });
D('ht16k33_matrix', 'HT16K33 matriz 8×8 I2C', 'Holtek', 5, I2C, { kind: 'matrix', i2c: 0x70, w: 110, h: 110 });
D('led_bar10', 'Barra de LEDs 10 segmentos', 'Genérico', 5, ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'K'], { kind: 'matrix', w: 130, h: 40 });
D('nixie_clock', 'Display VFD 16 caracteres', 'Noritake', 5, ['VCC', 'GND', 'SCK', 'MOSI', 'CS'], { kind: 'lcd', cols: 16, rows: 1, w: 260, h: 70 });

/* ===== ATUADORES / SAÍDAS ===== */
['3mm:3 mm', '10mm:10 mm', 'white:Branco', 'blue:Azul', 'green:Verde', 'yellow:Amarelo', 'uv:Ultravioleta', 'ir:Infravermelho'].forEach(s => { const [k, nm] = s.split(':'); A('led_' + k, 'LED ' + nm, 'Genérico', 2, ['A', 'K'], 'led', { w: 64, h: 52, defaults: { color: { white: '#ffffff', blue: '#3b82f6', green: '#22c55e', yellow: '#fbbf24', uv: '#a855f7', ir: '#7f1d1d' }[k] || '#ff3b30' } }); });
A('laser_ky008', 'Laser KY-008 650 nm', 'Genérico', 5, ['S', 'VCC', 'GND'].map((n, i) => ['SIG', 'VCC', 'GND'][i]), 'led', { w: 64, h: 52, defaults: { color: '#ff0000' }, loadOnly: true });
A('ws2812_30', 'Fita WS2812B 30 LEDs', 'Worldsemi', 5, ['DIN', 'GND', 'VCC'], 'strip', { leds: 30, w: 320, h: 30, dgpio: 16 });
A('ws2812_ring24', 'NeoPixel Ring 24', 'Adafruit', 5, ['DIN', 'GND', 'VCC'], 'strip', { leds: 24, w: 100, h: 100, dgpio: 16 });
A('ws2812_16', 'NeoPixel Stick 16', 'Adafruit', 5, ['DIN', 'GND', 'VCC'], 'strip', { leds: 16, w: 250, h: 30, dgpio: 16 });
A('ws2812_256', 'NeoPixel Matrix 16×16', 'Adafruit', 5, ['DIN', 'GND', 'VCC'], 'strip', { leds: 256, w: 160, h: 160, dgpio: 16 });
A('sk6812_rgbw', 'SK6812 RGBW ×8', 'Worldsemi', 5, ['DIN', 'GND', 'VCC'], 'strip', { leds: 8, w: 186, h: 30, dgpio: 16 });
A('apa102', 'APA102 DotStar ×8', 'Adafruit', 5, ['DI', 'CI', 'GND', 'VCC'], 'strip', { leds: 8, w: 186, h: 30 });
A('buzz_piezo', 'Piezo disco', 'Genérico', 5, ['+', '−'], 'buzzer', { w: 64, h: 52, dgpio: 14 });
A('buzz_mod', 'Módulo buzzer KY-012', 'Genérico', 5, ['SIG', 'VCC', 'GND'], 'buzzer', { w: 72, h: 52, dgpio: 14, modBuzz: true });
A('speaker_3w', 'Alto-falante 3 W 4 Ω', 'Genérico', 5, ['+', '−'], 'buzzer', { w: 80, h: 80, dgpio: 26 });
A('dfplayer', 'DFPlayer Mini MP3', 'DFRobot', 5, ['VCC', 'RX', 'TX', 'DACR', 'DACL', 'SPK1', 'GND', 'SPK2'], 'buzzer', { w: 100, h: 70, modBuzz: true, desc: 'Cartão SD + amplificador' });
A('max98357', 'Amplificador I2S MAX98357A', 'Maxim', 5, ['VIN', 'GND', 'SD', 'GAIN', 'DIN', 'BCLK', 'LRC'], 'buzzer', { w: 90, h: 60, modBuzz: true });
A('pam8403', 'Amplificador PAM8403 3 W', 'Diodes', 5, ['VCC', 'GND', 'L', 'R', 'SPK+', 'SPK−'], 'buzzer', { w: 90, h: 60, modBuzz: true });
// motores
A('n20_motor', 'Motor N20 com redução', 'Genérico', 6, ['+', '−'], 'motor', { w: 90, h: 40, motor: { Vn: 6, rpm: 300, Istall: 0.6, I0: 0.04, tau: 0.15 } });
A('motor_130', 'Motor DC 130 (3–6 V)', 'Mabuchi', 6, ['+', '−'], 'motor', { w: 80, h: 50, motor: { Vn: 6, rpm: 12000, Istall: 1.5, I0: 0.15, tau: 0.1 } });
A('motor_370', 'Motor DC 370 12 V', 'Genérico', 12, ['+', '−'], 'motor', { w: 90, h: 60, motor: { Vn: 12, rpm: 8000, Istall: 3, I0: 0.25, tau: 0.2 } });
A('motor_775', 'Motor DC 775 24 V', 'Genérico', 24, ['+', '−'], 'motor', { w: 100, h: 70, motor: { Vn: 24, rpm: 10000, Istall: 12, I0: 0.8, tau: 0.3 } });
A('motor_tt', 'Motor TT (robô) 6 V', 'Genérico', 6, ['+', '−'], 'motor', { w: 90, h: 60, motor: { Vn: 6, rpm: 200, Istall: 0.8, I0: 0.1, tau: 0.15 } });
A('fan12v', 'Cooler 12 V 80 mm', 'Genérico', 12, ['+', '−'], 'fan', { w: 90, h: 90, motor: { Vn: 12, rpm: 2800, Istall: 0.5, I0: 0.2, tau: 0.5 } });
A('fan_blower', 'Soprador 5015 12 V', 'Genérico', 12, ['+', '−'], 'fan', { w: 90, h: 80, motor: { Vn: 12, rpm: 5500, Istall: 0.4, I0: 0.15, tau: 0.4 } });
A('pump_5v', 'Bomba d\'água 5 V', 'Genérico', 5, ['+', '−'], 'motor', { w: 90, h: 50, motor: { Vn: 5, rpm: 6000, Istall: 0.8, I0: 0.25, tau: 0.2 } });
A('pump_12v', 'Bomba d\'água 12 V', 'Genérico', 12, ['+', '−'], 'motor', { w: 100, h: 60, motor: { Vn: 12, rpm: 5000, Istall: 1.5, I0: 0.4, tau: 0.3 } });
A('pump_peristaltic', 'Bomba peristáltica 12 V', 'Genérico', 12, ['+', '−'], 'motor', { w: 100, h: 70, motor: { Vn: 12, rpm: 120, Istall: 0.6, I0: 0.1, tau: 0.3 } });
A('bldc_drone', 'Motor brushless 2212 + ESC', 'Genérico', 11.1, ['SIG', 'VCC', 'GND'], 'servo', { w: 100, h: 70, desc: 'ESC: pulso 1000–2000 µs' });
A('servo_mg90s', 'Servo MG90S', 'TowerPro', 5, ['SIG', 'VCC', 'GND'], 'servo', { w: 90, h: 56, dgpio: 13 });
A('servo_ds3218', 'Servo DS3218 20 kg', 'DSServo', 6, ['SIG', 'VCC', 'GND'], 'servo', { w: 120, h: 76, dgpio: 13 });
A('servo_fs90r', 'Servo rotação contínua FS90R', 'Feetech', 5, ['SIG', 'VCC', 'GND'], 'servo', { w: 90, h: 56, dgpio: 13 });
A('servo_sg90_pro', 'Servo 9g Metal', 'Genérico', 5, ['SIG', 'VCC', 'GND'], 'servo', { w: 90, h: 56, dgpio: 13 });
A('nema11', 'Motor de passo NEMA 11', 'Genérico', 12, ['A+', 'A−', 'B+', 'B−'], 'stepper', { w: 90, h: 60, desc: '1.8°/passo' });
A('nema14', 'Motor de passo NEMA 14', 'Genérico', 12, ['A+', 'A−', 'B+', 'B−'], 'stepper', { w: 96, h: 64 });
A('stepper_gearless', 'Motor de passo 28BYJ-48 12 V', 'Genérico', 12, ['IN1', 'IN2', 'IN3', 'IN4', '+12V'], 'stepper', { w: 96, h: 60 });
// drivers de motor (ponte H) e MOSFET
const HB = (id, n, brand, vlog, pins, o) => A(id, n, brand, vlog, pins, 'hbridge', Object.assign({ w: 120, h: 80, hb: true }, o || {}));
HB('l298n', 'Driver L298N (2 canais)', 'ST', 5, ['ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB', 'OUT1', 'OUT2', 'OUT3', 'OUT4', 'VS', 'GND', 'V5'], { w: 150, h: 100, ch: [['ENA', 'IN1', 'IN2', 'OUT1', 'OUT2'], ['ENB', 'IN3', 'IN4', 'OUT3', 'OUT4']], drop: 1.8, desc: 'Ponte H dupla 2 A' });
HB('l293d', 'Driver L293D', 'TI', 5, ['EN1', 'IN1', 'IN2', 'IN3', 'IN4', 'EN2', 'OUT1', 'OUT2', 'OUT3', 'OUT4', 'VS', 'GND', 'VCC'], { ch: [['EN1', 'IN1', 'IN2', 'OUT1', 'OUT2'], ['EN2', 'IN3', 'IN4', 'OUT3', 'OUT4']], drop: 1.4, desc: 'Ponte H dupla 600 mA' });
HB('tb6612', 'Driver TB6612FNG', 'Toshiba', 3.3, ['PWMA', 'AIN1', 'AIN2', 'AO1', 'AO2', 'PWMB', 'BIN1', 'BIN2', 'BO1', 'BO2', 'VM', 'GND', 'VCC', 'STBY'], { ch: [['PWMA', 'AIN1', 'AIN2', 'AO1', 'AO2'], ['PWMB', 'BIN1', 'BIN2', 'BO1', 'BO2']], drop: 0.3, desc: '1.2 A por canal' });
HB('drv8833', 'Driver DRV8833', 'TI', 3.3, ['AIN1', 'AIN2', 'AOUT1', 'AOUT2', 'BIN1', 'BIN2', 'BOUT1', 'BOUT2', 'VM', 'GND', 'SLP'], { ch: [[null, 'AIN1', 'AIN2', 'AOUT1', 'AOUT2'], [null, 'BIN1', 'BIN2', 'BOUT1', 'BOUT2']], drop: 0.3 });
HB('bts7960', 'Driver BTS7960 43 A', 'Infineon', 5, ['RPWM', 'LPWM', 'R_EN', 'L_EN', 'VCC', 'GND', 'M+', 'M−', 'B+', 'B−'], { ch: [], drop: 0.2, bts: true, desc: 'Ponte H de alta corrente' });
HB('l9110', 'Driver L9110S', 'Genérico', 5, ['VCC', 'GND', 'IA', 'IB', 'OA', 'OB'].map((n, i) => ['VS', 'GND', 'IN1', 'IN2', 'OUT1', 'OUT2'][i]), { ch: [[null, 'IN1', 'IN2', 'OUT1', 'OUT2']], drop: 0.5 });
A('mosfet_mod', 'Módulo MOSFET IRF520', 'Genérico', 5, ['SIG', 'VCC', 'GND', 'V+', 'V−'], 'mosmod', { w: 90, h: 60, desc: 'Chave de carga até 24 V' });
A('uln2003', 'Driver ULN2003 (7 canais)', 'ST', 5, ['IN1', 'IN2', 'IN3', 'IN4', 'IN5', 'IN6', 'IN7', 'GND', 'COM', 'OUT7', 'OUT6', 'OUT5', 'OUT4', 'OUT3', 'OUT2', 'OUT1'], 'uln', { w: 140, h: 70 });
A('a4988', 'Driver A4988 (módulo)', 'Allegro', 5, ['EN', 'MS1', 'MS2', 'MS3', 'RST', 'SLP', 'STEP', 'DIR', 'VMOT', 'GND', '2B', '2A', '1A', '1B', 'VDD', 'GND2'], 'stepper', { w: 130, h: 70 });
A('drv8825', 'Driver DRV8825 (módulo)', 'TI', 5, ['EN', 'M0', 'M1', 'M2', 'RST', 'SLP', 'STEP', 'DIR', 'VMOT', 'GND', 'B2', 'B1', 'A1', 'A2', 'FLT', 'GND2'], 'stepper', { w: 130, h: 70 });
A('tmc2209', 'Driver TMC2209 (módulo)', 'Trinamic', 5, ['EN', 'MS1', 'MS2', 'PDN', 'CLK', 'STEP', 'DIR', 'VM', 'GND', '2B', '2A', '1A', '1B', 'VIO'], 'stepper', { w: 130, h: 70 });
// relés / cargas
['1:1 canal', '2:2 canais', '4:4 canais', '8:8 canais'].forEach(s => { const [n, d] = s.split(':'); const ch = +n; const pins = []; for(let i = 1; i <= ch; i++) pins.push('IN' + i); pins.push('VCC', 'GND'); for(let i = 1; i <= ch; i++) pins.push('COM' + i, 'NO' + i, 'NC' + i); A('relay_mod' + n, 'Módulo relé ' + d + ' (5 V)', 'Songle', 5, pins, 'relayN', { w: Math.max(110, 40 + ch * 42), h: 90, channelsN: ch }); });
A('ssr_25da', 'Relé de estado sólido SSR-25DA', 'Fotek', 5, ['IN+', 'IN−', 'LOAD1', 'LOAD2'], 'ssr', { w: 90, h: 70 });
A('valve_12v', 'Válvula solenoide 12 V', 'Genérico', 12, ['+', '−'], 'relay', { w: 90, h: 70, id2: 'solenoid' });
A('heater_12v', 'Resistência aquecedora 12 V 40 W', 'Genérico', 12, ['+', '−'], 'relay', { w: 90, h: 50, id2: 'peltier', loadR: 3.6 });
A('electromagnet', 'Eletroímã 12 V', 'Genérico', 12, ['+', '−'], 'relay', { w: 80, h: 60, id2: 'solenoid', loadR: 24 });
A('vib_coin', 'Motor de vibração (moeda)', 'Genérico', 3, ['+', '−'], 'motor', { w: 60, h: 50, motor: { Vn: 3, rpm: 12000, Istall: 0.1, I0: 0.06, tau: 0.08 } });

/* ===== ENTRADAS / CONTROLES ===== */
IO('btn_12mm', 'Push button 12 mm', 'Genérico', 3.3, ['A1', 'A2', 'B1', 'B2'], 'btn', { w: 60, h: 52, dgpio: 0 });
IO('btn_arcade', 'Botão arcade 30 mm', 'Sanwa', 3.3, ['A1', 'A2', 'B1', 'B2'], 'btn', { w: 72, h: 72, dgpio: 0 });
IO('btn_estop', 'Botão de emergência', 'Genérico', 24, ['NC1', 'NC2', 'NO1', 'NO2'], 'btn', { w: 76, h: 76 });
IO('toggle_spdt', 'Chave alavanca SPDT', 'Genérico', 3.3, ['COM', 'NO', 'NC'], 'sw', { w: 60, h: 50 });
IO('rocker', 'Chave gangorra (liga/desliga)', 'Genérico', 12, ['COM', 'NO', 'NC'], 'sw', { w: 60, h: 50 });
IO('slide_spdt', 'Chave deslizante SPDT', 'Genérico', 3.3, ['COM', 'NO', 'NC'], 'sw', { w: 56, h: 44 });
IO('dip8', 'DIP switch ×8', 'Genérico', 3.3, ['1', '2', '3', '4', '5', '6', '7', '8'], 'dip', { w: 70, h: 48 });
IO('pot_1k', 'Potenciômetro 1 kΩ', 'Bourns', 3.3, ['VCC', 'SIG', 'GND'], 'pot', { w: 52, h: 52, dgpio: 34, defaults: { rtotal: 1000 } });
IO('pot_100k', 'Potenciômetro 100 kΩ', 'Bourns', 3.3, ['VCC', 'SIG', 'GND'], 'pot', { w: 52, h: 52, dgpio: 34, defaults: { rtotal: 100000 } });
IO('pot_trim', 'Trimpot 3296 (10 kΩ)', 'Bourns', 3.3, ['VCC', 'SIG', 'GND'], 'pot', { w: 44, h: 36, dgpio: 34 });
IO('pot_slide_10k', 'Potenciômetro deslizante 10 kΩ', 'Alps', 3.3, ['VCC', 'SIG', 'GND'], 'pot', { w: 100, h: 40, dgpio: 34, slider: true });
IO('rheostat_100', 'Reostato 100 Ω', 'Genérico', 5, ['VCC', 'SIG', 'GND'], 'pot', { w: 56, h: 56, defaults: { rtotal: 100 } });
IO('joy_ps2', 'Joystick PS2 (thumbstick)', 'Genérico', 5, ['VRx', 'VRy', 'SW', 'VCC', 'GND'], 'joy', { w: 70, h: 64 });
IO('encoder_ec11', 'Encoder rotativo com botão', 'Alps', 5, ['CLK', 'DT', 'SW', 'VCC', 'GND'], 'enc', { w: 60, h: 56 });
IO('keypad_3x4', 'Teclado matricial 3×4', 'Genérico', 5, ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'], 'key', { w: 104, h: 120 });
IO('ir_receiver', 'Receptor IR VS1838B', 'Vishay', 5, ['OUT', 'GND', 'VCC'], 'sw', { w: 56, h: 52, irRx: true, iq: 0.004, desc: 'Clique para simular controle remoto' });

/* ===== COMUNICAÇÃO ===== */
C('esp01', 'ESP-01 (ESP8266)', 'AI-Thinker', 3.3, ['GND', 'TX', 'GPIO2', 'CH_PD', 'GPIO0', 'RST', 'VCC', 'RX'], { w: 100, h: 60 });
C('hc05', 'Bluetooth HC-05', 'ITead', 5, ['EN', 'VCC', 'GND', 'TXD', 'RXD', 'STATE'], { w: 90, h: 60 });
C('hc06', 'Bluetooth HC-06', 'ITead', 5, ['VCC', 'GND', 'TXD', 'RXD'], { w: 90, h: 60 });
C('hm10', 'BLE HM-10', 'JNHuaMao', 3.3, ['STATE', 'RXD', 'TXD', 'GND', 'VCC', 'EN'], { w: 90, h: 60 });
C('nrf24', 'Rádio nRF24L01', 'Nordic', 3.3, ['GND', 'VCC', 'CE', 'CSN', 'SCK', 'MOSI', 'MISO', 'IRQ'], { w: 90, h: 70 });
C('nrf24_pa', 'nRF24L01+PA+LNA', 'Nordic', 3.3, ['GND', 'VCC', 'CE', 'CSN', 'SCK', 'MOSI', 'MISO', 'IRQ'], { w: 120, h: 70 });
C('sx1276', 'LoRa SX1276 (RFM95)', 'Semtech', 3.3, ['3V3', 'GND', 'SCK', 'MISO', 'MOSI', 'NSS', 'RST', 'DIO0'], { w: 100, h: 70 });
C('ra02', 'LoRa Ra-02 SX1278', 'AI-Thinker', 3.3, ['3V3', 'GND', 'SCK', 'MISO', 'MOSI', 'NSS', 'RST', 'DIO0'], { w: 100, h: 70 });
C('e32_lora', 'LoRa E32-433T30D', 'Ebyte', 5, ['M0', 'M1', 'RXD', 'TXD', 'AUX', 'VCC', 'GND'], { w: 110, h: 70 });
C('cc1101', 'Rádio CC1101 sub-GHz', 'TI', 3.3, ['VCC', 'GND', 'SCK', 'MISO', 'MOSI', 'CSN', 'GDO0', 'GDO2'], { w: 100, h: 70 });
C('rfm69', 'Rádio RFM69HCW', 'HopeRF', 3.3, ['3V3', 'GND', 'SCK', 'MISO', 'MOSI', 'NSS', 'RST', 'DIO0'], { w: 100, h: 70 });
C('rf433_tx', 'Transmissor RF 433 MHz', 'Genérico', 5, ['ATAD', 'VCC', 'GND'], { w: 80, h: 50 });
C('rf433_rx', 'Receptor RF 433 MHz', 'Genérico', 5, ['VCC', 'DATA', 'DATA2', 'GND'], { w: 80, h: 50 });
C('sim800l', 'GSM SIM800L', 'SIMCom', 4, ['VCC', 'GND', 'TXD', 'RXD', 'RST', 'NET'], { w: 100, h: 70 });
C('sim7600', 'LTE SIM7600', 'SIMCom', 5, ['VCC', 'GND', 'TXD', 'RXD', 'PWR'], { w: 110, h: 80 });
C('w5500', 'Ethernet W5500', 'WIZnet', 3.3, ['3V3', 'GND', 'SCK', 'MISO', 'MOSI', 'CS', 'RST', 'INT'], { w: 110, h: 80 });
C('enc28j60', 'Ethernet ENC28J60', 'Microchip', 3.3, ['3V3', 'GND', 'SCK', 'MISO', 'MOSI', 'CS', 'INT', 'RST'], { w: 110, h: 80 });
C('mcp2515', 'CAN MCP2515 + TJA1050', 'Microchip', 5, ['VCC', 'GND', 'CS', 'SO', 'SI', 'SCK', 'INT', 'CANH', 'CANL'], { w: 110, h: 70 });
C('max485', 'RS-485 MAX485', 'Maxim', 5, ['RO', 'RE', 'DE', 'DI', 'VCC', 'GND', 'A', 'B'], { w: 90, h: 60 });
C('max3232', 'RS-232 MAX3232', 'Maxim', 3.3, ['VCC', 'GND', 'TX', 'RX', 'RTS', 'CTS'], { w: 90, h: 60 });
C('cp2102', 'USB-Serial CP2102', 'Silicon Labs', 3.3, ['3V3', 'GND', 'TXD', 'RXD', '5V', 'DTR'], { w: 90, h: 60 });
C('ch340', 'USB-Serial CH340G', 'WCH', 5, ['VCC', 'GND', 'TXD', 'RXD', 'DTR', '3V3'], { w: 90, h: 60 });
C('ft232', 'USB-Serial FT232RL', 'FTDI', 5, ['GND', 'CTS', 'VCC', 'TXD', 'RXD', 'DTR'], { w: 90, h: 60 });
C('ir_led_tx', 'LED IR transmissor 940 nm', 'Vishay', 3.3, ['A', 'K'], { kind: 'led', w: 64, h: 52, iq: 0, defaults: { color: '#7f1d1d' } });
C('lora_ttn_rak811', 'LoRaWAN RAK811', 'RAKwireless', 3.3, ['VCC', 'GND', 'TX', 'RX', 'RST'], { w: 100, h: 70 });
C('zigbee_cc2530', 'Zigbee CC2530', 'TI', 3.3, ['VCC', 'GND', 'TX', 'RX', 'RST'], { w: 100, h: 70 });
C('sd_card', 'Módulo cartão SD (SPI)', 'Genérico', 5, ['VCC', 'GND', 'MISO', 'MOSI', 'SCK', 'CS'], { w: 100, h: 70, iq: 0.03, lib: 'machine' });
C('microsd_3v3', 'Módulo microSD 3,3 V', 'Adafruit', 3.3, ['3V', 'GND', 'CLK', 'DO', 'DI', 'CS'].map((n, i) => ['VCC', 'GND', 'SCK', 'MISO', 'MOSI', 'CS'][i]), { w: 100, h: 70, iq: 0.03, lib: 'machine' });
C('eeprom_24lc256', 'EEPROM 24LC256', 'Microchip', 3.3, ['A0', 'A1', 'A2', 'GND', 'SDA', 'SCL', 'WP', 'VCC'], { w: 90, h: 50, i2c: 0x50, iq: 0.001, lib: 'machine' });
C('flash_w25q32', 'Flash SPI W25Q32', 'Winbond', 3.3, ['CS', 'DO', 'WP', 'GND', 'DI', 'CLK', 'HOLD', 'VCC'], { w: 90, h: 50, iq: 0.003, lib: 'machine' });
C('mcp23017', 'Expansor GPIO MCP23017', 'Microchip', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'A0', 'A1', 'A2', 'RST', 'INTA', 'INTB'], { w: 110, h: 60, i2c: 0x20, iq: 0.001, lib: 'machine' });
C('pcf8574', 'Expansor I2C PCF8574', 'NXP', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'], { w: 110, h: 60, i2c: 0x20, iq: 0.001, lib: 'machine' });
C('mcp4725', 'DAC MCP4725', 'Microchip', 3.3, ['VCC', 'GND', 'SCL', 'SDA', 'OUT', 'A0'], { w: 90, h: 50, i2c: 0x60, iq: 0.001, lib: 'machine' });
C('mcp3008', 'ADC MCP3008 8 canais', 'Microchip', 3.3, ['VDD', 'VREF', 'AGND', 'CLK', 'DOUT', 'DIN', 'CS', 'DGND', 'CH0', 'CH1', 'CH2', 'CH3'], { w: 110, h: 60, iq: 0.001, lib: 'machine' });
C('pca9685', 'PWM 16 canais PCA9685', 'NXP', 5, ['VCC', 'GND', 'SCL', 'SDA', 'OE', 'V+'], { w: 110, h: 70, i2c: 0x40, iq: 0.01, lib: 'machine' });
C('tca9548a', 'Multiplexador I2C TCA9548A', 'TI', 3.3, ['VIN', 'GND', 'SCL', 'SDA', 'A0', 'A1', 'A2', 'RST'], { w: 100, h: 60, i2c: 0x70, iq: 0.001, lib: 'machine' });
C('bss138_shifter', 'Level shifter 4 canais (BSS138)', 'Genérico', 3.3, ['LV', 'GND', 'HV', 'LV1', 'LV2', 'HV1', 'HV2'].slice(0, 6), { w: 90, h: 50, iq: 0.001, lib: 'machine' });

/* ===== PASSIVOS E SEMICONDUTORES ===== */
['100:100 Ω', '1k:1 kΩ', '4k7:4,7 kΩ', '10k:10 kΩ', '47k:47 kΩ', '100k:100 kΩ', '1M:1 MΩ', '10:10 Ω', '47:47 Ω', '2k2:2,2 kΩ', '330:330 Ω', '470:470 Ω'].forEach(s => { const [k, nm] = s.split(':'); const val = { '100': 100, '1k': 1000, '4k7': 4700, '10k': 10000, '47k': 47000, '100k': 100000, '1M': 1e6, '10': 10, '47': 47, '2k2': 2200, '330': 330, '470': 470 }[k]; P('res_' + k, 'Resistor ' + nm, 'Yageo', ['A', 'B'], 'res', { desc: '¼ W 5%', defaults: { value: val }, w: 50, h: 20 }); });
P('res_1w', 'Resistor 1 W (cerâmico) 10 Ω', 'Genérico', ['A', 'B'], 'res', { defaults: { value: 10, watt: 1 }, desc: '1 W' });
P('res_5w', 'Resistor de potência 5 W 10 Ω', 'Genérico', ['A', 'B'], 'res', { defaults: { value: 10, watt: 5 }, desc: '5 W', w: 60 });
P('shunt_01', 'Shunt 0,1 Ω 1 W', 'Genérico', ['A', 'B'], 'res', { defaults: { value: 0.1, watt: 1 } });
P('cap_electrolytic', 'Capacitor eletrolítico 470 µF', 'Panasonic', ['+', '−'], 'cap', { capModel: true, defaults: { capVal: 470, capUnit: 'µF' } });
P('cap_electro_1000', 'Capacitor eletrolítico 1000 µF', 'Panasonic', ['+', '−'], 'cap', { capModel: true, defaults: { capVal: 1000, capUnit: 'µF' } });
P('cap_ceramic_100n', 'Capacitor cerâmico 100 nF', 'Murata', ['A', 'B'], 'cap', { capModel: true, defaults: { capVal: 100, capUnit: 'nF' } });
P('cap_ceramic_10n', 'Capacitor cerâmico 10 nF', 'Murata', ['A', 'B'], 'cap', { capModel: true, defaults: { capVal: 10, capUnit: 'nF' } });
P('cap_ceramic_22p', 'Capacitor cerâmico 22 pF', 'Murata', ['A', 'B'], 'cap', { capModel: true, defaults: { capVal: 22, capUnit: 'pF' } });
P('cap_tantalum_10u', 'Capacitor tântalo 10 µF', 'Kemet', ['+', '−'], 'cap', { capModel: true, defaults: { capVal: 10, capUnit: 'µF' } });
P('cap_film_1u', 'Capacitor poliéster 1 µF', 'Genérico', ['A', 'B'], 'cap', { capModel: true, defaults: { capVal: 1, capUnit: 'µF' } });
P('ind_100uh', 'Indutor 100 µH', 'Bourns', ['A', 'B'], 'cap', { id2: 'inductor', defaults: { L: 100 } });
P('d1n4148', 'Diodo 1N4148', 'Vishay', ['A', 'K'], 'd', { vf: 0.72, ifm: 0.01, desc: 'Sinal rápido' });
P('d1n5819', 'Diodo Schottky 1N5819', 'ST', ['A', 'K'], 'd', { vf: 0.36, ifm: 0.1, desc: 'Vf ≈ 0,36 V' });
P('d1n5408', 'Diodo 1N5408 3 A', 'Vishay', ['A', 'K'], 'd', { vf: 0.85, ifm: 1 });
P('d_sb560', 'Schottky SB560 5 A', 'Vishay', ['A', 'K'], 'd', { vf: 0.5, ifm: 1 });
P('zener_3v3', 'Zener 3,3 V', 'Vishay', ['A', 'K'], 'd', { desc: 'Regulação 3,3 V' });
P('zener_9v1', 'Zener 9,1 V', 'Vishay', ['A', 'K'], 'd', { desc: 'Regulação 9,1 V' });
P('zener_12v', 'Zener 12 V', 'Vishay', ['A', 'K'], 'd', { desc: 'Regulação 12 V' });
P('tvs_smbj', 'Diodo TVS SMBJ5.0A', 'Littelfuse', ['A', 'K'], 'd', { vf: 0.8, ifm: 0.1 });
P('bridge_rect', 'Ponte retificadora KBP', 'Diodes Inc.', ['AC1', 'AC2', '+', '−'], 'bridge', { w: 60, h: 30 });
[['q2n2222', '2N2222 (NPN)', 'npn', 150], ['q_bc547', 'BC547 (NPN)', 'npn', 300], ['q_bc337', 'BC337 (NPN 800 mA)', 'npn', 250], ['q2n3904', '2N3904 (NPN)', 'npn', 150], ['q2n3906', '2N3906 (PNP)', 'pnp', 120], ['q_bc557', 'BC557 (PNP)', 'pnp', 250], ['q_tip120', 'TIP120 Darlington NPN', 'npn', 1000], ['q_tip122', 'TIP122 Darlington NPN', 'npn', 1000], ['q_tip31c', 'TIP31C (NPN 3 A)', 'npn', 50], ['q_tip42c', 'TIP42C (PNP 6 A)', 'pnp', 50], ['q_2sc1815', '2SC1815', 'npn', 200]].forEach(([id, n, tt, beta]) => P(id, n, 'Genérico', ['B', 'C', 'E'], 'trans', { tt, beta, fixedType: true }));
[['m_irlz44n', 'MOSFET-N IRLZ44N (nível lógico)', 'nmos', 1.8], ['m_2n7000', 'MOSFET-N 2N7000', 'nmos', 2.1], ['m_bs170', 'MOSFET-N BS170', 'nmos', 2.1], ['m_ao3400', 'MOSFET-N AO3400 SMD', 'nmos', 1.2], ['m_ao3401', 'MOSFET-P AO3401 SMD', 'pmos', -1.2], ['m_irf520', 'MOSFET-N IRF520', 'nmos', 3.5], ['m_irfz44n', 'MOSFET-N IRFZ44N', 'nmos', 3.5], ['m_irf4905', 'MOSFET-P IRF4905', 'pmos', -3.5]].forEach(([id, n, tt, vth]) => P(id, n, 'Genérico', ['G', 'D', 'S'], 'trans', { tt, vth, fixedType: true }));
[['lm7812', 'Regulador LM7812', 12, 14.5], ['lm7809', 'Regulador LM7809', 9, 11.5], ['lm7806', 'Regulador LM7806', 6, 8.5], ['lm7803', 'Regulador LM7803 (3,3 V)', 3.3, 5.5], ['ams1117_33', 'Regulador AMS1117-3.3', 3.3, 4.5], ['ams1117_5', 'Regulador AMS1117-5.0', 5, 6.2], ['lm1117_33', 'Regulador LM1117-3.3', 3.3, 4.7], ['mcp1700_33', 'LDO MCP1700-3.3', 3.3, 3.9], ['ld1117_18', 'Regulador LD1117-1.8', 1.8, 3.1]].forEach(([id, n, vout, vmin]) => P(id, n, 'Genérico', ['IN', 'GND', 'OUT'], 'ic', { reg: { vout, vin_min: vmin }, desc: 'Linear ' + vout + ' V' }));
P('lm317', 'Regulador ajustável LM317', 'TI', ['ADJ', 'OUT', 'IN'], 'lm317', { desc: '1,25–37 V' });
P('ne555', 'NE555 timer', 'TI', ['GND', 'TRIG', 'OUT', 'RST', 'CTRL', 'THR', 'DIS', 'VCC'], 'ne555', { w: 60, h: 40, desc: 'Astável/monoestável (RC reais)' });
P('lm358', 'Amp. op. LM358 (dual)', 'TI', ['OUT1', '1−', '1+', 'GND', '2+', '2−', 'OUT2', 'VCC'], 'opamp', { w: 60, h: 40 });
P('lm393', 'Comparador LM393 (dual)', 'TI', ['OUT1', '1−', '1+', 'GND', '2+', '2−', 'OUT2', 'VCC'], 'opamp', { w: 60, h: 40, comp: true });
P('lm324', 'Amp. op. LM324 (quad)', 'TI', ['OUT1', '1−', '1+', 'VCC', '2+', '2−', 'OUT2', 'OUT3', '3−', '3+', 'GND', '4+', '4−', 'OUT4'], 'opamp', { w: 80, h: 40 });
P('tl431', 'Referência TL431', 'TI', ['REF', 'A', 'K'], 'ic', { desc: 'Referência 2,495 V' });
P('hc595', '74HC595 shift register', 'TI', ['QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'GND', 'QH\'', 'SRCLR', 'SRCLK', 'RCLK', 'OE', 'SER', 'QA', 'VCC'], 'ic', { w: 90, h: 40 });
P('hc165', '74HC165 shift register', 'TI', ['PL', 'CP', 'D4', 'D5', 'D6', 'D7', 'Q7N', 'GND', 'Q7', 'DS', 'D0', 'D1', 'D2', 'D3', 'CE', 'VCC'], 'ic', { w: 90, h: 40 });
P('hc14', '74HC14 inversor Schmitt', 'TI', ['1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND', '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC'], 'ic', { w: 80, h: 40 });
P('cd4017', 'CD4017 contador década', 'TI', ['Q5', 'Q1', 'Q0', 'Q2', 'Q6', 'Q7', 'Q3', 'GND', 'Q8', 'Q4', 'Q9', 'CO', 'CKEN', 'CLK', 'RST', 'VCC'], 'ic', { w: 90, h: 40 });
P('cd4051', 'Mux analógico CD4051', 'TI', ['Y4', 'Y6', 'Z', 'Y7', 'Y5', 'INH', 'VEE', 'GND', 'C', 'B', 'A', 'Y3', 'Y0', 'Y1', 'Y2', 'VCC'], 'ic', { w: 90, h: 40 });
P('fuse_1a', 'Fusível 1 A', 'Littelfuse', ['A', 'B'], 'cap', { id2: 'fuse', defaults: { rating: 1 } });
P('fuse_5a', 'Fusível 5 A', 'Littelfuse', ['A', 'B'], 'cap', { id2: 'fuse', defaults: { rating: 5 } });
P('fuse_100ma', 'Fusível 100 mA', 'Littelfuse', ['A', 'B'], 'cap', { id2: 'fuse', defaults: { rating: 0.1 } });
P('ptc_fuse', 'Fusível rearmável PTC 500 mA', 'Bourns', ['A', 'B'], 'cap', { id2: 'fuse', defaults: { rating: 0.5 }, ptc: true });
P('thermistor_ptc', 'Termistor PTC 100 Ω', 'Genérico', ['A', 'B'], 'res', { defaults: { value: 100 } });
P('ferrite', 'Ferrite bead', 'Murata', ['A', 'B'], 'res', { defaults: { value: 0.1 } });
P('jumper_0r', 'Jumper 0 Ω', 'Genérico', ['A', 'B'], 'res', { defaults: { value: 0.01 } });

/* ===== ENERGIA ===== */
PW('b2xaa', 'Suporte 2×AA (3 V)', 'Genérico', ['+', '−'], 'aa', { desc: '3,0 V', srcV: 3.0, srcR: 0.4 });
PW('b3xaa', 'Suporte 3×AA (4,5 V)', 'Genérico', ['+', '−'], 'aa', { srcV: 4.5, srcR: 0.6 });
PW('b4xaa', 'Suporte 4×AA (6 V)', 'Genérico', ['+', '−'], 'aa', { srcV: 6.0, srcR: 0.8 });
PW('b4xaa_rech', 'Suporte 4×AA NiMH (4,8 V)', 'Genérico', ['+', '−'], 'aa', { srcV: 4.8, srcR: 0.3 });
PW('b2x18650', 'Pack 2×18650 (7,4 V)', 'Genérico', ['+', '−'], 'aa', { srcV: 7.4, srcR: 0.16 });
PW('b3x18650', 'Pack 3×18650 (11,1 V)', 'Genérico', ['+', '−'], 'aa', { srcV: 11.1, srcR: 0.24 });
PW('lipo_2s', 'LiPo 2S 7,4 V 2200 mAh', 'Genérico', ['+', '−'], 'aa', { srcV: 7.4, srcR: 0.05 });
PW('lipo_3s', 'LiPo 3S 11,1 V 2200 mAh', 'Genérico', ['+', '−'], 'aa', { srcV: 11.1, srcR: 0.07 });
PW('lead_acid_12v', 'Bateria chumbo-ácido 12 V 7 Ah', 'Genérico', ['+', '−'], 'aa', { srcV: 12.6, srcR: 0.02 });
PW('psu_5v2a', 'Fonte 5 V 2 A (tomada)', 'Genérico', ['+', '−'], 'aa', { srcV: 5.0, srcR: 0.08 });
PW('psu_9v1a', 'Fonte 9 V 1 A', 'Genérico', ['+', '−'], 'aa', { srcV: 9.0, srcR: 0.2 });
PW('psu_12v2a', 'Fonte 12 V 2 A', 'Genérico', ['+', '−'], 'aa', { srcV: 12.0, srcR: 0.1 });
PW('psu_bench', 'Fonte de bancada ajustável 0–30 V', 'Genérico', ['+', '−'], 'aa', { srcV: 5.0, srcR: 0.05, adj: true, desc: 'Ajuste a tensão nas propriedades' });
PW('usb_c_breakout', 'USB-C breakout 5 V', 'Genérico', ['VBUS', 'GND', 'CC1', 'CC2'], 'aa', { srcV: 5.0, srcR: 0.1 });
PW('dc_jack', 'Conector DC 5,5×2,1 mm (12 V)', 'Genérico', ['+', '−'], 'aa', { srcV: 12.0, srcR: 0.1 });
PW('solar_panel_3v', 'Painel solar 3 V 100 mA', 'Genérico', ['+', '−'], 'solar5', { w: 90, h: 70, solarV: 3.6 });
PW('xl6009', 'Boost XL6009 (ajustável)', 'Genérico', ['IN+', 'IN−', 'OUT+', 'OUT−'], 'mt3608', { defaults: { vout: 12 } });
PW('lm2596', 'Buck LM2596 (ajustável)', 'Genérico', ['IN+', 'IN−', 'OUT+', 'OUT−'], 'buck', { defaults: { vout: 5 }, desc: 'Step-down 3 A' });
PW('mp1584', 'Buck MP1584 (mini)', 'Genérico', ['IN+', 'IN−', 'OUT+', 'OUT−'], 'buck', { defaults: { vout: 5 } });
PW('xl4015', 'Buck XL4015 5 A', 'Genérico', ['IN+', 'IN−', 'OUT+', 'OUT−'], 'buck', { defaults: { vout: 12 } });
PW('ip5306', 'Carregador/boost IP5306 (power bank)', 'Genérico', ['BAT+', 'BAT-', 'USB+', 'USB-', '5V+', '5V-'], 'tp4056u');

/* ===== PLACAS (MCUs adicionais) ===== */
function cloneMcu(base, o){
  const b = PARTMAP[base];
  if(!b) return;
  const d = Object.assign({}, b, o);
  delete d._holes; delete d._holes2; delete d._mot;
  if(o.pinNames) d.pins = o.pinNames.length;
  add(d);
}
const M = (id, n, brand, base, o) => cloneMcu(base, Object.assign({ id, n, brand }, o));
M('uno_r4_minima', 'Arduino Uno R4 Minima', 'Arduino', 'uno', { chip: 'RA4M1', core: 'Cortex-M4 48 MHz' });
M('uno_r4_wifi', 'Arduino Uno R4 WiFi', 'Arduino', 'uno', { chip: 'RA4M1+ESP32-S3', core: 'Cortex-M4 + Wi-Fi/BLE', lib: 'wifi' });
M('nano_esp32', 'Arduino Nano ESP32', 'Arduino', 'esp32c3', { chip: 'ESP32-S3', core: 'Dual-core 240 MHz', vcc: 3.3, w: 110, h: 150 });
M('nano33_ble', 'Arduino Nano 33 BLE', 'Arduino', 'nano', { chip: 'nRF52840', vcc: 3.3, core: 'Cortex-M4 64 MHz' });
M('nano_rp2040', 'Arduino Nano RP2040 Connect', 'Arduino', 'nano', { chip: 'RP2040', vcc: 3.3, lib: 'machine' });
M('mkr_wifi1010', 'Arduino MKR WiFi 1010', 'Arduino', 'nano', { chip: 'SAMD21', vcc: 3.3, lib: 'wifi' });
M('due', 'Arduino Due', 'Arduino', 'mega', { chip: 'SAM3X8E', vcc: 3.3, core: 'Cortex-M3 84 MHz' });
M('zero', 'Arduino Zero', 'Arduino', 'nano', { chip: 'SAMD21', vcc: 3.3 });
M('micro', 'Arduino Micro', 'Arduino', 'leonardo', { chip: 'ATmega32U4' });
M('pro_micro', 'Pro Micro (SparkFun)', 'SparkFun', 'leonardo', { chip: 'ATmega32U4', w: 100, h: 130 });
M('esp32_s3_zero', 'ESP32-S3 Zero (Waveshare)', 'Waveshare', 'esp32s3', { w: 100, h: 110, core: 'Mini S3' });
M('esp32_c6', 'ESP32-C6 DevKitC', 'Espressif', 'esp32c3', { chip: 'ESP32-C6', core: 'RISC-V Wi-Fi 6' });
M('esp32_h2', 'ESP32-H2 DevKitM', 'Espressif', 'esp32c3', { chip: 'ESP32-H2', core: 'RISC-V Thread/Zigbee' });
M('lolin32', 'LOLIN32 / WEMOS', 'Wemos', 'esp32', { core: 'ESP32 + bateria LiPo' });
M('d1_mini', 'Wemos D1 mini', 'Wemos', 'nodemcu', { w: 110, h: 140, pinNames: ['RST', 'A0', 'D0', 'D5', 'D6', 'D7', 'D8', '3V3', 'TX', 'RX', 'D1', 'D2', 'D3', 'D4', 'GND', '5V'] });
M('d1_mini_pro', 'Wemos D1 mini Pro', 'Wemos', 'nodemcu', { w: 110, h: 140, pinNames: ['RST', 'A0', 'D0', 'D5', 'D6', 'D7', 'D8', '3V3', 'TX', 'RX', 'D1', 'D2', 'D3', 'D4', 'GND', '5V'] });
M('d1_r32', 'Wemos D1 R32', 'Wemos', 'esp32', { core: 'Formato Uno' });
M('esp12f', 'ESP-12F módulo', 'AI-Thinker', 'nodemcu', { w: 100, h: 110, pinNames: ['RST', 'ADC', 'EN', 'IO16', 'IO14', 'IO12', 'IO13', 'VCC', 'CS0', 'MISO', 'IO9', 'IO10', 'MOSI', 'SCLK', 'GND', 'IO15', 'IO2', 'IO0', 'IO4', 'IO5', 'RXD', 'TXD'] });
M('feather_esp32', 'Adafruit Feather ESP32', 'Adafruit', 'esp32', { core: 'Feather' });
M('feather_rp2040', 'Adafruit Feather RP2040', 'Adafruit', 'pico', { vcc: 3.3 });
M('qtpy_esp32c3', 'Adafruit QT Py ESP32-C3', 'Adafruit', 'xiao_esp32c3', {});
M('xiao_rp2040', 'Seeed XIAO RP2040', 'Seeed', 'xiao_esp32c3', { chip: 'RP2040', vcc: 3.3, lib: 'machine' });
M('xiao_esp32s3', 'Seeed XIAO ESP32-S3', 'Seeed', 'xiao_esp32c3', { chip: 'ESP32-S3' });
M('xiao_samd21', 'Seeed XIAO SAMD21', 'Seeed', 'xiao_esp32c3', { chip: 'SAMD21', lib: 'servo' });
M('xiao_nrf52840', 'Seeed XIAO nRF52840', 'Seeed', 'xiao_esp32c3', { chip: 'nRF52840' });
M('pico_h', 'Raspberry Pi Pico H', 'Raspberry Pi', 'pico', {});
M('pico_wh', 'Raspberry Pi Pico WH', 'Raspberry Pi', 'picow', {});
M('tiny2040', 'Pimoroni Tiny2040', 'Pimoroni', 'rp2040_zero', { vcc: 3.3 });
M('stm32_nucleo_f103', 'STM32 Nucleo-F103RB', 'ST', 'stm32', { chip: 'STM32F103RB' });
M('stm32_nucleo_f401', 'STM32 Nucleo-F401RE', 'ST', 'black_pill', { chip: 'STM32F401RE' });
M('stm32_nucleo_l476', 'STM32 Nucleo-L476RG', 'ST', 'black_pill', { chip: 'STM32L476RG' });
M('stm32_f407_disco', 'STM32F407 Discovery', 'ST', 'black_pill', { chip: 'STM32F407VG', core: 'Cortex-M4F 168 MHz' });
M('teensy31', 'Teensy 3.2', 'PJRC', 'teensy4', { chip: 'MK20DX256', core: 'Cortex-M4 72 MHz' });
M('teensy41', 'Teensy 4.1', 'PJRC', 'teensy4', { chip: 'i.MX RT1062', h: 230 });
M('teensy_lc', 'Teensy LC', 'PJRC', 'teensy4', { chip: 'KL26', core: 'Cortex-M0+ 48 MHz' });
M('ttgo_tbeam', 'TTGO T-Beam (LoRa+GPS)', 'LilyGO', 'esp32', { core: 'ESP32 + SX1276 + NEO-6M' });
M('microbit_v2', 'BBC micro:bit v2', 'BBC', 'nano', { chip: 'nRF52833', vcc: 3.3, lib: 'machine', core: 'Cortex-M4F + BLE' });
M('circuit_playground', 'Circuit Playground Express', 'Adafruit', 'nano', { chip: 'SAMD21', vcc: 3.3, lib: 'machine' });
// placas com tela embutida (OLED/TFT) — reaproveitam o motor de telas
(function(){
  const mk = (id, n, brand, base, scr, o) => {
    const b = PARTMAP[base]; if(!b) return;
    const px = mm => Math.round(mm * 3.6 / 2) * 2;
    const d = Object.assign({}, b, { id, n, brand }, o || {});
    d.scr = Object.assign({}, b.scr || { type: 'tft', touch: null, round: false, ctrl: 'mcu', fg: '#fff', bg: '#000', pcb: '#111' }, scr);
    // só converte mm->px o que veio em mm no override; o que vem da placa base já está em px (antes era multiplicado 2×: tela vazava)
    ['x', 'y', 'w', 'h'].forEach(k => { if(scr && k in scr) d.scr[k] = px(scr[k]); });
    if(o && o.pcb){ d.w = px(o.pcb[0]); d.h = px(o.pcb[1]); }
    delete d._holes; add(d);
  };
  mk('heltec_lora32', 'Heltec WiFi LoRa 32 V3 (OLED)', 'Heltec', 'esp32s3', { x: 5, y: 3, w: 22, h: 11, W: 128, H: 64, type: 'oled', ctrl: 'ssd1306', fg: '#9ad7ff', pcb: '#111827' }, { pcb: [28, 52], core: 'ESP32-S3 + SX1262 + OLED 0.96"', layout: 'bottom', desc: 'LoRa com OLED' });
  mk('ttgo_lora32', 'TTGO LoRa32 OLED', 'LilyGO', 'esp32', { x: 5, y: 3, w: 22, h: 11, W: 128, H: 64, type: 'oled', ctrl: 'ssd1306', fg: '#e8f6ff', pcb: '#1e3a5f' }, { pcb: [28, 52], layout: 'bottom', core: 'ESP32 + SX1276 + OLED' });
  mk('ttgo_tdisplay', 'TTGO T-Display (135×240)', 'LilyGO', 'tdisplay_s3', { W: 135, H: 240, x: 3, y: 7, w: 14.9, h: 25.6, ctrl: 'tdisp' }, { pcb: [25, 51], chip: 'ESP32', core: 'ESP32 + IPS 1.14"' });
  mk('esp32_oled_096', 'ESP32 com OLED 0.96" integrado', 'Genérico', 'esp32', { x: 5, y: 3, w: 22, h: 11, W: 128, H: 64, type: 'oled', ctrl: 'ssd1306', fg: '#e8f6ff', pcb: '#0e2a52' }, { pcb: [28, 52], layout: 'bottom' });
  mk('wio_terminal', 'Seeed Wio Terminal (320×240)', 'Seeed', 'cyd28', { W: 320, H: 240, x: 4, y: 5, w: 40.8, h: 30.6, touch: null, ctrl: 'mcu' }, { pcb: [72, 50], chip: 'ATSAMD51P19', vcc: 3.3, lib: 'machine', core: 'Cortex-M4F + LCD 2.4"' });
  mk('pybadge', 'Adafruit PyBadge (160×128)', 'Adafruit', 'cyd28', { W: 160, H: 128, x: 4, y: 4, w: 28, h: 22, touch: null, ctrl: 'mcu' }, { pcb: [87, 52], chip: 'ATSAMD51J19', vcc: 3.3, lib: 'machine' });
  mk('t_deck', 'LilyGO T-Deck (320×240)', 'LilyGO', 'm5core2', { W: 320, H: 240, x: 5, y: 5, w: 41, h: 31, touch: 'cap', ctrl: 'tdisp' }, { pcb: [100, 70], chip: 'ESP32-S3', core: 'ESP32-S3 + teclado + LoRa' });
  mk('m5stack_tough', 'M5Stack Tough (320×240 touch)', 'M5Stack', 'm5core2', { touch: 'cap' }, { chip: 'ESP32-D0WDQ6-V3' });
  mk('m5stack_paper', 'M5Paper e-Ink touch (540×960)', 'M5Stack', 'm5core2', { W: 540, H: 960, x: 3, y: 3, w: 51, h: 91, type: 'epd', touch: 'cap', ctrl: 'm5', pcb: '#1f2937' }, { pcb: [60, 100], core: 'ESP32 + e-Paper 4.7" GT911', layout: 'bottom' });
  mk('m5_atoms3', 'M5 AtomS3 (128×128)', 'M5Stack', 'm5stick', { W: 128, H: 128, x: 3, y: 3, w: 15, h: 15, ctrl: 'm5', btns: ['A'] }, { pcb: [24, 24], layout: 'bottom', chip: 'ESP32-S3' });
  mk('m5_stamp', 'M5 StickS3 (135×240)', 'M5Stack', 'm5stick', { ctrl: 'm5' }, { chip: 'ESP32-S3' });
  mk('waveshare_43b', 'Waveshare ESP32-S3 4.3" Touch-B', 'Waveshare', 'ws_s3_43', {}, {});
  mk('crowpanel5', 'Elecrow CrowPanel 5.0" (800×480)', 'Elecrow', 'crowpanel7', { x: 4, y: 5, w: 108.7, h: 65.5, W: 800, H: 480 }, { pcb: [128, 82] });
  mk('crowpanel43', 'Elecrow CrowPanel 4.3" (480×272)', 'Elecrow', 'crowpanel7', { x: 4, y: 5, w: 95, h: 54, W: 480, H: 272 }, { pcb: [108, 65] });
  mk('sunton_s3_7', 'Sunton ESP32-S3 7" (800×480)', 'Sunton', 'crowpanel7', {}, {});
  mk('lilygo_tdisplay_amoled', 'LilyGO T-Display S3 AMOLED 1.91"', 'LilyGO', 'tdisplay_s3_touch', { W: 240, H: 536, x: 2, y: 5, w: 17, h: 38, touch: 'cap' }, { pcb: [23, 50] });
  mk('cyd_s3_28', 'ESP32-S3 CYD 2.8" Touch', 'Sunton', 'cyd28', { touch: 'cap' }, { chip: 'ESP32-S3' });
  mk('cyd_24_s022', 'ESP32 CYD 2.4" Touch', 'Sunton', 'cyd28', { W: 240, H: 320, x: 3, y: 6, w: 36.7, h: 48.9 }, { pcb: [42, 71] });
})();
PARTS.forEach(p => { if(!p.pinNames) p.pinNames = autoPinNames(p); });

/* ---------- propriedades padrão por peça (valor do resistor etc.) ---------- */
const _dp = window.defaultProps;
window.defaultProps = function(def){
  const o = _dp(def);
  if(def.defaults) Object.assign(o, def.defaults);
  if(def.kind === 'cap' && def.capModel && !o.capUnit) o.capUnit = 'µF';
  return o;
};

/* ---------- geradores de bibliotecas genéricas (Python e C++) ---------- */
const sensorParts = () => PARTS.filter(p => p.sk && (EXTRA_SK[p.sk] || window.sensFields(p).length));
const _mm = window.makeModules;
window.makeModules = function(){
  const mods = _mm();
  for(const d of sensorParts()){
    const key = d.mod || d.id;
    const baseNames = new Set([d.id, key, key.replace(/_/g, ''), 'adafruit_' + key, 'sparkfun_' + key, 'micropython_' + key]);
    const cls = key.replace(/_/g, '').toUpperCase();
    const classNames = [cls, d.id.toUpperCase(), 'Adafruit_' + cls, d.id.charAt(0).toUpperCase() + d.id.slice(1)];
    const ctor = function(){ return makeGenericSensor(d); };
    for(const nm of baseNames){ if(mods[nm]) continue; mods[nm] = {}; for(const c of classNames) mods[nm][c] = ctor; mods[nm].Sensor = ctor; }
  }
  return mods;
};
function sensorFor(def){
  const live = BENCH.parts.find(p => p.def.id === def.id) || BENCH.parts.find(p => p.def.sk === def.sk);
  return live || null;
}
function makeGenericSensor(def){
  const o = { begin: () => true, init: () => true, read: () => true, measure: () => null, update: () => true, reset: () => 0, sleep: () => 0, wake: () => 0 };
  for(const f of sensFields(def)){
    Object.defineProperty(o, f.k, { enumerable: true, get: () => { const p = sensorFor(def); if(!p || !CIRCUIT.powered(p)) return 0; if(def.sk === 'adc16') return CIRCUIT.pinV(p, p.def.pinNames.indexOf('A' + f.k.slice(2))) - CIRCUIT.pinV(p, p.def.pinNames.indexOf('GND')); const v = p.state.vals[f.k]; return v == null ? 0 : Math.round(v * 100) / 100; } });
    o['get_' + f.k] = () => o[f.k]; o[f.k + '_'] = () => o[f.k];
  }
  return o;
}
// classes C++ genéricas (Adafruit_XXX / XXX) — nomes de método read*/get* resolvem pelo campo
window.KEZLE_CPP_CLASSES = {};
function regCpp(d){
  const cls = (d.mod || d.id).replace(/_/g, '').toUpperCase();
  const factory = function(){
    const base = { begin: () => true, init: () => true, available: () => true, update: () => true, setup: () => 0, reset: () => 0, powerOn: () => 0, startMeasurement: () => 0, dataReady: () => true, readSensor: () => true };
    const fs = sensFields(d);
    return new Proxy(base, { get(t, k){
      if(k in t) return t[k];
      if(typeof k !== 'string') return undefined;
      const stem = k.replace(/^(read|get|measure|sample)_?/i, '').toLowerCase();
      const f = fs.find(x => x.k.toLowerCase() === stem) || fs.find(x => x.k.toLowerCase().startsWith(stem) || stem.startsWith(x.k.toLowerCase())) || fs.find(x => stem && x.k.toLowerCase().includes(stem));
      if(!f) return () => 0;
      return () => { const p = sensorFor(d); if(!p || !CIRCUIT.powered(p)) return 0; let v = p.state.vals[f.k]; if(v == null) v = 0; if(/pressure/i.test(f.k) && /^(readPressure|getPressure)$/.test(k)) v *= 100; return d.sk === 'adc16' ? (CIRCUIT.pinV(p, p.def.pinNames.indexOf('A' + f.k.slice(2))) - CIRCUIT.pinV(p, p.def.pinNames.indexOf('GND'))) : Math.round(v * 100) / 100; };
    } });
  };
  for(const nm of [cls, 'Adafruit_' + cls, (d.mod || d.id).toUpperCase(), 'Sparkfun_' + cls, 'SparkFun_' + cls]) if(/^[A-Za-z_]\w*$/.test(nm)) window.KEZLE_CPP_CLASSES[nm] = factory;
}
sensorParts().forEach(regCpp);
window.KEZLE_REG_CPP = d => { if(d.sk && window.sensFields(d).length) regCpp(d); };

/* ---------- ADS1115: lê a tensão REAL dos pinos A0..A3 ---------- */
const _os = CIRCUIT.onSolve;
CIRCUIT.onSolve = function(){
  for(const p of BENCH.parts){
    if(p.def.sk === 'adc16' && SIM.on){
      const g = CIRCUIT.pinVByName(p, 'GND');
      for(let i = 0; i < 4; i++) p.state.vals['ch' + i] = CIRCUIT.pinVByName(p, 'A' + i) - g;
    }
    if(p.def.sk === 'rfid' && p.state.pressed !== undefined) p.state.vals.present = p.state.pressed ? 1 : 0;
  }
  if(_os) _os();
};

/* interação: RFID/IR/botão da chama etc. — o controle genérico do bench.js trata touch/motion; aqui adicionamos clique para RFID, chama, vibração, tilt */
const _bc = window.postPart;
window.postPart = function(inst, div){
  _bc(inst, div);
  const d = inst.def, st = inst.state, wrap = inst.wrap || div;
  if(['rfid', 'flame', 'tilt', 'vib', 'hr', 'gest', 'prox'].includes(d.sk) || d.irRx){
    const c = document.createElement('div');
    c.className = 'ctl';
    c.style.cssText = `position:absolute;left:${d.w / 2 - 13}px;top:${Math.max(4, d.h / 2 - 15)}px;width:26px;height:26px;border-radius:50%;background:#ffffff22;border:1px dashed #fff8;cursor:pointer;z-index:12;display:flex;align-items:center;justify-content:center;font-size:12px`;
    c.textContent = { rfid: '🏷', flame: '🔥', tilt: '↗', vib: '〰', hr: '👆', gest: '✋', prox: '✋' }[d.sk] || '📡';
    c.title = { rfid: 'Segure para aproximar um cartão', flame: 'Segure para acender uma chama', tilt: 'Clique e segure para inclinar', vib: 'Segure para vibrar', hr: 'Segure para colocar o dedo', gest: 'Segure para passar a mão', prox: 'Segure para aproximar objeto' }[d.sk] || 'Pressione o botão do controle';
    const set = v => { st.pressed = v; const k = { rfid: 'present', flame: 'flame', tilt: 'tilt', vib: 'vib', gest: 'gesture', prox: 'prox' }[d.sk]; if(k && st.vals) st.vals[k] = v ? (d.sk === 'prox' ? 60000 : 1) : (d.sk === 'prox' ? 1200 : 0); c.style.background = v ? '#facc15aa' : '#ffffff22'; if(d.irRx) CIRCUIT.request(); if(typeof CIRCUIT !== 'undefined') CIRCUIT.request(); };
    c.addEventListener('pointerdown', e => { e.stopPropagation(); c.setPointerCapture(e.pointerId); set(true); });
    c.addEventListener('pointerup', () => set(false)); c.addEventListener('pointercancel', () => set(false));
    c.addEventListener('mousedown', e => e.stopPropagation());
    wrap.appendChild(c);
  }
};

PARTMAP.lm7805.reg = { vout: 5, vin_min: 7 };
/* ---------- atualizar listas ---------- */
const nCat = document.getElementById('catCount');
try { renderPalette(); renderCatalog(); } catch(e){ console.warn(e); }
console.log('✅ Catálogo expandido:', before, '→', PARTS.length, 'peças');
window.KEZLE_CATALOG_SIZE = PARTS.length;
})();
