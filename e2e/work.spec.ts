import { test, expect } from '@playwright/test';

const PUBLISHED_CASE_STUDY_SLUGS = [
  'neev',
  'vericite',
  'bluehost-agents',
  'curat-money',
  'clusterbid',
];

test.describe('Work — cards and detail routes', () => {
  test('home page lists all five published case-study cards', async ({ page }) => {
    await page.goto('/');

    for (const slug of PUBLISHED_CASE_STUDY_SLUGS) {
      await expect(page.locator(`#case-${slug}`)).toBeVisible();
    }
  });

  test('ClusterBid renders on both listings and its detail route', async ({ page }) => {
    await page.goto('/');

    const card = page.locator('#case-clusterbid');
    await expect(card).toBeVisible();
    await expect(card).toContainText('pre-production proof');

    await page.goto('/work');
    await expect(page.getByRole('link', { name: /ClusterBid/i })).toBeVisible();

    await page.goto('/work/clusterbid');
    const article = page.locator('article.work-detail-body');
    await expect(article.getByRole('heading', { level: 1 })).toHaveText('ClusterBid');
    await expect(article).toContainText('UAT');
    await expect(article).toContainText('pre-production');
  });

  test('ClusterBid is present in Markdown, JSON, and the full corpus', async ({ request }) => {
    const markdownResponse = await request.get('/work/clusterbid.md');
    expect(markdownResponse.ok()).toBe(true);
    expect(markdownResponse.headers()['content-type']).toContain('text/markdown');
    const markdown = await markdownResponse.text();
    expect(markdown).toContain('# ClusterBid');
    expect(markdown).toContain('- **Role** — Engineering advisor · process & platform');

    const apiResponse = await request.get('/api/case-studies');
    expect(apiResponse.ok()).toBe(true);
    const payload = (await apiResponse.json()) as {
      count: number;
      caseStudies: Array<{ slug: string; role: string }>;
    };
    expect(payload.count).toBe(5);
    expect(payload.caseStudies.map((study) => study.slug)).toEqual(PUBLISHED_CASE_STUDY_SLUGS);
    expect(payload.caseStudies.at(-1)).toMatchObject({
      slug: 'clusterbid',
      role: 'Engineering advisor · process & platform',
    });

    const corpusResponse = await request.get('/llms-full.txt');
    expect(corpusResponse.ok()).toBe(true);
    expect(await corpusResponse.text()).toContain('<case-study slug="clusterbid">');
  });

  test('ClusterBid uses a static reel without media requests', async ({ page }) => {
    const clusterBidMediaRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/video\/work\/clusterbid(?:-hero)?\.(?:mp4|webp)$/.test(request.url())) {
        clusterBidMediaRequests.push(request.url());
      }
    });

    await page.goto('/');
    const card = page.locator('#case-clusterbid');
    await expect(card.locator('svg[data-reel-slug="clusterbid"]')).toBeVisible();
    await expect(card.locator('video')).toHaveCount(0);

    await page.goto('/work/clusterbid');
    await expect(page.locator('svg[data-reel-slug="clusterbid"]')).toBeVisible();
    await expect(page.locator('video[data-slug="clusterbid"]')).toHaveCount(0);
    expect(clusterBidMediaRequests).toEqual([]);
  });

  test('Neev card links to /work/neev and the detail page renders', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('#case-neev')
      .getByRole('link', { name: /Read the case study/i })
      .click();

    await expect(page).toHaveURL(/\/work\/neev$/, { timeout: 30_000 });

    // MDX owns the title + dek (per Phase 2 review fix). The H1 lives inside
    // the article, not the JSX header, so target the article scope.
    const article = page.locator('article.work-detail-body');
    await expect(article.getByRole('heading', { level: 1 })).toContainText('Neev');

    // Spec DL from frontmatter is still in the JSX header.
    await expect(page.locator('dl.case-spec')).toBeVisible();
  });

  test('Bluehost stub renders the confidentiality paragraph', async ({ page }) => {
    await page.goto('/work/bluehost-agents');

    const article = page.locator('article.work-detail-body');
    await expect(article).toContainText(/under scope review/i);
    await expect(article).toContainText('hello@akaushik.org');
  });
});
