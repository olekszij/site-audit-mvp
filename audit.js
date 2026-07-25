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
    throw new Error('Enter URL to check.');
  }

  const trimmed = value.trim();
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : 'https://' + trimmed;
  const parsed = new URL(withProtocol);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS addresses are supported.');
  }

  parsed.hash = '';
  return parsed.href;
}

function calculatePerformanceScore(context) {
  const { loadTime, page, resourceAudit, compressionAudit } = context;
  let score = 100;
  const deductions = [];

  const scriptCount = page.scripts.length;
  const stylesheetCount = page.stylesheets.length;
  const htmlSizeKb = page.htmlSizeBytes / 1024;
  const imagesWithoutDimensions = page.images.filter(
    (image) => !image.hasWidth || !image.hasHeight,
  ).length;
  const failedResources = resourceAudit?.unreachableAssets?.length || 0;
  const heavyImages = resourceAudit?.heavyImages?.length || 0;
  const cacheIssues = resourceAudit?.cacheIssues?.length || 0;

  if (loadTime > 2000) {
    const penalty = Math.min((loadTime - 2000) / 100, 20);
    score -= penalty;
    deductions.push({
      metric: 'Response time',
      value: loadTime + ' ms',
      penalty: Number(penalty.toFixed(1)),
    });
  }

  if (htmlSizeKb > 100) {
    const penalty = Math.min((htmlSizeKb - 100) / 50, 10);
    score -= penalty;
    deductions.push({
      metric: 'HTML size',
      value: formatBytes(page.htmlSizeBytes),
      penalty: Number(penalty.toFixed(1)),
    });
  }

  if (scriptCount > 10) {
    const penalty = Math.min((scriptCount - 10) * 1.5, 15);
    score -= penalty;
    deductions.push({
      metric: 'Scripts',
      value: String(scriptCount),
      penalty: Number(penalty.toFixed(1)),
    });
  }

  if (stylesheetCount > 5) {
    const penalty = Math.min((stylesheetCount - 5) * 2, 10);
    score -= penalty;
    deductions.push({
      metric: 'Stylesheets',
      value: String(stylesheetCount),
      penalty: Number(penalty.toFixed(1)),
    });
  }

  if (imagesWithoutDimensions > 0) {
    const penalty = Math.min(imagesWithoutDimensions * 1.5, 10);
    score -= penalty;
    deductions.push({
      metric: 'Images without size',
      value: String(imagesWithoutDimensions),
      penalty: Number(penalty.toFixed(1)),
    });
  }

  if (compressionAudit && !compressionAudit.encoding) {
    score -= 8;
    deductions.push({
      metric: 'Compression',
      value: 'None',
      penalty: 8,
    });
  }

  if (failedResources > 0) {
    const penalty = Math.min(failedResources * 3, 15);
    score -= penalty;
    deductions.push({
      metric: 'Failed resources',
      value: String(failedResources),
      penalty: Number(penalty.toFixed(1)),
    });
  }

  if (heavyImages > 0) {
    const penalty = Math.min(heavyImages * 2, 10);
    score -= penalty;
    deductions.push({
      metric: 'Heavy images',
      value: String(heavyImages),
      penalty: Number(penalty.toFixed(1)),
    });
  }

  if (cacheIssues > 0) {
    const penalty = Math.min(cacheIssues * 1.5, 8);
    score -= penalty;
    deductions.push({
      metric: 'Weak caching',
      value: String(cacheIssues),
      penalty: Number(penalty.toFixed(1)),
    });
  }

  const finalScore = Math.max(0, Math.round(score));
  return {
    score: finalScore,
    deductions,
    grade: getPerformanceGrade(finalScore),
  };
}

function getPerformanceGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getVitalStatus(value, good, needsImprovement) {
  if (value <= good) return 'good';
  if (value <= needsImprovement) return 'needs-improvement';
  return 'poor';
}

