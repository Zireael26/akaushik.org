import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  assertOptionalFalse,
  assertSingleAttempt,
  createRequester,
  extractHomepageImageUrls,
  hasMailtoAnchor,
  parseMcpPayload,
  validateCanonicalSitemap,
  validateDiscoveryLinks,
  validateHomepageNonce,
  validateRobotsSitemap,
} from './check-production-lib.mjs';
import { runProductionCheckCli, runProductionChecks } from './check-production.mjs';

const repositoryRoot = new URL('../', import.meta.url);

function readRepositoryFile(path) {
  return readFileSync(new URL(path, repositoryRoot), 'utf8');
}

function readWorkflow(path) {
  return parseYaml(readRepositoryFile(path));
}

function workflowStep(workflow, jobName, stepName) {
  return workflow.jobs[jobName].steps.find((step) => step.name === stepName);
}

describe('platform automation contracts', () => {
  it('runs manual stats refreshes from reviewed default-branch code', () => {
    const source = readRepositoryFile('.github/workflows/stats.yml');
    const workflow = parseYaml(source);
    const job = workflow.jobs.refresh;
    const checkout = job.steps.find((step) => String(step.uses).startsWith('actions/checkout@'));
    const prepare = workflowStep(workflow, 'refresh', 'Prepare stable automation branch');
    const fetchStats = workflowStep(workflow, 'refresh', 'Fetch stats');
    const publish = workflowStep(workflow, 'refresh', 'Open automation pull request');

    expect(workflow.on.repository_dispatch.types).toEqual(['refresh-github-stats']);
    expect(workflow.on.workflow_dispatch).toBeUndefined();
    expect(source).not.toContain('github.event.client_payload');
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency).toEqual({
      group: 'refresh-github-stats',
      'cancel-in-progress': false,
    });
    expect(checkout.with).toMatchObject({
      ref: '${{ github.event.repository.default_branch }}',
      'persist-credentials': false,
    });
    expect(prepare.run).toContain('git switch -C "$BRANCH_NAME" "origin/$BASE_BRANCH"');
    expect(prepare.run).toContain(
      `remote_sha="$(git ls-remote --heads origin "$BRANCH_NAME" | awk '{print $1}')"`,
    );
    expect(prepare.run).toContain('echo "remote_sha=$remote_sha" >> "$GITHUB_OUTPUT"');
    expect(prepare.run).toContain('git diff --quiet');
    expect(fetchStats.env.GITHUB_TOKEN).toBe('${{ secrets.GH_STATS_TOKEN }}');
    expect(publish.env.GH_TOKEN).toBe('${{ secrets.GH_STATS_TOKEN }}');
    expect(publish.env.REMOTE_BRANCH_SHA).toBe('${{ steps.branch.outputs.remote_sha }}');
    expect(publish.run.match(/^\s*git push(?:\s|$)/gm) ?? []).toHaveLength(1);
    expect(publish.run).toContain('--force-with-lease="$BRANCH_NAME:$REMOTE_BRANCH_SHA"');
  });

  it('reserves ADR-0016 for the platform runtime and bundle decision', () => {
    const oldAdr = new URL(
      'docs/adr/0015-post-launch-runtime-and-bundle-budget.md',
      repositoryRoot,
    );
    const newAdr = new URL(
      'docs/adr/0016-post-launch-runtime-and-bundle-budget.md',
      repositoryRoot,
    );
    const references = [
      'docs/BUNDLE_BUDGET.md',
      'docs/CHANGELOG.md',
      'docs/bundle-snapshots/2026-07-14-bundle.md',
      'specs/003-post-launch-closure/plan.md',
      'specs/003-post-launch-closure/tasks.md',
    ].map(readRepositoryFile);

    expect(existsSync(oldAdr)).toBe(false);
    expect(existsSync(newAdr)).toBe(true);
    for (const reference of references) {
      expect(reference).not.toContain('0015-post-launch-runtime-and-bundle-budget');
    }
    expect(references.join('\n')).toContain('ADR-0016');
  });
});

