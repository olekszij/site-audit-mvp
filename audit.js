const axios = require('axios');
const cheerio = require('cheerio');
const tls = require('tls');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SiteAuditBot/3.0';
const REQUEST_TIMEOUT_MS = 10000;
const RESOURCE_TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 5;
const MAX_LINK_CHECKS = 50;
const MAX_RESOURCE_CHECKS = 60;
const MAX_IMAGE_HEAD_CHECKS = 35;
const CONCURRENCY = 6;
const HEAVY_IMAGE_BYTES = 500 * 1024;
const GOOD_CACHE_SECONDS = 7 * 24 * 60 * 60;

function normalizeUrl(value) {
  if (!value || typeof value !== 'string') {
    throw new Error('Введите URL для проверки.');
  }

  const trimmed = value.trim();
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : 'https://' + trimmed;
  const parsed = new URL(withProtocol);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Поддерживаются только HTTP и HTTPS адреса.');
  }

  parsed.hash = '';
  return parsed.href;
}

async function runAudit(targetUrl) {
  const fetchResult = await fetchHtmlWithRedirects(targetUrl);
  const html =
    typeof fetchResult.response.data === 'string'
      ? fetchResult.response.data
      : String(fetchResult.response.data || '');
  const $ = cheerio.load(html);
  const page = collectPageData($, fetchResult.finalUrl, html);

  const [
    robotsAudit,
    canonicalAudit,
    ogImageAudit,
    linkAudit,
    resourceAudit,
    compressionAudit,
    tlsAudit,
  ] = await Promise.all([
    checkRobotsAndSitemap(fetchResult.finalUrl),
    page.canonical
      ? inspectCanonical(page.canonical, fetchResult.finalUrl)
      : Promise.resolve(null),
    page.ogImage
      ? inspectUrl(page.ogImage.absoluteUrl, 'image/*,*/*')
      : Promise.resolve(null),
    auditLinks(page.links),
    auditResources(page),
    checkCompression(fetchResult.finalUrl),
    getTlsCertificateInfo(fetchResult.finalUrl),
  ]);

  const context = {
    targetUrl,
    ...fetchResult,
    html,
    page,
    robotsAudit,
    canonicalAudit,
    ogImageAudit,
    linkAudit,
    resourceAudit,
    compressionAudit,
    tlsAudit,
  };
  const insights = buildInsights(context);

  return {
    targetUrl,
    finalUrl: fetchResult.finalUrl,
    checkedAt: new Date().toLocaleString('ru-RU'),
    loadTime: fetchResult.loadTime,
    insights,
    summary: buildSummary(insights),
    raw: buildRawData(context),
  };
}

async function fetchHtmlWithRedirects(startUrl) {
  let currentUrl = normalizeUrl(startUrl);
  const redirects = [];
  const startedAt = Date.now();

  for (let step = 0; step <= MAX_REDIRECTS; step += 1) {
    const response = await axios.get(currentUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 0,
      responseType: 'text',
      timeout: REQUEST_TIMEOUT_MS,
      transformResponse: [(data) => data],
      validateStatus: () => true,
    });

    const location = getHeader(response.headers, 'location');
    if (isRedirect(response.status) && location) {
      const nextUrl = new URL(location, currentUrl).href;
      redirects.push({
        status: response.status,
        from: currentUrl,
        to: nextUrl,
      });
      currentUrl = nextUrl;
      continue;
    }

    return {
      response,
      finalUrl: currentUrl,
      redirects,
      loadTime: Date.now() - startedAt,
    };
  }

  throw new Error('Слишком длинная цепочка редиректов.');
}

function collectPageData($, baseUrl, html) {
  const title = cleanText($('title').first().text()) || null;
  const description =
    $('meta[name="description"]').first().attr('content')?.trim() || null;
  const viewport = $('meta[name="viewport"]').first().attr('content') || null;
  const canonical = $('link[rel="canonical"]').first().attr('href') || null;
  const robots = $('meta[name="robots"]').first().attr('content') || null;
  const htmlLang = $('html').first().attr('lang') || null;
  const charset =
    $('meta[charset]').first().attr('charset') ||
    $('meta[http-equiv="content-type"]').first().attr('content') ||
    null;
  const favicon =
    $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .length > 0;

  const headings = [];
  $('h1,h2,h3,h4,h5,h6').each((index, element) => {
    const tagName = (element.tagName || element.name || '').toLowerCase();
    headings.push({
      level: Number(tagName.replace('h', '')),
      text: cleanText($(element).text()),
    });
  });

  const links = [];
  $('a[href]').each((index, element) => {
    const href = ($(element).attr('href') || '').trim();
    const absoluteUrl = toAbsoluteHttpUrl(href, baseUrl);

    if (!absoluteUrl) {
      return;
    }

    links.push({
      href,
      absoluteUrl: stripHash(absoluteUrl),
      text: getAccessibleText($, element),
    });
  });

  const images = [];
  $('img').each((index, element) => {
    const alt = $(element).attr('alt');
    const src =
      $(element).attr('src') ||
      $(element).attr('data-src') ||
      $(element).attr('data-lazy-src') ||
      '';
    images.push({
      src,
      absoluteUrl: toAbsoluteHttpUrl(src, baseUrl),
      hasAlt: alt !== undefined,
      alt: alt || '',
      hasWidth: Boolean($(element).attr('width')),
      hasHeight: Boolean($(element).attr('height')),
      loading: ($(element).attr('loading') || '').toLowerCase(),
      index,
    });
  });

  const scripts = [];
  $('script[src]').each((index, element) => {
    const src = $(element).attr('src') || '';
    const absoluteUrl = toAbsoluteHttpUrl(src, baseUrl);
    if (absoluteUrl) {
      scripts.push({ src, absoluteUrl });
    }
  });

  const stylesheets = [];
  $('link[href]').each((index, element) => {
    const rel = ($(element).attr('rel') || '').toLowerCase();
    if (!rel.split(/\s+/).includes('stylesheet')) {
      return;
    }

    const href = $(element).attr('href') || '';
    const absoluteUrl = toAbsoluteHttpUrl(href, baseUrl);
    if (absoluteUrl) {
      stylesheets.push({ href, absoluteUrl });
    }
  });

  const hreflangTags = [];
  $('link[rel="alternate"][hreflang]').each((index, element) => {
    const hreflang = ($(element).attr('hreflang') || '').trim();
    const href = ($(element).attr('href') || '').trim();
    hreflangTags.push({
      hreflang,
      href,
      absoluteUrl: toAbsoluteHttpUrl(href, baseUrl),
    });
  });

  const jsonLdScripts = [];
  $('script[type="application/ld+json"]').each((index, element) => {
    const content = ($(element).html() || '').trim();
    jsonLdScripts.push(parseJsonLd(content));
  });

  const ogTitle = $('meta[property="og:title"]').first().attr('content') || null;
  const ogDescription =
    $('meta[property="og:description"]').first().attr('content') || null;
  const ogImageValue =
    $('meta[property="og:image"]').first().attr('content') || null;
  const twitter = {
    card: $('meta[name="twitter:card"]').first().attr('content') || null,
    title: $('meta[name="twitter:title"]').first().attr('content') || null,
    description:
      $('meta[name="twitter:description"]').first().attr('content') || null,
    image: $('meta[name="twitter:image"]').first().attr('content') || null,
  };

  const final = new URL(baseUrl);
  const internalLinks = links.filter((link) =>
    sameSite(link.absoluteUrl, final.href),
  ).length;
  const externalLinks = links.length - internalLinks;
  const bodyText = cleanText($('body').text());

  return {
    title,
    description,
    viewport,
    canonical,
    robots,
    favicon,
    htmlLang,
    charset,
    headings,
    h1: headings.filter((heading) => heading.level === 1),
    links: uniqueBy(links, (link) => link.absoluteUrl),
    internalLinks,
    externalLinks,
    images,
    scripts,
    stylesheets,
    hreflangTags,
    jsonLdScripts,
    ogTitle,
    ogDescription,
    ogImage: ogImageValue
      ? {
          value: ogImageValue,
          absoluteUrl: toAbsoluteHttpUrl(ogImageValue, baseUrl),
        }
      : null,
    twitter,
    wordCount: countWords(bodyText),
    htmlSizeBytes: Buffer.byteLength(html, 'utf8'),
    formsAudit: auditForms($),
    interactiveTextAudit: auditInteractiveText($),
    contrastAudit: auditStaticContrast($),
    mixedContent: collectMixedContent($, baseUrl),
  };
}