function simulateCoreWebVitals(context) {
  const { loadTime, page } = context;
  const scriptCount = page.scripts.length;
  const stylesheetCount = page.stylesheets.length;
  const imagesWithoutDimensions = page.images.filter(
    (image) => !image.hasWidth || !image.hasHeight,
  ).length;

  // Estimated from response time + asset signals (not lab PSI / CrUX).
  const ttfb = loadTime;
  const fcp = Math.round(Math.max(loadTime * 0.55, Math.min(loadTime + 200, 2500)));
  const lcp = Math.round(
    Math.max(fcp + 300, loadTime * 1.15 + scriptCount * 60 + stylesheetCount * 40),
  );
  const cls = Math.min(imagesWithoutDimensions * 0.04, 0.5);
  const fid = Math.min(scriptCount * 12, 300);

  return {
    ttfb: {
      value: ttfb,
      unit: 'ms',
      status: getVitalStatus(ttfb, 800, 1800),
      label: 'Time to First Byte',
    },
    fcp: {
      value: fcp,
      unit: 'ms',
      status: getVitalStatus(fcp, 1800, 3000),
      label: 'First Contentful Paint',
    },
    lcp: {
      value: lcp,
      unit: 'ms',
      status: getVitalStatus(lcp, 2500, 4000),
      label: 'Largest Contentful Paint',
    },
    cls: {
      value: Number(cls.toFixed(3)),
      unit: '',
      status: getVitalStatus(cls, 0.1, 0.25),
      label: 'Cumulative Layout Shift',
    },
    fid: {
      value: Math.round(fid),
      unit: 'ms',
      status: getVitalStatus(fid, 100, 300),
      label: 'First Input Delay',
    },
  };
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
    twitterImageAudit,
    faviconAudit,
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
    page.twitter.image
      ? inspectUrl(page.twitter.image.absoluteUrl, 'image/*,*/*')
      : Promise.resolve(null),
    page.favicon.absoluteUrl
      ? inspectUrl(page.favicon.absoluteUrl, 'image/*,*/*')
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
    twitterImageAudit,
    faviconAudit,
    linkAudit,
    resourceAudit,
    compressionAudit,
    tlsAudit,
  };
  
  // Calculate performance metrics
  const performanceScore = calculatePerformanceScore(context);
  const coreWebVitals = simulateCoreWebVitals(context);
  
  const insights = buildInsights(context, performanceScore, coreWebVitals);

  return {
    targetUrl,
    finalUrl: fetchResult.finalUrl,
    checkedAt: new Date().toLocaleString('en-US'),
    loadTime: fetchResult.loadTime,
    insights,
    summary: buildSummary(insights),
    raw: buildRawData(context),
    performance: {
      score: performanceScore.score,
      grade: performanceScore.grade,
      deductions: performanceScore.deductions,
      coreWebVitals
    }
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

  throw new Error('Redirect chain too long.');
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
  const faviconHref =
    $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href') ||
    null;
  const faviconAbsolute =
    toAbsoluteHttpUrl(faviconHref, baseUrl) ||
    toAbsoluteHttpUrl('/favicon.ico', baseUrl);
  const favicon = {
    declared: Boolean(faviconHref),
    href: faviconHref,
    absoluteUrl: faviconAbsolute,
  };

  const appleTouchHref =
    $('link[rel="apple-touch-icon"]').first().attr('href') || null;
  const appleTouchIcon = {
    declared: Boolean(appleTouchHref),
    href: appleTouchHref,
    absoluteUrl: toAbsoluteHttpUrl(appleTouchHref, baseUrl),
  };

  const hasDoctype = /^\s*<!doctype\s+html/i.test(html || '');
  const metaRefresh =
    $('meta[http-equiv="refresh"]').first().attr('content') || null;
  const manifestHref =
    $('link[rel="manifest"]').first().attr('href') || null;
  const manifest = {
    declared: Boolean(manifestHref),
    href: manifestHref,
    absoluteUrl: toAbsoluteHttpUrl(manifestHref, baseUrl),
  };
  const themeColor =
    $('meta[name="theme-color"]').first().attr('content') || null;

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

    const rel = ($(element).attr('rel') || '').toLowerCase();
    const target = ($(element).attr('target') || '').trim().toLowerCase();

    links.push({
      href,
      absoluteUrl: stripHash(absoluteUrl),
      text: getAccessibleText($, element),
      target,
      rel,
      relTokens: rel.split(/\s+/).filter(Boolean),
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
    const srcset =
      $(element).attr('srcset') ||
      $(element).attr('data-srcset') ||
      '';
    images.push({
      src,
      srcset,
      sizes: $(element).attr('sizes') || '',
      absoluteUrl: toAbsoluteHttpUrl(src, baseUrl),
      hasAlt: alt !== undefined,
      alt: alt || '',
      hasWidth: Boolean($(element).attr('width')),
      hasHeight: Boolean($(element).attr('height')),
      loading: ($(element).attr('loading') || '').toLowerCase(),
      index,
    });
  });

  const pictureModern = [];
  $('picture source[type], picture source[srcset]').each((index, element) => {
    const type = ($(element).attr('type') || '').toLowerCase();
    const srcset = $(element).attr('srcset') || '';
    pictureModern.push({ type, srcset });
  });

  const scripts = [];
  $('script[src]').each((index, element) => {
    const src = $(element).attr('src') || '';
    const absoluteUrl = toAbsoluteHttpUrl(src, baseUrl);
    if (absoluteUrl) {
      const type = ($(element).attr('type') || '').toLowerCase();
      scripts.push({
        src,
        absoluteUrl,
        async: $(element).attr('async') !== undefined,
        defer: $(element).attr('defer') !== undefined,
        type,
        integrity: ($(element).attr('integrity') || '').trim(),
        isModule: type === 'module',
      });
    }
  });

  const stylesheets = [];
  const resourceHints = [];
  $('link[href]').each((index, element) => {
    const rel = ($(element).attr('rel') || '').toLowerCase();
    const relTokens = rel.split(/\s+/).filter(Boolean);
    const href = $(element).attr('href') || '';
    const absoluteUrl = toAbsoluteHttpUrl(href, baseUrl);

    if (relTokens.includes('stylesheet') && absoluteUrl) {
      stylesheets.push({
        href,
        absoluteUrl,
        integrity: ($(element).attr('integrity') || '').trim(),
      });
    }

    if (
      absoluteUrl &&
      (relTokens.includes('preconnect') ||
        relTokens.includes('dns-prefetch') ||
        relTokens.includes('preload') ||
        relTokens.includes('prefetch'))
    ) {
      resourceHints.push({
        rel: relTokens.join(' '),
        href,
        absoluteUrl,
      });
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
  const twitterImageValue =
    $('meta[name="twitter:image"]').first().attr('content') || null;
  const twitter = {
    card: $('meta[name="twitter:card"]').first().attr('content') || null,
    title: $('meta[name="twitter:title"]').first().attr('content') || null,
    description:
      $('meta[name="twitter:description"]').first().attr('content') || null,
    image: twitterImageValue
      ? {
          value: twitterImageValue,
          absoluteUrl: toAbsoluteHttpUrl(twitterImageValue, baseUrl),
        }
      : null,
  };

  const final = new URL(baseUrl);
  const internalLinks = links.filter((link) =>
    sameSite(link.absoluteUrl, final.href),
  ).length;
  const externalLinks = links.length - internalLinks;
  const bodyText = cleanText($('body').text());

  const hasMain =
    $('main').length > 0 || $('[role="main"]').length > 0;

  const skipLink = detectSkipLink($);
  const autoplayMedia = [];
  $('video[autoplay], audio[autoplay]').each((index, element) => {
    const muted =
      $(element).attr('muted') !== undefined ||
      String($(element).attr('muted') || '').toLowerCase() === 'true';
    if (!muted) {
      const tag = (element.tagName || element.name || 'media').toLowerCase();
      autoplayMedia.push({
        tag,
        src: $(element).attr('src') || $(element).find('source').first().attr('src') || '',
      });
    }
  });

  const iframes = [];
  $('iframe').each((index, element) => {
    const titleAttr = cleanText($(element).attr('title') || '');
    const aria = cleanText($(element).attr('aria-label') || '');
    iframes.push({
      src: $(element).attr('src') || '',
      hasAccessibleName: Boolean(titleAttr || aria),
    });
  });

  const weakAnchors = collectWeakAnchors(links);

  return {
    title,
    description,
    viewport,
    canonical,
    robots,
    favicon,
    appleTouchIcon,
    hasDoctype,
    metaRefresh,
    manifest,
    themeColor,
    hasMain,
    skipLink,
    autoplayMedia,
    iframes,
    weakAnchors,
    htmlLang,
    charset,
    headings,
    h1: headings.filter((heading) => heading.level === 1),
    links: uniqueBy(links, (link) => link.absoluteUrl),
    internalLinks,
    externalLinks,
    images,
    pictureModern,
    scripts,
    stylesheets,
    resourceHints,
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
  twitterImageAudit,
  faviconAudit,
  linkAudit,
  resourceAudit,
  compressionAudit,
  tlsAudit,
}, performanceScore, coreWebVitals) {
  const insights = [];
  const finalUrlObject = new URL(finalUrl);
  const targetUrlObject = new URL(targetUrl);
  const status = response.status;
  const contentType = getHeader(response.headers, 'content-type');

  if (status >= 500) {
    addInsight(
      insights,
      'danger',
      'Technical',
      'Server returned error ' + status,
      'Page is unavailable to users and search bots.',
    );
  } else if (status >= 400) {
    addInsight(
      insights,
      'danger',
      'Technical',
      'Page returned status ' + status,
      'Such URL should not be the main landing page.',
    );
  } else if (status >= 300) {
    addInsight(
      insights,
      'warning',
      'Technical',
      'Final status ' + status,
      'Check that redirect is intentional.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Technical',
      'HTTP status is normal',
      'Final page responds with code ' + status + '.',
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
      'Technical',
      'Redirect chain: ' + redirects.length,
      hasHttpToHttps
        ? 'HTTP version correctly redirects visitor to HTTPS.'
        : 'There are intermediate redirects. Shorter chain means faster loading.',
      redirects.map(
        (redirect) => redirect.status + ': ' + redirect.from + ' -> ' + redirect.to,
      ),
    );
  } else if (targetUrlObject.protocol === 'http:' && finalUrlObject.protocol === 'http:') {
    addInsight(
      insights,
      'warning',
      'Security',
      'HTTP does not redirect to HTTPS',
      'For public sites, it is better to set up 301 redirect to secure version.',
    );
  }

  if (!contentType || contentType.includes('text/html')) {
    addInsight(
      insights,
      'success',
      'Technical',
      'Content type suitable for HTML page',
      contentType ? 'Content-Type: ' + contentType : 'Server did not specify Content-Type.',
    );
  } else {
    addInsight(
      insights,
      'warning',
      'Technical',
      'Unusual Content-Type',
      'Expected HTML, but server returned: ' + contentType + '.',
    );
  }

  if (finalUrlObject.protocol !== 'https:') {
    addInsight(
      insights,
      'danger',
      'Security',
      'HTTPS missing',
      'Browsers will mark site as unsafe, and some SEO signals will be weaker.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Security',
      'HTTPS enabled',
      'Final URL uses secure protocol.',
    );
  }

  addTitleInsights(insights, page);
  addDescriptionInsights(insights, page.description);
  addHeadingInsights(insights, page);
  addDocumentInsights(insights, page);
  addIndexingInsights(insights, page, robotsAudit, finalUrl);
  addCanonicalInsights(insights, canonicalAudit, finalUrl);
  addMediaInsights(insights, page, ogImageAudit, resourceAudit);
  addSocialInsights(insights, page, twitterImageAudit);
  addContentInsights(insights, page);
  addPerformanceInsights(
    insights,
    loadTime,
    page,
    resourceAudit,
    compressionAudit,
    finalUrl,
  );
  addEstimatedPerformanceInsights(insights, performanceScore, coreWebVitals);
  addSecurityInsights(insights, response.headers, finalUrlObject, page, tlsAudit);
  addAccessibilityInsights(insights, page, faviconAudit);
  addPwaBrandingInsights(insights, page);
  addLandmarkInsights(insights, page);
  addLinkInsights(insights, linkAudit, page);
  addInternationalInsights(insights, page);

  return insights;
}

function addDocumentInsights(insights, page) {
  if (!page.hasDoctype) {
    addInsight(
      insights,
      'warning',
      'Technical',
      'HTML doctype missing',
      'Pages should start with <!DOCTYPE html> so browsers use standards mode.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Technical',
      'HTML doctype present',
      'Document declares an HTML doctype.',
    );
  }

  if (page.metaRefresh) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Meta refresh found',
      'Meta refresh redirects are weaker for SEO and accessibility than HTTP redirects.',
      [page.metaRefresh],
    );
  }
}

function addPwaBrandingInsights(insights, page) {
  if (!page.manifest || !page.manifest.declared) {
    addInsight(
      insights,
      'info',
      'Mobile',
      'Web app manifest missing',
      'A manifest helps installability and home-screen icons on supporting browsers.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Mobile',
      'Web app manifest linked',
      'Found <link rel="manifest">.',
      [page.manifest.absoluteUrl || page.manifest.href],
    );
  }

  if (!page.themeColor) {
    addInsight(
      insights,
      'info',
      'Branding',
      'theme-color missing',
      'theme-color tints browser UI on mobile and improves brand consistency.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Branding',
      'theme-color set',
      'Browser chrome can use the declared brand color.',
      [page.themeColor],
    );
  }

  if (!page.appleTouchIcon || !page.appleTouchIcon.declared) {
    addInsight(
      insights,
      'info',
      'Branding',
      'apple-touch-icon missing',
      'iOS home-screen bookmarks look better with an apple-touch-icon.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Branding',
      'apple-touch-icon found',
      'Apple touch icon is linked.',
      [page.appleTouchIcon.absoluteUrl || page.appleTouchIcon.href],
    );
  }
}

function addLandmarkInsights(insights, page) {
  if (!page.skipLink || !page.skipLink.found) {
    addInsight(
      insights,
      'warning',
      'Accessibility',
      'Skip link not found',
      'A skip-to-content link near the top helps keyboard users bypass repeated chrome.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Accessibility',
      'Skip link present',
      'Early link looks like a skip/navigation bypass.',
      [page.skipLink.href, page.skipLink.text].filter(Boolean),
    );
  }

  if (!page.hasMain) {
    addInsight(
      insights,
      'warning',
      'Accessibility',
      'Main landmark missing',
      'Add <main> or role="main" so assistive tech can jump to primary content.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Accessibility',
      'Main landmark present',
      'Page exposes a main content landmark.',
    );
  }

  if (page.autoplayMedia && page.autoplayMedia.length > 0) {
    addInsight(
      insights,
      'warning',
      'Accessibility',
      'Autoplay media without muted',
      'Autoplaying video/audio without muted can surprise users and fail accessibility expectations.',
      page.autoplayMedia
        .slice(0, 5)
        .map((item) => item.tag + (item.src ? ': ' + item.src : '')),
    );
  }

  const untitledIframes = (page.iframes || []).filter(
    (frame) => !frame.hasAccessibleName,
  );
  if (untitledIframes.length > 0) {
    addInsight(
      insights,
      'warning',
      'Accessibility',
      'Iframes missing accessible name',
      'Each iframe needs a title or aria-label describing its purpose.',
      untitledIframes
        .slice(0, 5)
        .map((frame) => frame.src || '(no src)'),
    );
  } else if ((page.iframes || []).length > 0) {
    addInsight(
      insights,
      'success',
      'Accessibility',
      'Iframes have accessible names',
      'Checked iframes include title or aria-label.',
    );
  }
}

function addTitleInsights(insights, page) {
  if (!page.title) {
    addInsight(
      insights,
      'danger',
      'SEO',
      'Title tag missing',
      'Search engines and browser tab have nothing to show as page name.',
    );
    return;
  }

  const length = page.title.length;
  if (length < 30 || length > 60) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Suboptimal Title length (' + length + ' chars)',
      'Guideline for snippet: 30-60 characters.',
      ['Title: ' + page.title],
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'Title has good length',
      'Page title falls within recommended range.',
      ['Title: ' + page.title],
    );
  }

  if (isGenericTitle(page.title)) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Title too generic',
      'Name like "Home" or "Main" poorly explains page value.',
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
      'Title and H1 match',
      'This is not an error, but often better to give title slightly more context for search.',
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
      'No meta description',
      'Random text fragment from page may appear in search results.',
    );
    return;
  }

  const length = description.length;
  if (length < 70 || length > 160) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Suboptimal description length (' + length + ' chars)',
      'Good guideline for snippet: 70-160 characters.',
      ['Meta description: ' + description],
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'Meta description filled correctly',
      'Product description falls within working length range.',
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
      'H1 missing',
      'Search engines have harder time determining main page topic.',
    );
  } else if (page.h1.length > 1) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Multiple H1 found (' + page.h1.length + ')',
      'Better to keep one main page heading.',
      page.h1.map((heading) => heading.text).filter(Boolean).slice(0, 5),
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'H1 found',
      'Main heading: "' + page.h1[0].text + '".',
    );
  }

  const emptyHeadings = page.headings.filter((heading) => !heading.text);
  const skippedLevels = findSkippedHeadingLevels(page.headings);

  if (emptyHeadings.length > 0) {
    addInsight(
      insights,
      'warning',
      'Accessibility',
      'Empty headings found',
      'Empty H-tags hinder screen reader navigation and blur page structure.',
    );
  }

  if (skippedLevels.length > 0) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Heading hierarchy broken',
      'There are level skips, e.g., H2 directly to H4.',
      skippedLevels.slice(0, 5),
    );
  } else if (page.headings.length > 0) {
    addInsight(
      insights,
      'success',
      'SEO',
      'Heading hierarchy looks sequential',
      'No major H1-H6 level gaps found.',
    );
  }
}

