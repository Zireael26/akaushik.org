import { expect, test } from '@playwright/test';

// Guard against a future proxy.ts edit (matcher regex, prefersMarkdown
// check, rewrite URL construction) silently breaking either content
// negotiation pattern. AGENT_READINESS §4.1 is the contract. The
// isitagentready.com scan hits both patterns; losing either drops the
// score without warning.
//
// Runs only on one project — Playwright's `request` API doesn't care about
// the viewport/browser matrix and content-negotiation is a server-side
// behaviour.

test.describe.configure({ mode: 'serial' });

test.describe('content negotiation', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Server-side behaviour; run once on chromium-desktop.',
  );

  test('Pattern B: /work/<slug>.md serves Markdown', async ({ request }) => {
    const response = await request.get('/work/neev.md');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/markdown');
    const body = await response.text();
    // MDX body leads with `# <title>` + `> <dek>` per AGENT_READINESS §4.4.
    expect(body.startsWith('# ')).toBe(true);
    expect(body).toContain('Canonical');
  });

  test('Pattern B: /writing/<slug>.md serves Markdown', async ({ request }) => {
    const response = await request.get('/writing/micrograd-makemore.md');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/markdown');
    const body = await response.text();
    expect(body.startsWith('# ')).toBe(true);
  });

  test('Pattern A: Accept: text/markdown on /work/<slug> rewrites', async ({
    request,
  }) => {
    const response = await request.get('/work/neev', {
      headers: { Accept: 'text/markdown' },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/markdown');
  });

  test('Pattern A: Accept: text/markdown on / rewrites to llms.txt', async ({
    request,
  }) => {
    const response = await request.get('/', {
      headers: { Accept: 'text/markdown' },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/markdown');
  });

  test('default Accept on /work/<slug> still returns HTML', async ({
    request,
  }) => {
    const response = await request.get('/work/neev');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    // HTML pages advertise the alternate via Link rel=alternate.
    const link = response.headers()['link'] ?? '';
    expect(link).toContain('rel="alternate"');
    expect(link).toContain('text/markdown');
  });
});