function buildInsights({
  targetUrl,
  finalUrl,
  response,
  redirects,
  loadTime,
  page,
  robotsAudit,
  canonicalAudit,
  ogImageAudit,
  linkAudit,
  resourceAudit,
  compressionAudit,
  tlsAudit,
}) {
  const insights = [];
  const finalUrlObject = new URL(finalUrl);
  const targetUrlObject = new URL(targetUrl);
  const status = response.status;
  const contentType = getHeader(response.headers, 'content-type');

  if (status >= 500) {
    addInsight(
      insights,
      'danger',
      'Техника',
      'Сервер вернул ошибку ' + status,
      'Страница недоступна для пользователей и поисковых роботов.',
    );
  } else if (status >= 400) {
    addInsight(
      insights,
      'danger',
      'Техника',
      'Страница вернула статус ' + status,
      'Такой URL не должен быть основной посадочной страницей.',
    );
  } else if (status >= 300) {
    addInsight(
      insights,
      'warning',
      'Техника',
      'Финальный статус ' + status,
      'Проверьте, что редирект настроен намеренно.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Техника',
      'HTTP-статус в норме',
      'Финальная страница отвечает кодом ' + status + '.',
    );
  }

  if (redirects.length > 0) {
    const hasHttpToHttps = redirects.some(
      (redirect) =>
        redirect.from.startsWith('http://') && redirect.to.startsWith('https://'),
    );
    addInsight(
      insights,
      hasHttpToHttps ? 'success' : 'info',
      'Техника',
      'Цепочка редиректов: ' + redirects.length,
      hasHttpToHttps
        ? 'HTTP-версия корректно переводит посетителя на HTTPS.'
        : 'Есть промежуточные переходы. Чем короче цепочка, тем быстрее загрузка.',
      redirects.map(
        (redirect) => redirect.status + ': ' + redirect.from + ' -> ' + redirect.to,
      ),
    );
  } else if (targetUrlObject.protocol === 'http:' && finalUrlObject.protocol === 'http:') {
    addInsight(
      insights,
      'warning',
      'Безопасность',
      'HTTP не перенаправляется на HTTPS',
      'Для публичного сайта лучше настроить 301-редирект на защищённую версию.',
    );
  }

  if (!contentType || contentType.includes('text/html')) {
    addInsight(
      insights,
      'success',
      'Техника',
      'Тип контента подходит для HTML-страницы',
      contentType ? 'Content-Type: ' + contentType : 'Сервер не указал Content-Type.',
    );
  } else {
    addInsight(
      insights,
      'warning',
      'Техника',
      'Необычный Content-Type',
      'Ожидался HTML, но сервер вернул: ' + contentType + '.',
    );
  }

  if (finalUrlObject.protocol !== 'https:') {
    addInsight(
      insights,
      'danger',
      'Безопасность',
      'Отсутствует HTTPS',
      'Браузеры будут помечать сайт как небезопасный, а часть SEO-сигналов будет слабее.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Безопасность',
      'HTTPS подключён',
      'Финальный URL использует защищённый протокол.',
    );
  }

  addTitleInsights(insights, page);
  addDescriptionInsights(insights, page.description);
  addHeadingInsights(insights, page);
  addIndexingInsights(insights, page, robotsAudit);
  addCanonicalInsights(insights, canonicalAudit);
  addMediaInsights(insights, page, ogImageAudit, resourceAudit);
  addSocialInsights(insights, page, ogImageAudit);
  addContentInsights(insights, page);
  addPerformanceInsights(
    insights,
    loadTime,
    page,
    resourceAudit,
    compressionAudit,
  );
  addSecurityInsights(insights, response.headers, finalUrlObject, page, tlsAudit);
  addAccessibilityInsights(insights, page);
  addLinkInsights(insights, linkAudit);
  addInternationalInsights(insights, page);

  return insights;
}

function addTitleInsights(insights, page) {
  if (!page.title) {
    addInsight(
      insights,
      'danger',
      'SEO',
      'Отсутствует тег Title',
      'Поисковым системам и вкладке браузера нечего показать как название страницы.',
    );
    return;
  }

  const length = page.title.length;
  if (length < 30 || length > 60) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Неоптимальная длина Title (' + length + ' симв.)',
      'Ориентир для сниппета: 30-60 символов.',
      ['Title: ' + page.title],
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'Title хорошей длины',
      'Заголовок страницы попадает в рекомендуемый диапазон.',
      ['Title: ' + page.title],
    );
  }

  if (isGenericTitle(page.title)) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Title слишком общий',
      'Название вроде "Home" или "Главная" плохо объясняет ценность страницы.',
      ['Title: ' + page.title],
    );
  }

  if (
    page.h1.length === 1 &&
    normalizeTextForCompare(page.h1[0].text) === normalizeTextForCompare(page.title)
  ) {
    addInsight(
      insights,
      'info',
      'SEO',
      'Title и H1 совпадают',
      'Это не ошибка, но часто лучше дать title чуть больше контекста для поиска.',
      ['Title: ' + page.title],
    );
  }
}

function addDescriptionInsights(insights, description) {
  if (!description) {
    addInsight(
      insights,
      'danger',
      'SEO',
      'Нет meta description',
      'В поисковой выдаче может появиться случайный фрагмент текста со страницы.',
    );
    return;
  }

  const length = description.length;
  if (length < 70 || length > 160) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Неоптимальная длина description (' + length + ' симв.)',
      'Хороший ориентир для сниппета: 70-160 символов.',
      ['Meta description: ' + description],
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'Meta description заполнен корректно',
      'Описание страницы попадает в рабочий диапазон длины.',
      ['Meta description: ' + description],
    );
  }
}