function addIndexingInsights(insights, page, robotsAudit, finalUrl) {
  const robots = (page.robots || '').toLowerCase();
  if (robots.includes('noindex') || robots.includes('nofollow')) {
    addInsight(
      insights,
      'danger',
      'Indexing',
      'Meta robots blocks indexing or links',
      'Directives found on page: ' + page.robots + '.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Indexing',
      'Meta robots does not block page',
      page.robots
        ? 'Current directives: ' + page.robots + '.'
        : 'No blocking meta robots directives found.',
    );
  }

  if (!robotsAudit.robots.exists) {
    addInsight(
      insights,
      'warning',
      'Indexing',
      'robots.txt not found',
      'File is not required, but helps control site crawling.',
      [robotsAudit.robots.url],
    );
  } else if (robotsAudit.robots.blocksTarget || robotsAudit.robots.blocksAll) {
    addInsight(
      insights,
      'danger',
      'Indexing',
      'robots.txt blocks page',
      robotsAudit.robots.blocksAll
        ? 'For User-agent: * found Disallow: /.'
        : 'robots.txt rules prohibit crawling checked path.',
      [robotsAudit.robots.url],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Indexing',
      'robots.txt does not block checked page',
      'File is available and does not contain explicit ban for this URL.',
      [robotsAudit.robots.url],
    );
  }

  if (robotsAudit.sitemap.exists) {
    addInsight(
      insights,
      robotsAudit.sitemap.validXml ? 'success' : 'warning',
      'Indexing',
      'Sitemap found',
      robotsAudit.sitemap.validXml
        ? 'Site map looks like valid XML sitemap.'
        : 'File is available but does not look like standard sitemap XML.',
      [robotsAudit.sitemap.url],
    );

    if (robotsAudit.sitemap.containsPage === true) {
      addInsight(
        insights,
        'success',
        'Indexing',
        'Sitemap includes checked URL',
        'The audited page URL appears in a <loc> entry of the sitemap.',
        [finalUrl],
      );

      const robotsLower = (page.robots || '').toLowerCase();
      if (robotsLower.includes('noindex')) {
        addInsight(
          insights,
          'warning',
          'Indexing',
          'noindex conflicts with sitemap',
          'Page is listed in the sitemap but meta robots asks crawlers not to index it.',
          [finalUrl, page.robots],
        );
      }
    } else if (robotsAudit.sitemap.containsPage === false) {
      addInsight(
        insights,
        'warning',
        'Indexing',
        'Checked URL missing from sitemap',
        'Sitemap was found, but this page URL was not listed in checked sitemap files.',
        [robotsAudit.sitemap.url, finalUrl],
      );
    } else if (robotsAudit.sitemap.isIndex) {
      addInsight(
        insights,
        'info',
        'Indexing',
        'Sitemap is an index file',
        'Found a sitemap index; page inclusion was not fully verified across all child sitemaps.',
        [robotsAudit.sitemap.url],
      );
    }
  } else {
    addInsight(
      insights,
      'warning',
      'Indexing',
      'Sitemap not found',
      'Add sitemap.xml or Sitemap link in robots.txt to speed up page discovery.',
      robotsAudit.sitemap.checkedUrls,
    );
  }
}

