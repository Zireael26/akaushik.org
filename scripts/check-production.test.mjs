import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  assertOptionalFalse,
  createRequester,
  extractHomepageImageUrls,
  parseMcpPayload,
  validateHomepageNonce,
} from './check-production-lib.mjs';

const repositoryRoot = new URL('../', import.meta.url);

function readRepositoryFile(path) {
  return readFileSync(new URL(path, repositoryRoot), 'utf8');
}

describe('platform automation contracts', () => {
  it('runs manual stats refreshes from reviewed default-branch code', () => {
    const workflow = readRepositoryFile('.github/workflows/stats.yml');

    expect(workflow).toMatch(/repository_dispatch:\s*\n\s+types: \[refresh-github-stats\]/);
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(workflow).not.toContain('github.event.client_payload');
    expect(workflow).toContain('ref: ${{ github.event.repository.default_branch }}');
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
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(delayImpl).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('response body'));
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
    const workflow = readRepositoryFile('.github/workflows/production-smoke.yml');

    expect(workflow).toContain("PRODUCTION_TIMEOUT_MS: '15000'");
    expect(workflow).toContain('ref: ${{ github.event.repository.default_branch }}');
  });
});
