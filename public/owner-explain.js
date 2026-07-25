(function () {
  // Plain-language explanations for site owners (no jargon).
  // Keys = English insight titles (exact) or regex patterns.
  var plain = {
    en: {
      introBad:
        'Hello! We checked your website and found a few serious problems that are worth fixing first. In simple words:',
      introOk:
        'Hello! We checked your website. There are no critical problems right now — nice work. Still keep an eye on warnings when you can.',
      outro:
        'If you want, send this list to your developer or hosting support and ask them to fix these points.',
      copy: 'Copy message',
      copied: 'Copied',
      empty: 'No critical issues to explain.',
      button: 'Explanation for site owner',
      title: 'Message for the site owner',
      close: 'Close',
    },
    be: {
      introBad:
        'Вітаем! Мы праверылі ваш сайт і знайшлі некалькі сур’ёзных праблем, якія лепш выправіць у першую чаргу. Простымі словамі:',
      introOk:
        'Вітаем! Мы праверылі ваш сайт. Крытычных праблем зараз няма — добрая навіна. Папярэджанні можна разгледзець па меры магчымасці.',
      outro:
        'Калі хочаце, перашліце гэты спіс распрацоўшчыку або ў падтрымку хостынгу і папрасіце выправіць гэтыя пункты.',
      copy: 'Скапіяваць паведамленне',
      copied: 'Скапіявана',
      empty: 'Няма крытычных праблем для тлумачэння.',
      button: 'Тлумачэнне для ўладальніка сайта',
      title: 'Паведамленне для ўладальніка сайта',
      close: 'Закрыць',
    },
  };

  var exact = {
    en: {
      'HTTPS missing':
        'The site opens without a lock (without secure connection). Visitors may see a browser warning, and search engines trust such sites less.',
      'HTTP does not redirect to HTTPS':
        'There is a secure version of the site, but the usual address does not automatically send people there. Visitors can land on the unsafe version.',
      'Title tag missing':
        'The page has no name for Google and for the browser tab. Search results look incomplete and unclear.',
      'No meta description':
        'There is no short page description for search results. Google may show a random text snippet instead.',
      'H1 missing':
        'The page has no main heading. It is harder for people and search engines to understand what the page is about.',
      'Canonical not specified':
        'Search engines may treat copies of this page as separate pages. That can split your visibility.',
      'Canonical points to unavailable URL':
        'The “main” address of the page does not open. Search engines can get confused about which version to show.',
      'Canonical cannot be read':
        'The “main page address” setting is broken, so search engines may not understand the preferred version.',
      'Canonical points to different domain':
        'The page points to another website as the main version. Traffic and search credit can go elsewhere.',
      'Meta robots blocks indexing or links':
        'The page asks search engines not to index it or not to follow links. It may not appear in Google.',
      'robots.txt blocks page':
        'A site file tells search engines not to check this page. It can stay invisible in search.',
      'Broken links found':
        'Some links on the page lead nowhere. Visitors hit errors, and it looks unprofessional.',
      'Unreachable page resources found':
        'Some images, styles or scripts fail to load. Parts of the page can look broken.',
      'Mixed content found':
        'On the secure site, some files still load insecurely. Browsers can block them and break the look.',
      'HTML too heavy':
        'The page code is very heavy. On weak internet or phones it can load slowly.',
      'Very slow response':
        'The server answers too slowly. People may leave before the page opens.',
      'TLS certificate expired':
        'The site security certificate has expired. Browsers will warn visitors that the site is unsafe.',
      'TLS certificate failed verification':
        'The site security certificate looks wrong. Browsers may block or scare visitors away.',
      'TLS certificate could not be verified':
        'We could not confirm the site security certificate. Visitors may see trust warnings.',
      'JSON-LD contains errors':
        'Extra information for Google (rich results) is written incorrectly, so Google may ignore it.',
      'OG image unavailable':
        'When the link is shared on social networks, the preview image does not open.',
      'OG image specified incorrectly':
        'The social preview image is set incorrectly, so shares may look empty or broken.',
      'Open Graph incomplete':
        'Social networks may not show a nice title/description/image when someone shares your link.',
      'Twitter Card incomplete':
        'On X/Twitter the shared link may look plain, without a proper card preview.',
      'No meta viewport':
        'The page is not prepared for phones. On mobile it can look zoomed wrongly or hard to use.',
      'Charset not specified':
        'Text encoding is not set. Letters and symbols can display as gibberish.',
      'HTML lang not specified':
        'The page language is not marked. Browsers and tools understand the content worse.',
      'Unusual Content-Type':
        'The server sends the page in an unexpected format. Some browsers or bots may mishandle it.',
      'Cookies missing protective flags':
        'Login/session cookies are not fully protected. That raises the risk of account misuse.',
      'Form fields missing label':
        'Some form fields have no clear labels. People using screen readers (and many others) can get stuck.',
      'Links or buttons without clear text':
        'Some buttons or links have no clear text. Visitors may not understand what they click.',
      'Images missing width/height':
        'Images do not reserve space while loading, so the page can jump and cause mis-taps.',
      'Image alt issues':
        'Many images have no text description. The site is harder for visually impaired users, and Google Images gets less signal.',
      'Heavy images found':
        'Some images are too large. The page becomes heavy and slow, especially on mobile.',
      'Static resources have weak caching':
        'Returning visitors re-download the same files again and again. The site feels slower than it should.',
      'Compression not detected':
        'The server does not shrink text files before sending. Loading takes more time and mobile data.',
      'Heading hierarchy broken':
        'Headings jump levels (for example from H2 to H4). The page structure is harder to follow.',
      'Empty headings found':
        'There are empty headings on the page. That confuses navigation and accessibility tools.',
      'Little text on page':
        'There is very little text. Search engines may treat the page as thin and rank it poorly.',
      'Favicon not found':
        'There is no site icon. In browser tabs and bookmarks the site looks unfinished.',
      'hreflang errors found':
        'Language version links are set incorrectly. The wrong language version may show in search.',
      'Potentially low contrast found':
        'Some text may be hard to read because it blends into the background.',
      'Sitemap not found':
        'There is no site map file. Search engines may discover new pages more slowly.',
      'robots.txt not found':
        'There is no robots.txt file. Crawling still works, but you have less control over bots.',
    },
    be: {
      'HTTPS missing':
        'Сайт адкрываецца без «замка» (без бяспечнага злучэння). Наведвальнікі могуць убачыць папярэджанне браўзера, а пошукавікі давяраюць такім сайтам менш.',
      'HTTP does not redirect to HTTPS':
        'Ёсць бяспечная версія сайта, але звычайны адрас сам туды не перанакіроўвае. Людзі могуць трапіць на небяспечную версію.',
      'Title tag missing':
        'У старонкі няма назвы для Google і для ўкладкі браўзера. У пошуку яна выглядае няпоўна і незразумела.',
      'No meta description':
        'Няма кароткага апісання для пошуку. Google можа паказаць выпадковы кавалак тэксту.',
      'H1 missing':
        'Няма галоўнага загалоўка. Людзям і пошукавікам складаней зразумець, пра што старонка.',
      'Canonical not specified':
        'Пошукавікі могуць лічыць копіі гэтай старонкі асобнымі. Бачнасць у пошуку можа «размазвацца».',
      'Canonical points to unavailable URL':
        '«Галоўны» адрас старонкі не адкрываецца. Пошукавікі могуць заблытацца, якую версію паказваць.',
      'Canonical cannot be read':
        'Налада «галоўнага адраса» старонкі зламаная, таму пошукавікі могуць не зразумець патрэбную версію.',
      'Canonical points to different domain':
        'Старонка паказвае на іншы сайт як на асноўную версію. Трафік і «вага» ў пошуку могуць сыходзіць іншым.',
      'Meta robots blocks indexing or links':
        'Старонка просіць пошукавікі яе не індэксаваць або не пераходзіць па спасылках. Яна можа не з’явіцца ў Google.',
      'robots.txt blocks page':
        'Файл сайта кажа пошукавікам не правяраць гэтую старонку. Яна можа застацца нябачнай у пошуку.',
      'Broken links found':
        'Некаторыя спасылкі вядуць «у нікуды». Наведвальнікі бачаць памылкі, і сайт выглядае неакуратна.',
      'Unreachable page resources found':
        'Некаторыя выявы, стылі ці скрыпты не загружаюцца. Часткі старонкі могуць выглядаць зламанымі.',
      'Mixed content found':
        'На бяспечным сайце частка файлаў усё яшчэ грузіцца небяспечна. Браўзер можа іх заблакаваць і сапсаваць выгляд.',
      'HTML too heavy':
        'Код старонкі вельмі цяжкі. На слабым інтэрнэце ці тэлефоне яна можа грузіцца доўга.',
      'Very slow response':
        'Сервер адказвае занадта павольна. Людзі могуць сысці, пакуль старонка нават не адкрыецца.',
      'TLS certificate expired':
        'Сертыфікат бяспекі сайта пратэрмінаваны. Браўзеры будуць папярэджваць, што сайт небяспечны.',
      'TLS certificate failed verification':
        'Сертыфікат бяспекі выглядае няправільным. Браўзеры могуць блакаваць сайт або палохаць наведвальнікаў.',
      'TLS certificate could not be verified':
        'Мы не змаглі пацвердзіць сертыфікат бяспекі. Наведвальнікі могуць убачыць папярэджанні даверу.',
      'JSON-LD contains errors':
        'Дадатковая інфармацыя для Google напісана з памылкамі, таму Google можа яе ігнараваць.',
      'OG image unavailable':
        'Калі спасылку дзеляцца ў сацсетках, выява прэвью не адкрываецца.',
      'OG image specified incorrectly':
        'Выява для сацсетак зададзена няправільна, таму рэпост можа выглядаць пустым.',
      'Open Graph incomplete':
        'Сацсеткі могуць не паказаць прыгожую назву/апісанне/выяву пры шэрынгу спасылкі.',
      'Twitter Card incomplete':
        'У X/Twitter спасылка можа выглядаць бедна, без нармальнай карткі прэвью.',
      'No meta viewport':
        'Старонка не падрыхтавана для тэлефонаў. На мабільным яна можа выглядаць нязручна.',
      'Charset not specified':
        'Не зададзена кадзіроўка тэксту. Літары і сімвалы могуць паказвацца «краказябрамі».',
      'HTML lang not specified':
        'Не пазначана мова старонкі. Браўзеры і інструменты горш разумеюць кантэнт.',
      'Unusual Content-Type':
        'Сервер аддае старонку ў нечаканым фармаце. Некаторыя браўзеры ці боты могуць апрацаваць яе няправільна.',
      'Cookies missing protective flags':
        'Cookie сесіі/уваходу абаронены не поўнасцю. Гэта павышае рызыку злоўжывання акаўнтам.',
      'Form fields missing label':
        'У некаторых палёў формы няма зразумелых подпісаў. Людзям са скрынрыдарамі (і многім іншым) цяжка запаўняць форму.',
      'Links or buttons without clear text':
        'У некаторых кнопак ці спасылак няма зразумелага тэксту. Невідавочна, на што націскаеш.',
      'Images missing width/height':
        'Выявы не рэзервуюць месца пры загрузцы, таму старонка можа «скакаць» і правакаваць памылковыя націскі.',
      'Image alt issues':
        'У многіх выяў няма тэкставага апісання. Сайт горш даступны для людзей са слабым зрокам, і Google Images атрымлівае менш сігналаў.',
      'Heavy images found':
        'Некаторыя выявы занадта вялікія. Старонка становіцца цяжкай і павольнай, асабліва на мабільным.',
      'Static resources have weak caching':
        'Паўторныя наведвальнікі зноў і зноў спампоўваюць тыя ж файлы. Сайт адчуваецца павольней, чым мог бы.',
      'Compression not detected':
        'Сервер не сціскае тэкставыя файлы перад адпраўкай. Загрузка займае больш часу і мабільнага трафіку.',
      'Heading hierarchy broken':
        'Загалоўкі скачуць па ўзроўнях (напрыклад з H2 адразу на H4). Структуру старонкі цяжэй чытаць.',
      'Empty headings found':
        'На старонцы ёсць пустыя загалоўкі. Гэта блытае навігацыю і інструменты даступнасці.',
      'Little text on page':
        'Тэксту вельмі мала. Пошукавікі могуць лічыць старонку «тонкай» і дрэнна яе паказваць.',
      'Favicon not found':
        'Няма іконкі сайта. Ва ўкладках і закладках сайт выглядае незавершаным.',
      'hreflang errors found':
        'Спасылкі на моўныя версіі наладжаны няправільна. У пошуку можа паказвацца няправільная мова.',
      'Potentially low contrast found':
        'Некаторы тэкст можа быць дрэнна чытэльны, бо зліваецца з фонам.',
      'Sitemap not found':
        'Няма файла карты сайта. Пошукавікі могуць павольней знаходзіць новыя старонкі.',
      'robots.txt not found':
        'Няма файла robots.txt. Абход усё роўна працуе, але кантролю над ботамі менш.',
    },
  };

  var patterns = [
    {
      re: /^Server returned error \d+$/,
      en: 'The server is returning an error. For visitors the site looks unavailable.',
      be: 'Сервер вяртае памылку. Для наведвальнікаў сайт выглядае недаступным.',
    },
    {
      re: /^Page returned status [45]\d\d$/,
      en: 'The page opens with an error code. People cannot use it normally.',
      be: 'Старонка адкрываецца з кодам памылкі. Нармальна карыстацца ёй нельга.',
    },
    {
      re: /^Very slow response \(\d+ ms\)$/,
      en: 'The server answers too slowly. People may leave before the page opens.',
      be: 'Сервер адказвае занадта павольна. Людзі могуць сысці, пакуль старонка не адкрыецца.',
    },
    {
      re: /^Slow server response \(\d+ ms\)$/,
      en: 'The site answers slower than comfortable. Loading feels sluggish.',
      be: 'Сайт адказвае павольней за камфортны ўзровень. Загрузка адчуваецца цяжкай.',
    },
    {
      re: /^Estimated performance score: (\d+)\/100 \(grade [A-F]\)$/,
      en: 'Overall speed looks weak (about $1 out of 100). Visitors may feel the site is slow.',
      be: 'Агульная хуткасць выглядае слабай (каля $1 з 100). Наведвальнікі могуць адчуваць, што сайт тармозіць.',
    },
    {
      re: /^Estimated Largest Contentful Paint:/,
      en: 'The main content appears too late. The page feels empty for too long.',
      be: 'Асноўны кантэнт з’яўляецца занадта позна. Старонка доўга выглядае пустой.',
    },
    {
      re: /^Estimated Cumulative Layout Shift:/,
      en: 'The page jumps while loading. People can accidentally tap the wrong button.',
      be: 'Старонка «скача» падчас загрузкі. Людзі могуць выпадкова націснуць не тую кнопку.',
    },
    {
      re: /^Estimated First Input Delay:/,
      en: 'After the page appears, the first tap/click reacts with a delay. It feels “frozen”.',
      be: 'Пасля з’яўлення старонкі першы націск/клік рэагуе з затрымкай. Адчуваецца, нібыта «завісла».',
    },
    {
      re: /^Estimated Time to First Byte:/,
      en: 'The server starts answering late. Everything else has to wait.',
      be: 'Сервер пачынае адказваць позна. Усё астатняе чакае.',
    },
    {
      re: /^Estimated First Contentful Paint:/,
      en: 'The first text or picture appears late. Visitors stare at a blank screen longer.',
      be: 'Першы тэкст ці выява з’яўляюцца позна. Наведвальнікі даўжэй глядзяць на пусты экран.',
    },
    {
      re: /^Missing header /,
      en: 'An important security setting is missing. The site is less protected from common attacks.',
      be: 'Бракуе важнай налады бяспекі. Сайт горш абаронены ад тыповых атак.',
    },
    {
      re: /^Multiple H1 found/,
      en: 'There are several main headings. The page topic becomes less clear.',
      be: 'Галоўных загалоўкаў некалькі. Тэма старонкі становіцца менш зразумелай.',
    },
  ];

  function getLang() {
    return document.documentElement.getAttribute('data-lang') === 'be' ? 'be' : 'en';
  }

  function tUi(key) {
    return (plain[getLang()] || plain.en)[key] || plain.en[key] || key;
  }

  function explainTitle(enTitle) {
    var lang = getLang();
    var map = exact[lang] || exact.en;
    if (map[enTitle]) return map[enTitle];
    if (exact.en[enTitle] && lang === 'be') {
      // fall through to patterns / en fallback below
    } else if (exact.en[enTitle]) {
      return exact.en[enTitle];
    }

    for (var i = 0; i < patterns.length; i++) {
      var m = enTitle.match(patterns[i].re);
      if (!m) continue;
      var out = patterns[i][lang] || patterns[i].en;
      for (var g = 1; g < m.length; g++) {
        out = out.replace('$' + g, m[g]);
      }
      return out;
    }

    // Last resort: use translated insight text if available, else English text from DOM later
    return null;
  }

  function collectCriticalItems() {
    var items = [];
    document.querySelectorAll('.insight-item[data-level="danger"]').forEach(function (el) {
      var titleEl = el.querySelector('.insight-title');
      if (!titleEl) return;
      var enTitle = titleEl.getAttribute('data-en') || titleEl.textContent;
      var textEl = el.querySelector('.insight-text');
      var fallback =
        (textEl && (textEl.getAttribute('data-en') || textEl.textContent)) || '';
      var explained = explainTitle(enTitle) || fallback;
      if (explained) items.push(explained);
    });

    // If performance grade is poor, add a plain note even if already covered
    var scoreEl = document.querySelector('[data-perf-score]');
    if (scoreEl) {
      var score = Number(scoreEl.getAttribute('data-perf-score'));
      var grade = scoreEl.getAttribute('data-perf-grade') || '';
      if (score < 60 || grade === 'F' || grade === 'D') {
        var msg =
          getLang() === 'be'
            ? 'Хуткасць сайта зараз слабая. Людзі могуць сыходзіць, не дачакаўшыся загрузкі.'
            : 'Site speed is currently weak. People may leave before the page finishes loading.';
        if (items.indexOf(msg) === -1) items.push(msg);
      }
    }

    // Deduplicate similar lines
    var seen = {};
    return items.filter(function (line) {
      var key = line.slice(0, 80);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function buildMessage() {
    var items = collectCriticalItems();
    if (!items.length) {
      return tUi('introOk') + '\n\n' + tUi('outro');
    }
    var bullets = items.map(function (line) {
      return '• ' + line;
    });
    return tUi('introBad') + '\n\n' + bullets.join('\n\n') + '\n\n' + tUi('outro');
  }

  function openOwnerExplain() {
    var modal = document.getElementById('owner-explain-modal');
    var body = document.getElementById('owner-explain-body');
    var title = document.getElementById('owner-explain-title');
    var copyBtn = document.getElementById('owner-explain-copy');
    if (!modal || !body) return;

    title.textContent = tUi('title');
    copyBtn.textContent = tUi('copy');
    document.getElementById('owner-explain-close').textContent = tUi('close');
    body.textContent = buildMessage();

    modal.hidden = false;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeOwnerExplain() {
    var modal = document.getElementById('owner-explain-modal');
    if (!modal) return;
    modal.hidden = true;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  async function copyOwnerExplain() {
    var body = document.getElementById('owner-explain-body');
    var copyBtn = document.getElementById('owner-explain-copy');
    if (!body || !copyBtn) return;
    try {
      await navigator.clipboard.writeText(body.textContent || '');
      copyBtn.textContent = tUi('copied');
      setTimeout(function () {
        copyBtn.textContent = tUi('copy');
      }, 1600);
    } catch (_) {
      var range = document.createRange();
      range.selectNodeContents(body);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function refreshOwnerUi() {
    var label = document.getElementById('owner-explain-btn-label');
    if (label) label.textContent = tUi('button');
    var modal = document.getElementById('owner-explain-modal');
    if (modal && !modal.hidden) {
      document.getElementById('owner-explain-title').textContent = tUi('title');
      document.getElementById('owner-explain-copy').textContent = tUi('copy');
      document.getElementById('owner-explain-close').textContent = tUi('close');
      document.getElementById('owner-explain-body').textContent = buildMessage();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('owner-explain-btn');
    if (!btn) return;
    refreshOwnerUi();
    btn.addEventListener('click', openOwnerExplain);
    document
      .getElementById('owner-explain-close')
      .addEventListener('click', closeOwnerExplain);
    document
      .getElementById('owner-explain-copy')
      .addEventListener('click', copyOwnerExplain);
    document.getElementById('owner-explain-modal').addEventListener('click', function (e) {
      if (e.target.id === 'owner-explain-modal') closeOwnerExplain();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeOwnerExplain();
    });
  });

  window.addEventListener('site-audit:lang', refreshOwnerUi);
  window.__buildOwnerExplain = buildMessage;
})();