function addCanonicalInsights(insights, canonicalAudit, finalUrl) {
  if (!canonicalAudit) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Canonical not specified',
      'Search engines may index page duplicates with parameters or alternative URLs.',
    );
    return;
  }

  if (!canonicalAudit.absoluteUrl) {
    addInsight(
      insights,
      'danger',
      'SEO',
      'Canonical cannot be read',
      'Canonical value could not be converted to HTTP/HTTPS URL.',
      [canonicalAudit.value],
    );
    return;
  }

  const details = [
    'Canonical: ' + canonicalAudit.absoluteUrl,
    canonicalAudit.status ? 'Status: ' + canonicalAudit.status : null,
  ].filter(Boolean);

  if (!canonicalAudit.isAbsolute) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Canonical specified as relative URL',
      'Better to use full absolute address.',
      details,
    );
  } else if (!canonicalAudit.sameDomain) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'Canonical points to different domain',
      'This is acceptable only if you intentionally pass canonicality to another page version.',
      details,
    );
  } else if (!canonicalAudit.ok) {
    addInsight(
      insights,
      'danger',
      'SEO',
      'Canonical points to unavailable URL',
      'Canonical address must open without errors.',
      details,
    );
  } else if (hostsDifferOnlyByWww(canonicalAudit.absoluteUrl, finalUrl)) {
    addInsight(
      insights,
      'info',
      'SEO',
      'www and non-www hosts mixed',
      'Canonical and page URL differ only by www. Prefer one host and redirect the other.',
      details.concat(['Checked page: ' + finalUrl]),
    );
  } else if (!urlsLooselyEqual(canonicalAudit.absoluteUrl, finalUrl)) {
    addInsight(
      insights,
      'info',
      'SEO',
      'Canonical points to a different URL',
      'Canonical is reachable on the same domain but does not match the checked page URL. Fine for intentional consolidation.',
      details.concat(['Checked page: ' + finalUrl]),
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'Canonical configured correctly',
      'Canonical URL is absolute, available and matches this page.',
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
      'Media',
      'No images found on page',
      'If page is selling or content-based, visual block can improve engagement.',
    );
  } else if (missingAlt > 0 || emptyAlt > 0) {
    addInsight(
      insights,
      'warning',
      'Accessibility',
      'Image alt issues',
      'Without alt, page is less accessible and loses image search signals.',
      [
        'Missing alt: ' + missingAlt,
        'Empty alt: ' + emptyAlt,
        'Total images: ' + page.images.length,
      ],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Accessibility',
      'Image alt filled',
      'All found images have non-empty alt.',
    );
  }

  const missingDimensions = page.images.filter(
    (image) => !image.hasWidth || !image.hasHeight,
  ).length;
  if (missingDimensions > 0) {
    addInsight(
      insights,
      'warning',
      'Performance',
      'Images missing width/height',
      'Dimensions help browser reserve space in advance and reduce layout shifts.',
      ['Missing dimensions: ' + missingDimensions + ' / ' + page.images.length],
    );
  } else if (page.images.length > 0) {
    addInsight(
      insights,
      'success',
      'Performance',
      'Image dimensions set',
      'All found images have width and height.',
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
      'Performance',
      'Lazy loading candidates found',
      'Images below first blocks can often be loaded lazily via loading="lazy".',
      ['Candidates: ' + lazyCandidates.length],
    );
  }

  if (resourceAudit.heavyImages.length > 0) {
    addInsight(
      insights,
      'warning',
      'Performance',
      'Heavy images found',
      'Images larger than 500 KB can significantly slow down page.',
      resourceAudit.heavyImages
        .slice(0, 5)
        .map((image) => formatBytes(image.bytes) + ' - ' + image.url),
    );
  }

  if (page.ogImage && !page.ogImage.absoluteUrl) {
    addInsight(
      insights,
      'warning',
      'Social',
      'OG image specified incorrectly',
      'Preview image must be accessible HTTP/HTTPS URL.',
      [page.ogImage.value],
    );
  } else if (page.ogImage && ogImageAudit && !ogImageAudit.ok) {
    addInsight(
      insights,
      'warning',
      'Social',
      'OG image unavailable',
      'Social networks may not generate preview.',
      [page.ogImage.absoluteUrl],
    );
  } else if (page.ogImage) {
    addInsight(
      insights,
      'success',
      'Social',
      'OG image available',
      'Preview image opens without error.',
    );
  }
}

function addSocialInsights(insights, page, twitterImageAudit) {
  const missingOg = [];
  if (!page.ogTitle) missingOg.push('og:title');
  if (!page.ogDescription) missingOg.push('og:description');
  if (!page.ogImage) missingOg.push('og:image');

  if (missingOg.length > 0) {
    addInsight(
      insights,
      'warning',
      'Social',
      'Open Graph incomplete',
      'When reposting, link may look weaker or without image.',
      missingOg,
    );
  } else {
    addInsight(
      insights,
      'success',
      'Social',
      'Open Graph configured',
      'Main OG tags for preview are present.',
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
      'Social',
      'Twitter Card incomplete',
      'For X/Twitter and similar clients, better to add full tag set.',
      missingTwitter,
    );
  } else {
    addInsight(
      insights,
      'success',
      'Social',
      'Twitter Card configured',
      'All main Twitter meta tags found.',
    );
  }

  if (page.twitter.image && !page.twitter.image.absoluteUrl) {
    addInsight(
      insights,
      'warning',
      'Social',
      'Twitter image specified incorrectly',
      'Preview image must be accessible HTTP/HTTPS URL.',
      [page.twitter.image.value],
    );
  } else if (page.twitter.image && twitterImageAudit && !twitterImageAudit.ok) {
    addInsight(
      insights,
      'warning',
      'Social',
      'Twitter image unavailable',
      'X/Twitter clients may not generate a card preview.',
      [page.twitter.image.absoluteUrl],
    );
  } else if (page.twitter.image) {
    addInsight(
      insights,
      'success',
      'Social',
      'Twitter image available',
      'Twitter Card image opens without error.',
    );
  }
}

