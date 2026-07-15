const DEFAULT_MAX_FETCH_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

export function assertSmoke(condition, message) {
  if (!condition) throw new Error(message);
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function contentType(response) {
  return response.headers.get('content-type') ?? '';
}

export function parseJson(body, path) {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${path} did not return valid JSON`);
  }
}

function isTransientFetchFailure(error) {
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function cancelResponseBody(response) {
  try {
    await response?.body?.cancel();
  } catch {
    // A failed or already-consumed stream has nothing left worth preserving.
  }
}

async function readResponseBody(response, bodyType) {
  if (bodyType === 'none') {
    await cancelResponseBody(response);
    return undefined;
  }
  if (bodyType === 'text') return response.text();
  if (bodyType === 'bytes') return new Uint8Array(await response.arrayBuffer());
  throw new Error(`Unsupported response body type: ${bodyType}`);
}

export function createRequester({
  timeoutMs,
  fetchImpl = globalThis.fetch,
  delayImpl = delay,
  logger = console,
  maxAttempts = DEFAULT_MAX_FETCH_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
}) {
  assertSmoke(Number.isInteger(timeoutMs) && timeoutMs > 0, 'request timeout must be positive');
  assertSmoke(
    Number.isInteger(maxAttempts) && maxAttempts > 0,
    'maximum request attempts must be positive',
  );

  return async function request(
    url,
    { accept = '*/*', method = 'GET', headers = {}, body, bodyType = 'none' } = {},
  ) {
    const overallStart = performance.now();
    const requestHeaders = new Headers(headers);
    if (!requestHeaders.has('accept')) requestHeaders.set('accept', accept);
    requestHeaders.set('user-agent', 'akaushik.org-production-smoke/1.0');

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const start = performance.now();
      let response;
      let phase = 'response';

      try {
        response = await fetchImpl(url, {
          method,
          body,
          headers: requestHeaders,
          redirect: 'manual',
          signal: AbortSignal.timeout(timeoutMs),
        });
        const ttfbMs = performance.now() - start;

        if (response.status >= 500 && response.status <= 599 && attempt < maxAttempts) {
          await cancelResponseBody(response);
          logger.warn(
            `RETRY ${method} ${url.href} - HTTP ${response.status} (attempt ${attempt + 1}/${maxAttempts})`,
          );
          await delayImpl(retryDelayMs);
          continue;
        }

        phase = 'response body';
        const responseBody = await readResponseBody(response, bodyType);
        return {
          response,
          body: responseBody,
          ttfbMs,
          attempts: attempt,
          totalElapsedMs: performance.now() - overallStart,
        };
      } catch (error) {
        await cancelResponseBody(response);
        if (attempt >= maxAttempts || !isTransientFetchFailure(error)) throw error;
        logger.warn(
          `RETRY ${method} ${url.href} - ${phase}: ${errorMessage(error)} (attempt ${attempt + 1}/${maxAttempts})`,
        );
        await delayImpl(retryDelayMs);
      }
    }

    throw new Error(`request attempts exhausted for ${url.href}`);
  };
}

export function assertSingleAttempt(result, label) {
  assertSmoke(
    result.attempts === 1,
    `${label} required ${result.attempts} attempts over ${Math.round(result.totalElapsedMs)} ms`,
  );
}

function parseLinkParameters(value) {
  const parameters = new Map();
  const pattern = /;\s*([!#$%&'*+.^_`|~0-9a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;\s]+))/gi;
  for (const match of value.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    assertSmoke(!parameters.has(name), `Link field repeats the ${name} parameter`);
    parameters.set(name, match[2] ?? match[3] ?? match[4]);
  }
  const residue = value.replace(pattern, '').replace(/\s/g, '');
  assertSmoke(residue.length === 0, `Link field contains malformed parameters: ${residue}`);
  return parameters;
}

