import { chromium } from '@playwright/test';

/**
 * Visual receipt for the heatfield port.
 *
 * The Chrome-extension route can't verify this: that tab runs hidden, so
 * requestAnimationFrame is suspended and a screenshot only ever forces a single
 * frame. The exhibit blend needs ~46 consecutive frames (0.022/frame), so it
 * never advances there. A Playwright-driven browser keeps rendering.
 */
const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch();

async function shoot(mode, steps, name) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: mode === 'dark' ? 'dark' : 'light',
    deviceScaleFactor: 2,
  });
  await page.goto('http://localhost:3100/', { waitUntil: 'networkidle' });
  await page.evaluate((m) => document.documentElement.setAttribute('data-mode', m), mode);
  await page.waitForTimeout(600);

  const canvas = page.locator('.px-heatfield canvas');
  const box = await canvas.boundingBox();
  // Well clear of the pivot zone (|x/cols - 0.5| < 0.09, 0.03 < y/rows < 0.32),
  // which is the secret entrance and deliberately does not cycle exhibits.
  const px = box.x + box.width * 0.22;
  const py = box.y + box.height * 0.55;

  // Two clicks per exhibit: odd clicks tip the beam, even clicks advance.
  for (let i = 0; i < steps * 2; i++) {
    await page.mouse.click(px, py);
    await page.waitForTimeout(60);
  }
  // Let the 0.022/frame blend run to completion, then settle the ambient drift.
  await page.waitForTimeout(1800);

  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
}

await shoot('light', 0, 'exhibit-0-light');
await shoot('light', 1, 'exhibit-1-light');
await shoot('light', 2, 'exhibit-2-light');
await shoot('light', 3, 'exhibit-3-light');
await shoot('dark', 3, 'exhibit-3-dark');

await browser.close();
console.log('done');