function addContentInsights(insights, page) {
  if (page.wordCount < 300) {
    addInsight(
      insights,
      'warning',
      'Content',
      'Little text on page',
      'Thin pages are harder to rank for content queries.',
      ['Words: ' + page.wordCount],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Content',
      'Text volume looks sufficient',
      'Approximately ' + page.wordCount + ' words found on page.',
    );
  }

  const invalidJsonLd = page.jsonLdScripts.filter((script) => !script.valid);
  if (page.jsonLdScripts.length === 0) {
    addInsight(
      insights,
      'info',
      'SEO',
      'JSON-LD/schema.org not found',
      'Structured data not required, but can improve rich snippets.',
    );
  } else if (invalidJsonLd.length > 0) {
    addInsight(
      insights,
      'danger',
      'SEO',
      'JSON-LD contains errors',
      'Incorrect JSON will not be processed by search engines.',
      invalidJsonLd.slice(0, 3).map((script) => script.error),
    );
  } else {
    const types = uniqueBy(
      page.jsonLdScripts.flatMap((script) => script.types || []),
      (type) => type,
    );
    const knownTypes = types.filter((type) => KNOWN_SCHEMA_TYPES.has(type));
    if (types.length === 0) {
      addInsight(
        insights,
        'info',
        'SEO',
        'JSON-LD valid but missing @type',
        'Blocks parse as JSON, but no recognizable schema.org @type was found.',
        ['Structured data blocks: ' + page.jsonLdScripts.length],
      );
    } else if (knownTypes.length === 0) {
      addInsight(
        insights,
        'info',
        'SEO',
        'JSON-LD uses uncommon @type',
        'Structured data is valid. Consider common types like Organization, WebSite, Article or Product for richer results.',
        types.slice(0, 8),
      );
    } else {
      addInsight(
        insights,
        'success',
        'SEO',
        'JSON-LD valid',
        'Structured data blocks found: ' +
          page.jsonLdScripts.length +
          '. Known types: ' +
          knownTypes.slice(0, 6).join(', ') +
          '.',
      );
    }
  }
}

function addPerformanceInsights(
  insights,
  loadTime,
  page,
  resourceAudit,
  compressionAudit,
  finalUrl,
) {
  if (loadTime > 5000) {
    addInsight(
      insights,
      'danger',
      'Performance',
      'Very slow response (' + loadTime + ' ms)',
      'Check server, caching and heavy blocking resources.',
    );
  } else if (loadTime > 2000) {
    addInsight(
      insights,
      'warning',
      'Performance',
      'Slow server response (' + loadTime + ' ms)',
      'Page responds longer than 2 seconds.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Performance',
      'Server responds quickly',
      'Response received in ' + loadTime + ' ms.',
    );
  }

  if (page.htmlSizeBytes > 500 * 1024) {
    addInsight(
      insights,
      'danger',
      'Performance',
      'HTML too heavy',
      'HTML size exceeds 500 KB before accounting for external resources.',
      [formatBytes(page.htmlSizeBytes)],
    );
  } else if (page.htmlSizeBytes > 200 * 1024) {
    addInsight(
      insights,
      'warning',
      'Performance',
      'HTML larger than usual',
      'Worth checking inline styles, data and extra markup.',
      [formatBytes(page.htmlSizeBytes)],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Performance',
      'HTML size normal',
      'HTML weighs ' + formatBytes(page.htmlSizeBytes) + '.',
    );
  }

  if (compressionAudit.encoding) {
    addInsight(
      insights,
      'success',
      'Performance',
      'Compression enabled',
      'Server serves page with Content-Encoding: ' + compressionAudit.encoding + '.',
    );
  } else {
    addInsight(
      insights,
      'warning',
      'Performance',
      'Compression not detected',
      'For HTML/CSS/JS usually worth enabling gzip or brotli.',
    );
  }

  const assetCount = page.scripts.length + page.stylesheets.length;
  if (page.scripts.length > 20 || page.stylesheets.length > 10) {
    addInsight(
      insights,
      'warning',
      'Performance',
      'Many JS/CSS files',
      'Large number of external files increases loading overhead.',
      ['JS: ' + page.scripts.length, 'CSS: ' + page.stylesheets.length],
    );
  } else {
    addInsight(
      insights,
      assetCount > 0 ? 'success' : 'info',
      'Performance',
      'JS/CSS file count acceptable',
      'JS: ' + page.scripts.length + ', CSS: ' + page.stylesheets.length + '.',
    );
  }

  if (resourceAudit.unreachableAssets.length > 0) {
    addInsight(
      insights,
      'danger',
      'Technical',
      'Unreachable page resources found',
      'Broken CSS, JS or images break interface and metrics.',
      resourceAudit.unreachableAssets
        .slice(0, 5)
        .map((asset) => (asset.status || 'ERR') + ' - ' + asset.url),
    );
  }

  if (resourceAudit.cacheIssues.length > 0) {
    addInsight(
      insights,
      'warning',
      'Performance',
      'Static resources have weak caching',
      'For CSS/JS/images usually need Cache-Control with long max-age.',
      resourceAudit.cacheIssues
        .slice(0, 5)
        .map((asset) => asset.reason + ': ' + asset.url),
    );
  } else if (resourceAudit.checkedResources > 0) {
    addInsight(
      insights,
      'success',
      'Performance',
      'Static resource caching looks good',
      'Resources checked: ' + resourceAudit.checkedResources + '.',
    );
  }

  addModernImageInsights(insights, page);
  addScriptLoadingInsights(insights, page, finalUrl);
  addResourceHintInsights(insights, page, finalUrl);
}

