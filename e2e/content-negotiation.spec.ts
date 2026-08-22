import { expect, test } from '@playwright/test';

// Guards the two content-negotiation patterns promised by AGENT_READINESS §4.1.
// The “.md suffix” and “Accept: text/markdown” patterns are both hit by
// isitagentready.com; losing either drops the score without warning. Keeping
// these assertions ensures Link discovery and Markdown alternate delivery stay
// intact across server refactors.
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
    expect(response.headers()['link']).toContain(
      '<https://akaushik.org/work/neev>; rel="canonical"',
    );
    const body = await response.text();
    // MDX body leads with `# <title>` + `> <dek>` per AGENT_READINESS §4.4.
    expect(body.startsWith('# ')).toBe(true);
    expect(body).toContain('Canonical');
  });

  test('Pattern B: /writing/<slug>.md serves Markdown', async ({ request }) => {
    const response = await request.get('/writing/micrograd-makemore.md');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/markdown');
    expect(response.headers()['link']).toContain(
      '<https://akaushik.org/writing/micrograd-makemore>; rel="canonical"',
    );
    const body = await response.text();
    expect(body.startsWith('# ')).toBe(true);
  });

  test('Pattern A: Accept: text/markdown on /work/<slug> serves Markdown', async ({
    request,
  }) => {
    const response = await request.get('/work/neev', {
      headers: { Accept: 'text/markdown' },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/markdown');
    expect(response.headers()['link']).toContain(
      '<https://akaushik.org/work/neev>; rel="canonical"',
    );
  });

  test('Pattern A: Accept: text/markdown on / serves Markdown (llms.txt)', async ({
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
