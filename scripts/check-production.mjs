#!/usr/bin/env node

import {
  assertOptionalFalse,
  assertSingleAttempt,
  assertSmoke as assert,
  contentType,
  createRequester,
  errorMessage,
  extractHomepageImageUrls,
  hasMailtoAnchor,
  isRecord,
  parseJson,
  parseMcpPayload,
  validateCanonicalSitemap,
  validateDiscoveryLinks,
  validateHomepageNonce,
  validateRobotsSitemap,
} from './check-production-lib.mjs';

const DEFAULT_BASE_URL = 'https://akaushik.org';
const DEFAULT_LEGACY_URL = 'https://akaushik.dev';
const DEFAULT_TTFB_THRESHOLD_MS = 2_500;
const DEFAULT_TIMEOUT_MS = 15_000;
const HOMEPAGE_SAMPLE_COUNT = 3;
const MCP_PROTOCOL_VERSION = '2025-11-25';
const MCP_ACCEPT = 'application/json, text/event-stream';
const MCP_TOOL_NAMES = ['lookup_case_study', 'get_availability'];

const HELP = `Usage: pnpm production:check [options]

Checks canonical and legacy routing, agent discovery and live MCP, rotating
nonce CSP, contact-email integrity, homepage image URLs, the full ICO directory,
and median homepage TTFB from three sequential samples. Transient fetch/body
failures and HTTP 5xx responses receive one bounded retry; assertion failures
are never retried.

Options:
  --base-url <url>               Canonical production origin
  --legacy-url <url>             Legacy/alias origin expected to 308
  --ttfb-threshold-ms <ms>       Median homepage ceiling (default: 2500 ms)
  --timeout-ms <ms>              Per-fetch-attempt timeout (default: 15000 ms)
  --help                         Show this help

Environment variables:
  PRODUCTION_BASE_URL
  PRODUCTION_LEGACY_URL
  PRODUCTION_TTFB_THRESHOLD_MS
  PRODUCTION_TIMEOUT_MS
`;

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function productionOrigin(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (url.protocol !== 'https:') throw new Error(`${label} must use HTTPS`);
  if (url.username || url.password) throw new Error(`${label} must not include credentials`);
  return new URL('/', url.origin);
}