function addHeadingInsights(insights, page) {
  if (page.h1.length === 0) {
    addInsight(
      insights,
      'danger',
      'SEO',
      'Отсутствует H1',
      'Поисковым системам сложнее определить основную тему страницы.',
    );
  } else if (page.h1.length > 1) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Найдено несколько H1 (' + page.h1.length + ')',
      'Лучше оставить один главный заголовок страницы.',
      page.h1.map((heading) => heading.text).filter(Boolean).slice(0, 5),
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'H1 найден',
      'Главный заголовок: "' + page.h1[0].text + '".',
    );
  }

  const emptyHeadings = page.headings.filter((heading) => !heading.text);
  const skippedLevels = findSkippedHeadingLevels(page.headings);

  if (emptyHeadings.length > 0) {
    addInsight(
      insights,
      'warning',
      'Доступность',
      'Есть пустые заголовки',
      'Пустые H-теги мешают навигации скринридеров и размывают структуру страницы.',
    );
  }

  if (skippedLevels.length > 0) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Нарушена иерархия заголовков',
      'Есть переходы через уровень, например H2 сразу к H4.',
      skippedLevels.slice(0, 5),
    );
  } else if (page.headings.length > 0) {
    addInsight(
      insights,
      'success',
      'SEO',
      'Иерархия заголовков выглядит последовательно',
      'Крупных пропусков уровней H1-H6 не найдено.',
    );
  }
}

function addIndexingInsights(insights, page, robotsAudit) {
  const robots = (page.robots || '').toLowerCase();
  if (robots.includes('noindex') || robots.includes('nofollow')) {
    addInsight(
      insights,
      'danger',
      'Индексация',
      'Meta robots запрещает индексацию или переходы',
      'На странице найдены директивы: ' + page.robots + '.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Индексация',
      'Meta robots не блокирует страницу',
      page.robots
        ? 'Текущие директивы: ' + page.robots + '.'
        : 'Запрещающих meta robots директив не найдено.',
    );
  }

  if (!robotsAudit.robots.exists) {
    addInsight(
      insights,
      'warning',
      'Индексация',
      'robots.txt не найден',
      'Файл не обязателен, но он помогает управлять обходом сайта.',
      [robotsAudit.robots.url],
    );
  } else if (robotsAudit.robots.blocksTarget || robotsAudit.robots.blocksAll) {
    addInsight(
      insights,
      'danger',
      'Индексация',
      'robots.txt блокирует страницу',
      robotsAudit.robots.blocksAll
        ? 'Для User-agent: * найден запрет Disallow: /.'
        : 'Правила robots.txt запрещают обход проверяемого пути.',
      [robotsAudit.robots.url],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Индексация',
      'robots.txt не блокирует проверяемую страницу',
      'Файл доступен и не содержит явного запрета для этого URL.',
      [robotsAudit.robots.url],
    );
  }

  if (robotsAudit.sitemap.exists) {
    addInsight(
      insights,
      robotsAudit.sitemap.validXml ? 'success' : 'warning',
      'Индексация',
      'Sitemap найден',
      robotsAudit.sitemap.validXml
        ? 'Карта сайта похожа на валидный XML sitemap.'
        : 'Файл доступен, но не похож на стандартный sitemap XML.',
      [robotsAudit.sitemap.url],
    );
  } else {
    addInsight(
      insights,
      'warning',
      'Индексация',
      'Sitemap не найден',
      'Добавьте sitemap.xml или ссылку Sitemap в robots.txt, чтобы ускорить обнаружение страниц.',
      robotsAudit.sitemap.checkedUrls,
    );
  }
}

function addCanonicalInsights(insights, canonicalAudit) {
  if (!canonicalAudit) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Не указан canonical',
      'Поисковики могут индексировать дубли страниц с параметрами или альтернативными URL.',
    );
    return;
  }

  if (!canonicalAudit.absoluteUrl) {
    addInsight(
      insights,
      'danger',
      'SEO',
      'Canonical невозможно прочитать',
      'Значение canonical не удалось привести к HTTP/HTTPS URL.',
      [canonicalAudit.value],
    );
    return;
  }

  const details = [
    'Canonical: ' + canonicalAudit.absoluteUrl,
    canonicalAudit.status ? 'Статус: ' + canonicalAudit.status : null,
  ].filter(Boolean);

  if (!canonicalAudit.isAbsolute) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Canonical указан относительным URL',
      'Лучше использовать полный абсолютный адрес.',
      details,
    );
  } else if (!canonicalAudit.sameDomain) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Canonical ведёт на другой домен',
      'Это допустимо только если вы осознанно передаёте каноничность другой версии страницы.',
      details,
    );
  } else if (!canonicalAudit.ok) {
    addInsight(
      insights,
      'danger',
      'SEO',
      'Canonical ведёт на недоступный URL',
      'Канонический адрес должен открываться без ошибок.',
      details,
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'Canonical настроен корректно',
      'Канонический URL абсолютный, доступный и находится на том же домене.',
      details,
    );
  }
}

function addMediaInsights(insights, page, ogImageAudit, resourceAudit) {
  const missingAlt = page.images.filter((image) => !image.hasAlt).length;
  const emptyAlt = page.images.filter(
    (image) => image.hasAlt && image.alt.trim() === '',
  ).length;

  if (page.images.length === 0) {
    addInsight(
      insights,
      'info',
      'Медиа',
      'Изображений на странице не найдено',
      'Если страница продающая или контентная, визуальный блок может улучшить вовлечение.',
    );
  } else if (missingAlt > 0 || emptyAlt > 0) {
    addInsight(
      insights,
      'warning',
      'Доступность',
      'Проблемы с alt у изображений',
      'Без alt страница хуже доступна и теряет часть сигналов для поиска по изображениям.',
      [
        'Без alt: ' + missingAlt,
        'Пустой alt: ' + emptyAlt,
        'Всего изображений: ' + page.images.length,
      ],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Доступность',
      'Alt у изображений заполнен',
      'Все найденные изображения имеют непустой alt.',
    );
  }

  const missingDimensions = page.images.filter(
    (image) => !image.hasWidth || !image.hasHeight,
  ).length;
  if (missingDimensions > 0) {
    addInsight(
      insights,
      'warning',
      'Производительность',
      'У изображений нет width/height',
      'Размеры помогают браузеру заранее зарезервировать место и снизить сдвиги макета.',
      ['Без размеров: ' + missingDimensions + ' / ' + page.images.length],
    );
  } else if (page.images.length > 0) {
    addInsight(
      insights,
      'success',
      'Производительность',
      'Размеры изображений заданы',
      'У всех найденных изображений есть width и height.',
    );
  }

  const lazyCandidates = page.images.filter(
    (image) =>
      image.index >= 3 &&
      image.absoluteUrl &&
      image.loading !== 'lazy' &&
      image.loading !== 'eager',
  );
  if (lazyCandidates.length > 0) {
    addInsight(
      insights,
      'info',
      'Производительность',
      'Есть кандидаты для lazy loading',
      'Изображения ниже первых блоков часто можно грузить лениво через loading="lazy".',
      ['Кандидатов: ' + lazyCandidates.length],
    );
  }

  if (resourceAudit.heavyImages.length > 0) {
    addInsight(
      insights,
      'warning',
      'Производительность',
      'Найдены тяжёлые изображения',
      'Изображения больше 500 KB могут заметно замедлять страницу.',
      resourceAudit.heavyImages
        .slice(0, 5)
        .map((image) => formatBytes(image.bytes) + ' - ' + image.url),
    );
  }

  if (page.ogImage && !page.ogImage.absoluteUrl) {
    addInsight(
      insights,
      'warning',
      'Соцсети',
      'OG image указан некорректно',
      'Изображение для превью должно быть доступным HTTP/HTTPS URL.',
      [page.ogImage.value],
    );
  } else if (page.ogImage && ogImageAudit && !ogImageAudit.ok) {
    addInsight(
      insights,
      'warning',
      'Соцсети',
      'OG image недоступен',
      'Социальные сети могут не сформировать превью.',
      [page.ogImage.absoluteUrl],
    );
  } else if (page.ogImage) {
    addInsight(
      insights,
      'success',
      'Соцсети',
      'OG image доступен',
      'Изображение для превью открывается без ошибки.',
    );
  }
}

