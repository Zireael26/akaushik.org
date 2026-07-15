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
    expect(prepare.run).toContain('git diff --quiet');
    expect(fetchStats.env.GITHUB_TOKEN).toBe('${{ secrets.GH_STATS_TOKEN }}');
    expect(publish.env.GH_TOKEN).toBe('${{ secrets.GH_STATS_TOKEN }}');
    expect(publish.env.REMOTE_BRANCH_SHA).toBe('${{ steps.branch.outputs.remote_sha }}');
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
    ).toThrow(/llms\.txt must be advertised exactly once/);
    expect(() =>
      validateDiscoveryLinks(valid.replace('rel="sitemap"', 'rel="alternate"'), baseUrl, expected),
    ).toThrow(/sitemap\.xml must be advertised exactly once/);

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
