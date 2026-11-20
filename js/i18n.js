/* Kezle Lab Pro — traduções da interface (sem serviços externos).
   Idioma-base: português. Troca em tempo real, lembra a escolha e traduz também o conteúdo criado depois. */
(function(){
'use strict';
const LANGS = [['pt','Português'],['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['it','Italiano'],['zh','中文'],['ja','日本語'],['ru','Русский'],['ko','한국어']];
// pt : [en, es, fr, de, it, zh, ja, ru, ko]
const D = {
'Entrar':['Sign in','Entrar','Se connecter','Anmelden','Accedi','登录','ログイン','Войти','로그인'],
'Criar conta':['Sign up','Crear cuenta','Créer un compte','Konto erstellen','Crea account','注册','アカウント作成','Регистрация','가입'],
'Usuário':['Username','Usuario','Utilisateur','Benutzername','Utente','用户名','ユーザー名','Пользователь','사용자'],
'Senha':['Password','Contraseña','Mot de passe','Passwort','Password','密码','パスワード','Пароль','비밀번호'],
'Entrar no laboratório':['Enter the lab','Entrar al laboratorio','Entrer au labo','Ins Labor','Entra nel laboratorio','进入实验室','ラボに入る','В лабораторию','실험실 입장'],
'Nome completo':['Full name','Nombre completo','Nom complet','Vollständiger Name','Nome completo','全名','氏名','Полное имя','이름'],
'País':['Country','País','Pays','Land','Paese','国家','国','Страна','국가'],
'Criar conta gratuita':['Create free account','Crear cuenta gratis','Créer un compte gratuit','Kostenloses Konto','Crea account gratuito','创建免费账户','無料アカウント作成','Бесплатный аккаунт','무료 계정 만들기'],
'Sem localização':['No location','Sin ubicación','Sans position','Kein Standort','Nessuna posizione','无位置','位置なし','Нет локации','위치 없음'],
'código em execução':['code running','código en ejecución','code en cours','Code läuft','codice in esecuzione','代码运行中','コード実行中','код выполняется','코드 실행 중'],
'Sair':['Log out','Salir','Quitter','Abmelden','Esci','退出','ログアウト','Выйти','로그아웃'],
'Bancada CAD':['CAD Bench','Mesa CAD','Établi CAO','CAD-Werkbank','Banco CAD','CAD 工作台','CAD ベンチ','CAD-стенд','CAD 작업대'],
'Catálogo de Peças':['Parts Catalog','Catálogo de piezas','Catalogue de pièces','Teilekatalog','Catalogo componenti','元件目录','部品カタログ','Каталог деталей','부품 카탈로그'],
'Bibliotecas':['Libraries','Bibliotecas','Bibliothèques','Bibliotheken','Librerie','库','ライブラリ','Библиотеки','라이브러리'],
'Estúdio de Peças':['Parts Studio','Estudio de piezas','Studio de pièces','Teile-Studio','Studio componenti','元件工作室','部品スタジオ','Студия деталей','부품 스튜디오'],
'Espaço de Programação':['Code Workspace','Espacio de programación','Espace de programmation','Programmierbereich','Spazio di programmazione','编程空间','プログラミング','Среда программирования','코딩 공간'],
'Localização':['Location','Ubicación','Localisation','Standort','Posizione','位置','位置情報','Местоположение','위치'],
'Meus Projetos':['My Projects','Mis proyectos','Mes projets','Meine Projekte','I miei progetti','我的项目','マイプロジェクト','Мои проекты','내 프로젝트'],
'Galeria Global':['Global Gallery','Galería global','Galerie mondiale','Globale Galerie','Galleria globale','全球画廊','グローバルギャラリー','Глобальная галерея','글로벌 갤러리'],
'Simulação: OFF':['Simulation: OFF','Simulación: OFF','Simulation : OFF','Simulation: AUS','Simulazione: OFF','仿真：关','シミュレーション：OFF','Симуляция: ВЫКЛ','시뮬레이션: OFF'],
'Simulação: ON':['Simulation: ON','Simulación: ON','Simulation : ON','Simulation: AN','Simulazione: ON','仿真：开','シミュレーション：ON','Симуляция: ВКЛ','시뮬레이션: ON'],
'USB virtual: ON':['Virtual USB: ON','USB virtual: ON','USB virtuel : ON','Virtuelles USB: AN','USB virtuale: ON','虚拟 USB：开','仮想 USB：ON','Виртуальный USB: ВКЛ','가상 USB: ON'],
'USB virtual: OFF':['Virtual USB: OFF','USB virtual: OFF','USB virtuel : OFF','Virtuelles USB: AUS','USB virtuale: OFF','虚拟 USB：关','仮想 USB：OFF','Виртуальный USB: ВЫКЛ','가상 USB: OFF'],
'Mover':['Move','Mover','Déplacer','Verschieben','Sposta','移动','移動','Двигать','이동'],
'Conectar':['Connect','Conectar','Connecter','Verbinden','Collega','连线','接続','Соединить','연결'],
'Apagar':['Delete','Borrar','Supprimer','Löschen','Elimina','删除','削除','Удалить','삭제'],
'Fio:':['Wire:','Cable:','Fil :','Draht:','Filo:','导线：','配線：','Провод:','전선:'],
'Executar código':['Run code','Ejecutar código','Exécuter le code','Code ausführen','Esegui codice','运行代码','コード実行','Запустить код','코드 실행'],
'Exemplo':['Example','Ejemplo','Exemple','Beispiel','Esempio','示例','サンプル','Пример','예제'],
'Limpar fios':['Clear wires','Limpiar cables','Effacer les fils','Drähte löschen','Rimuovi fili','清除导线','配線を消去','Убрать провода','전선 지우기'],
'Limpar':['Clear','Limpiar','Effacer','Leeren','Pulisci','清除','クリア','Очистить','지우기'],
'Salvar':['Save','Guardar','Enregistrer','Speichern','Salva','保存','保存','Сохранить','저장'],
'Publicar':['Publish','Publicar','Publier','Veröffentlichen','Pubblica','发布','公開','Опубликовать','게시'],
'Selecione uma peça na bancada para ver propriedades e valores ao vivo.':['Select a part on the bench to see its properties and live values.','Selecciona una pieza para ver propiedades y valores en vivo.','Sélectionnez une pièce pour voir ses propriétés et valeurs en direct.','Wähle ein Teil, um Eigenschaften und Live-Werte zu sehen.','Seleziona un componente per vedere proprietà e valori in tempo reale.','在工作台上选择元件以查看属性和实时数值。','部品を選ぶとプロパティとライブ値が表示されます。','Выберите деталь, чтобы увидеть свойства и значения.','부품을 선택하면 속성과 실시간 값이 표시됩니다.'],
'Serial':['Serial','Serial','Série','Seriell','Seriale','串口','シリアル','Serial','시리얼'],
'Monitor':['Monitor','Monitor','Moniteur','Monitor','Monitor','监视器','モニター','Монитор','모니터'],
'Plotter':['Plotter','Trazador','Traceur','Plotter','Plotter','绘图器','プロッタ','Плоттер','플로터'],
'limpar':['clear','limpiar','effacer','leeren','pulisci','清除','クリア','очистить','지우기'],
'Peça aleatória':['Random part','Pieza aleatoria','Pièce aléatoire','Zufälliges Teil','Componente casuale','随机元件','ランダム部品','Случайная деталь','무작위 부품'],
'Seletor de Bibliotecas':['Library Picker','Selector de bibliotecas','Sélecteur de bibliothèques','Bibliotheksauswahl','Selettore librerie','库选择器','ライブラリ選択','Выбор библиотек','라이브러리 선택'],
'Estúdio de Criação de Peças Customizadas':['Custom Parts Studio','Estudio de piezas personalizadas','Studio de pièces personnalisées','Studio für eigene Teile','Studio componenti personalizzati','自定义元件工作室','カスタム部品スタジオ','Студия своих деталей','사용자 정의 부품 스튜디오'],
'Nova peça':['New part','Nueva pieza','Nouvelle pièce','Neues Teil','Nuovo componente','新元件','新しい部品','Новая деталь','새 부품'],
'Nome da peça *':['Part name *','Nombre de la pieza *','Nom de la pièce *','Teilename *','Nome componente *','元件名称 *','部品名 *','Название детали *','부품 이름 *'],
'Marca':['Brand','Marca','Marque','Marke','Marca','品牌','ブランド','Бренд','브랜드'],
'Categoria *':['Category *','Categoría *','Catégorie *','Kategorie *','Categoria *','类别 *','カテゴリ *','Категория *','카테고리 *'],
'Protocolo':['Protocol','Protocolo','Protocole','Protokoll','Protocollo','协议','プロトコル','Протокол','프로토콜'],
'Analógico':['Analog','Analógico','Analogique','Analog','Analogico','模拟','アナログ','Аналоговый','아날로그'],
'Digital':['Digital','Digital','Numérique','Digital','Digitale','数字','デジタル','Цифровой','디지털'],
'Outro':['Other','Otro','Autre','Andere','Altro','其他','その他','Другое','기타'],
'Opções de Microcontrolador':['Microcontroller options','Opciones del microcontrolador','Options du microcontrôleur','Mikrocontroller-Optionen','Opzioni microcontrollore','微控制器选项','マイコンオプション','Параметры МК','마이크로컨트롤러 옵션'],
'Nº de Pinos':['No. of pins','N.º de pines','Nb de broches','Anzahl Pins','N. di pin','引脚数','ピン数','Кол-во выводов','핀 수'],
'Descrição Curta':['Short description','Descripción corta','Description courte','Kurzbeschreibung','Descrizione breve','简短描述','短い説明','Краткое описание','간단한 설명'],
'Criar Peça no Catálogo':['Add part to catalog','Crear pieza en el catálogo','Ajouter au catalogue','Teil zum Katalog hinzufügen','Aggiungi al catalogo','添加到目录','カタログに追加','Добавить в каталог','카탈로그에 추가'],
'Minhas peças customizadas':['My custom parts','Mis piezas personalizadas','Mes pièces personnalisées','Meine eigenen Teile','I miei componenti','我的自定义元件','マイカスタム部品','Мои детали','내 사용자 부품'],
'Executar':['Run','Ejecutar','Exécuter','Ausführen','Esegui','运行','実行','Запуск','실행'],
'Parar':['Stop','Detener','Arrêter','Stopp','Ferma','停止','停止','Стоп','정지'],
'Modelos de código…':['Code templates…','Plantillas de código…','Modèles de code…','Code-Vorlagen…','Modelli di codice…','代码模板…','コードテンプレート…','Шаблоны кода…','코드 템플릿…'],
'sem MCU':['no MCU','sin MCU','sans MCU','kein MCU','nessun MCU','无 MCU','MCU なし','нет МК','MCU 없음'],
'Console':['Console','Consola','Console','Konsole','Console','控制台','コンソール','Консоль','콘솔'],
'Localização & Calibração Climática':['Location & Climate Calibration','Ubicación y calibración climática','Localisation et calibration climatique','Standort & Klimakalibrierung','Posizione e calibrazione climatica','位置与气候校准','位置と気候キャリブレーション','Локация и климат-калибровка','위치 및 기후 보정'],
'Selecionar localização':['Choose location','Elegir ubicación','Choisir la position','Standort wählen','Scegli posizione','选择位置','位置を選択','Выбрать локацию','위치 선택'],
'Busca de cidades':['City search','Búsqueda de ciudades','Recherche de villes','Städtesuche','Cerca città','城市搜索','都市検索','Поиск города','도시 검색'],
'Usar meu GPS':['Use my GPS','Usar mi GPS','Utiliser mon GPS','Mein GPS nutzen','Usa il mio GPS','使用我的 GPS','GPS を使う','Мой GPS','내 GPS 사용'],
'Modo apenas aleatório':['Random-only mode','Solo modo aleatorio','Mode aléatoire seul','Nur Zufallsmodus','Solo modalità casuale','仅随机模式','ランダムのみ','Только случайный режим','무작위 모드만'],
'Temp. Base':['Base temp.','Temp. base','Temp. de base','Basistemp.','Temp. base','基础温度','基準温度','Баз. темп.','기준 온도'],
'Umidade Rel.':['Rel. humidity','Humedad rel.','Humidité rel.','Rel. Feuchte','Umidità rel.','相对湿度','相対湿度','Отн. влажность','상대 습도'],
'Pressão (Alt)':['Pressure (Alt)','Presión (Alt)','Pression (Alt)','Druck (Höhe)','Pressione (Alt)','气压（海拔）','気圧（高度）','Давление (выс.)','기압(고도)'],
'Luz Meio-Dia':['Noon light','Luz mediodía','Lumière midi','Mittagslicht','Luce mezzogiorno','正午光照','正午の光','Полуденный свет','정오 조도'],
'Luz Atual':['Current light','Luz actual','Lumière actuelle','Aktuelles Licht','Luce attuale','当前光照','現在の光','Текущий свет','현재 조도'],
'Projetos publicados mundialmente pela comunidade Kezle Lab. Abra qualquer um direto na sua bancada.':['Projects published worldwide by the Kezle Lab community. Open any of them on your bench.','Proyectos publicados en todo el mundo por la comunidad. Ábrelos en tu mesa.','Projets publiés dans le monde entier par la communauté. Ouvrez-les sur votre établi.','Weltweit veröffentlichte Projekte der Community. Öffne sie direkt in deiner Werkbank.','Progetti pubblicati dalla community. Aprili sul tuo banco.','社区在全球发布的项目，可直接在工作台打开。','コミュニティが世界中で公開したプロジェクト。','Проекты сообщества со всего мира. Откройте на своём стенде.','커뮤니티가 전 세계에 게시한 프로젝트입니다.'],
'Armazenados localmente na sua conta. Publique para compartilhá-los com o mundo na Galeria Global.':['Stored locally in your account. Publish to share them with the world in the Global Gallery.','Guardados localmente en tu cuenta. Publica para compartirlos en la Galería global.','Stockés localement. Publiez pour les partager dans la Galerie mondiale.','Lokal in deinem Konto gespeichert. Veröffentliche sie in der globalen Galerie.','Salvati localmente. Pubblica per condividerli nella Galleria globale.','本地保存在您的账户中。发布后可在全球画廊分享。','アカウントにローカル保存。公開するとグローバルギャラリーで共有できます。','Хранятся локально. Опубликуйте, чтобы поделиться в галерее.','계정에 로컬 저장됩니다. 게시하여 공유하세요.'],
'idioma':['language','idioma','langue','Sprache','lingua','语言','言語','язык','언어'],
'Idioma do site':['Site language','Idioma del sitio','Langue du site','Websprache','Lingua del sito','网站语言','サイト言語','Язык сайта','사이트 언어'],
'Configurar localização':['Set location','Configurar ubicación','Définir la position','Standort einstellen','Imposta posizione','设置位置','位置を設定','Задать локацию','위치 설정'],
'buscar peça…':['search part…','buscar pieza…','chercher une pièce…','Teil suchen…','cerca componente…','搜索元件…','部品を検索…','поиск детали…','부품 검색…'],
'digite uma cidade…':['type a city…','escribe una ciudad…','saisissez une ville…','Stadt eingeben…','digita una città…','输入城市…','都市名を入力…','введите город…','도시 입력…'],
'Nenhuma cidade encontrada':['No city found','Ninguna ciudad encontrada','Aucune ville trouvée','Keine Stadt gefunden','Nessuna città trovata','未找到城市','都市が見つかりません','Город не найден','도시를 찾을 수 없음'],
'Se junte ao Kezle Lab Pro':['Join Kezle Lab Pro','Únete a Kezle Lab Pro','Rejoignez Kezle Lab Pro','Tritt Kezle Lab Pro bei','Unisciti a Kezle Lab Pro','加入 Kezle Lab Pro','Kezle Lab Pro に参加','Присоединяйтесь','Kezle Lab Pro 참여'],
'Completamente gratuito:':['Completely free:','Totalmente gratis:','Entièrement gratuit :','Völlig kostenlos:','Completamente gratuito:','完全免费：','完全無料：','Полностью бесплатно:','완전 무료:'],
'Serial Monitor + Serial Plotter em tempo real':['Serial Monitor + Serial Plotter in real time','Monitor serie + trazador serie en tiempo real','Moniteur + traceur série en temps réel','Serieller Monitor + Plotter in Echtzeit','Monitor + plotter seriale in tempo reale','实时串口监视器 + 绘图器','リアルタイム シリアルモニター＋プロッタ','Серийный монитор и плоттер в реальном времени','실시간 시리얼 모니터 + 플로터'],
'Sensores calibrados pelo clima da sua localização':['Sensors calibrated to your local climate','Sensores calibrados con el clima de tu ubicación','Capteurs calibrés selon votre climat','Sensoren nach lokalem Klima kalibriert','Sensori calibrati sul clima locale','传感器按本地气候校准','現地の気候で校正されるセンサー','Датчики калибруются по вашему климату','현지 기후로 보정되는 센서'],
};
const IDX = {pt:-1,en:0,es:1,fr:2,de:3,it:4,zh:5,ja:6,ru:7,ko:8};
const ORIG = new WeakMap();          // nó → texto original em pt
const ATTR = new WeakMap();          // elemento → {attr: pt}
let cur = 'pt';
const lead = s => (s.match(/^[^\p{L}\p{N}]*/u) || [''])[0];
const tail = s => (s.match(/[^\p{L}\p{N}…:.*]*$/u) || [''])[0];
function tr(pt, lang){
  const raw = pt.trim(); if(!raw) return pt;
  const core = raw.replace(/^[^\p{L}\p{N}]+/u, '');
  const hit = D[raw] || D[core] || D[core.replace(/[\s ]+/g, ' ')];
  if(!hit) return null;
  const v = hit[IDX[lang]]; if(!v) return null;
  const pre = D[raw] ? '' : raw.slice(0, raw.length - core.length);
  return pt.replace(raw, pre + v);
}
function applyNode(n, lang){
  if(n.nodeType === 3){
    const p = n.parentNode; if(!p || /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(p.nodeName)) return;
    if(!ORIG.has(n)) ORIG.set(n, n.nodeValue);
    const src = ORIG.get(n);
    if(lang === 'pt'){ if(n.nodeValue !== src) n.nodeValue = src; return; }
    const t = tr(src, lang); if(t != null && n.nodeValue !== t) n.nodeValue = t;
  } else if(n.nodeType === 1){
    if(/^(SCRIPT|STYLE|TEXTAREA|CODE|PRE|SVG)$/i.test(n.nodeName)) return;
    for(const a of ['placeholder', 'title']){
      if(!n.hasAttribute || !n.hasAttribute(a)) continue;
      let m = ATTR.get(n); if(!m){ m = {}; ATTR.set(n, m); }
      if(m[a] == null) m[a] = n.getAttribute(a);
      const t = lang === 'pt' ? m[a] : tr(m[a], lang);
      if(t != null && n.getAttribute(a) !== t) n.setAttribute(a, t);
    }
    n.childNodes.forEach(c => applyNode(c, lang));
  }
}
let busy = false;
function applyAll(){ busy = true; try{ applyNode(document.body, cur); }finally{ busy = false; } }
function setLang(l){
  if(!(l in IDX)) l = 'pt';
  cur = l;
  try{ localStorage.setItem('kezle.lang', l); }catch(e){}
  document.documentElement.lang = l;
  applyAll();
  const sel = document.getElementById('langSel'); if(sel && sel.value !== l) sel.value = l;
  document.dispatchEvent(new CustomEvent('kezle:lang', { detail: l }));
}
function init(){
  const sel = document.getElementById('langSel');
  if(sel){
    sel.innerHTML = LANGS.map(x => '<option value="' + x[0] + '">🌐 ' + x[1] + '</option>').join('');
    sel.onchange = () => setLang(sel.value);
  }
  let l = 'pt';
  try{ l = localStorage.getItem('kezle.lang') || ''; }catch(e){}
  if(!l){ const n = (navigator.language || 'pt').slice(0, 2).toLowerCase(); l = n in IDX ? n : 'pt'; }
  let pend = 0;
  new MutationObserver(() => { if(busy || cur === 'pt') return; clearTimeout(pend); pend = setTimeout(applyAll, 60); })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  setLang(l);
}
window.KezleI18n = { setLang, get lang(){ return cur; }, t: s => (cur === 'pt' ? s : (tr(s, cur) || s)), LANGS };
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