function addModernImageInsights(insights, page) {
  if (page.images.length < 3) {
    return;
  }

  const modernPattern = /\.(webp|avif)(?:$|\?|#)/i;
  const hasModernSrc = page.images.some(
    (image) =>
      modernPattern.test(image.src || '') ||
      modernPattern.test(image.srcset || '') ||
      modernPattern.test(image.absoluteUrl || ''),
  );
  const hasModernPicture = (page.pictureModern || []).some(
    (source) =>
      /image\/(webp|avif)/i.test(source.type || '') ||
      modernPattern.test(source.srcset || ''),
  );
  const withSrcset = page.images.filter((image) => (image.srcset || '').trim())
    .length;

  if (!hasModernSrc && !hasModernPicture) {
    addInsight(
      insights,
      'info',
      'Performance',
      'No modern image formats detected',
      'WebP/AVIF (or <picture> sources) usually shrink image weight versus JPEG/PNG alone.',
      ['Images on page: ' + page.images.length],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Performance',
      'Modern image formats detected',
      'Page references WebP/AVIF or modern <picture> sources.',
    );
  }

  if (page.images.length >= 5 && withSrcset === 0) {
    addInsight(
      insights,
      'info',
      'Performance',
      'Responsive images (srcset) missing',
      'Multiple images without srcset/sizes may send oversized files to mobile devices.',
      ['Images: ' + page.images.length],
    );
  } else if (withSrcset > 0) {
    addInsight(
      insights,
      'success',
      'Performance',
      'Responsive images present',
      'Images with srcset: ' + withSrcset + ' / ' + page.images.length + '.',
    );
  }
}

function addScriptLoadingInsights(insights, page, finalUrl) {
  if (page.scripts.length === 0) {
    return;
  }

  const blocking = page.scripts.filter(
    (script) => !script.async && !script.defer && !script.isModule,
  );
  if (blocking.length >= 3) {
    addInsight(
      insights,
      'warning',
      'Performance',
      'Many render-blocking scripts',
      'External scripts without async/defer/type=module can delay first paint.',
      [
        'Blocking scripts: ' + blocking.length + ' / ' + page.scripts.length,
        ...blocking.slice(0, 5).map((script) => script.absoluteUrl),
      ],
    );
  } else if (page.scripts.length > 0) {
    addInsight(
      insights,
      'success',
      'Performance',
      'Script loading looks non-blocking',
      'Most external scripts use async, defer or module.',
      ['Scripts: ' + page.scripts.length, 'Blocking: ' + blocking.length],
    );
  }

  const externalWithoutSri = [
    ...page.scripts
      .filter(
        (script) =>
          !sameSite(script.absoluteUrl, finalUrl) && !script.integrity,
      )
      .map((script) => 'script: ' + script.absoluteUrl),
    ...page.stylesheets
      .filter(
        (sheet) => !sameSite(sheet.absoluteUrl, finalUrl) && !sheet.integrity,
      )
      .map((sheet) => 'stylesheet: ' + sheet.absoluteUrl),
  ];

  if (externalWithoutSri.length > 0) {
    addInsight(
      insights,
      'warning',
      'Security',
      'External assets missing SRI',
      'Third-party scripts/stylesheets without integrity can be altered without your notice.',
      externalWithoutSri.slice(0, 6),
    );
  } else if (
    page.scripts.some((script) => !sameSite(script.absoluteUrl, finalUrl)) ||
    page.stylesheets.some((sheet) => !sameSite(sheet.absoluteUrl, finalUrl))
  ) {
    addInsight(
      insights,
      'success',
      'Security',
      'External assets use SRI',
      'Checked third-party script/link tags include integrity hashes.',
    );
  }
}

function addResourceHintInsights(insights, page, finalUrl) {
  const pageHost = new URL(finalUrl).hostname.toLowerCase();
  const thirdPartyHosts = new Set();
  [...page.scripts, ...page.stylesheets, ...page.images]
    .map((item) => item.absoluteUrl)
    .filter(Boolean)
    .forEach((url) => {
      try {
        const host = new URL(url).hostname.toLowerCase();
        if (host && host !== pageHost && !host.endsWith('.' + pageHost)) {
          thirdPartyHosts.add(host);
        }
      } catch (error) {
        // ignore bad URLs
      }
    });

  if (thirdPartyHosts.size === 0) {
    return;
  }

  const hintedHosts = new Set();
  (page.resourceHints || []).forEach((hint) => {
    try {
      hintedHosts.add(new URL(hint.absoluteUrl).hostname.toLowerCase());
    } catch (error) {
      // ignore
    }
  });

  const missing = [...thirdPartyHosts].filter((host) => !hintedHosts.has(host));
  if (missing.length > 0 && (page.resourceHints || []).length === 0) {
    addInsight(
      insights,
      'info',
      'Performance',
      'No preconnect/dns-prefetch hints',
      'Third-party hosts are loaded without resource hints that can warm up connections earlier.',
      missing.slice(0, 6),
    );
  } else if (missing.length > 0) {
    addInsight(
      insights,
      'info',
      'Performance',
      'Some third-party hosts lack resource hints',
      'Consider preconnect or dns-prefetch for frequently used external origins.',
      missing.slice(0, 6),
    );
  } else {
    addInsight(
      insights,
      'success',
      'Performance',
      'Resource hints cover third-party hosts',
      'preconnect/dns-prefetch/preload found for external origins used on the page.',
    );
  }
}

function addEstimatedPerformanceInsights(insights, performanceScore, coreWebVitals) {
  const scoreLevel =
    performanceScore.score >= 80
      ? 'success'
      : performanceScore.score >= 60
        ? 'warning'
        : 'danger';

  addInsight(
    insights,
    scoreLevel,
    'Performance',
    'Estimated performance score: ' +
      performanceScore.score +
      '/100 (grade ' +
      performanceScore.grade +
      ')',
    'Heuristic score from response time, HTML weight, JS/CSS count, compression, caching and broken assets. Not a PageSpeed Insights lab score.',
    performanceScore.deductions.map(
      (item) => item.metric + ': ' + item.value + ' (-' + item.penalty + ')',
    ),
  );

  Object.values(coreWebVitals).forEach((vital) => {
    const level =
      vital.status === 'good'
        ? 'success'
        : vital.status === 'needs-improvement'
          ? 'warning'
          : 'danger';
    const displayValue =
      vital.unit === 'ms' ? vital.value + ' ms' : String(vital.value);

    addInsight(
      insights,
      level,
      'Performance',
      'Estimated ' + vital.label + ': ' + displayValue,
      'Approx. signal only — derived from server response and page assets, not browser timing APIs.',
    );
  });
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
    {
      name: 'permissions-policy',
      title: 'Permissions-Policy',
    },
    {
      name: 'cross-origin-opener-policy',
      title: 'Cross-Origin-Opener-Policy',
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
        'Security',
        'Missing header ' + header.title,
        'This security header reduces risk of typical attacks or data leaks.',
      );
      return;
    }

    if (header.expected && !value.toLowerCase().includes(header.expected)) {
      addInsight(
        insights,
        'warning',
        'Security',
        header.title + ' set unusually',
        'Expected value with "' + header.expected + '", found: ' + value + '.',
      );
      return;
    }

    addInsight(
      insights,
      'success',
      'Security',
      header.title + ' present',
      'Value: ' + value + '.',
    );
  });

  const xssProtection = getHeader(headers, 'x-xss-protection');
  if (xssProtection) {
    const lower = xssProtection.toLowerCase();
    if (lower.includes('0')) {
      addInsight(
        insights,
        'info',
        'Security',
        'X-XSS-Protection disabled',
        'Value 0 is acceptable; modern browsers rely on CSP instead of this legacy header.',
        [xssProtection],
      );
    } else {
      addInsight(
        insights,
        'info',
        'Security',
        'Deprecated X-XSS-Protection present',
        'Prefer a strong Content-Security-Policy; X-XSS-Protection is legacy and inconsistently supported.',
        [xssProtection],
      );
    }
  }

  if (page.mixedContent.length > 0) {
    addInsight(
      insights,
      'danger',
      'Security',
      'Mixed content found',
      'HTTPS page references HTTP resources that browser may block.',
      page.mixedContent.slice(0, 5),
    );
  } else if (finalUrlObject.protocol === 'https:') {
    addInsight(
      insights,
      'success',
      'Security',
      'Mixed content not found',
      'No explicit HTTP resources for loading in HTML.',
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
      'Security',
      'Set-Cookie not found',
      'Page does not set cookies in first response.',
    );
    return;
  }

  const issues = [];
  cookies.forEach((cookie, index) => {
    const lower = cookie.toLowerCase();
    const name = cookie.split('=')[0] || 'cookie #' + (index + 1);
    if (!lower.includes('; secure')) issues.push(name + ': no Secure');
    if (!lower.includes('; httponly')) issues.push(name + ': no HttpOnly');
    if (!lower.includes('; samesite')) issues.push(name + ': no SameSite');
  });

  if (issues.length > 0) {
    addInsight(
      insights,
      'warning',
      'Security',
      'Cookies missing protective flags',
      'For user sessions especially important Secure, HttpOnly and SameSite.',
      issues.slice(0, 8),
    );
  } else {
    addInsight(
      insights,
      'success',
      'Security',
      'Cookies protected with flags',
      'All cookies from first response contain Secure, HttpOnly and SameSite.',
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
      'Security',
      'TLS certificate could not be verified',
      tlsAudit.error,
    );
    return;
  }

  if (!tlsAudit.authorized) {
    addInsight(
      insights,
      'danger',
      'Security',
      'TLS certificate failed verification',
      tlsAudit.authorizationError || 'Certificate untrusted or configured incorrectly.',
    );
  }

  if (tlsAudit.daysLeft < 0) {
    addInsight(
      insights,
      'danger',
      'Security',
      'TLS certificate expired',
      'Validity expired: ' + tlsAudit.validTo + '.',
    );
  } else if (tlsAudit.daysLeft < 14) {
    addInsight(
      insights,
      'danger',
      'Security',
      'TLS certificate expiring soon',
      'Days left: ' + tlsAudit.daysLeft + '.',
    );
  } else if (tlsAudit.daysLeft < 30) {
    addInsight(
      insights,
      'warning',
      'Security',
      'TLS certificate near expiration',
      'Days left: ' + tlsAudit.daysLeft + '.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Security',
      'TLS certificate current',
      'Approximately ' + tlsAudit.daysLeft + ' days until expiration.',
    );
  }
}