function addSocialInsights(insights, page) {
  const missingOg = [];
  if (!page.ogTitle) missingOg.push('og:title');
  if (!page.ogDescription) missingOg.push('og:description');
  if (!page.ogImage) missingOg.push('og:image');

  if (missingOg.length > 0) {
    addInsight(
      insights,
      'warning',
      'Соцсети',
      'Open Graph заполнен не полностью',
      'При репосте ссылка может выглядеть слабее или без изображения.',
      missingOg,
    );
  } else {
    addInsight(
      insights,
      'success',
      'Соцсети',
      'Open Graph настроен',
      'Основные OG-теги для превью присутствуют.',
    );
  }

  const missingTwitter = [];
  if (!page.twitter.card) missingTwitter.push('twitter:card');
  if (!page.twitter.title) missingTwitter.push('twitter:title');
  if (!page.twitter.description) missingTwitter.push('twitter:description');
  if (!page.twitter.image) missingTwitter.push('twitter:image');

  if (missingTwitter.length > 0) {
    addInsight(
      insights,
      'warning',
      'Соцсети',
      'Twitter Card заполнен не полностью',
      'Для X/Twitter и похожих клиентов лучше добавить полный набор тегов.',
      missingTwitter,
    );
  } else {
    addInsight(
      insights,
      'success',
      'Соцсети',
      'Twitter Card настроен',
      'Все основные Twitter meta-теги найдены.',
    );
  }
}

function addContentInsights(insights, page) {
  if (page.wordCount < 300) {
    addInsight(
      insights,
      'warning',
      'Контент',
      'На странице мало текста',
      'Тонкие страницы сложнее ранжировать по содержательным запросам.',
      ['Слов: ' + page.wordCount],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Контент',
      'Объём текста выглядит достаточным',
      'На странице найдено примерно ' + page.wordCount + ' слов.',
    );
  }

  const invalidJsonLd = page.jsonLdScripts.filter((script) => !script.valid);
  if (page.jsonLdScripts.length === 0) {
    addInsight(
      insights,
      'info',
      'SEO',
      'JSON-LD/schema.org не найден',
      'Структурированные данные не обязательны, но могут улучшить расширенные сниппеты.',
    );
  } else if (invalidJsonLd.length > 0) {
    addInsight(
      insights,
      'danger',
      'SEO',
      'JSON-LD содержит ошибки',
      'Некорректный JSON не будет обработан поисковыми системами.',
      invalidJsonLd.slice(0, 3).map((script) => script.error),
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'JSON-LD валиден',
      'Найдено блоков структурированных данных: ' + page.jsonLdScripts.length + '.',
    );
  }
}

function addPerformanceInsights(
  insights,
  loadTime,
  page,
  resourceAudit,
  compressionAudit,
) {
  if (loadTime > 5000) {
    addInsight(
      insights,
      'danger',
      'Производительность',
      'Очень медленный ответ (' + loadTime + ' мс)',
      'Проверьте сервер, кеширование и тяжёлые блокирующие ресурсы.',
    );
  } else if (loadTime > 2000) {
    addInsight(
      insights,
      'warning',
      'Производительность',
      'Медленный ответ сервера (' + loadTime + ' мс)',
      'Страница отвечает дольше 2 секунд.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Производительность',
      'Сервер отвечает быстро',
      'Ответ получен за ' + loadTime + ' мс.',
    );
  }

  if (page.htmlSizeBytes > 500 * 1024) {
    addInsight(
      insights,
      'danger',
      'Производительность',
      'HTML слишком тяжёлый',
      'Размер HTML превышает 500 KB до учёта внешних ресурсов.',
      [formatBytes(page.htmlSizeBytes)],
    );
  } else if (page.htmlSizeBytes > 200 * 1024) {
    addInsight(
      insights,
      'warning',
      'Производительность',
      'HTML крупнее обычного',
      'Стоит проверить встроенные стили, данные и лишнюю разметку.',
      [formatBytes(page.htmlSizeBytes)],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Производительность',
      'Размер HTML в норме',
      'HTML весит ' + formatBytes(page.htmlSizeBytes) + '.',
    );
  }

  if (compressionAudit.encoding) {
    addInsight(
      insights,
      'success',
      'Производительность',
      'Сжатие включено',
      'Сервер отдаёт страницу с Content-Encoding: ' + compressionAudit.encoding + '.',
    );
  } else {
    addInsight(
      insights,
      'warning',
      'Производительность',
      'Сжатие не обнаружено',
      'Для HTML/CSS/JS обычно стоит включить gzip или brotli.',
    );
  }

  const assetCount = page.scripts.length + page.stylesheets.length;
  if (page.scripts.length > 20 || page.stylesheets.length > 10) {
    addInsight(
      insights,
      'warning',
      'Производительность',
      'Много JS/CSS файлов',
      'Большое количество внешних файлов увеличивает накладные расходы загрузки.',
      ['JS: ' + page.scripts.length, 'CSS: ' + page.stylesheets.length],
    );
  } else {
    addInsight(
      insights,
      assetCount > 0 ? 'success' : 'info',
      'Производительность',
      'Количество JS/CSS файлов приемлемое',
      'JS: ' + page.scripts.length + ', CSS: ' + page.stylesheets.length + '.',
    );
  }

  if (resourceAudit.unreachableAssets.length > 0) {
    addInsight(
      insights,
      'danger',
      'Техника',
      'Есть недоступные ресурсы страницы',
      'Битые CSS, JS или изображения ломают интерфейс и метрики.',
      resourceAudit.unreachableAssets
        .slice(0, 5)
        .map((asset) => (asset.status || 'ERR') + ' - ' + asset.url),
    );
  }

  if (resourceAudit.cacheIssues.length > 0) {
    addInsight(
      insights,
      'warning',
      'Производительность',
      'У статических ресурсов слабое кеширование',
      'Для CSS/JS/изображений обычно нужен Cache-Control с долгим max-age.',
      resourceAudit.cacheIssues
        .slice(0, 5)
        .map((asset) => asset.reason + ': ' + asset.url),
    );
  } else if (resourceAudit.checkedResources > 0) {
    addInsight(
      insights,
      'success',
      'Производительность',
      'Кеширование статических ресурсов выглядит хорошо',
      'Проверено ресурсов: ' + resourceAudit.checkedResources + '.',
    );
  }
}