export function parseLinkHeader(value, baseUrl) {
  const entries = [];
  const pattern = /<([^<>]+)>((?:\s*;\s*[^,]*)?)(?=\s*(?:,|$))/g;
  for (const match of value.matchAll(pattern)) {
    const parameters = parseLinkParameters(match[2]);
    let url;
    try {
      url = new URL(match[1], baseUrl);
    } catch {
      throw new Error(`Link target is not a valid URL: ${match[1]}`);
    }
    entries.push({
      url,
      rel: (parameters.get('rel') ?? '')
        .split(/\s+/)
        .map((relation) => relation.toLowerCase())
        .filter(Boolean),
      type: (parameters.get('type') ?? '').toLowerCase(),
    });
  }

  const residue = value.replace(pattern, '').replace(/[\s,]/g, '');
  assertSmoke(residue.length === 0, `Link header contains malformed fields: ${residue}`);
  return entries;
}

export function validateDiscoveryLinks(value, baseUrl, expected) {
  const entries = parseLinkHeader(value, baseUrl);
  for (const contract of expected) {
    const candidates = entries.filter(
      (entry) =>
        entry.url.pathname === contract.path &&
        entry.url.search === '' &&
        entry.url.hash === '' &&
        entry.rel.includes(contract.rel) &&
        entry.type === contract.type,
    );
    assertSmoke(
      candidates.length === 1,
      `${contract.path} must be advertised exactly once with rel=${contract.rel} and type=${contract.type}`,
    );
    assertSmoke(
      candidates[0].url.origin === baseUrl.origin,
      `${contract.path} must be advertised on ${baseUrl.origin}, received ${candidates[0].url.origin}`,
    );
  }
  return expected.length;
}

export function validateRobotsSitemap(body, baseUrl) {
  const sitemapLines = [...body.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)].map((match) => match[1]);
  const expected = new URL('/sitemap.xml', baseUrl).href;
  assertSmoke(sitemapLines.length === 1, 'robots.txt must contain exactly one Sitemap directive');
  let actual;
  try {
    actual = new URL(sitemapLines[0]).href;
  } catch {
    throw new Error(`robots.txt Sitemap is not a valid absolute URL: ${sitemapLines[0]}`);
  }
  assertSmoke(actual === expected, `robots.txt Sitemap is ${actual}, expected ${expected}`);
}

export function validateCanonicalSitemap(body, baseUrl) {
  const locations = [...body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    match[1].replaceAll('&amp;', '&'),
  );
  assertSmoke(locations.length > 0, 'sitemap contains no URL locations');
  for (const location of locations) {
    let url;
    try {
      url = new URL(location);
    } catch {
      throw new Error(`sitemap location is not a valid absolute URL: ${location}`);
    }
    assertSmoke(
      url.origin === baseUrl.origin && !url.username && !url.password,
      `sitemap location is not canonical: ${url.href}`,
    );
  }
  return locations.length;
}

export function hasMailtoAnchor(body, email) {
  const rendered = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  for (const match of rendered.matchAll(/<a\b([^>]*)>/gi)) {
    const href = attributeValue(match[1], 'href');
    if (!href) continue;
    const address = href.slice(0, href.indexOf('?') === -1 ? undefined : href.indexOf('?'));
    if (address.toLowerCase() === `mailto:${email.toLowerCase()}`) return true;
  }
  return false;
}

function cspDirective(policy, name) {
  const normalizedName = name.toLowerCase();
  return (
    policy
      .split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.split(/\s+/, 1)[0]?.toLowerCase() === normalizedName) ?? ''
  );
}

function splitCspPolicies(value) {
  return value
    .split(/,(?=\s*[a-z][a-z0-9-]*(?:\s|;|$))/i)
    .map((policy) => policy.trim())
    .filter(Boolean);
}