function addAccessibilityInsights(insights, page, faviconAudit) {
  if (!page.viewport) {
    addInsight(
      insights,
      'danger',
      'Mobile',
      'No meta viewport',
      'Page may display incorrectly on smartphones.',
    );
  } else {
    const viewport = page.viewport.toLowerCase();
    const hasDeviceWidth = /width\s*=\s*device-width/.test(viewport);
    const blocksZoom =
      /user-scalable\s*=\s*(no|0)/.test(viewport) ||
      /maximum-scale\s*=\s*1(?:\.0+)?(?:\s|,|$)/.test(viewport);

    if (!hasDeviceWidth) {
      addInsight(
        insights,
        'warning',
        'Mobile',
        'Viewport missing width=device-width',
        'Meta viewport exists, but without width=device-width mobile layout often breaks.',
        [page.viewport],
      );
    } else if (blocksZoom) {
      addInsight(
        insights,
        'warning',
        'Mobile',
        'Viewport restricts zoom',
        'user-scalable=no or maximum-scale=1 hurts accessibility for users who need zoom.',
        [page.viewport],
      );
    } else {
      addInsight(
        insights,
        'success',
        'Mobile',
        'Viewport set',
        'Page contains a mobile-friendly meta viewport.',
        [page.viewport],
      );
    }
  }

  if (!page.favicon || !page.favicon.absoluteUrl) {
    addInsight(
      insights,
      'warning',
      'Branding',
      'Favicon not found',
      'Without icon, site looks less complete in tabs and bookmarks.',
    );
  } else if (faviconAudit && !faviconAudit.ok) {
    addInsight(
      insights,
      'warning',
      'Branding',
      'Favicon unreachable',
      'Icon URL is declared or expected, but does not respond successfully.',
      [page.favicon.absoluteUrl],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Branding',
      'Favicon found',
      page.favicon.declared
        ? 'Site icon is linked and reachable.'
        : 'Default /favicon.ico is reachable.',
      [page.favicon.absoluteUrl],
    );
  }

  if (page.formsAudit.total === 0) {
    addInsight(
      insights,
      'info',
      'Accessibility',
      'No form fields found',
      'Label check not applied.',
    );
  } else if (page.formsAudit.missingLabels.length > 0) {
    addInsight(
      insights,
      'warning',
      'Accessibility',
      'Form fields missing label',
      'Label helps screen reader users and increases click area.',
      [
        'Missing label: ' +
          page.formsAudit.missingLabels.length +
          ' / ' +
          page.formsAudit.total,
      ],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Accessibility',
      'Form fields labeled',
      'All checked fields have label or aria-label.',
    );
  }

  const emptyInteractive =
    page.interactiveTextAudit.emptyLinks.length +
    page.interactiveTextAudit.emptyButtons.length;
  if (emptyInteractive > 0) {
    addInsight(
      insights,
      'warning',
      'Accessibility',
      'Links or buttons without clear text',
      'Interactive elements need text, aria-label or title.',
      [
        'Empty links: ' + page.interactiveTextAudit.emptyLinks.length,
        'Empty buttons: ' + page.interactiveTextAudit.emptyButtons.length,
      ],
    );
  } else {
    addInsight(
      insights,
      'success',
      'Accessibility',
      'Link and button text readable',
      'No empty interactive elements found.',
    );
  }

  if (page.contrastAudit.lowContrast.length > 0) {
    addInsight(
      insights,
      'warning',
      'Accessibility',
      'Potentially low contrast found',
      'Static check of inline/style CSS found color pairs below WCAG 4.5:1.',
      page.contrastAudit.lowContrast
        .slice(0, 5)
        .map((item) => item.ratio + ': ' + item.sample),
    );
  } else {
    addInsight(
      insights,
      page.contrastAudit.checked > 0 ? 'success' : 'info',
      'Accessibility',
      'No critical contrast issues found',
      page.contrastAudit.checked > 0
        ? 'Color pairs checked: ' + page.contrastAudit.checked + '.'
        : 'No explicit inline/style color + background pairs found on page.',
    );
  }
}

function addLinkInsights(insights, linkAudit, page) {
  if (page.internalLinks === 0 && page.externalLinks > 0) {
    addInsight(
      insights,
      'warning',
      'Links',
      'No internal links found',
      'Page only links outward. Visitors and crawlers get weak in-site navigation from here.',
      [
        'Internal: ' + page.internalLinks,
        'External: ' + page.externalLinks,
      ],
    );
  } else if (
    page.externalLinks > 10 &&
    page.externalLinks > page.internalLinks * 3
  ) {
    addInsight(
      insights,
      'info',
      'Links',
      'Many more external than internal links',
      'Outbound-heavy pages can dilute crawl focus; check that key internal paths are linked.',
      [
        'Internal: ' + page.internalLinks,
        'External: ' + page.externalLinks,
      ],
    );
  } else if (page.links.length > 0) {
    addInsight(
      insights,
      'success',
      'Links',
      'Internal/external link mix looks balanced',
      'Internal: ' +
        page.internalLinks +
        ', external: ' +
        page.externalLinks +
        '.',
    );
  }

  const weakAnchors = page.weakAnchors || [];
  if (weakAnchors.length >= 3) {
    addInsight(
      insights,
      'info',
      'SEO',
      'Generic anchor text found',
      'Vague link text like "click here" or raw URLs is weaker for SEO and accessibility.',
      weakAnchors
        .slice(0, 6)
        .map((item) => '"' + item.text + '" -> ' + item.absoluteUrl),
    );
  }

  const unsafeBlank = page.links.filter((link) => {
    if (link.target !== '_blank') {
      return false;
    }
    const tokens = link.relTokens || [];
    return !tokens.includes('noopener') && !tokens.includes('noreferrer');
  });
  if (unsafeBlank.length > 0) {
    addInsight(
      insights,
      'warning',
      'Security',
      'target=_blank without noopener',
      'Links that open a new tab should use rel="noopener" or "noreferrer" to avoid tab-nabbing.',
      unsafeBlank.slice(0, 6).map((link) => link.absoluteUrl),
    );
  } else if (page.links.some((link) => link.target === '_blank')) {
    addInsight(
      insights,
      'success',
      'Security',
      'Blank-target links use noopener',
      'Checked target=_blank links include noopener or noreferrer.',
    );
  }

  if (linkAudit.checked === 0) {
    addInsight(
      insights,
      'info',
      'Links',
      'No links to check found',
      'Page has no HTTP/HTTPS links.',
    );
    return;
  }

  if (linkAudit.broken.length > 0) {
    addInsight(
      insights,
      'danger',
      'Links',
      'Broken links found',
      'Such links worsen user experience and waste crawl budget.',
      linkAudit.broken
        .slice(0, 8)
        .map((link) => (link.status || 'ERR') + ' - ' + link.url),
    );
  } else {
    addInsight(
      insights,
      'success',
      'Links',
      'No broken links found',
      'Links checked: ' + linkAudit.checked + '.',
    );
  }

  if (linkAudit.total > linkAudit.checked) {
    addInsight(
      insights,
      'info',
      'Links',
      'Link sample checked',
      'To prevent audit hanging, checked first ' +
        linkAudit.checked +
        ' of ' +
        linkAudit.total +
        ' unique links.',
    );
  }
}