describe('production smoke safeguards', () => {
  it('executes the complete production contract through an injected transport', async () => {
    const discovery = [
      '</llms.txt>; rel="describedby"; type="text/markdown"',
      '</llms-full.txt>; rel="describedby"; type="text/markdown"',
      '</sitemap.xml>; rel="sitemap"; type="application/xml"',
      '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
      '</.well-known/mcp.json>; rel="describedby"; type="application/json"',
      '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
      '</api/openapi.json>; rel="service-desc"; type="application/json"',
      '</api/docs>; rel="service-doc"; type="text/html"',
    ].join(', ');
    const tools = [
      {
        name: 'lookup_case_study',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      {
        name: 'get_availability',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
        },
      },
    ];
    let homepageRequestCount = 0;

    function result(body, contentType, status = 200, headers = {}) {
      return {
        response: new Response(null, {
          status,
          headers: { 'content-type': contentType, ...headers },
        }),
        body,
        ttfbMs: 10,
        attempts: 1,
        totalElapsedMs: 12,
      };
    }

    const request = vi.fn(async (url, requestOptions = {}) => {
      if (url.origin === 'https://akaushik.dev') {
        return result('', 'text/plain', 308, {
          location: `https://akaushik.org${url.pathname}`,
        });
      }

      if (url.pathname === '/' && requestOptions.method !== 'POST') {
        homepageRequestCount += 1;
        const nonce = `response-nonce-${homepageRequestCount}`;
        const html = [
          `<script nonce="${nonce}">self.__next_f = []</script>`,
          '<a href="mailto:hello@akaushik.org">Contact</a>',
          '<link rel="icon" href="/favicon.svg">',
        ].join('');
        return result(html, 'text/html; charset=utf-8', 200, {
          link: discovery,
          'content-security-policy':
            `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic'; ` +
            `script-src-attr 'none'`,
        });
      }

      if (url.pathname === '/api/mcp' && requestOptions.method === 'POST') {
        const message = JSON.parse(requestOptions.body);
        if (!('id' in message)) return result(new Uint8Array(), 'application/json', 202);

        let rpcResult;
        if (message.method === 'initialize') {
          rpcResult = {
            protocolVersion: '2025-11-25',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'akaushik-org', version: '1.0.0' },
          };
        } else if (message.method === 'tools/list') {
          rpcResult = { tools };
        } else if (message.params.name === 'lookup_case_study') {
          const structuredContent = {
            slug: 'neev',
            title: 'Neev',
            url: 'https://akaushik.org/work/neev',
            markdown: '# Neev\nA case study.',
          };
          rpcResult = {
            structuredContent,
            content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          };
        } else {
          rpcResult = {
            structuredContent: {
              status: 'open',
              capacity: 'one project this quarter',
              contactUrl: 'https://akaushik.org/#contact',
              email: 'hello@akaushik.org',
            },
          };
        }

        return result(
          JSON.stringify({ jsonrpc: '2.0', id: message.id, result: rpcResult }),
          'application/json',
        );
      }

      const surfaces = {
        '/robots.txt': [
          'User-agent: *\nContent-Signal: search=yes\nSitemap: https://akaushik.org/sitemap.xml\n',
          'text/plain',
        ],
        '/llms.txt': ['# Abhishek Kaushik\n', 'text/markdown'],
        '/llms-full.txt': [`# Full\n<about>\n${'x'.repeat(5_100)}`, 'text/markdown'],
        '/sitemap.xml': [
          '<urlset><url><loc>https://akaushik.org/</loc></url></urlset>',
          'application/xml',
        ],
        '/.well-known/api-catalog': [
          JSON.stringify({ linkset: [{ anchor: 'https://akaushik.org/' }] }),
          'application/linkset+json',
        ],
        '/.well-known/agent-skills/index.json': [
          JSON.stringify({ skills: [{ name: 'hire-me' }] }),
          'application/json',
        ],
        '/.well-known/agent-skills/hire-me/SKILL.md': [
          '---\nname: hire-me\n---\n',
          'text/markdown',
        ],
        '/.well-known/mcp.json': [
          JSON.stringify({
            name: 'akaushik.org',
            status: 'live',
            endpoint: 'https://akaushik.org/api/mcp',
            protocolVersion: '2025-11-25',
            transport: 'streamable-http',
            capabilities: { tools },
          }),
          'application/json',
        ],
        '/api/openapi.json': [
          JSON.stringify({ openapi: '3.1.0', paths: { '/api/mcp': { post: {} } } }),
          'application/json',
        ],
        '/api/docs': ['<!doctype html><title>OpenAPI 3.1</title>', 'text/html'],
        '/favicon.svg': ['<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml'],
      };

      if (url.pathname === '/favicon.ico') {
        return result(
          new Uint8Array(readFileSync(new URL('public/favicon.ico', repositoryRoot))),
          'image/x-icon',
        );
      }
      const surface = surfaces[url.pathname];
      if (!surface) throw new Error(`Unexpected test request: ${url.href}`);
      return result(surface[0], surface[1]);
    });

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const outcome = await runProductionChecks(
        {
          baseUrl: new URL('https://akaushik.org/'),
          legacyUrl: new URL('https://akaushik.dev/'),
          ttfbThresholdMs: 2_500,
          timeoutMs: 15_000,
        },
        request,
      );

      expect(outcome).toEqual({ passCount: 20, failures: [], exitCode: 0 });
      expect(homepageRequestCount).toBe(3);
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  it('returns explicit CLI outcomes for help and invalid configuration', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(runProductionCheckCli(['--help'], {})).resolves.toBe(0);
      await expect(runProductionCheckCli(['--unknown'], {})).resolves.toBe(2);
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  it('enforces every effective CSP script policy on inline and external scripts', () => {
    const nonce = 'response-nonce';
    const response = new Response(null, {
      headers: {
        'content-security-policy': [
          `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic'`,
          `default-src 'self'; script-src-elem 'nonce-${nonce}' 'strict-dynamic'`,
        ].join(', '),
      },
    });
    const body = [
      `<script nonce="${nonce}">self.__next_f = []</script>`,
      `<script nonce="${nonce}" src="/_next/static/chunks/app.js"></script>`,
    ].join('');

    expect(validateHomepageNonce({ response, body }, 'homepage')).toEqual({
      nonce,
      policyCount: 2,
      scriptCount: 2,
      inlineScriptCount: 1,
      externalScriptCount: 1,
    });

    expect(() =>
      validateHomepageNonce(
        {
          response,
          body: `<script nonce="${nonce}">ok()</script><script src="/missing.js"></script>`,
        },
        'homepage',
      ),
    ).toThrow(/external script 2 did not carry the response nonce/);

    const unsafeFallback = new Response(null, {
      headers: {
        'content-security-policy':
          `default-src 'self'; script-src 'unsafe-inline' 'nonce-${nonce}' 'strict-dynamic'; ` +
          `script-src-elem 'nonce-${nonce}' 'strict-dynamic'`,
      },
    });
    expect(() =>
      validateHomepageNonce(
        { response: unsafeFallback, body: `<script nonce="${nonce}">ok()</script>` },
        'homepage',
      ),
    ).toThrow(/script-src contains 'unsafe-inline'/);

    const missingStrictDynamic = new Response(null, {
      headers: {
        'content-security-policy':
          `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic'; ` +
          `script-src-elem 'nonce-${nonce}'`,
      },
    });
    expect(() =>
      validateHomepageNonce(
        { response: missingStrictDynamic, body: `<script nonce="${nonce}">ok()</script>` },
        'homepage',
      ),
    ).toThrow(/script-src-elem omits 'strict-dynamic'/);

    const unsafeAttributes = new Response(null, {
      headers: {
        'content-security-policy':
          `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic'; ` +
          `script-src-attr 'unsafe-inline'`,
      },
    });
    expect(() =>
      validateHomepageNonce(
        { response: unsafeAttributes, body: `<script nonce="${nonce}">ok()</script>` },
        'homepage',
      ),
    ).toThrow(/script-src-attr must be exactly 'none'/);
  });

  it('retries a transient response-body failure inside the request timeout', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: { cancel: vi.fn() },
        text: vi.fn().mockRejectedValue(new TypeError('terminated')),
      })
      .mockResolvedValueOnce(new Response('complete', { status: 200 }));
    const delayImpl = vi.fn();
    const logger = { warn: vi.fn() };
    const request = createRequester({ timeoutMs: 1_000, fetchImpl, delayImpl, logger });

    const result = await request(new URL('https://akaushik.org/llms.txt'), {
      bodyType: 'text',
    });

    expect(result.body).toBe('complete');
    expect(result.attempts).toBe(2);
    expect(result.totalElapsedMs).toBeGreaterThanOrEqual(result.ttfbMs);
    expect(() => assertSingleAttempt(result, 'homepage sample')).toThrow(/required 2 attempts/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(delayImpl).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('response body'));
  });

  it('requires exact same-origin discovery relations and canonical URL documents', () => {
    const baseUrl = new URL('https://akaushik.org/');
    const expected = [
      { path: '/llms.txt', rel: 'describedby', type: 'text/markdown' },
      { path: '/sitemap.xml', rel: 'sitemap', type: 'application/xml' },
    ];
    const valid = [
      '</llms.txt>; rel="describedby"; type="text/markdown"',
      '<https://akaushik.org/sitemap.xml>; rel="sitemap"; type="application/xml"',
    ].join(', ');
    expect(validateDiscoveryLinks(valid, baseUrl, expected)).toBe(2);
    expect(() =>
      validateDiscoveryLinks(
        valid.replace('</llms.txt>', '<https://attacker.invalid/llms.txt>'),
        baseUrl,
        expected,
      ),
    ).toThrow(/llms\.txt must be advertised on https:\/\/akaushik\.org/);
    expect(() =>
      validateDiscoveryLinks(
        `${valid}, <https://attacker.invalid/llms.txt>; rel="describedby"; type="text/markdown"`,
        baseUrl,
        expected,
      ),
    ).toThrow(/llms\.txt must be advertised exactly once/);
    expect(() =>
      validateDiscoveryLinks(valid.replace('rel="sitemap"', 'rel="alternate"'), baseUrl, expected),
    ).toThrow(/sitemap\.xml must be advertised exactly once/);
    expect(() =>
      validateDiscoveryLinks(
        valid.replace('type="text/markdown"', 'type="text/markdown"; broken'),
        baseUrl,
        expected,
      ),
    ).toThrow(/malformed parameters/);
    expect(() =>
      validateDiscoveryLinks(
        valid.replace('rel="describedby"', 'title="rel=describedby"'),
        baseUrl,
        expected,
      ),
    ).toThrow(/llms\.txt must be advertised exactly once/);

    expect(() =>
      validateRobotsSitemap('User-agent: *\nSitemap: https://akaushik.org/sitemap.xml\n', baseUrl),
    ).not.toThrow();
    expect(() =>
      validateRobotsSitemap(
        'User-agent: *\nSitemap: https://attacker.invalid/sitemap.xml\n',
        baseUrl,
      ),
    ).toThrow(/expected https:\/\/akaushik\.org\/sitemap\.xml/);

    expect(
      validateCanonicalSitemap(
        '<urlset><url><loc>https://akaushik.org/</loc></url></urlset>',
        baseUrl,
      ),
    ).toBe(1);
    expect(() =>
      validateCanonicalSitemap(
        '<urlset><url><loc>https://attacker.invalid/</loc></url></urlset>',
        baseUrl,
      ),
    ).toThrow(/not canonical/);
  });

  it('recognizes only rendered mailto anchors', () => {
    expect(
      hasMailtoAnchor(
        '<a href="mailto:hello@akaushik.org?subject=Hello">Contact</a>',
        'hello@akaushik.org',
      ),
    ).toBe(true);
    for (const body of [
      '<!-- <a href="mailto:hello@akaushik.org">Contact</a> -->',
      '<script>const markup = `<a href="mailto:hello@akaushik.org">x</a>`</script>',
      '<template><a href="mailto:hello@akaushik.org">x</a></template>',
      '<div data-copy="href=mailto:hello@akaushik.org">Contact</div>',
    ]) {
      expect(hasMailtoAnchor(body, 'hello@akaushik.org')).toBe(false);
    }
  });

  it('parses one valid JSON-RPC message from an SSE response', () => {
    const response = new Response(null, {
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
    });
    const body = [
      ': keepalive',
      'event: message',
      'id: rpc-1',
      'data: {"jsonrpc":"2.0",',
      'data: "id":"rpc-1","result":{}}',
      '',
      '',
    ].join('\r\n');

    expect(parseMcpPayload(body, response, 'tools/list')).toEqual({
      jsonrpc: '2.0',
      id: 'rpc-1',
      result: {},
    });
    expect(() => parseMcpPayload('{"jsonrpc":"2.0"}', response, 'tools/list')).toThrow(
      /did not contain exactly one SSE data event/,
    );
  });

  it('discovers and fully resolves every homepage image URL shape', () => {
    const body = `
      <meta property="og:image" content="/opengraph-image">
      <link rel="icon" href="/favicon.svg">
      <img src="/images/about/abhishek.webp"
           srcset="/_next/image?url=%2Fimages%2Fabout%2Fabhishek.webp&amp;w=640&amp;q=75 1x,
                   /_next/image?url=%2Fimages%2Fabout%2Fabhishek.webp&amp;w=1280&amp;q=75 2x">
      <script type="application/ld+json">{
        "@type": "Organization",
        "logo": {
          "@type": "ImageObject",
          "url": "https://akaushik.org/opengraph-image",
          "contentUrl": "https://akaushik.org/opengraph-image"
        }
      }</script>
    `;

    expect(extractHomepageImageUrls(body, new URL('https://akaushik.org/'))).toEqual([
      'https://akaushik.org/_next/image?url=%2Fimages%2Fabout%2Fabhishek.webp&w=1280&q=75',
      'https://akaushik.org/_next/image?url=%2Fimages%2Fabout%2Fabhishek.webp&w=640&q=75',
      'https://akaushik.org/favicon.svg',
      'https://akaushik.org/images/about/abhishek.webp',
      'https://akaushik.org/opengraph-image',
    ]);

    expect(() =>
      extractHomepageImageUrls(
        '<img src="https://example.com/tracker.gif">',
        new URL('https://akaushik.org/'),
      ),
    ).toThrow(/must be same-origin HTTPS/);
  });

  it('accepts omitted MCP false-by-default fields but rejects true values', () => {
    expect(() => assertOptionalFalse(undefined, 'result.isError')).not.toThrow();
    expect(() => assertOptionalFalse(false, 'result.isError')).not.toThrow();
    expect(() => assertOptionalFalse(true, 'result.isError')).toThrow(
      /result\.isError must be false when present/,
    );
  });

  it('pins the scheduled smoke request timeout explicitly', () => {
    const workflow = readWorkflow('.github/workflows/production-smoke.yml');
    const job = workflow.jobs.smoke;
    const checkout = job.steps.find((step) => String(step.uses).startsWith('actions/checkout@'));
    const smoke = workflowStep(workflow, 'smoke', 'Check production safeguards');

    expect(workflow.on.schedule).toEqual([{ cron: '37 4 * * *' }]);
    expect(workflow.on.workflow_dispatch).toBeNull();
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency).toEqual({
      group: 'production-smoke',
      'cancel-in-progress': false,
    });
    expect(job['timeout-minutes']).toBe(5);
    expect(checkout.with.ref).toBe('${{ github.event.repository.default_branch }}');
    expect(smoke.env).toMatchObject({
      PRODUCTION_BASE_URL: 'https://akaushik.org',
      PRODUCTION_LEGACY_URL: 'https://akaushik.dev',
      PRODUCTION_TTFB_THRESHOLD_MS: '2500',
      PRODUCTION_TIMEOUT_MS: '15000',
    });
    expect(smoke.run).toBe('pnpm production:check');
  });
});
