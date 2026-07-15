import { expect, test } from '@playwright/test';

const IS_CI = process.env.CI === '1' || process.env.CI === 'true';

test.describe('structured metadata', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Server-rendered metadata and CSP behavior need one engine.',
  );

  test('JSON-LD stays in server HTML and carries the response CSP nonce', async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== 'chromium');

    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    for (const [path, minimumScripts] of [
      ['/', 1],
      ['/work/neev', 3],
      ['/writing/ai-for-msme', 3],
    ] as const) {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);
      const csp = response?.headers()['content-security-policy'];
      test.skip(!csp && !IS_CI, 'The nonce-bearing CSP is production-only.');
      expect(csp, `${path} must return the production CSP in CI`).toBeTruthy();
      const nonce = /'nonce-([^']+)'/.exec(csp ?? '')?.[1];
      expect(nonce).toBeTruthy();

      const scripts = page.locator('script[type="application/ld+json"]');
      await expect(scripts).toHaveCount(minimumScripts);
      const scriptNonces = await scripts.evaluateAll((elements) =>
        elements.map((element) => (element as HTMLScriptElement).nonce),
      );
      expect(scriptNonces).toEqual(Array.from({ length: minimumScripts }, () => nonce));
      expect(await response?.text()).toContain('type="application/ld+json"');
    }

    expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([]);
  });
});