function addInternationalInsights(insights, page) {
  if (!page.htmlLang) {
    addInsight(
      insights,
      'warning',
      'Accessibility',
      'HTML lang not specified',
      'Lang attribute helps browsers, translators and screen readers.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Accessibility',
      'Page language specified',
      'html lang="' + page.htmlLang + '".',
    );
  }

  if (!page.charset) {
    addInsight(
      insights,
      'warning',
      'Technical',
      'Charset not specified',
      'Add meta charset to avoid encoding issues.',
    );
  } else {
    addInsight(
      insights,
      'success',
      'Technical',
      'Charset specified',
      'Encoding: ' + page.charset + '.',
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
      'hreflang not found',
      'Normal for single-language site. For multilingual versions, tags needed.',
    );
  } else if (invalidHreflang.length > 0) {
    addInsight(
      insights,
      'warning',
      'SEO',
      'hreflang errors found',
      'Check language codes and href of alternative pages.',
      invalidHreflang
        .slice(0, 5)
        .map((tag) => tag.hreflang + ' -> ' + tag.href),
    );
  } else {
    addInsight(
      insights,
      'success',
      'SEO',
      'hreflang looks correct',
      'Alternative language versions found: ' + page.hreflangTags.length + '.',
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
        return { url: resource.url, reason: 'No Cache-Control' };
      }

      const seconds = getMaxAgeSeconds(cacheControl);
      if (seconds !== null && seconds < GOOD_CACHE_SECONDS) {
        return {
          url: resource.url,
          reason: 'max-age less than 7 days',
        };
      }

      if (/no-store|no-cache/i.test(cacheControl)) {
        return { url: resource.url, reason: 'Caching disabled' };
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
    const body = result.body || '';
    const isIndex = /<sitemapindex[\s>]/i.test(body);
    const validXml = /<(urlset|sitemapindex)[\s>]/i.test(body);
    const sitemapResult = {
      url: sitemapUrl,
      status: result.status,
      exists: result.status >= 200 && result.status < 400,
      validXml,
      isIndex,
      body: sitemapResultBody(body),
    };
    checkedSitemaps.push(sitemapResult);

    if (sitemapResult.exists && !foundSitemap) {
      foundSitemap = sitemapResult;
    }
  }

  let containsPage = null;
  if (foundSitemap && foundSitemap.exists) {
    containsPage = await sitemapContainsUrl(foundSitemap, finalUrl);
  }

  return {
    robots: robotsData,
    sitemap: foundSitemap
      ? {
          exists: true,
          validXml: foundSitemap.validXml,
          isIndex: foundSitemap.isIndex,
          url: foundSitemap.url,
          containsPage,
          checkedUrls: checkedSitemaps.map((item) => item.url),
        }
      : {
          exists: false,
          validXml: false,
          isIndex: false,
          url: sitemapCandidates[0],
          containsPage: null,
          checkedUrls: checkedSitemaps.map((item) => item.url),
        },
  };
}

function sitemapResultBody(body) {
  // Keep enough XML for loc matching without holding huge payloads forever.
  return String(body || '').slice(0, 500000);
}

async function sitemapContainsUrl(sitemap, finalUrl) {
  const candidates = collectSitemapLocUrls(sitemap.body || '');
  if (sitemap.isIndex) {
    const childUrls = candidates.slice(0, 3);
    for (const childUrl of childUrls) {
      const child = await fetchText(childUrl);
      if (!(child.status >= 200 && child.status < 400)) {
        continue;
      }
      const childLocs = collectSitemapLocUrls(child.body || '');
      if (childLocs.some((loc) => urlsLooselyEqual(loc, finalUrl))) {
        return true;
      }
    }
    // Index found but page not in the first few children — unknown rather than hard miss.
    return null;
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.some((loc) => urlsLooselyEqual(loc, finalUrl));
}

function collectSitemapLocUrls(xml) {
  const urls = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match = re.exec(xml);
  while (match) {
    const value = decodeXmlEntities(match[1].trim());
    if (value) {
      urls.push(value);
    }
    match = re.exec(xml);
  }
  return urls;
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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
      error: 'Invalid URL',
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
            error: 'Server did not return certificate data.',
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
      resolve({ error: 'TLS certificate check timeout.' });
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
      error: 'Empty JSON-LD block.',
      types: [],
    };
  }

  try {
    const data = JSON.parse(content);
    return { valid: true, types: extractJsonLdTypes(data) };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      types: [],
    };
  }
}

function extractJsonLdTypes(node, acc = []) {
  if (!node) {
    return acc;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => extractJsonLdTypes(item, acc));
    return acc;
  }

  if (typeof node !== 'object') {
    return acc;
  }

  if (node['@type']) {
    const raw = node['@type'];
    const list = Array.isArray(raw) ? raw : [raw];
    list.forEach((type) => {
      const cleaned = String(type || '')
        .replace(/^https?:\/\/schema\.org\//i, '')
        .trim();
      if (cleaned) {
        acc.push(cleaned);
      }
    });
  }

  if (node['@graph']) {
    extractJsonLdTypes(node['@graph'], acc);
  }

  Object.keys(node).forEach((key) => {
    if (key === '@type' || key === '@context') {
      return;
    }
    const value = node[key];
    if (value && typeof value === 'object') {
      extractJsonLdTypes(value, acc);
    }
  });

  return acc;
}

const KNOWN_SCHEMA_TYPES = new Set([
  'Organization',
  'WebSite',
  'WebPage',
  'Article',
  'NewsArticle',
  'BlogPosting',
  'Product',
  'BreadcrumbList',
  'FAQPage',
  'HowTo',
  'LocalBusiness',
  'Person',
  'ImageObject',
  'VideoObject',
  'Event',
  'Review',
  'AggregateRating',
  'ItemList',
  'SearchAction',
]);

function urlsLooselyEqual(leftUrl, rightUrl) {
  try {
    const left = new URL(stripHash(leftUrl));
    const right = new URL(stripHash(rightUrl));
    const normalize = (url) => {
      const path = url.pathname.replace(/\/+$/, '') || '/';
      return (
        url.protocol.toLowerCase() +
        '//' +
        url.host.toLowerCase() +
        path +
        url.search
      );
    };
    return normalize(left) === normalize(right);
  } catch (error) {
    return false;
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
    contentType: getHeader(response.headers, 'content-type') || 'Not specified',
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
    favicon: Boolean(page.favicon && (page.favicon.declared || page.favicon.absoluteUrl)),
    faviconUrl: page.favicon?.absoluteUrl || null,
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

function detectSkipLink($) {
  const candidates = $('body a[href]').slice(0, 8).toArray();
  for (let i = 0; i < candidates.length; i += 1) {
    const el = candidates[i];
    const href = (($(el).attr('href') || '')).trim().toLowerCase();
    const text = normalizeTextForCompare(getAccessibleText($, el));
    const looksLikeSkip =
      text.includes('skip') ||
      text.includes('пропуст') ||
      text.includes('перейт') ||
      text.includes('к содержан') ||
      text.includes('да зместу') ||
      href === '#main' ||
      href === '#content' ||
      href === '#main-content' ||
      href.startsWith('#main') ||
      href.startsWith('#content');
    if (looksLikeSkip) {
      return {
        found: true,
        href: $(el).attr('href') || '',
        text: getAccessibleText($, el),
      };
    }
  }
  return { found: false, href: null, text: null };
}

const WEAK_ANCHOR_TEXTS = new Set([
  'click here',
  'here',
  'read more',
  'more',
  'learn more',
  'details',
  'link',
  'тут',
  'сюда',
  'далее',
  'подробнее',
  'читать далее',
  'нажмите здесь',
  'націсніце тут',
  'падрабязней',
  'чытаць далей',
]);

function collectWeakAnchors(links) {
  const weak = [];
  links.forEach((link) => {
    const text = cleanText(link.text || '');
    const normalized = normalizeTextForCompare(text);
    const looksLikeUrl = /^https?:\/\//i.test(text) || /^www\./i.test(text);
    if (WEAK_ANCHOR_TEXTS.has(normalized) || looksLikeUrl) {
      weak.push({
        text: text || link.href,
        absoluteUrl: link.absoluteUrl,
      });
    }
  });
  return weak;
}

function hostsDifferOnlyByWww(leftUrl, rightUrl) {
  try {
    const left = new URL(leftUrl);
    const right = new URL(rightUrl);
    if (normalizeHost(left.hostname) !== normalizeHost(right.hostname)) {
      return false;
    }
    return left.hostname.toLowerCase() !== right.hostname.toLowerCase();
  } catch (error) {
    return false;
  }
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
  return error.message || 'Unknown error';
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