function addSecurityInsights(insights, headers, finalUrlObject, page, tlsAudit) {
  const securityHeaders = [
    {
      name: 'strict-transport-security',
      title: 'HSTS',
      requiredOnHttps: true,
    },
    {
      name: 'content-security-policy',
      title: 'Content-Security-Policy',
    },
    {
      name: 'x-content-type-options',
      title: 'X-Content-Type-Options',
      expected: 'nosniff',
    },
    {
      name: 'referrer-policy',
      title: 'Referrer-Policy',
    },
    {
      name: 'x-frame-options',
      title: 'X-Frame-Options',
    },
  ];

  securityHeaders.forEach((header) => {
    if (header.requiredOnHttps && finalUrlObject.protocol !== 'https:') {
      return;
    }

    const value = getHeader(headers, header.name);
    if (!value) {
      addInsight(
        insights,
        'warning',
        'Безопасность',
        'Нет заголовка ' + header.title,
        'Этот security header снижает риск типовых атак или утечек данных.',
      );
      return;
    }

    if (header.expected && !value.toLowerCase().includes(header.expected)) {
      addInsight(
        insights,
        'warning',
        'Безопасность',
        header.title + ' задан необычно',
        'Ожидалось значение с "' + header.expected + '", найдено: ' + value + '.',
      );
      return;
    }

    addInsight(
      insights,
      'success',
      'Безопасность',
      header.title + ' присутствует',
      'Значение: ' + value + '.',
    );
  });

  if (page.mixedContent.length > 0) {
    addInsight(
      insights,
      'danger',
      'Безопасность',
      'Найден mixed content',
      'HTTPS-страница ссылается на HTTP-ресурсы, которые браузер может заблокировать.',
      page.mixedContent.slice(0, 5),
    );
  } else if (finalUrlObject.protocol === 'https:') {
    addInsight(
      insights,
      'success',
      'Безопасность',
      'Mixed content не найден',
      'В HTML нет явных HTTP-ресурсов для загрузки.',
    );
  }

  addCookieInsights(insights, headers);
  addTlsInsights(insights, tlsAudit);
}

function addCookieInsights(insights, headers) {
  const cookies = normalizeSetCookie(headers['set-cookie']);
  if (cookies.length === 0) {
    addInsight(
      insights,
      'info',
      'Безопасность',
      'Set-Cookie не найден',
      'Страница не устанавливает cookies в первом ответе.',
    );
    return;
  }

  const issues = [];
  cookies.forEach((cookie, index) => {
    const lower = cookie.toLowerCase();
    const name = cookie.split('=')[0] || 'cookie #' + (index + 1);
    if (!lower.includes('; secure')) issues.push(name + ': нет Secure');
    if (!lower.includes('; httponly')) issues.push(name + ': нет HttpOnly');
    if (!lower.includes('; samesite')) issues.push(name + ': нет SameSite');
  });

  if (issues.length > 0) {
    addInsight(
      insights,
      'warning',
      'Безопасность',
      'У cookies не хватает защитных флагов',
      'Для пользовательских сессий особенно важны Secure, HttpOnly и SameSite.',
      issues.slice(0, 8),
    );
  } else {
    addInsight(
      insights,
      'success',
      'Безопасность',
      'Cookies защищены флагами',
      'Все cookies из первого ответа содержат Secure, HttpOnly и SameSite.',
    );
  }
}

function addTlsInsights(insights, tlsAudit) {
  if (tlsAudit.skipped) {
    return;
  }

  if (tlsAudit.error) {
    addInsight(
      insights,
      'warning',
      'Безопасность',
      'TLS-сертификат не удалось проверить',
      tlsAudit.error,
    );
    return;
  }

  if (!tlsAudit.authorized) {
    addInsight(
      insights,
      'danger',
      'Безопасность',
      'TLS-сертификат не прошёл проверку',
      tlsAudit.authorizationError || 'Сертификат недоверенный или настроен некорректно.',
    );
  }

  if (tlsAudit.daysLeft < 0) {
    addInsight(
      insights,
      'danger',
      'Безопасность',
      'TLS-сертификат просрочен',
      'Срок действия истёк: ' + tlsAudit.validTo + '.',
    );
  } else if (tlsAudit.daysLeft < 14) {
    addInsight(
      insights,
      'danger',
      'Безопасность',
      'TLS-сертификат скоро истечёт',
      'Осталось дней: ' + tlsAudit.daysLeft + '.',
    );
  } else if (tlsAudit.daysLeft < 30) {
    addInsight(
      insights,
      'warning',
      'Безопасность',
      'TLS-сертификат близок к истечению',
      'Осталось дней: ' + tlsAudit.daysLeft + '.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Безопасность',
      'TLS-сертификат актуален',
      'До истечения примерно ' + tlsAudit.daysLeft + ' дн.',
    );
  }
}

function addAccessibilityInsights(insights, page) {
  if (!page.viewport) {
    addInsight(
      insights,
      'danger',
      'Мобильность',
      'Нет meta viewport',
      'На смартфонах страница может отображаться некорректно.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Мобильность',
      'Viewport задан',
      'Страница содержит meta viewport.',
    );
  }

  if (!page.favicon) {
    addInsight(
      insights,
      'warning',
      'Брендинг',
      'Favicon не найден',
      'Без иконки сайт выглядит менее завершённым во вкладках и закладках.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Брендинг',
      'Favicon найден',
      'Иконка сайта подключена.',
    );
  }

  if (page.formsAudit.total === 0) {
    addInsight(
      insights,
      'info',
      'Доступность',
      'Полей формы не найдено',
      'Проверка label не применялась.',
    );
  } else if (page.formsAudit.missingLabels.length > 0) {
    addInsight(
      insights,
      'warning',
      'Доступность',
      'У полей формы нет label',
      'Label помогает пользователям скринридеров и увеличивает область клика.',
      [
        'Без label: ' +
          page.formsAudit.missingLabels.length +
          ' / ' +
          page.formsAudit.total,
      ],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Доступность',
      'Поля формы подписаны',
      'У всех проверенных полей есть label или aria-метка.',
    );
  }

  const emptyInteractive =
    page.interactiveTextAudit.emptyLinks.length +
    page.interactiveTextAudit.emptyButtons.length;
  if (emptyInteractive > 0) {
    addInsight(
      insights,
      'warning',
      'Доступность',
      'Есть ссылки или кнопки без понятного текста',
      'Интерактивным элементам нужен текст, aria-label или title.',
      [
        'Пустые ссылки: ' + page.interactiveTextAudit.emptyLinks.length,
        'Пустые кнопки: ' + page.interactiveTextAudit.emptyButtons.length,
      ],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Доступность',
      'Текст ссылок и кнопок читаемый',
      'Пустых интерактивных элементов не найдено.',
    );
  }

  if (page.contrastAudit.lowContrast.length > 0) {
    addInsight(
      insights,
      'warning',
      'Доступность',
      'Найден потенциально низкий контраст',
      'Статическая проверка inline/style CSS нашла пары цветов ниже WCAG 4.5:1.',
      page.contrastAudit.lowContrast
        .slice(0, 5)
        .map((item) => item.ratio + ': ' + item.sample),
    );
  } else {
    addInsight(
      insights,
      page.contrastAudit.checked > 0 ? 'success' : 'info',
      'Доступность',
      'Критичных проблем контраста не найдено',
      page.contrastAudit.checked > 0
        ? 'Проверено цветовых пар: ' + page.contrastAudit.checked + '.'
        : 'На странице не найдено явных inline/style пар color + background.',
    );
  }
}

function addLinkInsights(insights, linkAudit) {
  if (linkAudit.checked === 0) {
    addInsight(
      insights,
      'info',
      'Ссылки',
      'Ссылок для проверки не найдено',
      'На странице нет HTTP/HTTPS ссылок.',
    );
    return;
  }

  if (linkAudit.broken.length > 0) {
    addInsight(
      insights,
      'danger',
      'Ссылки',
      'Найдены битые ссылки',
      'Такие ссылки ухудшают пользовательский опыт и расходуют crawl budget.',
      linkAudit.broken
        .slice(0, 8)
        .map((link) => (link.status || 'ERR') + ' - ' + link.url),
    );
  } else {
    addInsight(
      insights,
      'success',
      'Ссылки',
      'Битые ссылки не найдены',
      'Проверено ссылок: ' + linkAudit.checked + '.',
    );
  }

  if (linkAudit.total > linkAudit.checked) {
    addInsight(
      insights,
      'info',
      'Ссылки',
      'Проверена выборка ссылок',
      'Чтобы аудит не зависал, проверены первые ' +
        linkAudit.checked +
        ' из ' +
        linkAudit.total +
        ' уникальных ссылок.',
    );
  }
}

