import { chromium } from '@playwright/test';

/**
 * Visual receipts for the pixel design.
 *
 * The Chrome-extension route can't verify this site: that tab runs hidden, so
 * requestAnimationFrame is suspended and a screenshot only ever forces a single
 * frame. The heatfield's exhibit blend needs ~46 consecutive frames
 * (0.022/frame), so it never advances there. A Playwright-driven browser keeps
 * rendering.
 *
 * Usage: node scripts/visual-receipt.mjs [outDir] [mode]
 *   mode: "page" (default) full-page shots in both themes, or "exhibits" to
 *         click through the four hero exhibits.
 */
const OUT = process.argv[2] ?? '.';
const MODE = process.argv[3] ?? 'page';
const URL = process.env.RECEIPT_URL ?? 'http://localhost:3100/';

const browser = await chromium.launch();

async function open(mode) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: mode === 'dark' ? 'dark' : 'light',
    deviceScaleFactor: 2,
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate((m) => document.documentElement.setAttribute('data-mode', m), mode);
  await page.waitForTimeout(700);
  return page;
}

if (MODE === 'exhibits') {
  for (const [mode, steps] of [
    ['light', 0],
    ['light', 1],
    ['light', 2],
    ['light', 3],
    ['dark', 0],
  ]) {
    const page = await open(mode);
    const box = await page.locator('.px-heatfield canvas').boundingBox();
    // Well clear of the pivot zone (|x/cols - 0.5| < 0.09, 0.03 < y/rows < 0.32),
    // which is the secret entrance and deliberately does not cycle exhibits.
    const px = box.x + box.width * 0.22;
    const py = box.y + box.height * 0.55;
    // Two clicks per exhibit: odd clicks swing the graph, even clicks advance.
    for (let i = 0; i < steps * 2; i++) {
      await page.mouse.click(px, py);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/exhibit-${steps}-${mode}.png` });
    await page.close();
  }
} else {
  for (const mode of ['light', 'dark']) {
    const page = await open(mode);
    // Scroll the whole page once so lazy content and any scroll-triggered
    // canvas sizing settles before the full-page capture.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/page-${mode}.png`, fullPage: true });
    await page.close();
  }
}

await browser.close();
console.log('done');