function parseOptions(args) {
  const values = {
    baseUrl: process.env.PRODUCTION_BASE_URL ?? DEFAULT_BASE_URL,
    legacyUrl: process.env.PRODUCTION_LEGACY_URL ?? DEFAULT_LEGACY_URL,
    ttfbThresholdMs: process.env.PRODUCTION_TTFB_THRESHOLD_MS ?? String(DEFAULT_TTFB_THRESHOLD_MS),
    timeoutMs: process.env.PRODUCTION_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS),
  };
  const flags = {
    '--base-url': 'baseUrl',
    '--legacy-url': 'legacyUrl',
    '--ttfb-threshold-ms': 'ttfbThresholdMs',
    '--timeout-ms': 'timeoutMs',
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') {
      console.log(HELP);
      process.exit(0);
    }
    const key = flags[argument];
    if (!key) throw new Error(`Unknown option: ${argument}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
    values[key] = value;
    index += 1;
  }

  return {
    baseUrl: productionOrigin(values.baseUrl, 'base URL'),
    legacyUrl: productionOrigin(values.legacyUrl, 'legacy URL'),
    ttfbThresholdMs: positiveInteger(values.ttfbThresholdMs, 'TTFB threshold'),
    timeoutMs: positiveInteger(values.timeoutMs, 'request timeout'),
  };
}

let options;
try {
  options = parseOptions(process.argv.slice(2));
} catch (error) {
  console.error(`Configuration error: ${errorMessage(error)}`);
  console.error('Run with --help for usage.');
  process.exit(2);
}

const request = createRequester({ timeoutMs: options.timeoutMs });

let passCount = 0;
const failures = [];

async function check(name, assertion) {
  try {
    const detail = await assertion();
    passCount += 1;
    console.log(`PASS ${name}${detail ? ` - ${detail}` : ''}`);
  } catch (error) {
    const message = errorMessage(error);
    failures.push({ name, message });
    console.error(`FAIL ${name} - ${message}`);
  }
}

function assertExactToolNames(tools, label) {
  assert(Array.isArray(tools), `${label} tools are missing`);
  const names = tools.map((tool, index) => {
    assert(isRecord(tool), `${label} tool ${index + 1} is malformed`);
    assert(typeof tool.name === 'string', `${label} tool ${index + 1} name is missing`);
    return tool.name;
  });
  const actual = [...names].sort();
  const expected = [...MCP_TOOL_NAMES].sort();
  assert(
    actual.length === expected.length && actual.every((name, index) => name === expected[index]),
    `${label} tools were ${names.join(', ') || 'empty'}, expected ${MCP_TOOL_NAMES.join(', ')}`,
  );
  return names;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function rpcRequest(method, params, id) {
  return { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) };
}

async function postMcp(message, label) {
  const url = new URL('/api/mcp', options.baseUrl);
  const { response, body } = await request(url, {
    method: 'POST',
    accept: MCP_ACCEPT,
    headers: {
      'content-type': 'application/json',
      'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    },
    body: JSON.stringify(message),
    bodyType: 'text',
  });
  assert(response.status === 200, `${label} expected 200, received ${response.status}`);
  const json = parseMcpPayload(body, response, `${url.pathname} ${label}`);
  assert(isRecord(json), `${label} response is not a JSON object`);
  assert(json.jsonrpc === '2.0', `${label} response is not JSON-RPC 2.0`);
  assert(json.id === message.id, `${label} response id did not match the request`);
  if ('error' in json) {
    const rpcError = isRecord(json.error)
      ? `${String(json.error.code)} ${String(json.error.message)}`
      : 'malformed error';
    throw new Error(`${label} returned JSON-RPC error: ${rpcError}`);
  }
  assert(isRecord(json.result), `${label} result is missing`);
  return { response, result: json.result };
}

async function postMcpInitialized() {
  const url = new URL('/api/mcp', options.baseUrl);
  const { response, body } = await request(url, {
    method: 'POST',
    accept: MCP_ACCEPT,
    headers: {
      'content-type': 'application/json',
      'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    bodyType: 'bytes',
  });
  assert(
    response.status === 202,
    `initialized notification expected 202, received ${response.status}`,
  );
  assert(body.length === 0, `initialized notification returned ${body.length} response bytes`);
}

function bytesMatch(bytes, offset, expected) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function validatePngIcon(bytes, view, imageOffset, imageSize, width, height, label) {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  assert(imageSize >= 24, `${label} PNG payload is too short (${imageSize} bytes)`);
  assert(bytesMatch(bytes, imageOffset, pngSignature), `${label} PNG signature is invalid`);
  assert(view.getUint32(imageOffset + 8, false) === 13, `${label} PNG IHDR length is invalid`);
  assert(
    bytesMatch(bytes, imageOffset + 12, [0x49, 0x48, 0x44, 0x52]),
    `${label} PNG IHDR chunk is missing`,
  );
  assert(view.getUint32(imageOffset + 16, false) === width, `${label} PNG width is inconsistent`);
  assert(view.getUint32(imageOffset + 20, false) === height, `${label} PNG height is inconsistent`);
  return 'PNG';
}

function validateDibIcon(view, imageOffset, imageSize, width, height, label) {
  const dibHeaderSizes = new Set([12, 40, 52, 56, 64, 108, 124]);
  assert(imageSize >= 12, `${label} DIB payload is too short (${imageSize} bytes)`);
  const headerSize = view.getUint32(imageOffset, true);
  assert(dibHeaderSizes.has(headerSize), `${label} has unsupported DIB header size ${headerSize}`);
  assert(headerSize <= imageSize, `${label} DIB header exceeds its payload`);

  const coreHeader = headerSize === 12;
  const embeddedWidth = coreHeader
    ? view.getUint16(imageOffset + 4, true)
    : view.getInt32(imageOffset + 4, true);
  const embeddedHeight = coreHeader
    ? view.getUint16(imageOffset + 6, true)
    : view.getInt32(imageOffset + 8, true);
  const planes = view.getUint16(imageOffset + (coreHeader ? 8 : 12), true);
  const bitDepth = view.getUint16(imageOffset + (coreHeader ? 10 : 14), true);
  assert(embeddedWidth === width, `${label} DIB width is inconsistent`);
  assert(Math.abs(embeddedHeight) === height * 2, `${label} DIB height is inconsistent`);
  assert(planes === 1, `${label} DIB plane count is ${planes}, expected 1`);
  assert(bitDepth > 0, `${label} DIB bit depth is invalid`);
  return 'DIB';
}

let homepage;
let homepageSamples = [];

console.log(
  `Production smoke: ${options.baseUrl.origin} (${HOMEPAGE_SAMPLE_COUNT}-sample median TTFB ceiling ${options.ttfbThresholdMs} ms; one transient retry)`,
);

await check(
  `canonical homepage routing (${HOMEPAGE_SAMPLE_COUNT} sequential samples)`,
  async () => {
    const url = new URL('/', options.baseUrl);
    const samples = [];

    for (let index = 0; index < HOMEPAGE_SAMPLE_COUNT; index += 1) {
      const sample = await request(url, {
        accept: 'text/html',
        bodyType: 'text',
      });
      const { response, body, ttfbMs } = sample;
      const sampleLabel = `sample ${index + 1}`;
      assertSingleAttempt(sample, sampleLabel);
      assert(response.status === 200, `${sampleLabel} expected 200, received ${response.status}`);
      assert(!response.headers.has('location'), `${sampleLabel} returned a redirect`);
      assert(
        /text\/html/i.test(contentType(response)),
        `${sampleLabel} returned unexpected content type: ${contentType(response)}`,
      );
      samples.push({ response, body, ttfbMs });
    }

    homepageSamples = samples;
    [homepage] = samples;
    return `${samples.length} sequential 200 responses from ${url.href}`;
  },
);

await check('legacy alias routing', async () => {
  const paths = ['/', '/work/neev'];
  for (const path of paths) {
    const legacyTarget = new URL(path, options.legacyUrl);
    const expectedTarget = new URL(path, options.baseUrl);
    const { response } = await request(legacyTarget);
    assert(
      response.status === 308,
      `${legacyTarget.href} returned ${response.status}, expected 308`,
    );
    const location = response.headers.get('location');
    assert(location, `${legacyTarget.href} did not include a Location header`);
    const resolved = new URL(location, legacyTarget);
    assert(
      resolved.href === expectedTarget.href,
      `${legacyTarget.href} redirected to ${resolved.href}, expected ${expectedTarget.href}`,
    );
  }
  return '308 root and deep-path redirects preserve the canonical path';
});

await check('agent discovery Link header', () => {
  assert(homepage, 'canonical homepage was unavailable');
  const link = homepage.response.headers.get('link') ?? '';
  const advertised = [
    { path: '/llms.txt', rel: 'describedby', type: 'text/markdown' },
    { path: '/llms-full.txt', rel: 'describedby', type: 'text/markdown' },
    { path: '/sitemap.xml', rel: 'sitemap', type: 'application/xml' },
    {
      path: '/.well-known/agent-skills/index.json',
      rel: 'describedby',
      type: 'application/json',
    },
    { path: '/.well-known/mcp.json', rel: 'describedby', type: 'application/json' },
    {
      path: '/.well-known/api-catalog',
      rel: 'api-catalog',
      type: 'application/linkset+json',
    },
    { path: '/api/openapi.json', rel: 'service-desc', type: 'application/json' },
    { path: '/api/docs', rel: 'service-doc', type: 'text/html' },
  ];
  const count = validateDiscoveryLinks(link, options.baseUrl, advertised);
  return `${count} canonical targets advertised with exact relation and type`;
});

const agentSurfaces = [
  {
    path: '/robots.txt',
    type: /text\/plain/i,
    validate(body) {
      assert(/Content-Signal:/i.test(body), 'missing Content-Signal directive');
      validateRobotsSitemap(body, options.baseUrl);
    },
  },
  {
    path: '/llms.txt',
    type: /text\/markdown/i,
    validate(body) {
      assert(/^# /m.test(body), 'missing Markdown heading');
    },
  },
  {
    path: '/llms-full.txt',
    type: /text\/markdown/i,
    validate(body) {
      assert(body.length > 5_000, `body is unexpectedly short (${body.length} bytes)`);
      assert(body.includes('<about>'), 'missing about corpus section');
    },
  },
  {
    path: '/sitemap.xml',
    type: /xml/i,
    validate(body) {
      assert(body.includes('<urlset'), 'missing sitemap urlset');
      validateCanonicalSitemap(body, options.baseUrl);
    },
  },
  {
    path: '/.well-known/api-catalog',
    type: /application\/linkset\+json/i,
    validate(body, path) {
      const json = parseJson(body, path);
      assert(Array.isArray(json.linkset) && json.linkset.length > 0, 'linkset is empty');
    },
  },
  {
    path: '/.well-known/agent-skills/index.json',
    type: /application\/json/i,
    validate(body, path) {
      const json = parseJson(body, path);
      assert(Array.isArray(json.skills) && json.skills.length > 0, 'skills index is empty');
    },
  },
  {
    path: '/.well-known/agent-skills/hire-me/SKILL.md',
    type: /text\/(?:markdown|plain)/i,
    validate(body) {
      assert(body.startsWith('---'), 'skill frontmatter is missing');
    },
  },
  {
    path: '/.well-known/mcp.json',
    type: /application\/json/i,
    validate(body, path) {
      const json = parseJson(body, path);
      assert(isRecord(json), 'MCP card is not a JSON object');
      assert(typeof json.name === 'string' && json.name.length > 0, 'MCP card name is missing');
      assert(json.status === 'live', `MCP card status is ${String(json.status)}, expected live`);
      assert(
        json.endpoint === new URL('/api/mcp', options.baseUrl).href,
        `MCP card endpoint is ${String(json.endpoint)}, expected ${new URL('/api/mcp', options.baseUrl).href}`,
      );
      assert(
        json.protocolVersion === MCP_PROTOCOL_VERSION,
        `MCP card protocol is ${String(json.protocolVersion)}, expected ${MCP_PROTOCOL_VERSION}`,
      );
      assert(json.transport === 'streamable-http', 'MCP card transport is not streamable-http');
      const capabilities = isRecord(json.capabilities) ? json.capabilities : {};
      assertExactToolNames(capabilities.tools, 'MCP card');
    },
  },
  {
    path: '/api/openapi.json',
    type: /application\/json/i,
    validate(body, path) {
      const json = parseJson(body, path);
      assert(isRecord(json), 'OpenAPI document is not a JSON object');
      assert(/^3\.1/.test(json.openapi), 'OpenAPI document is not version 3.1');
      assert(isRecord(json.paths), 'OpenAPI paths are missing');
      assert(isRecord(json.paths['/api/mcp']), 'OpenAPI /api/mcp path is missing');
      assert(isRecord(json.paths['/api/mcp'].post), 'OpenAPI /api/mcp POST operation is missing');
    },
  },
  {
    path: '/api/docs',
    type: /text\/html/i,
    validate(body) {
      assert(body.includes('OpenAPI 3.1'), 'human-readable API docs are incomplete');
    },
  },
];

for (const surface of agentSurfaces) {
  await check(`agent surface ${surface.path}`, async () => {
    const url = new URL(surface.path, options.baseUrl);
    const { response, body } = await request(url, { bodyType: 'text' });
    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(
      surface.type.test(contentType(response)),
      `unexpected content type: ${contentType(response)}`,
    );
    assert(body.length > 0, 'body is empty');
    surface.validate(body, surface.path);
    return `${response.status} ${contentType(response).split(';')[0]}`;
  });
}

await check('live MCP initialize, tools/list, and tool calls', async () => {
  const initializeId = 'production-smoke-initialize';
  const { response: initializeResponse, result: initialize } = await postMcp(
    rpcRequest(
      'initialize',
      {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'akaushik.org-production-smoke', version: '1.0.0' },
      },
      initializeId,
    ),
    'initialize',
  );
  assert(
    initialize.protocolVersion === MCP_PROTOCOL_VERSION,
    `initialize negotiated ${String(initialize.protocolVersion)}, expected ${MCP_PROTOCOL_VERSION}`,
  );
  assert(!initializeResponse.headers.has('mcp-session-id'), 'stateless MCP issued a session id');
  const initializeCapabilities = isRecord(initialize.capabilities) ? initialize.capabilities : {};
  const initializeTools = isRecord(initializeCapabilities.tools)
    ? initializeCapabilities.tools
    : {};
  assertOptionalFalse(initializeTools.listChanged, 'initialize capabilities.tools.listChanged');
  const serverInfo = isRecord(initialize.serverInfo) ? initialize.serverInfo : {};
  assert(serverInfo.name === 'akaushik-org', 'initialize serverInfo.name is incorrect');

  await postMcpInitialized();

  const { result: listed } = await postMcp(
    rpcRequest('tools/list', {}, 'tools-list'),
    'tools/list',
  );
  const listedNames = assertExactToolNames(listed.tools, 'live MCP');
  for (const tool of listed.tools) {
    const annotations = isRecord(tool.annotations) ? tool.annotations : {};
    assert(
      annotations.readOnlyHint === true &&
        annotations.destructiveHint === false &&
        annotations.idempotentHint === true,
      `live MCP tool ${tool.name} is not advertised as read-only and idempotent`,
    );
  }

  const { result: lookup } = await postMcp(
    rpcRequest(
      'tools/call',
      { name: 'lookup_case_study', arguments: { slug: 'neev' } },
      'lookup-neev',
    ),
    'lookup_case_study(neev)',
  );
  assertOptionalFalse(lookup.isError, 'lookup_case_study(neev) result.isError');
  const caseStudy = isRecord(lookup.structuredContent) ? lookup.structuredContent : {};
  assert(caseStudy.slug === 'neev', 'lookup_case_study returned the wrong slug');
  assert(caseStudy.title === 'Neev', 'lookup_case_study returned the wrong title');
  assert(
    caseStudy.url === new URL('/work/neev', options.baseUrl).href,
    'lookup_case_study returned the wrong canonical URL',
  );
  assert(
    typeof caseStudy.markdown === 'string' && caseStudy.markdown.includes('# Neev'),
    'lookup_case_study returned incomplete Markdown',
  );
  assert(
    Array.isArray(lookup.content) && isRecord(lookup.content[0]),
    'lookup text content is missing',
  );
  assert(lookup.content[0].type === 'text', 'lookup content is not text');
  assert(typeof lookup.content[0].text === 'string', 'lookup text content is malformed');
  const mirroredCaseStudy = parseJson(lookup.content[0].text, 'lookup_case_study text content');
  assert(
    isRecord(mirroredCaseStudy) && mirroredCaseStudy.slug === caseStudy.slug,
    'lookup text content does not mirror structuredContent',
  );

  const { result: availabilityResult } = await postMcp(
    rpcRequest('tools/call', { name: 'get_availability', arguments: {} }, 'get-availability'),
    'get_availability',
  );
  assertOptionalFalse(availabilityResult.isError, 'get_availability result.isError');
  const availability = isRecord(availabilityResult.structuredContent)
    ? availabilityResult.structuredContent
    : {};
  assert(availability.status === 'open', 'availability status is not open');
  assert(
    availability.capacity === 'one project this quarter',
    'availability capacity is unexpected',
  );
  assert(
    availability.contactUrl === new URL('/#contact', options.baseUrl).href,
    'availability contact URL is incorrect',
  );
  assert(availability.email === 'hello@akaushik.org', 'availability email is incorrect');

  return `${MCP_PROTOCOL_VERSION}; ${listedNames.join(', ')}; Neev; availability open`;
});

await check('nonce Content-Security-Policy', () => {
  assert(homepageSamples.length >= 2, 'separate homepage responses were unavailable');
  const first = validateHomepageNonce(homepageSamples[0], 'homepage response 1');
  const second = validateHomepageNonce(homepageSamples[1], 'homepage response 2');
  assert(first.nonce !== second.nonce, 'CSP nonce did not rotate across homepage responses');
  return `${first.scriptCount + second.scriptCount} inline/external scripts matched all CSP policies; nonce rotated`;
});

await check('raw contact mailto', () => {
  assert(homepage, 'canonical homepage was unavailable');
  assert(
    hasMailtoAnchor(homepage.body, 'hello@akaushik.org'),
    'usable raw mailto:hello@akaushik.org anchor is missing',
  );
  return 'raw mailto link present';
});

await check('Cloudflare email-protection decoder absent', () => {
  assert(homepage, 'canonical homepage was unavailable');
  const markers = [
    ['/cdn-cgi/l/email-protection', /\/cdn-cgi\/l\/email-protection/i],
    ['data-cfemail', /data-cfemail/i],
    ['email-decode.min.js', /email-decode\.min\.js/i],
    ['__cf_email__', /__cf_email__/i],
  ];
  const found = markers.filter(([, pattern]) => pattern.test(homepage.body)).map(([name]) => name);
  assert(found.length === 0, `found Cloudflare email-protection artifacts: ${found.join(', ')}`);
  return 'no decoder markup or script';
});

await check('homepage image URLs', async () => {
  assert(homepage, 'canonical homepage was unavailable');
  const imageUrls = extractHomepageImageUrls(homepage.body, options.baseUrl);
  assert(imageUrls.length > 0, 'homepage advertised no image URLs');

  for (const href of imageUrls) {
    const url = new URL(href);
    const { response, body } = await request(url, {
      accept: 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8',
      bodyType: 'bytes',
    });
    assert(response.status === 200, `${url.href} expected 200, received ${response.status}`);
    assert(!response.headers.has('location'), `${url.href} returned a redirect`);
    assert(
      /^image\//i.test(contentType(response)),
      `${url.href} returned unexpected content type: ${contentType(response)}`,
    );
    assert(body.length > 0, `${url.href} returned an empty image body`);
  }

  return `${imageUrls.length} same-origin HTTPS images returned non-empty image bodies`;
});

await check('legacy favicon', async () => {
  const url = new URL('/favicon.ico', options.baseUrl);
  const { response, body: bytes } = await request(url, {
    accept: 'image/x-icon,image/*;q=0.8',
    bodyType: 'bytes',
  });
  assert(response.status === 200, `expected 200, received ${response.status}`);
  assert(
    /image\/(?:x-icon|vnd\.microsoft\.icon)|application\/octet-stream/i.test(contentType(response)),
    `unexpected content type: ${contentType(response)}`,
  );
  assert(bytes.length >= 6, `ICO body is too short (${bytes.length} bytes)`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert(view.getUint16(0, true) === 0, 'ICO reserved field is invalid');
  assert(view.getUint16(2, true) === 1, 'ICO type is not icon');
  const imageCount = view.getUint16(4, true);
  assert(imageCount > 0, 'ICO contains no images');
  const directoryLength = 6 + imageCount * 16;
  assert(
    bytes.length >= directoryLength,
    `ICO directory requires ${directoryLength} bytes, received ${bytes.length}`,
  );

  const dimensions = [];
  const formats = [];
  for (let index = 0; index < imageCount; index += 1) {
    const entryOffset = 6 + index * 16;
    const width = bytes[entryOffset] || 256;
    const height = bytes[entryOffset + 1] || 256;
    const label = `ICO entry ${index + 1} (${width}x${height})`;
    assert(bytes[entryOffset + 3] === 0, `${label} reserved field is invalid`);

    const imageSize = view.getUint32(entryOffset + 8, true);
    const imageOffset = view.getUint32(entryOffset + 12, true);
    assert(width >= 1 && width <= 256, `${label} width is invalid`);
    assert(height >= 1 && height <= 256, `${label} height is invalid`);
    assert(imageSize > 0, `${label} payload is empty`);
    assert(imageOffset >= directoryLength, `${label} payload overlaps the ICO directory`);
    assert(imageOffset <= bytes.length, `${label} payload offset exceeds the file length`);
    assert(
      imageSize <= bytes.length - imageOffset,
      `${label} payload exceeds the file length (${imageOffset} + ${imageSize} > ${bytes.length})`,
    );

    const isPng = bytesMatch(bytes, imageOffset, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const format = isPng
      ? validatePngIcon(bytes, view, imageOffset, imageSize, width, height, label)
      : validateDibIcon(view, imageOffset, imageSize, width, height, label);
    dimensions.push(`${width}x${height}`);
    formats.push(format);
  }

  const formatSummary = [...new Set(formats)].join('/');
  return `${bytes.length} bytes; ${imageCount} bounded ${formatSummary} images (${dimensions.join(', ')})`;
});

await check(`homepage median TTFB <= ${options.ttfbThresholdMs} ms`, () => {
  assert(
    homepageSamples.length === HOMEPAGE_SAMPLE_COUNT,
    `expected ${HOMEPAGE_SAMPLE_COUNT} homepage samples, received ${homepageSamples.length}`,
  );
  const samples = homepageSamples.map(({ ttfbMs }) => ttfbMs);
  const measured = median(samples);
  const roundedMedian = Math.round(measured);
  const roundedSamples = samples.map((sample) => Math.round(sample));
  assert(
    measured <= options.ttfbThresholdMs,
    `median ${roundedMedian} ms from samples ${roundedSamples.join(', ')} ms; threshold ${options.ttfbThresholdMs} ms`,
  );
  return `median ${roundedMedian} ms (samples ${roundedSamples.join(', ')} ms)`;
});

console.log(`Production smoke complete: ${passCount} passed, ${failures.length} failed.`);
if (failures.length > 0) process.exitCode = 1;