function addInternationalInsights(insights, page) {
  if (!page.htmlLang) {
    addInsight(
      insights,
      'warning',
      'Доступность',
      'Не указан lang у html',
      'Атрибут lang помогает браузерам, переводчикам и скринридерам.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Доступность',
      'Язык страницы указан',
      'html lang="' + page.htmlLang + '".',
    );
  }

  if (!page.charset) {
    addInsight(
      insights,
      'warning',
      'Техника',
      'Не указан charset',
      'Добавьте meta charset, чтобы избежать проблем с кодировкой.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Техника',
      'Charset указан',
      'Кодировка: ' + page.charset + '.',
    );
  }

  const invalidHreflang = page.hreflangTags.filter(
    (tag) => !isValidHreflang(tag.hreflang) || !tag.absoluteUrl,
  );
  if (page.hreflangTags.length === 0) {
    addInsight(
      insights,
      'info',
      'SEO',
      'hreflang не найден',
      'Это нормально для одноязычного сайта. Для мультиязычных версий теги нужны.',
    );
  } else if (invalidHreflang.length > 0) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Есть ошибки в hreflang',
      'Проверьте языковые коды и href у альтернативных страниц.',
      invalidHreflang
        .slice(0, 5)
        .map((tag) => tag.hreflang + ' -> ' + tag.href),
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'hreflang выглядит корректно',
      'Найдено альтернативных языковых версий: ' + page.hreflangTags.length + '.',
    );
  }
}

async function auditLinks(links) {
  const uniqueLinks = uniqueBy(links, (link) => link.absoluteUrl);
  const sample = uniqueLinks.slice(0, MAX_LINK_CHECKS);
  const results = await mapLimit(sample, CONCURRENCY, async (link) => {
    const result = await inspectUrl(link.absoluteUrl, 'text/html,*/*');
    return {
      url: link.absoluteUrl,
      status: result.status,
      ok: result.ok || [401, 403].includes(result.status),
      error: result.error,
    };
  });

  return {
    total: uniqueLinks.length,
    checked: results.length,
    broken: results.filter((result) => !result.ok),
  };
}

async function auditResources(page) {
  const resources = uniqueBy(
    [
      ...page.stylesheets.map((item) => ({ type: 'css', url: item.absoluteUrl })),
      ...page.scripts.map((item) => ({ type: 'js', url: item.absoluteUrl })),
      ...page.images
        .filter((item) => item.absoluteUrl)
        .map((item) => ({ type: 'image', url: item.absoluteUrl })),
    ],
    (resource) => resource.url,
  ).slice(0, MAX_RESOURCE_CHECKS);

  const checked = await mapLimit(resources, CONCURRENCY, async (resource) => {
    const result = await inspectUrl(resource.url, '*/*');
    return {
      ...resource,
      status: result.status,
      ok: result.ok || [401, 403].includes(result.status),
      headers: result.headers || {},
      error: result.error,
    };
  });

  const imageChecks = checked
    .filter((resource) => resource.type === 'image')
    .slice(0, MAX_IMAGE_HEAD_CHECKS);
  const heavyImages = imageChecks
    .map((image) => ({
      url: image.url,
      bytes: Number(getHeader(image.headers, 'content-length')) || 0,
    }))
    .filter((image) => image.bytes > HEAVY_IMAGE_BYTES);

  const cacheIssues = checked
    .filter((resource) => resource.ok)
    .map((resource) => {
      const cacheControl = getHeader(resource.headers, 'cache-control');
      if (!cacheControl) {
        return { url: resource.url, reason: 'Нет Cache-Control' };
      }

      const seconds = getMaxAgeSeconds(cacheControl);
      if (seconds !== null && seconds < GOOD_CACHE_SECONDS) {
        return {
          url: resource.url,
          reason: 'max-age меньше 7 дней',
        };
      }

      if (/no-store|no-cache/i.test(cacheControl)) {
        return { url: resource.url, reason: 'Отключено кеширование' };
      }

      return null;
    })
    .filter(Boolean);

  return {
    checkedResources: checked.length,
    unreachableAssets: checked.filter((resource) => !resource.ok),
    cacheIssues,
    heavyImages,
  };
}

async function checkRobotsAndSitemap(finalUrl) {
  const parsed = new URL(finalUrl);
  const robotsUrl = new URL('/robots.txt', parsed.origin).href;
  const robotsResponse = await fetchText(robotsUrl);
  const robotsData = {
    url: robotsUrl,
    status: robotsResponse.status,
    exists: robotsResponse.status >= 200 && robotsResponse.status < 400,
    blocksAll: false,
    blocksTarget: false,
    sitemaps: [],
  };

  if (robotsData.exists) {
    const parsedRobots = parseRobotsTxt(
      robotsResponse.body,
      parsed.pathname || '/',
    );
    robotsData.blocksAll = parsedRobots.blocksAll;
    robotsData.blocksTarget = parsedRobots.blocksTarget;
    robotsData.sitemaps = parsedRobots.sitemaps;
  }

  const sitemapCandidates = uniqueBy(
    [
      ...robotsData.sitemaps,
      new URL('/sitemap.xml', parsed.origin).href,
      new URL('/sitemap_index.xml', parsed.origin).href,
    ].filter(Boolean),
    (url) => url,
  ).slice(0, 4);

  const checkedSitemaps = [];
  let foundSitemap = null;
  for (const sitemapUrl of sitemapCandidates) {
    const result = await fetchText(sitemapUrl);
    const sitemapResult = {
      url: sitemapUrl,
      status: result.status,
      exists: result.status >= 200 && result.status < 400,
      validXml: /<(urlset|sitemapindex)[\s>]/i.test(result.body || ''),
    };
    checkedSitemaps.push(sitemapResult);

    if (sitemapResult.exists && !foundSitemap) {
      foundSitemap = sitemapResult;
    }
  }

  return {
    robots: robotsData,
    sitemap: foundSitemap || {
      exists: false,
      validXml: false,
      url: sitemapCandidates[0],
      checkedUrls: checkedSitemaps.map((item) => item.url),
    },
  };
}

async function inspectCanonical(value, baseUrl) {
  const absoluteUrl = toAbsoluteHttpUrl(value, baseUrl);
  if (!absoluteUrl) {
    return {
      value,
      absoluteUrl: null,
      isAbsolute: false,
      sameDomain: false,
      ok: false,
      status: null,
    };
  }

  const result = await inspectUrl(absoluteUrl, 'text/html,*/*');
  return {
    value,
    absoluteUrl,
    isAbsolute: /^https?:\/\//i.test(value),
    sameDomain: sameSite(absoluteUrl, baseUrl),
    ok: result.ok || [401, 403].includes(result.status),
    status: result.status,
  };
}

