# Kezle Lab Pro 1.2

Simulador de bancada de eletrônica embarcada que roda 100% no navegador (HTML + JS), com uma Galeria Global servida por funções serverless na Vercel.

## O que há de novo

| Área | O que mudou |
|---|---|
| **Simulação elétrica** | Solver nodal real (`js/circuit.js`): resistor, capacitor, indutor, LED, diodo/Zener/Schottky, BJT, MOSFET, relés, reguladores, pontes H, 555, amp-ops, fontes com resistência interna. Nada acende "por osmose": a corrente decide. LED queima sem resistor, motor tem RPM e aquecimento, resistor alto = LED fraco/apagado, potenciômetro funciona como divisor/reostato. |
| **Protoboard** | Passo 2,54 mm, 830/400/170 furos, trilhas por coluna, canal central, trilhos de alimentação, peças encaixam nos furos (snap) e acompanham a placa ao arrastar. |
| **Fios** | Ficam por cima dos componentes, dobram (duplo clique), têm alça de curva e alças nas pontas para religar a outro pino. São salvos nos projetos (antes se perdiam ao reabrir). |
| **Telas** | Tamanho físico proporcional (3,6 px/mm), resolução nativa, OLED/TFT/e-Paper/redondas, touch capacitivo (multitoque) e resistivo (XPT2046), lupa com toque, firmware demo interativo. CYD, M5Core2/CoreS3/Dial, T-Display, Waveshare/Elecrow 4,3"/7", Nextion… |
| **Linguagens (9)** | MicroPython, CircuitPython, C++ (Arduino), C (Pico SDK/AVR), JavaScript, Lua, BASIC, Go (TinyGo), Rust. Todas usam o mesmo HAL (`js/hal.js`). |
| **Catálogo** | 215 → 600+ peças com modelos elétricos e bibliotecas Python/C++ genéricas. |
| **Estúdio** | Planejador: pinagem por função, elétrica (VCC mín/máx, consumo), dimensões em mm, tela/touch, campos de leitura, API de código e validação. |
| **Projetos** | Salvar, atualizar (ou salvar como novo), renomear, duplicar, exportar/importar `.json`. |
| **Galeria Global** | Backend real (`api/`): publicar, atualizar, despublicar, curtir, comentar, busca e filtros. |

## Galeria Global — configuração (obrigatória para persistir)

As funções em `api/` usam **Upstash Redis / Vercel KV** quando as variáveis de ambiente existem; sem elas usam memória da instância (**dados temporários**, perdidos a cada cold start — o app avisa na aba Galeria).

1. Painel da Vercel → projeto → **Storage → Create → Upstash Redis** (Marketplace) → *Connect Project*.
2. Isso define `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL/TOKEN`). Faça *Redeploy*.
3. Teste: `https://SEU-SITE/api/health` deve responder `"storage":"redis"`.

Limitações conhecidas: as contas de usuário continuam locais ao navegador (não há login no servidor); a propriedade de uma publicação é provada por uma chave secreta guardada no navegador de quem publicou (apenas o hash é salvo no servidor). Limite de ~450 KB por projeto e 40 escritas/min por IP.

## Estrutura

```
index.html        app original (UI, catálogo base, bancada)
js/circuit.js     solver MNA + modelos elétricos
js/bench.js       protoboard, fios, rotação, controles interativos
js/screens.js     telas, touch, lupa, firmware demo
js/py.js          interpretador MicroPython (kwargs, classes, tuplas, try/except…)
js/hal.js         HAL comum (GPIO, PWM, ADC, displays, touch)
js/langs.js       registro de linguagens, módulos Python/CircuitPython, runner JS
js/lang2.js       C / C++ → JS assíncrono
js/lang3.js       Go e Rust → JS assíncrono
js/lang4.js       Lua e BASIC (interpretadores próprios)
js/catalog.js     +400 peças
js/studio.js      Estúdio v2
js/online.js      projetos + galeria global
api/*.js          funções serverless (Vercel)
```

## Limites honestos

- C/C++, Go e Rust são **subconjuntos** transpilados para JS (sem templates/exceções C++, `struct`/`impl` em Rust, canais/goroutines reais em Go). Servem para firmware didático típico.
- O solver roda em tempo real (~16–60 Hz): osciladores rápidos (555 acima de alguns Hz, PWM em kHz) são modelados por média/superposição, não por forma de onda.
- Protocolos (I2C/SPI/UART) são simulados no nível de dispositivo, não de barramento bit a bit.
