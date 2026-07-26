(function () {
  var STORAGE_KEY = 'site-audit-lang';

  var vitalGuides = {
    en: {
      ttfb: {
        short: 'How fast the server starts sending the first byte of the response.',
        label: 'Time to First Byte',
        affects:
          'Everything downstream — a slow TTFB delays FCP, LCP and the whole “page feels ready” moment.',
        depends: [
          'Server/CPU cold starts and hosting distance to the user',
          'DNS lookup and TLS handshake time',
          'Backend work: DB queries, SSR, redirects, middleware',
          'CDN / edge caching vs origin every request',
        ],
        do: [
          'Put the site behind a CDN and cache HTML/API where safe',
          'Cut redirect chains (especially HTTP→HTTPS→www hops)',
          'Speed up the origin: faster hosting, query indexes, less SSR work',
          'Enable keep-alive / HTTP/2 or HTTP/3',
          'Warm critical endpoints; avoid cold serverless starts on the landing path',
        ],
        targets: 'Good ≤ 800 ms · Needs work ≤ 1800 ms · Poor > 1800 ms',
      },
      fcp: {
        short: 'When the first text or image appears — the user finally sees something.',
        label: 'First Contentful Paint',
        affects:
          'Perceived speed. Slow FCP feels like a blank/white screen and raises bounce risk.',
        depends: [
          'TTFB (server must answer first)',
          'Render-blocking CSS and fonts in <head>',
          'Large HTML or heavy JS that blocks first paint',
          'Client network and device CPU',
        ],
        do: [
          'Inline critical CSS; defer non-critical stylesheets',
          'Preload the main font / hero image; use font-display: swap',
          'Remove unused CSS; avoid huge CSS frameworks on the first paint path',
          'Defer non-essential JS; keep <head> lean',
          'Compress HTML (gzip/brotli) and shrink above-the-fold markup',
        ],
        targets: 'Good ≤ 1.8 s · Needs work ≤ 3.0 s · Poor > 3.0 s',
      },
      lcp: {
        short:
          'When the largest visible content (hero image, headline block, video poster) finishes painting.',
        label: 'Largest Contentful Paint',
        affects:
          'Core Web Vital for “content is useful”. Google uses it in ranking / page experience signals.',
        depends: [
          'TTFB + FCP chain',
          'Size and format of the LCP element (often a hero image)',
          'Whether the LCP resource is discoverable early (not lazy/late)',
          'CSS/JS that delay rendering of the main block',
        ],
        do: [
          'Identify the LCP element (usually H1 text or hero img) in DevTools Performance / PSI',
          'Optimize that image: modern formats (AVIF/WebP), correct dimensions, compression',
          'Preload the LCP image; do not lazy-load it',
          'Serve images from a CDN; set width/height to avoid late layout',
          'Avoid late-injected heroes from heavy JS frameworks if possible',
        ],
        targets: 'Good ≤ 2.5 s · Needs work ≤ 4.0 s · Poor > 4.0 s',
      },
      cls: {
        short:
          'How much the layout jumps while loading — buttons/text shifting under the user’s finger.',
        label: 'Cumulative Layout Shift',
        affects:
          'Trust and usability. High CLS causes mis-taps and feels “broken”. Also a Core Web Vital.',
        depends: [
          'Images/ads/embeds without reserved width & height',
          'Web fonts swapping and reflowing text',
          'Dynamically injected banners, cookie bars, late UI above content',
          'Animations that move layout instead of transform/opacity',
        ],
        do: [
          'Always set width and height (or aspect-ratio) on images and video',
          'Reserve space for ads, embeds and sticky bars',
          'Prefer font-display: optional/swap and match fallback metrics',
          'Avoid inserting content above existing content after load',
          'Animate with transform/opacity, not top/height that reflows the page',
        ],
        targets: 'Good ≤ 0.1 · Needs work ≤ 0.25 · Poor > 0.25',
      },
      fid: {
        short:
          'Delay from the first tap/click until the browser can start handling that input.',
        label: 'First Input Delay',
        affects:
          'Interactivity. High FID means the page looks ready but ignores clicks (busy main thread).',
        depends: [
          'Amount of JavaScript parsing/compiling/executing',
          'Long tasks on the main thread during load',
          'Third-party scripts (analytics, chat, tags)',
          'Heavy hydration in SPA frameworks',
        ],
        do: [
          'Split and code-split JS; ship less on the first load',
          'Defer / async third parties; load chat widgets after interaction',
          'Break long tasks (>50 ms); use requestIdleCallback where useful',
          'Prefer lighter frameworks or progressive hydration',
          'Move heavy work to Web Workers when possible',
        ],
        targets: 'Good ≤ 100 ms · Needs work ≤ 300 ms · Poor > 300 ms',
        note: 'FID is being replaced by INP (Interaction to Next Paint) in field data, but the fix list is the same: free the main thread.',
      },
    },
    be: {
      ttfb: {
        short: 'Як хутка сервер пачынае аддаваць першы байт адказу.',
        label: 'Час да першага байта',
        affects:
          'Уплывае на ўсё далейшае — павольны TTFB адкладае FCP, LCP і момант, калі старонка «ажывае».',
        depends: [
          'Халодны старт сервера / CPU і адлегласць хостынга да карыстальніка',
          'DNS-запыт і TLS-рукапацісканне',
          'Праца бэкенда: БД, SSR, рэдырэкты, middleware',
          'CDN / edge-кэш супраць заўсёдыга звароту да origin',
        ],
        do: [
          'Пастаўце сайт за CDN і кэшуйце HTML/API там, дзе бяспечна',
          'Скараціце ланцужкі рэдырэктаў (асабліва HTTP→HTTPS→www)',
          'Паскорце origin: хутчэйшы хостынг, індэксы ў БД, менш SSR-працы',
          'Уключыце keep-alive / HTTP/2 або HTTP/3',
          'Прагравайце крытычныя эндпоінты; пазбягайце халоднага старту serverless на лендынгу',
        ],
        targets: 'Добра ≤ 800 мс · Трэба палепшыць ≤ 1800 мс · Кепска > 1800 мс',
      },
      fcp: {
        short: 'Калі з’яўляецца першы тэкст ці выява — карыстальнік ужо нешта бачыць.',
        label: 'Першая адмалёўка кантэнту',
        affects:
          'Успрыманая хуткасць. Павольны FCP — белы экран і вышэйшы рызыка сыходу.',
        depends: [
          'TTFB (спачатку мусіць адказаць сервер)',
          'CSS і шрыфты ў <head>, якія блакуюць рэндэр',
          'Вялікі HTML або цяжкі JS, што стрымліваюць першую адмалёўку',
          'Сетка кліента і CPU прылады',
        ],
        do: [
          'Інлайніце крытычны CSS; адкладвайце некрытычныя стылі',
          'Preload асноўнага шрыфта / hero-выявы; font-display: swap',
          'Прыбірайце лішні CSS; не цягніце вялікія CSS-фреймворкі на першы экран',
          'Адкладвайце неабавязковы JS; трымайце <head> лёгкім',
          'Сціскайце HTML (gzip/brotli) і скарачайце разметку above-the-fold',
        ],
        targets: 'Добра ≤ 1.8 с · Трэба палепшыць ≤ 3.0 с · Кепска > 3.0 с',
      },
      lcp: {
        short:
          'Калі адмалёўваецца найбуйнейшы бачны блок (hero, загаловак, постар відэа).',
        label: 'Адмалёўка найбуйнейшага кантэнту',
        affects:
          'Core Web Vital «кантэнт карысны». Google улічвае гэта ў сігналах якасці старонкі.',
        depends: [
          'Ланцужок TTFB + FCP',
          'Памер і фармат LCP-элемента (часта hero-выява)',
          'Ці LCP-рэсурс даступны рана (не lazy / не позна)',
          'CSS/JS, якія затрымліваюць рэндэр галоўнага блока',
        ],
        do: [
          'Знайдзіце LCP-элемент у DevTools Performance / PSI',
          'Аптымізуйце выяву: AVIF/WebP, памеры, сцісканне',
          'Preload LCP-выявы; не рабіце ёй lazy-load',
          'Аддавайце выявы праз CDN; задайце width/height',
          'Пазбягайце познага ўстаўлення hero праз цяжкі JS',
        ],
        targets: 'Добра ≤ 2.5 с · Трэба палепшыць ≤ 4.0 с · Кепска > 4.0 с',
      },
      cls: {
        short:
          'Наколькі «скача» макет пры загрузцы — кнопкі/тэкст зрушваюцца пад пальцам.',
        label: 'Сумарны зрух макета',
        affects:
          'Давер і зручнасць. Высокі CLS — памылковыя клікі і адчуванне «зламанага» сайта. Гэта таксама Core Web Vital.',
        depends: [
          'Выявы/рэклама/эмбеды без зарезерваваных width і height',
          'Вэб-шрыфты, што перабудоўваюць тэкст',
          'Дынамічныя банеры, cookie-панэлі, познае UI над кантэнтам',
          'Анімацыі праз top/height замест transform/opacity',
        ],
        do: [
          'Заўсёды задавайце width і height (або aspect-ratio) для выяў і відэа',
          'Рэзервуйце месца пад рэкламу, эмбеды і sticky-бары',
          'Выкарыстоўвайце font-display: optional/swap і супастаўныя fallback-метрыкі',
          'Не ўстаўляйце кантэнт вышэй ужо паказанага пасля загрузкі',
          'Анімуйце праз transform/opacity, а не ўласцівасці, што ламаюць layout',
        ],
        targets: 'Добра ≤ 0.1 · Трэба палепшыць ≤ 0.25 · Кепска > 0.25',
      },
      fid: {
        short:
          'Затрымка ад першага націску/кліку да моманту, калі браўзер можа пачаць апрацоўку.',
        label: 'Затрымка першага ўводу',
        affects:
          'Інтэрактыўнасць. Высокі FID — старонка выглядае гатовай, але ігнаруе клікі (заняты main thread).',
        depends: [
          'Аб’ём JS: парсінг, кампіляцыя, выкананне',
          'Доўгія задачы на main thread падчас загрузкі',
          'Староннія скрыпты (аналітыка, чат, тэгі)',
          'Цяжкая hydration у SPA-фреймворках',
        ],
        do: [
          'Дзяліце і code-split JS; менш кода на першы экран',
          'Defer / async для third-party; чат — пасля ўзаемадзеяння',
          'Драбіце long tasks (>50 мс); выкарыстоўвайце requestIdleCallback',
          'Лягчэйшыя фрэймворкі або progressive hydration',
          'Пераносьце цяжкую працу ў Web Workers, дзе магчыма',
        ],
        targets: 'Добра ≤ 100 мс · Трэба палепшыць ≤ 300 мс · Кепска > 300 мс',
        note: 'FID у field-дадзеных замяняецца на INP, але рамонт той жа: вызваліце main thread.',
      },
    },
    fr: {
      ttfb: {
        short:
          'À quelle vitesse le serveur commence à envoyer le premier octet de la réponse.',
        label: 'Temps jusqu’au premier octet',
        affects:
          'Tout ce qui suit — un TTFB lent retarde le FCP, le LCP et le moment où la page « semble prête ».',
        depends: [
          'Démarrages à froid CPU/serveur et distance de l’hébergement',
          'Temps de résolution DNS et de poignée de main TLS',
          'Travail backend : requêtes DB, SSR, redirections, middleware',
          'CDN / cache edge vs origin à chaque requête',
        ],
        do: [
          'Placez le site derrière un CDN et cachez HTML/API là où c’est sûr',
          'Réduisez les chaînes de redirections (surtout HTTP→HTTPS→www)',
          'Accélérez l’origin : hébergement plus rapide, index DB, moins de SSR',
          'Activez keep-alive / HTTP/2 ou HTTP/3',
          'Préchauffez les endpoints critiques ; évitez les cold starts serverless sur la landing',
        ],
        targets: 'Bon ≤ 800 ms · À améliorer ≤ 1800 ms · Faible > 1800 ms',
      },
      fcp: {
        short:
          'Quand le premier texte ou image apparaît — l’utilisateur voit enfin quelque chose.',
        label: 'Premier rendu de contenu',
        affects:
          'Vitesse perçue. Un FCP lent donne un écran blanc et augmente le risque de rebond.',
        depends: [
          'TTFB (le serveur doit répondre d’abord)',
          'CSS et polices bloquants dans <head>',
          'HTML volumineux ou JS lourd qui retarde le premier rendu',
          'Réseau client et CPU de l’appareil',
        ],
        do: [
          'Inlinez le CSS critique ; différéz les feuilles non critiques',
          'Preload de la police / image hero principale ; font-display: swap',
          'Supprimez le CSS inutilisé ; évitez les gros frameworks CSS au premier écran',
          'Différez le JS non essentiel ; gardez un <head> léger',
          'Compressez le HTML (gzip/brotli) et réduisez le markup above-the-fold',
        ],
        targets: 'Bon ≤ 1,8 s · À améliorer ≤ 3,0 s · Faible > 3,0 s',
      },
      lcp: {
        short:
          'Quand le plus grand contenu visible (image hero, titre, poster vidéo) finit de s’afficher.',
        label: 'Rendu du plus grand contenu',
        affects:
          'Core Web Vital « contenu utile ». Google l’utilise dans le ranking / page experience.',
        depends: [
          'Chaîne TTFB + FCP',
          'Taille et format de l’élément LCP (souvent une image hero)',
          'Si la ressource LCP est découvrable tôt (pas lazy / tardive)',
          'CSS/JS qui retardent le rendu du bloc principal',
        ],
        do: [
          'Identifiez l’élément LCP dans DevTools Performance / PSI',
          'Optimisez cette image : formats modernes (AVIF/WebP), dimensions, compression',
          'Preload de l’image LCP ; ne pas la lazy-loader',
          'Servez les images via CDN ; définissez width/height',
          'Évitez les heroes injectés tardivement par des frameworks JS lourds',
        ],
        targets: 'Bon ≤ 2,5 s · À améliorer ≤ 4,0 s · Faible > 4,0 s',
      },
      cls: {
        short:
          'À quel point la mise en page saute pendant le chargement — boutons/texte qui bougent sous le doigt.',
        label: 'Décalage cumulatif de mise en page',
        affects:
          'Confiance et utilisabilité. Un CLS élevé provoque des mauvais clics et un sentiment de site « cassé ». Aussi un Core Web Vital.',
        depends: [
          'Images/pubs/embeds sans width & height réservés',
          'Polices web qui reflowent le texte',
          'Bannières dynamiques, barres cookies, UI tardive au-dessus du contenu',
          'Animations via top/height au lieu de transform/opacity',
        ],
        do: [
          'Définissez toujours width et height (ou aspect-ratio) sur images et vidéos',
          'Réservez de l’espace pour pubs, embeds et barres sticky',
          'Préférez font-display: optional/swap et des métriques de fallback proches',
          'N’insérez pas de contenu au-dessus du contenu déjà affiché après chargement',
          'Animez avec transform/opacity, pas des propriétés qui reflowent',
        ],
        targets: 'Bon ≤ 0,1 · À améliorer ≤ 0,25 · Faible > 0,25',
      },
      fid: {
        short:
          'Délai entre le premier tap/clic et le moment où le navigateur peut commencer à le traiter.',
        label: 'Délai de première interaction',
        affects:
          'Interactivité. Un FID élevé : la page a l’air prête mais ignore les clics (main thread occupé).',
        depends: [
          'Volume de JS : parsing, compilation, exécution',
          'Longues tâches sur le main thread pendant le chargement',
          'Scripts tiers (analytics, chat, tags)',
          'Hydration lourde dans les frameworks SPA',
        ],
        do: [
          'Découpez et code-splittez le JS ; moins de code au premier chargement',
          'Defer / async pour les tiers ; chargez le chat après interaction',
          'Cassez les long tasks (>50 ms) ; utilisez requestIdleCallback si utile',
          'Frameworks plus légers ou hydration progressive',
          'Déplacez le travail lourd vers des Web Workers si possible',
        ],
        targets: 'Bon ≤ 100 ms · À améliorer ≤ 300 ms · Faible > 300 ms',
        note: 'Le FID est remplacé par l’INP dans les données de terrain, mais la correction est la même : libérez le main thread.',
      },
    },
  };

  var dict = {
    en: {
      'theme.dark': 'Dark',
      'theme.light': 'Light',
      'theme.aria': 'Switch theme',
      'lang.aria': 'Switch language',
      'lang.en': 'EN',
      'lang.fr': 'FR',
      'lang.be': 'BE',
      'home.eyebrow': 'SEO • Security • Performance',
      'home.title': 'Deep Express Site Audit',
      'home.lead':
        'Checks indexing, meta tags, links, media, security headers, speed, accessibility, and basic technical hygiene of the page.',
      'home.urlLabel': 'Site URL',
      'home.run': 'Run Audit',
      'home.auditing': 'Auditing…',
      'home.loadingTitle': 'Running audit…',
      'home.errorFallback': 'Failed to perform site audit.',
      'home.hint0':
        'Checking SEO, security, links and performance. This can take up to a minute.',
      'home.hint1': 'Fetching page HTML and following redirects…',
      'home.hint2': 'Scanning meta tags, headings and structured data…',
      'home.hint3': 'Checking links, images and static resources…',
      'home.hint4': 'Reviewing security headers and TLS…',
      'report.newAudit': '← New Audit',
      'report.title': 'Audit Results',
      'report.checkedUrl': 'Checked URL:',
      'report.overallScore': 'Overall Score',
      'report.scoreHint': '100 − 12×critical − 5×warning − 1×info',
      'report.speedLeadShort': 'Heuristic speed estimate — not PageSpeed lab.',
      'report.words': 'words',
      'report.export': 'Export',
      'report.exportHtml': 'HTML (Email)',
      'report.critical': 'Critical',
      'report.warning': 'Warning',
      'report.ok': 'OK',
      'report.info': 'Info',
      'report.clearFilter': 'Show all',
      'report.filteredChecks': '%s issues',
      'report.responseTime': 'Response Time',
      'report.checked': 'Checked',
      'report.performance': 'Performance',
      'report.speedScore': 'Estimated speed score',
      'report.speedLead':
        'Heuristic score from response time, HTML weight, JS/CSS, compression and assets — not a PageSpeed Insights lab run. Click any metric card for a full guide.',
      'report.grade': 'Grade',
      'report.guide': 'Guide →',
      'report.deductions': 'Score deductions',
      'report.close': 'Close',
      'report.affects': 'What it affects',
      'report.depends': 'What it depends on',
      'report.todo': 'What to do',
      'report.allChecks': 'All Checks',
      'report.chars': 'chars',
      'report.titleMissing': 'Title missing',
      'report.descMissing': 'Meta description missing',
      'report.metaDescription': 'Meta description',
      'report.links': 'Links',
      'report.linksHint': 'internal / external',
      'report.imagesAlt': 'Images without alt',
      'report.imagesAltHint': 'missing + empty',
      'report.jsCss': 'JS / CSS',
      'report.jsCssHint': 'external files',
      'report.htmlText': 'HTML / text',
      'report.htmlTextHint': 'size / words',
      'report.checksPerformed': '{n} checks performed',
      'report.showDetails': 'Show details ▼',
      'report.hideDetails': 'Hide details ▲',
      'report.rawData': 'Raw Data',
      'report.none': 'None',
      'report.found': 'Found',
      'vital.good': 'Good',
      'vital.needs-improvement': 'Needs work',
      'vital.poor': 'Poor',
      'cat.SEO': 'SEO',
      'cat.Performance': 'Performance',
      'cat.Security': 'Security',
      'cat.Accessibility': 'Accessibility',
      'cat.Technical': 'Technical',
      'cat.Indexing': 'Indexing',
      'cat.Social': 'Social',
      'cat.Content': 'Content',
      'cat.Media': 'Media',
      'cat.Links': 'Links',
      'cat.Branding': 'Branding',
      'cat.Mobile': 'Mobile',
      'report.pageTitle': 'Title',
      'report.h1': 'H1',
      'raw.httpStatus': 'HTTP Status',
      'raw.contentType': 'Content-Type',
      'raw.redirects': 'Redirects',
      'raw.canonical': 'Canonical',
      'raw.robotsMeta': 'Robots meta',
      'raw.sitemap': 'Sitemap',
      'raw.jsonLd': 'JSON-LD',
      'raw.hreflang': 'hreflang',
      'raw.compression': 'Compression',
      'metric.Response time': 'Response time',
      'metric.HTML size': 'HTML size',
      'metric.Scripts': 'Scripts',
      'metric.Stylesheets': 'Stylesheets',
      'metric.Images without size': 'Images without size',
      'metric.Compression': 'Compression',
      'metric.Failed resources': 'Failed resources',
      'metric.Heavy images': 'Heavy images',
      'metric.Weak caching': 'Weak caching',
    },
    be: {
      'theme.dark': 'Цёмная',
      'theme.light': 'Светлая',
      'theme.aria': 'Пераключыць тэму',
      'lang.aria': 'Пераключыць мову',
      'lang.en': 'EN',
      'lang.fr': 'FR',
      'lang.be': 'BE',
      'home.eyebrow': 'SEO • Бяспека • Хуткасць',
      'home.title': 'Глыбокі Express-аўдыт сайта',
      'home.lead':
        'Правярае індэксацыю, мета-тэгі, спасылкі, медыя, загалоўкі бяспекі, хуткасць, даступнасць і базавую тэхнічную гігіену старонкі.',
      'home.urlLabel': 'URL сайта',
      'home.run': 'Запусціць аўдыт',
      'home.auditing': 'Аўдыт…',
      'home.loadingTitle': 'Ідзе аўдыт…',
      'home.errorFallback': 'Не ўдалося выканаць аўдыт сайта.',
      'home.hint0':
        'Правяраем SEO, бяспеку, спасылкі і хуткасць. Гэта можа заняць да хвіліны.',
      'home.hint1': 'Загружаем HTML і сочым за рэдырэктамі…',
      'home.hint2': 'Скануем мета-тэгі, загалоўкі і structured data…',
      'home.hint3': 'Правяраем спасылкі, выявы і статычныя рэсурсы…',
      'home.hint4': 'Праглядаем загалоўкі бяспекі і TLS…',
      'report.newAudit': '← Новы аўдыт',
      'report.title': 'Вынікі аўдыту',
      'report.checkedUrl': 'Правераны URL:',
      'report.overallScore': 'Агульны бал',
      'report.scoreHint': '100 − 12×крытычна − 5×папярэджанне − 1×інфа',
      'report.speedLeadShort': 'Эўрыстычная ацэнка хуткасці — не лабараторны PageSpeed.',
      'report.words': 'слоў',
      'report.export': 'Экспорт',
      'report.exportHtml': 'HTML (Email)',
      'report.critical': 'Крытычна',
      'report.warning': 'Папярэджанне',
      'report.ok': 'ОК',
      'report.info': 'Інфа',
      'report.clearFilter': 'Паказаць усе',
      'report.filteredChecks': '%s',
      'report.responseTime': 'Час адказу',
      'report.checked': 'Праверана',
      'report.performance': 'Хуткасць',
      'report.speedScore': 'Ацэначны бал хуткасці',
      'report.speedLead':
        'Эўрыстычны бал з часу адказу, вагі HTML, JS/CSS, сціскання і рэсурсаў — не лабараторны PageSpeed Insights. Націсніце картку метрыкі для поўнага гайда.',
      'report.grade': 'Ацэнка',
      'report.guide': 'Гайд →',
      'report.deductions': 'Зніжэнні бала',
      'report.close': 'Закрыць',
      'report.affects': 'На што ўплывае',
      'report.depends': 'Ад чаго залежыць',
      'report.todo': 'Што рабіць',
      'report.allChecks': 'Усе праверкі',
      'report.chars': 'сімв.',
      'report.titleMissing': 'Title адсутнічае',
      'report.descMissing': 'Meta description адсутнічае',
      'report.metaDescription': 'Meta description',
      'report.links': 'Спасылкі',
      'report.linksHint': 'унутраныя / знешнія',
      'report.imagesAlt': 'Выявы без alt',
      'report.imagesAltHint': 'без alt + пустыя',
      'report.jsCss': 'JS / CSS',
      'report.jsCssHint': 'знешнія файлы',
      'report.htmlText': 'HTML / тэкст',
      'report.htmlTextHint': 'памер / словы',
      'report.checksPerformed': 'Праверак: {n}',
      'report.showDetails': 'Паказаць дэталі ▼',
      'report.hideDetails': 'Схаваць дэталі ▲',
      'report.rawData': 'Сырыя даныя',
      'report.none': 'Няма',
      'report.found': 'Знойдзена',
      'vital.good': 'Добра',
      'vital.needs-improvement': 'Трэба палепшыць',
      'vital.poor': 'Кепска',
      'cat.SEO': 'SEO',
      'cat.Performance': 'Хуткасць',
      'cat.Security': 'Бяспека',
      'cat.Accessibility': 'Даступнасць',
      'cat.Technical': 'Тэхнічнае',
      'cat.Indexing': 'Індэксацыя',
      'cat.Social': 'Сацсеткі',
      'cat.Content': 'Кантэнт',
      'cat.Media': 'Медыя',
      'cat.Links': 'Спасылкі',
      'cat.Branding': 'Брэнд',
      'cat.Mobile': 'Мабільнае',
      'report.pageTitle': 'Title',
      'report.h1': 'H1',
      'raw.httpStatus': 'HTTP-статус',
      'raw.contentType': 'Content-Type',
      'raw.redirects': 'Рэдырэкты',
      'raw.canonical': 'Canonical',
      'raw.robotsMeta': 'Meta robots',
      'raw.sitemap': 'Sitemap',
      'raw.jsonLd': 'JSON-LD',
      'raw.hreflang': 'hreflang',
      'raw.compression': 'Сцісканне',
      'metric.Response time': 'Час адказу',
      'metric.HTML size': 'Памер HTML',
      'metric.Scripts': 'Скрыпты',
      'metric.Stylesheets': 'Стылі',
      'metric.Images without size': 'Выявы без памераў',
      'metric.Compression': 'Сцісканне',
      'metric.Failed resources': 'Зламаныя рэсурсы',
      'metric.Heavy images': 'Цяжкія выявы',
      'metric.Weak caching': 'Слабы кэш',
    },
    fr: {
      'theme.dark': 'Sombre',
      'theme.light': 'Clair',
      'theme.aria': 'Changer de thème',
      'lang.aria': 'Changer de langue',
      'lang.en': 'EN',
      'lang.fr': 'FR',
      'lang.be': 'BE',
      'home.eyebrow': 'SEO • Sécurité • Performance',
      'home.title': 'Audit Express approfondi de site',
      'home.lead':
        'Vérifie l’indexation, les meta tags, les liens, les médias, les en-têtes de sécurité, la vitesse, l’accessibilité et l’hygiène technique de base de la page.',
      'home.urlLabel': 'URL du site',
      'home.run': 'Lancer l’audit',
      'home.auditing': 'Audit…',
      'home.loadingTitle': 'Audit en cours…',
      'home.errorFallback': 'Échec de l’audit du site.',
      'home.hint0':
        'Vérification SEO, sécurité, liens et performance. Cela peut prendre jusqu’à une minute.',
      'home.hint1': 'Récupération du HTML et suivi des redirections…',
      'home.hint2': 'Analyse des meta tags, titres et données structurées…',
      'home.hint3': 'Vérification des liens, images et ressources statiques…',
      'home.hint4': 'Contrôle des en-têtes de sécurité et du TLS…',
      'report.newAudit': '← Nouvel audit',
      'report.title': 'Résultats de l’audit',
      'report.checkedUrl': 'URL vérifiée :',
      'report.overallScore': 'Score global',
      'report.scoreHint': '100 − 12×critique − 5×avertissement − 1×info',
      'report.speedLeadShort': 'Estimation heuristique de vitesse — pas un lab PageSpeed.',
      'report.words': 'mots',
      'report.export': 'Exporter',
      'report.exportHtml': 'HTML (Email)',
      'report.critical': 'Critique',
      'report.warning': 'Avertissement',
      'report.ok': 'OK',
      'report.info': 'Info',
      'report.clearFilter': 'Tout afficher',
      'report.filteredChecks': '%s problèmes',
      'report.responseTime': 'Temps de réponse',
      'report.checked': 'Vérifié',
      'report.performance': 'Performance',
      'report.speedScore': 'Score de vitesse estimé',
      'report.speedLead':
        'Score heuristique basé sur le temps de réponse, le poids HTML, JS/CSS, la compression et les assets — pas un run lab PageSpeed Insights. Cliquez une carte métrique pour le guide complet.',
      'report.grade': 'Note',
      'report.guide': 'Guide →',
      'report.deductions': 'Pénalités de score',
      'report.close': 'Fermer',
      'report.affects': 'Ce que cela affecte',
      'report.depends': 'De quoi cela dépend',
      'report.todo': 'Que faire',
      'report.allChecks': 'Toutes les vérifications',
      'report.chars': 'car.',
      'report.titleMissing': 'Title manquant',
      'report.descMissing': 'Meta description manquante',
      'report.metaDescription': 'Meta description',
      'report.links': 'Liens',
      'report.linksHint': 'internes / externes',
      'report.imagesAlt': 'Images sans alt',
      'report.imagesAltHint': 'manquants + vides',
      'report.jsCss': 'JS / CSS',
      'report.jsCssHint': 'fichiers externes',
      'report.htmlText': 'HTML / texte',
      'report.htmlTextHint': 'taille / mots',
      'report.checksPerformed': '{n} vérifications effectuées',
      'report.showDetails': 'Afficher les détails ▼',
      'report.hideDetails': 'Masquer les détails ▲',
      'report.rawData': 'Données brutes',
      'report.none': 'Aucun',
      'report.found': 'Trouvé',
      'vital.good': 'Bon',
      'vital.needs-improvement': 'À améliorer',
      'vital.poor': 'Faible',
      'cat.SEO': 'SEO',
      'cat.Performance': 'Performance',
      'cat.Security': 'Sécurité',
      'cat.Accessibility': 'Accessibilité',
      'cat.Technical': 'Technique',
      'cat.Indexing': 'Indexation',
      'cat.Social': 'Social',
      'cat.Content': 'Contenu',
      'cat.Media': 'Médias',
      'cat.Links': 'Liens',
      'cat.Branding': 'Marque',
      'cat.Mobile': 'Mobile',
      'report.pageTitle': 'Title',
      'report.h1': 'H1',
      'raw.httpStatus': 'Statut HTTP',
      'raw.contentType': 'Content-Type',
      'raw.redirects': 'Redirections',
      'raw.canonical': 'Canonical',
      'raw.robotsMeta': 'Meta robots',
      'raw.sitemap': 'Sitemap',
      'raw.jsonLd': 'JSON-LD',
      'raw.hreflang': 'hreflang',
      'raw.compression': 'Compression',
      'metric.Response time': 'Temps de réponse',
      'metric.HTML size': 'Taille HTML',
      'metric.Scripts': 'Scripts',
      'metric.Stylesheets': 'Feuilles de style',
      'metric.Images without size': 'Images sans dimensions',
      'metric.Compression': 'Compression',
      'metric.Failed resources': 'Ressources en échec',
      'metric.Heavy images': 'Images lourdes',
      'metric.Weak caching': 'Cache faible',
    },
  };

  var LANGS = ['en', 'fr', 'be'];

  function getPreferredLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (LANGS.indexOf(saved) !== -1) return saved;
    } catch (_) {}
    return 'en';
  }

  function t(key, lang) {
    lang = lang || getPreferredLang();
    var pack = dict[lang] || dict.en;
    return pack[key] != null ? pack[key] : dict.en[key] || key;
  }

  function applyI18n(lang) {
    lang = lang || getPreferredLang();
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var value = t(key, lang);
      var n = el.getAttribute('data-i18n-n');
      if (n != null) value = value.replace('{n}', n);
      el.textContent = value;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute(
        'placeholder',
        t(el.getAttribute('data-i18n-placeholder'), lang),
      );
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'), lang));
    });

    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var fallback = el.getAttribute('data-i18n-fallback') || '';
      var key = el.getAttribute('data-i18n-title');
      var translated = t(key, lang);
      el.textContent =
        translated && translated !== key ? translated : fallback || el.textContent;
    });

    document.querySelectorAll('[data-i18n-category]').forEach(function (el) {
      var cat = el.getAttribute('data-i18n-category');
      var count = el.getAttribute('data-i18n-count');
      var key = 'cat.' + cat;
      var pack = dict[lang] || dict.en;
      var label =
        (pack[key] != null && pack[key]) ||
        (dict.en[key] != null && dict.en[key]) ||
        cat;
      var icon = el.getAttribute('data-i18n-icon') || '';
      if (count) {
        el.textContent = (icon ? icon + ' ' : '') + label + ' (' + count + ')';
      } else {
        el.textContent = label;
      }
    });

    document.querySelectorAll('[data-i18n-level]').forEach(function (el) {
      var level = el.getAttribute('data-i18n-level');
      var map = {
        success: 'report.ok',
        warning: 'report.warning',
        danger: 'report.critical',
        info: 'report.info',
      };
      el.textContent = t(map[level] || 'report.info', lang);
    });

    document.querySelectorAll('[data-i18n-metric]').forEach(function (el) {
      var metric = el.getAttribute('data-i18n-metric');
      var value = el.getAttribute('data-i18n-value') || '';
      el.textContent = t('metric.' + metric, lang) + ': ' + value;
    });

    document.querySelectorAll('[data-vital-short]').forEach(function (el) {
      var key = el.getAttribute('data-vital-short');
      var guide = (vitalGuides[lang] || vitalGuides.en)[key];
      if (guide) el.textContent = guide.short;
    });

    document.querySelectorAll('[data-vital-label]').forEach(function (el) {
      var key = el.getAttribute('data-vital-label');
      var guide = (vitalGuides[lang] || vitalGuides.en)[key];
      if (guide) el.textContent = guide.label;
    });

    document.querySelectorAll('[data-vital-status]').forEach(function (el) {
      var status = el.getAttribute('data-vital-status');
      el.textContent = t('vital.' + status, lang);
    });

    var langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
      langToggle.setAttribute('aria-pressed', lang === 'en' ? 'false' : 'true');
      langToggle.setAttribute('aria-label', t('lang.aria', lang));
    }

    var themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', t('theme.aria', lang));
    }

    window.__vitalGuides = vitalGuides[lang] || vitalGuides.en;
    if (typeof window.__translateInsights === 'function') {
      window.__translateInsights(lang);
    }
    window.dispatchEvent(
      new CustomEvent('site-audit:lang', { detail: { lang: lang } }),
    );
  }

  function toggleLang() {
    var current = getPreferredLang();
    var idx = LANGS.indexOf(current);
    applyI18n(LANGS[(idx + 1) % LANGS.length]);
  }

  window.__i18n = {
    t: t,
    apply: applyI18n,
    toggle: toggleLang,
    getLang: getPreferredLang,
    langs: LANGS,
    vitalGuides: vitalGuides,
    hints: function (lang) {
      lang = lang || getPreferredLang();
      return [
        t('home.hint0', lang),
        t('home.hint1', lang),
        t('home.hint2', lang),
        t('home.hint3', lang),
        t('home.hint4', lang),
      ];
    },
  };

  applyI18n(getPreferredLang());

  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('lang-toggle');
    if (toggle) toggle.addEventListener('click', toggleLang);
    applyI18n(getPreferredLang());
  });
})();