async function checkCompression(finalUrl) {
  try {
    const response = await axios.get(finalUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,*/*',
        'Accept-Encoding': 'br, gzip, deflate',
      },
      maxRedirects: 0,
      responseType: 'stream',
      decompress: false,
      timeout: RESOURCE_TIMEOUT_MS,
      validateStatus: () => true,
    });

    if (response.data && typeof response.data.destroy === 'function') {
      response.data.destroy();
    }

    return {
      encoding: getHeader(response.headers, 'content-encoding') || null,
    };
  } catch (error) {
    return { encoding: null, error: simplifyError(error) };
  }
}

async function inspectUrl(url, accept) {
  if (!url) {
    return {
      ok: false,
      status: null,
      headers: {},
      error: 'Некорректный URL',
    };
  }

  try {
    let response = await requestHeaders(url, 'HEAD', accept);
    if ([403, 405, 501].includes(response.status)) {
      response = await requestHeaders(url, 'GET', accept);
    }

    return {
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      headers: response.headers,
      finalUrl: response.finalUrl,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      headers: {},
      error: simplifyError(error),
    };
  }
}

async function requestHeaders(url, method, accept) {
  const response = await axios.request({
    url,
    method,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: accept || '*/*',
    },
    maxRedirects: 3,
    responseType: 'stream',
    timeout: RESOURCE_TIMEOUT_MS,
    validateStatus: () => true,
  });

  if (response.data && typeof response.data.destroy === 'function') {
    response.data.destroy();
  }

  return {
    status: response.status,
    headers: response.headers || {},
    finalUrl: response.request?.res?.responseUrl || url,
  };
}