function attributeValue(attributes, name) {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`,
    'i',
  );
  const match = attributes.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function scriptElements(body) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of body.matchAll(pattern)) {
    const attributes = match[1];
    const content = match[2];
    const src = attributeValue(attributes, 'src');
    if (!src && content.trim().length === 0) continue;
    scripts.push({ attributes, content, src });
  }
  return scripts;
}

export function validateHomepageNonce(sample, label) {
  const header = sample.response.headers.get('content-security-policy') ?? '';
  const policies = splitCspPolicies(header);
  assertSmoke(policies.length > 0, `${label} Content-Security-Policy is missing`);

  const policyNonces = [];
  for (let index = 0; index < policies.length; index += 1) {
    const policy = policies[index];
    const policyLabel = `${label} CSP policy ${index + 1}`;
    const scriptSource = cspDirective(policy, 'script-src');
    const scriptElementSource = cspDirective(policy, 'script-src-elem');
    const scriptAttributeSource = cspDirective(policy, 'script-src-attr');
    if (scriptAttributeSource) {
      assertSmoke(
        /^script-src-attr\s+'none'\s*$/i.test(scriptAttributeSource),
        `${policyLabel} script-src-attr must be exactly 'none' when present`,
      );
    }
    const effectiveDirectives = [
      ...(scriptSource ? [['script-src', scriptSource]] : []),
      ...(scriptElementSource ? [['script-src-elem', scriptElementSource]] : []),
      ...(!scriptSource && !scriptElementSource
        ? [['default-src', cspDirective(policy, 'default-src')]]
        : []),
    ];

    for (const [directiveName, directive] of effectiveDirectives) {
      assertSmoke(directive, `${policyLabel} has no effective script directive`);
      const directiveLabel = `${policyLabel} ${directiveName}`;
      assertSmoke(
        !/(?:^|\s)'unsafe-inline'(?:\s|$)/i.test(directive),
        `${directiveLabel} contains 'unsafe-inline'`,
      );
      assertSmoke(
        /(?:^|\s)'strict-dynamic'(?:\s|$)/i.test(directive),
        `${directiveLabel} omits 'strict-dynamic'`,
      );

      const nonceSources = [...directive.matchAll(/'nonce-([^']+)'/gi)];
      assertSmoke(
        nonceSources.length === 1,
        `${directiveLabel} must contain exactly one nonce source`,
      );
      const nonce = nonceSources[0][1];
      assertSmoke(nonce.length > 0, `${directiveLabel} nonce is empty`);
      policyNonces.push(nonce);
    }
  }

  assertSmoke(policyNonces.length > 0, `${label} has no effective CSP script directive`);
  const responseNonce = policyNonces[0];
  assertSmoke(
    policyNonces.every((nonce) => nonce === responseNonce),
    `${label} CSP policies do not share one response nonce`,
  );

  const scripts = scriptElements(sample.body);
  assertSmoke(scripts.length > 0, `${label} contains no inline or external scripts`);
  for (let index = 0; index < scripts.length; index += 1) {
    const script = scripts[index];
    const nonce = attributeValue(script.attributes, 'nonce');
    const kind = script.src ? 'external' : 'inline';
    assertSmoke(
      nonce === responseNonce,
      `${label} ${kind} script ${index + 1} did not carry the response nonce`,
    );
  }

  const externalScriptCount = scripts.filter((script) => script.src).length;
  return {
    nonce: responseNonce,
    policyCount: policies.length,
    scriptCount: scripts.length,
    inlineScriptCount: scripts.length - externalScriptCount,
    externalScriptCount,
  };
}

function parseSseDataEvents(body) {
  const events = [];
  let data = [];

  const dispatch = () => {
    if (data.length > 0) events.push(data.join('\n'));
    data = [];
  };

  const normalized = body.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (const line of `${normalized}\n`.split('\n')) {
    if (line === '') {
      dispatch();
      continue;
    }
    if (line.startsWith(':')) continue;

    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') data.push(value);
  }

  return events;
}

export function parseMcpPayload(body, response, label) {
  const mediaType = contentType(response).split(';', 1)[0].trim().toLowerCase();
  if (mediaType === 'application/json') return parseJson(body, label);
  if (mediaType === 'text/event-stream') {
    const events = parseSseDataEvents(body);
    assertSmoke(
      events.length === 1,
      `${label} did not contain exactly one SSE data event (received ${events.length})`,
    );
    return parseJson(events[0], `${label} SSE data`);
  }
  throw new Error(`${label} returned unexpected content type: ${contentType(response)}`);
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function normalizeImageUrl(value, baseUrl, label) {
  let url;
  try {
    url = new URL(decodeHtmlAttribute(value.trim()), baseUrl);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  assertSmoke(
    url.protocol === 'https:' &&
      url.origin === baseUrl.origin &&
      !url.username &&
      !url.password &&
      !url.hash,
    `${label} must be same-origin HTTPS without credentials or a fragment`,
  );
  return url.href;
}

function walkStructuredImages(value, add, imageContext = false) {
  if (Array.isArray(value)) {
    for (const item of value) walkStructuredImages(item, add, imageContext);
    return;
  }
  if (!isRecord(value)) return;

  const type = value['@type'];
  const isImageObject =
    imageContext || type === 'ImageObject' || (Array.isArray(type) && type.includes('ImageObject'));

  for (const [key, child] of Object.entries(value)) {
    if (['image', 'logo', 'thumbnail', 'thumbnailUrl'].includes(key)) {
      if (typeof child === 'string') add(child, `JSON-LD ${key}`);
      else walkStructuredImages(child, add, true);
      continue;
    }
    if (isImageObject && ['url', 'contentUrl'].includes(key) && typeof child === 'string') {
      add(child, `JSON-LD ImageObject.${key}`);
      continue;
    }
    walkStructuredImages(child, add, isImageObject);
  }
}

export function extractHomepageImageUrls(body, baseUrl) {
  const urls = new Set();
  const add = (value, label) => urls.add(normalizeImageUrl(value, baseUrl, label));

  for (const match of body.matchAll(/<img\b([^>]*)>/gi)) {
    const attributes = match[1];
    const src = attributeValue(attributes, 'src');
    if (src) add(src, 'img src');
    const srcset = attributeValue(attributes, 'srcset');
    if (srcset) {
      for (const candidate of srcset.split(',')) {
        const value = candidate.trim().split(/\s+/, 1)[0];
        if (value) add(value, 'img srcset candidate');
      }
    }
  }

  for (const match of body.matchAll(/<source\b([^>]*)>/gi)) {
    const srcset = attributeValue(match[1], 'srcset');
    if (!srcset) continue;
    for (const candidate of srcset.split(',')) {
      const value = candidate.trim().split(/\s+/, 1)[0];
      if (value) add(value, 'source srcset candidate');
    }
  }

  for (const match of body.matchAll(/<meta\b([^>]*)>/gi)) {
    const attributes = match[1];
    const key = (attributeValue(attributes, 'property') ?? attributeValue(attributes, 'name'))
      ?.toLowerCase()
      .trim();
    if (!['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'].includes(key)) {
      continue;
    }
    const value = attributeValue(attributes, 'content');
    assertSmoke(value, `${key} metadata content is missing`);
    add(value, `${key} metadata`);
  }

  for (const match of body.matchAll(/<link\b([^>]*)>/gi)) {
    const attributes = match[1];
    const rel = attributeValue(attributes, 'rel')?.toLowerCase().split(/\s+/) ?? [];
    if (!rel.some((token) => token === 'icon' || token.endsWith('-icon'))) continue;
    const href = attributeValue(attributes, 'href');
    assertSmoke(href, `${rel.join(' ')} link href is missing`);
    add(href, `${rel.join(' ')} link`);
  }

  for (const script of scriptElements(body)) {
    if (attributeValue(script.attributes, 'type')?.toLowerCase() !== 'application/ld+json') {
      continue;
    }
    walkStructuredImages(parseJson(script.content, 'homepage JSON-LD'), add);
  }

  return [...urls].sort();
}

export function assertOptionalFalse(value, label) {
  assertSmoke(value === undefined || value === false, `${label} must be false when present`);
}
