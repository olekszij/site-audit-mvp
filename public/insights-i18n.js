/* Auto-assisted Belarusian translations for audit insights */
(function () {
  var titles = {
  "Broken links found": "Знойдзены зламаныя спасылкі",
  "Canonical cannot be read": "Canonical нечытэльны",
  "Canonical configured correctly": "Canonical наладжаны правільна",
  "Canonical not specified": "Canonical не ўказаны",
  "Canonical points to different domain": "Canonical вядзе на іншы дамен",
  "Canonical points to unavailable URL": "Canonical вядзе на недаступны URL",
  "Canonical specified as relative URL": "Canonical зададзены як адносны URL",
  "Charset not specified": "Charset не ўказаны",
  "Charset specified": "Charset указаны",
  "Compression enabled": "Сцісканне ўключана",
  "Compression not detected": "Сцісканне не выяўлена",
  "Content type suitable for HTML page": "Тып кантэнту падыходзіць для HTML",
  "Cookies missing protective flags": "У cookie няма ахоўных сцягоў",
  "Cookies protected with flags": "Cookie абаронены сцягамі",
  "Empty headings found": "Знойдзены пустыя загалоўкі",
  "Favicon found": "Favicon знойдзены",
  "Favicon not found": "Favicon не знойдзены",
  "Form fields labeled": "Палі формы маюць label",
  "Form fields missing label": "Палям формы бракуе label",
  "H1 found": "H1 знойдзены",
  "H1 missing": "H1 адсутнічае",
  "HTML lang not specified": "HTML lang не ўказаны",
  "HTML larger than usual": "HTML большы за звычайны",
  "HTML size normal": "Памер HTML у норме",
  "HTML too heavy": "HTML занадта цяжкі",
  "HTTP does not redirect to HTTPS": "HTTP не рэдырэктыць на HTTPS",
  "HTTP status is normal": "HTTP-статус у норме",
  "HTTPS enabled": "HTTPS уключаны",
  "HTTPS missing": "HTTPS адсутнічае",
  "Heading hierarchy broken": "Іерархія загалоўкаў парушана",
  "Heading hierarchy looks sequential": "Іерархія загалоўкаў выглядае паслядоўнай",
  "Heavy images found": "Знойдзены цяжкія выявы",
  "Image alt filled": "Alt у выяў запоўнены",
  "Image alt issues": "Праблемы з alt у выяў",
  "Image dimensions set": "Памеры выяў зададзены",
  "Images missing width/height": "У выяў няма width/height",
  "JSON-LD contains errors": "JSON-LD утрымлівае памылкі",
  "JSON-LD valid": "JSON-LD карэктны",
  "JSON-LD/schema.org not found": "JSON-LD/schema.org не знойдзены",
  "Lazy loading candidates found": "Знойдзены кандыдаты на lazy loading",
  "Link and button text readable": "Тэкст спасылак і кнопак чытэльны",
  "Link sample checked": "Правераны ўзор спасылак",
  "Links or buttons without clear text": "Спасылкі ці кнопкі без зразумелага тэксту",
  "Little text on page": "Мала тэксту на старонцы",
  "Many JS/CSS files": "Шмат JS/CSS файлаў",
  "Meta description filled correctly": "Meta description запоўнены карэктна",
  "Meta robots blocks indexing or links": "Meta robots блакуе індэксацыю ці спасылкі",
  "Meta robots does not block page": "Meta robots не блакуе старонку",
  "Mixed content found": "Знойдзены mixed content",
  "Mixed content not found": "Mixed content не знойдзены",
  "No broken links found": "Зламаных спасылак няма",
  "No form fields found": "Палёў формы не знойдзена",
  "No images found on page": "На старонцы няма выяў",
  "No links to check found": "Няма спасылак для праверкі",
  "No meta description": "Няма meta description",
  "No meta viewport": "Няма meta viewport",
  "OG image available": "OG image даступны",
  "OG image specified incorrectly": "OG image указаны няправільна",
  "OG image unavailable": "OG image недаступны",
  "Open Graph configured": "Open Graph наладжаны",
  "Open Graph incomplete": "Open Graph няпоўны",
  "Page language specified": "Мова старонкі ўказана",
  "Potentially low contrast found": "Магчыма нізкі кантраст",
  "Server responds quickly": "Сервер адказвае хутка",
  "Set-Cookie not found": "Set-Cookie не знойдзены",
  "Sitemap not found": "Sitemap не знойдзены",
  "Static resource caching looks good": "Кэш статыкі выглядае добра",
  "Static resources have weak caching": "У статычных рэсурсаў слабы кэш",
  "TLS certificate could not be verified": "TLS-сертыфікат не ўдалося праверыць",
  "TLS certificate current": "TLS-сертыфікат актуальны",
  "TLS certificate expired": "TLS-сертыфікат пратэрмінаваны",
  "TLS certificate expiring soon": "TLS-сертыфікат хутка скончыцца",
  "TLS certificate failed verification": "Праверка TLS-сертыфіката не прайшла",
  "TLS certificate near expiration": "TLS-сертыфікат блізкі да заканчэння",
  "Text volume looks sufficient": "Аб’ём тэксту выглядае дастатковым",
  "Title and H1 match": "Title і H1 супадаюць",
  "Title has good length": "Даўжыня Title добрая",
  "Title tag missing": "Тэг Title адсутнічае",
  "Title too generic": "Title занадта агульны",
  "Twitter Card configured": "Twitter Card наладжаны",
  "Twitter Card incomplete": "Twitter Card няпоўны",
  "Unreachable page resources found": "Знойдзены недасяжныя рэсурсы",
  "Unusual Content-Type": "Незвычайны Content-Type",
  "Viewport set": "Viewport зададзены",
  "hreflang errors found": "Знойдзены памылкі hreflang",
  "hreflang looks correct": "hreflang выглядае карэктна",
  "hreflang not found": "hreflang не знойдзены",
  "robots.txt blocks page": "robots.txt блакуе старонку",
  "robots.txt does not block checked page": "robots.txt не блакуе правераную старонку",
  "robots.txt not found": "robots.txt не знойдзены",
  "JS/CSS file count acceptable": "Колькасць JS/CSS файлаў прымальная",
  "Sitemap found": "Sitemap знойдзены",
  "No critical contrast issues found": "Крытычных праблем кантрасту не знойдзена",
};
  var texts = {
  "Add meta charset to avoid encoding issues.": "Дадайце meta charset, каб пазбегнуць праблем з кадзіроўкай.",
  "Add sitemap.xml or Sitemap link in robots.txt to speed up page discovery.": "Дадайце sitemap.xml або спасылку Sitemap у robots.txt, каб паскорыць выяўленне старонак.",
  "All checked fields have label or aria-label.": "Усе правераныя палі маюць label або aria-label.",
  "All cookies from first response contain Secure, HttpOnly and SameSite.": "Усе cookie з першага адказу маюць Secure, HttpOnly і SameSite.",
  "All found images have non-empty alt.": "Усе знойдзеныя выявы маюць непусты alt.",
  "All found images have width and height.": "Усе знойдзеныя выявы маюць width і height.",
  "All main Twitter meta tags found.": "Знойдзены ўсе асноўныя Twitter meta-тэгі.",
  "Better to keep one main page heading.": "Лепш пакінуць адзін галоўны загаловак старонкі.",
  "Better to use full absolute address.": "Лепш выкарыстоўваць поўны абсалютны адрас.",
  "Broken CSS, JS or images break interface and metrics.": "Зламаныя CSS, JS ці выявы ламаюць інтэрфейс і метрыкі.",
  "Browsers will mark site as unsafe, and some SEO signals will be weaker.": "Браўзеры пазначаць сайт як небяспечны, а частка SEO-сігналаў аслабне.",
  "Canonical URL is absolute, available and on same domain.": "Canonical URL абсалютны, даступны і на тым жа дамене.",
  "Canonical address must open without errors.": "Canonical-адрас павінен адкрывацца без памылак.",
  "Canonical value could not be converted to HTTP/HTTPS URL.": "Значэнне canonical не ўдалося пераўтварыць у HTTP/HTTPS URL.",
  "Check language codes and href of alternative pages.": "Праверце коды моў і href альтэрнатыўных старонак.",
  "Check server, caching and heavy blocking resources.": "Праверце сервер, кэшаванне і цяжкія блакуючыя рэсурсы.",
  "Check that redirect is intentional.": "Праверце, што рэдырэкт наўмысны.",
  "Dimensions help browser reserve space in advance and reduce layout shifts.": "Памеры дапамагаюць браўзеру зарэзерваваць месца загадзя і зменшыць зрухі макета.",
  "Empty H-tags hinder screen reader navigation and blur page structure.": "Пустыя H-тэгі ўскладняюць навігацыю скрынрыдарам і размываюць структуру.",
  "File is available and does not contain explicit ban for this URL.": "Файл даступны і не ўтрымлівае яўнай забароны для гэтага URL.",
  "File is not required, but helps control site crawling.": "Файл неабавязковы, але дапамагае кантраляваць абход сайта.",
  "Final URL uses secure protocol.": "Фінальны URL выкарыстоўвае бяспечны пратакол.",
  "For CSS/JS/images usually need Cache-Control with long max-age.": "Для CSS/JS/выяў звычайна патрэбны Cache-Control з доўгім max-age.",
  "For HTML/CSS/JS usually worth enabling gzip or brotli.": "Для HTML/CSS/JS звычайна варта ўключыць gzip або brotli.",
  "For X/Twitter and similar clients, better to add full tag set.": "Для X/Twitter і падобных кліентаў лепш дадаць поўны набор тэгаў.",
  "For public sites, it is better to set up 301 redirect to secure version.": "Для публічных сайтаў лепш наладзіць 301 рэдырэкт на бяспечную версію.",
  "For user sessions especially important Secure, HttpOnly and SameSite.": "Для карыстальніцкіх сесій асабліва важныя Secure, HttpOnly і SameSite.",
  "Good guideline for snippet: 70-160 characters.": "Добрая рэкамендацыя для снипета: 70–160 сімвалаў.",
  "Guideline for snippet: 30-60 characters.": "Рэкамендацыя для снипета: 30–60 сімвалаў.",
  "HTML size exceeds 500 KB before accounting for external resources.": "Памер HTML перавышае 500 КБ яшчэ да ўліку знешніх рэсурсаў.",
  "HTTPS page references HTTP resources that browser may block.": "HTTPS-старонка спасылаецца на HTTP-рэсурсы, якія браўзер можа заблакаваць.",
  "If page is selling or content-based, visual block can improve engagement.": "Калі старонка продажная ці кантэнтная, візуальны блок можа палепшыць уцягванне.",
  "Images below first blocks can often be loaded lazily via loading=\"lazy\".": "Выявы ніжэй першага экрана часта можна загружаць лена праз loading=\"lazy\".",
  "Images larger than 500 KB can significantly slow down page.": "Выявы больш за 500 КБ могуць істотна запаволіць старонку.",
  "Incorrect JSON will not be processed by search engines.": "Няправільны JSON пошукавікі не апрацуюць.",
  "Interactive elements need text, aria-label or title.": "Інтэрактыўным элементам патрэбны тэкст, aria-label або title.",
  "Label check not applied.": "Праверка label не прымянялася.",
  "Label helps screen reader users and increases click area.": "Label дапамагае карыстальнікам скрынрыдара і павялічвае зону кліку.",
  "Lang attribute helps browsers, translators and screen readers.": "Атрыбут lang дапамагае браўзерам, перакладчыкам і скрынрыдарам.",
  "Large number of external files increases loading overhead.": "Вялікая колькасць знешніх файлаў павялічвае накладныя выдаткі загрузкі.",
  "Main OG tags for preview are present.": "Асноўныя OG-тэгі для прэвью прысутнічаюць.",
  "Name like \"Home\" or \"Main\" poorly explains page value.": "Назва накшталт «Home» ці «Main» кепска тлумачыць каштоўнасць старонкі.",
  "No empty interactive elements found.": "Пустых інтэрактыўных элементаў не знойдзена.",
  "No explicit HTTP resources for loading in HTML.": "Яўных HTTP-рэсурсаў для загрузкі ў HTML няма.",
  "No major H1-H6 level gaps found.": "Істотных прабелаў узроўняў H1–H6 не знойдзена.",
  "Normal for single-language site. For multilingual versions, tags needed.": "Нармальна для аднамоўнага сайта. Для шматмоўных версій патрэбныя тэгі.",
  "Page contains meta viewport.": "На старонцы ёсць meta viewport.",
  "Page does not set cookies in first response.": "Старонка не задае cookie ў першым адказе.",
  "Page has no HTTP/HTTPS links.": "На старонцы няма HTTP/HTTPS спасылак.",
  "Page is unavailable to users and search bots.": "Старонка недаступная карыстальнікам і пошукавым ботам.",
  "Page may display incorrectly on smartphones.": "Старонка можа няправільна адлюстроўвацца на смартфонах.",
  "Page responds longer than 2 seconds.": "Старонка адказвае даўжэй за 2 секунды.",
  "Page title falls within recommended range.": "Title старонкі ў рэкамендаваным дыяпазоне.",
  "Preview image must be accessible HTTP/HTTPS URL.": "Выява прэвью павінна быць даступным HTTP/HTTPS URL.",
  "Preview image opens without error.": "Выява прэвью адкрываецца без памылкі.",
  "Product description falls within working length range.": "Апісанне трапляе ў рабочы дыяпазон даўжыні.",
  "Random text fragment from page may appear in search results.": "У выніках пошуку можа з’явіцца выпадковы фрагмент тэксту са старонкі.",
  "Search engines and browser tab have nothing to show as page name.": "У пошукавікаў і ўкладкі браўзера няма назвы старонкі.",
  "Search engines have harder time determining main page topic.": "Пошукавікам складаней вызначыць асноўную тэму старонкі.",
  "Search engines may index page duplicates with parameters or alternative URLs.": "Пошукавікі могуць індэксаваць дублікаты з параметрамі ці альтэрнатыўнымі URL.",
  "Site icon connected.": "Іконка сайта падключана.",
  "Social networks may not generate preview.": "Сацсеткі могуць не згенерыраваць прэвью.",
  "Static check of inline/style CSS found color pairs below WCAG 4.5:1.": "Статычная праверка inline/style CSS знайшла пары колераў ніжэй WCAG 4.5:1.",
  "Structured data not required, but can improve rich snippets.": "Structured data неабавязковыя, але могуць палепшыць rich snippets.",
  "Such URL should not be the main landing page.": "Такі URL не павінен быць галоўнай пасадачнай старонкай.",
  "Such links worsen user experience and waste crawl budget.": "Такія спасылкі пагаршаюць UX і марнуюць crawl budget.",
  "There are level skips, e.g., H2 directly to H4.": "Ёсць пропускі ўзроўняў, напрыклад H2 адразу да H4.",
  "Thin pages are harder to rank for content queries.": "Тонкія старонкі складаней ранжыраваць па кантэнтных запытах.",
  "This is acceptable only if you intentionally pass canonicality to another page version.": "Гэта прымальна толькі калі вы наўмысна перадаеце canonical іншай версіі старонкі.",
  "This is not an error, but often better to give title slightly more context for search.": "Гэта не памылка, але часта лепш даць title трохі больш кантэксту для пошуку.",
  "This security header reduces risk of typical attacks or data leaks.": "Гэты загаловак бяспекі зніжае рызыку тыповых атак ці ўцечак даных.",
  "When reposting, link may look weaker or without image.": "Пры рэпосце спасылка можа выглядаць слабей або без выявы.",
  "Without alt, page is less accessible and loses image search signals.": "Без alt старонка менш даступная і губляе сігналы пошуку па выявах.",
  "Without icon, site looks less complete in tabs and bookmarks.": "Без іконкі сайт выглядае менш завершаным ва ўкладках і закладках.",
  "Worth checking inline styles, data and extra markup.": "Варта праверыць inline-стылі, даныя і лішнюю разметку.",
  "Heuristic score from response time, HTML weight, JS/CSS count, compression, caching and broken assets. Not a PageSpeed Insights lab score.": "Эўрыстычны бал з часу адказу, вагі HTML, колькасці JS/CSS, сціскання, кэша і зламаных рэсурсаў. Не лабараторны бал PageSpeed Insights.",
  "Approx. signal only — derived from server response and page assets, not browser timing APIs.": "Толькі прыблізны сігнал — з адказу сервера і рэсурсаў старонкі, не з browser timing API.",
  "There are intermediate redirects. Shorter chain means faster loading.": "Ёсць прамежкавыя рэдырэкты. Карацейшы ланцужок — хутчэйшая загрузка.",
  "HTTP version correctly redirects visitor to HTTPS.": "HTTP-версія карэктна рэдырэктыць наведвальніка на HTTPS.",
  "No blocking meta robots directives found.": "Блакуючых дырэктыў meta robots не знойдзена.",
  "Server did not specify Content-Type.": "Сервер не ўказаў Content-Type.",
  "Site map looks like valid XML sitemap.": "Карта сайта выглядае як карэктны XML sitemap.",
  "No explicit inline/style color + background pairs found on page.": "Яўных пар колер + фон у inline/style на старонцы не знойдзена.",
};
  var vitalLabels = {
  "Time to First Byte": "Час да першага байта",
  "First Contentful Paint": "Першая адмалёўка кантэнту",
  "Largest Contentful Paint": "Адмалёўка найбуйнейшага кантэнту",
  "Cumulative Layout Shift": "Сумарны зрух макета",
  "First Input Delay": "Затрымка першага ўводу"
};
  var patterns = [
    { re: /^Server returned error (\d+)$/, be: "Сервер вярнуў памылку $1" },
    { re: /^Page returned status (\d+)$/, be: "Старонка вярнула статус $1" },
    { re: /^Final status (\d+)$/, be: "Фінальны статус $1" },
    { re: /^Suboptimal Title length \((\d+) chars\)$/, be: "Неаптымальная даўжыня Title ($1 сімв.)" },
    { re: /^Suboptimal description length \((\d+) chars\)$/, be: "Неаптымальная даўжыня description ($1 сімв.)" },
    { re: /^Multiple H1 found \((\d+)\)$/, be: "Знойдзена некалькі H1 ($1)" },
    { re: /^Very slow response \((\d+) ms\)$/, be: "Вельмі павольны адказ ($1 мс)" },
    { re: /^Slow server response \((\d+) ms\)$/, be: "Павольны адказ сервера ($1 мс)" },
    { re: /^Redirect chain: (\d+)$/, be: "Ланцужок рэдырэктаў: $1" },
    { re: /^Missing header (.+)$/, be: "Адсутнічае загаловак $1" },
    { re: /^(.+) set unusually$/, be: "$1 зададзены нязвыкла" },
    { re: /^(.+) present$/, be: "$1 прысутнічае" },
    { re: /^Estimated performance score: (\d+)\/100 \(grade ([A-F])\)$/, be: "Ацэначны бал хуткасці: $1/100 (ацэнка $2)" },
    { re: /^Estimated (.+): (.+)$/, be: "Ацэнка $1: $2" },
    { re: /^Final page responds with code (\d+)\.$/, be: "Фінальная старонка адказвае кодам $1." },
    { re: /^Content-Type: (.+)$/, be: "Content-Type: $1" },
    { re: /^Main heading: "(.+)"\.$/, be: "Галоўны загаловак: «$1»." },
    { re: /^Directives found on page: (.+)\.$/, be: "Дырэктывы на старонцы: $1." },
    { re: /^Current directives: (.+)\.$/, be: "Бягучыя дырэктывы: $1." },
    { re: /^Approximately (\d+) words found on page\.$/, be: "На старонцы прыблізна $1 слоў." },
    { re: /^Structured data blocks found: (\d+)\.$/, be: "Знойдзена блокаў structured data: $1." },
    { re: /^Response received in (\d+) ms\.$/, be: "Адказ атрыманы за $1 мс." },
    { re: /^HTML weighs (.+)\.$/, be: "HTML важыць $1." },
    { re: /^Server serves page with Content-Encoding: (.+)\.$/, be: "Сервер аддае старонку з Content-Encoding: $1." },
    { re: /^Resources checked: (\d+)\.$/, be: "Праверана рэсурсаў: $1." },
    { re: /^Expected value with "(.+)", found: (.+)\.$/, be: "Чакалася значэнне з «$1», знойдзена: $2." },
    { re: /^Value: (.+)\.$/, be: "Значэнне: $1." },
    { re: /^Validity expired: (.+)\.$/, be: "Тэрмін дзеяння скончыўся: $1." },
    { re: /^Days left: (.+)\.$/, be: "Дзён засталося: $1." },
    { re: /^Approximately (\d+) days until expiration\.$/, be: "Прыблізна $1 дзён да заканчэння." },
    { re: /^Links checked: (\d+)\.$/, be: "Праверана спасылак: $1." },
    { re: /^html lang="(.+)"\.$/, be: "html lang=\"$1\"." },
    { re: /^Encoding: (.+)\.$/, be: "Кадзіроўка: $1." },
    { re: /^Alternative language versions found: (\d+)\.$/, be: "Знойдзена альтэрнатыўных моўных версій: $1." },
    { re: /^JS: (\d+), CSS: (\d+)\.$/, be: "JS: $1, CSS: $2." },
    { re: /^Expected HTML, but server returned: (.+)\.$/, be: "Чакаўся HTML, але сервер вярнуў: $1." },
    { re: /^To prevent audit hanging, checked first (\d+) .+\.$/, be: "Каб аўдыт не завісаў, правераны першыя $1 элементаў." }
  ];

  function applyPattern(str) {
    for (var i = 0; i < patterns.length; i++) {
      var m = str.match(patterns[i].re);
      if (!m) continue;
      var out = patterns[i].be;
      for (var g = 1; g < m.length; g++) {
        var val = m[g];
        if (vitalLabels[val]) val = vitalLabels[val];
        out = out.replace('$' + g, val);
      }
      return out;
    }
    return null;
  }

  function translateInsightPart(str, map) {
    if (!str) return str;
    if (map[str]) return map[str];
    var viaPattern = applyPattern(str);
    if (viaPattern) return viaPattern;
    return str;
  }

  function translateInsights(lang) {
    document.querySelectorAll('.insight-item').forEach(function (item) {
      var titleEl = item.querySelector('.insight-title');
      var textEl = item.querySelector('.insight-text');
      if (!titleEl || !textEl) return;
      var enTitle = titleEl.getAttribute('data-en') || titleEl.textContent;
      var enText = textEl.getAttribute('data-en') || textEl.textContent;
      if (!titleEl.getAttribute('data-en')) titleEl.setAttribute('data-en', enTitle);
      if (!textEl.getAttribute('data-en')) textEl.setAttribute('data-en', enText);
      if (lang === 'be') {
        titleEl.textContent = translateInsightPart(enTitle, titles);
        textEl.textContent = translateInsightPart(enText, texts);
      } else {
        titleEl.textContent = enTitle;
        textEl.textContent = enText;
      }
    });
  }

  window.__translateInsights = translateInsights;
  window.addEventListener('site-audit:lang', function (e) {
    translateInsights((e.detail && e.detail.lang) || 'en');
  });
  document.addEventListener('DOMContentLoaded', function () {
    var lang = document.documentElement.getAttribute('data-lang') || 'en';
    translateInsights(lang);
  });
})();