async function fetchText(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/plain,application/xml,text/xml,*/*',
      },
      maxRedirects: 3,
      responseType: 'text',
      timeout: RESOURCE_TIMEOUT_MS,
      transformResponse: [(data) => data],
      validateStatus: () => true,
    });

    return {
      status: response.status,
      headers: response.headers || {},
      body:
        typeof response.data === 'string'
          ? response.data
          : String(response.data || ''),
    };
  } catch (error) {
    return {
      status: null,
      headers: {},
      body: '',
      error: simplifyError(error),
    };
  }
}

function getTlsCertificateInfo(finalUrl) {
  const parsed = new URL(finalUrl);
  if (parsed.protocol !== 'https:') {
    return Promise.resolve({ skipped: true });
  }

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 443,
        servername: parsed.hostname,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || !cert.valid_to) {
          resolve({
            error: 'Сервер не вернул данные сертификата.',
          });
          return;
        }

        const validTo = new Date(cert.valid_to);
        resolve({
          authorized: socket.authorized,
          authorizationError: socket.authorizationError,
          validTo: cert.valid_to,
          daysLeft: Math.ceil(
            (validTo.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
          ),
          issuer: cert.issuer,
          subject: cert.subject,
        });
      },
    );

    socket.setTimeout(RESOURCE_TIMEOUT_MS, () => {
      socket.destroy();
      resolve({ error: 'Таймаут проверки TLS-сертификата.' });
    });

    socket.on('error', (error) => {
      resolve({ error: simplifyError(error) });
    });
  });
}

function parseRobotsTxt(body, targetPath) {
  const rules = [];
  const sitemaps = [];
  let currentApplies = false;
  let seenDirectiveInGroup = false;

  body.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.split('#')[0].trim();
    if (!line) {
      currentApplies = false;
      seenDirectiveInGroup = false;
      return;
    }

    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) {
      return;
    }

    const field = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (field === 'sitemap' && value) {
      sitemaps.push(value);
      return;
    }

    if (field === 'user-agent') {
      if (seenDirectiveInGroup) {
        currentApplies = false;
        seenDirectiveInGroup = false;
      }
      currentApplies =
        currentApplies || value === '*' || value.toLowerCase().includes('auditbot');
      return;
    }

    if (field === 'allow' || field === 'disallow') {
      seenDirectiveInGroup = true;
      if (currentApplies) {
        rules.push({
          type: field,
          path: value,
        });
      }
    }
  });

  return {
    blocksAll: isRobotsPathBlocked('/', rules),
    blocksTarget: isRobotsPathBlocked(targetPath || '/', rules),
    sitemaps,
  };
}

function isRobotsPathBlocked(path, rules) {
  const applicable = rules.filter((rule) => {
    if (rule.type === 'disallow' && rule.path === '') return false;
    return path.startsWith(rule.path || '/');
  });

  if (applicable.length === 0) {
    return false;
  }

  applicable.sort((a, b) => {
    const lengthDiff = (b.path || '').length - (a.path || '').length;
    if (lengthDiff !== 0) return lengthDiff;
    if (a.type === b.type) return 0;
    return a.type === 'allow' ? -1 : 1;
  });

  return applicable[0].type === 'disallow';
}

function auditForms($) {
  const controls = [];
  $('input, select, textarea').each((index, element) => {
    const tag = (element.tagName || element.name || '').toLowerCase();
    const type = ($(element).attr('type') || '').toLowerCase();
    if (
      tag === 'input' &&
      ['hidden', 'button', 'submit', 'reset', 'image'].includes(type)
    ) {
      return;
    }

    const id = $(element).attr('id');
    const hasExplicitLabel = id ? $('label[for="' + cssEscape(id) + '"]').length > 0 : false;
    const hasLabel =
      hasExplicitLabel ||
      $(element).closest('label').length > 0 ||
      Boolean($(element).attr('aria-label')) ||
      Boolean($(element).attr('aria-labelledby')) ||
      Boolean($(element).attr('title'));

    controls.push({
      tag,
      type,
      name: $(element).attr('name') || '',
      hasLabel,
    });
  });

  return {
    total: controls.length,
    missingLabels: controls.filter((control) => !control.hasLabel),
  };
}

function auditInteractiveText($) {
  const emptyLinks = [];
  const emptyButtons = [];

  $('a[href]').each((index, element) => {
    if (!getAccessibleText($, element)) {
      emptyLinks.push($(element).attr('href') || 'link #' + (index + 1));
    }
  });

  $('button').each((index, element) => {
    if (!getAccessibleText($, element)) {
      emptyButtons.push($(element).attr('id') || 'button #' + (index + 1));
    }
  });

  return { emptyLinks, emptyButtons };
}

function auditStaticContrast($) {
  const checkedPairs = [];

  $('[style]').each((index, element) => {
    const declarations = parseCssDeclarations($(element).attr('style') || '');
    const pair = colorPairFromDeclarations(declarations);
    if (pair) {
      checkedPairs.push({
        ...pair,
        sample: cleanText($(element).text()).slice(0, 60) || element.tagName,
      });
    }
  });

  $('style').each((index, element) => {
    const css = $(element).html() || '';
    const ruleMatches = css.matchAll(/\{([^{}]+)\}/g);
    for (const match of ruleMatches) {
      const declarations = parseCssDeclarations(match[1]);
      const pair = colorPairFromDeclarations(declarations);
      if (pair) {
        checkedPairs.push({
          ...pair,
          sample: 'style block #' + (index + 1),
        });
      }
    }
  });

  const lowContrast = checkedPairs
    .map((pair) => ({
      sample: pair.sample,
      ratio: calculateContrastRatio(pair.foreground, pair.background).toFixed(2),
    }))
    .filter((pair) => Number(pair.ratio) < 4.5);

  return {
    checked: checkedPairs.length,
    lowContrast,
  };
}

function collectMixedContent($, baseUrl) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') {
    return [];
  }

  const mixed = [];
  $('[src], link[href]').each((index, element) => {
    const src = $(element).attr('src') || $(element).attr('href') || '';
    if (/^http:\/\//i.test(src)) {
      mixed.push(src);
    }
  });

  return uniqueBy(mixed, (item) => item).slice(0, 20);
}

function parseJsonLd(content) {
  if (!content) {
    return {
      valid: false,
      error: 'Пустой JSON-LD блок.',
    };
  }

  try {
    JSON.parse(content);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

function buildRawData({
  finalUrl,
  response,
  redirects,
  loadTime,
  page,
  robotsAudit,
  linkAudit,
  resourceAudit,
  compressionAudit,
  tlsAudit,
}) {
  return {
    status: response.status,
    finalUrl,
    redirects,
    loadTime,
    contentType: getHeader(response.headers, 'content-type') || 'Не указан',
    title: page.title,
    description: page.description,
    h1: page.h1.map((heading) => heading.text),
    headings: page.headings.length,
    wordCount: page.wordCount,
    htmlSize: formatBytes(page.htmlSizeBytes),
    images: page.images.length,
    imagesWithoutAlt: page.images.filter((image) => !image.hasAlt).length,
    imagesWithEmptyAlt: page.images.filter(
      (image) => image.hasAlt && image.alt.trim() === '',
    ).length,
    imagesWithoutDimensions: page.images.filter(
      (image) => !image.hasWidth || !image.hasHeight,
    ).length,
    internalLinks: page.internalLinks,
    externalLinks: page.externalLinks,
    checkedLinks: linkAudit.checked,
    brokenLinks: linkAudit.broken.length,
    scripts: page.scripts.length,
    stylesheets: page.stylesheets.length,
    checkedResources: resourceAudit.checkedResources,
    cacheIssues: resourceAudit.cacheIssues.length,
    heavyImages: resourceAudit.heavyImages.length,
    canonical: page.canonical,
    robots: page.robots,
    robotsTxt: robotsAudit.robots,
    sitemap: robotsAudit.sitemap,
    viewport: page.viewport,
    favicon: page.favicon,
    htmlLang: page.htmlLang,
    charset: page.charset,
    og: {
      title: page.ogTitle,
      description: page.ogDescription,
      image: page.ogImage?.value || null,
    },
    twitter: page.twitter,
    jsonLd: page.jsonLdScripts.length,
    hreflang: page.hreflangTags.length,
    compression: compressionAudit.encoding,
    tlsDaysLeft: tlsAudit.daysLeft,
  };
}

function buildSummary(insights) {
  const counts = insights.reduce(
    (acc, insight) => {
      acc[insight.level] += 1;
      return acc;
    },
    { success: 0, warning: 0, danger: 0, info: 0 },
  );
  const score = Math.max(
    0,
    Math.min(
      100,
      100 - counts.danger * 12 - counts.warning * 5 - counts.info,
    ),
  );

  return {
    ...counts,
    score,
    total: insights.length,
  };
}

function addInsight(insights, level, category, title, text, details = []) {
  insights.push({
    level,
    category,
    title,
    text,
    details: details.filter(Boolean),
  });
}

function findSkippedHeadingLevels(headings) {
  const skipped = [];
  let previousLevel = null;

  headings.forEach((heading) => {
    if (previousLevel !== null && heading.level > previousLevel + 1) {
      skipped.push('H' + previousLevel + ' -> H' + heading.level);
    }
    previousLevel = heading.level;
  });

  return skipped;
}

function getHeader(headers, name) {
  if (!headers) return '';
  const lowerName = name.toLowerCase();
  return headers[lowerName] || headers[name] || '';
}

function normalizeSetCookie(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getMaxAgeSeconds(cacheControl) {
  const match = cacheControl.match(/(?:s-maxage|max-age)=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function isRedirect(status) {
  return status >= 300 && status < 400;
}

function toAbsoluteHttpUrl(value, baseUrl) {
  if (!value) return null;
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    /^(mailto|tel|sms|javascript|data|blob):/i.test(trimmed)
  ) {
    return null;
  }

  try {
    const url = new URL(trimmed, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.href;
  } catch (error) {
    return null;
  }
}

function sameSite(leftUrl, rightUrl) {
  try {
    const left = new URL(leftUrl);
    const right = new URL(rightUrl);
    return normalizeHost(left.hostname) === normalizeHost(right.hostname);
  } catch (error) {
    return false;
  }
}

function normalizeHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function stripHash(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href;
  } catch (error) {
    return url;
  }
}

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function getAccessibleText($, element) {
  const text = cleanText($(element).text());
  if (text) return text;

  const aria = $(element).attr('aria-label');
  if (aria) return cleanText(aria);

  const title = $(element).attr('title');
  if (title) return cleanText(title);

  const imageAlt = $(element).find('img[alt]').first().attr('alt');
  if (imageAlt) return cleanText(imageAlt);

  return '';
}

function countWords(text) {
  if (!text) return 0;
  const words = text.match(/[A-Za-zА-Яа-яЁё0-9]+/g);
  return words ? words.length : 0;
}

function isGenericTitle(title) {
  const normalized = normalizeTextForCompare(title);
  return [
    'home',
    'homepage',
    'main',
    'index',
    'untitled',
    'document',
    'welcome',
    'главная',
    'главная страница',
    'добро пожаловать',
  ].includes(normalized);
}

function normalizeTextForCompare(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[|:—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidHreflang(value) {
  return /^(x-default|[a-z]{2,3}(-[a-z0-9]{2,8})*)$/i.test(value || '');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1) + ' ' + units[unitIndex];
}

function parseCssDeclarations(value) {
  return value.split(';').reduce((acc, declaration) => {
    const colonIndex = declaration.indexOf(':');
    if (colonIndex === -1) return acc;
    const property = declaration.slice(0, colonIndex).trim().toLowerCase();
    const propertyValue = declaration.slice(colonIndex + 1).trim();
    if (property) {
      acc[property] = propertyValue;
    }
    return acc;
  }, {});
}

function colorPairFromDeclarations(declarations) {
  const foreground = parseColor(declarations.color);
  const background = parseColor(
    declarations['background-color'] || declarations.background,
  );

  if (!foreground || !background) {
    return null;
  }

  return { foreground, background };
}

function parseColor(value) {
  if (!value) return null;
  const color = value.trim().toLowerCase();
  const named = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    green: [0, 128, 0],
    blue: [0, 0, 255],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
    transparent: null,
  };

  if (Object.prototype.hasOwnProperty.call(named, color)) {
    return named[color];
  }

  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (hex) {
    const raw = hex[1];
    const expanded =
      raw.length === 3
        ? raw
            .split('')
            .map((char) => char + char)
            .join('')
        : raw;
    return [
      parseInt(expanded.slice(0, 2), 16),
      parseInt(expanded.slice(2, 4), 16),
      parseInt(expanded.slice(4, 6), 16),
    ];
  }

  const rgb = color.match(/^rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1]
      .split(',')
      .slice(0, 3)
      .map((part) => Number(part.trim()));
    if (parts.every((part) => Number.isFinite(part))) {
      return parts;
    }
  }

  return null;
}

function calculateContrastRatio(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function cssEscape(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}

function simplifyError(error) {
  if (error.response) {
    return 'HTTP ' + error.response.status;
  }
  if (error.code) {
    return error.code;
  }
  return error.message || 'Неизвестная ошибка';
}

async function mapLimit(items, limit, mapper) {
  if (items.length === 0) {
    return [];
  }

  const results = new Array(items.length);
  let index = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const unique = [];

  items.forEach((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(item);
  });

  return unique;
}

module.exports = {
  runAudit,
  normalizeUrl,
};
