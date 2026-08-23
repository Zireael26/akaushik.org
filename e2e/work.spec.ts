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

    // The home Work stack is `MatterRow` links, one per published slug. Per-slug
    // presence rather than an exact count, so adding a sixth study does not
    // fail this.
    for (const slug of PUBLISHED_CASE_STUDY_SLUGS) {
      await expect(page.locator(`#work a.px-matter[href="/work/${slug}"]`)).toBeVisible();
    }
  });

  test('ClusterBid renders on both listings and its detail route', async ({ page }) => {
    await page.goto('/');

    const row = page.locator('#work a.px-matter[href="/work/clusterbid"]');
    await expect(row).toBeVisible();
    // The row carries the study's name and its positioning tag; that pairing is
    // the whole point of the stack, so both are asserted.
    await expect(row).toContainText('ClusterBid');
    await expect(row).toContainText('UAT platform engineering');

    await page.goto('/work');
    await expect(page.getByRole('link', { name: /ClusterBid/i })).toBeVisible();

    // /work index entry: baseline `.work-index-item` → pixel `.px-work-index-item`.
    // Same live index entry, class renamed — selector migrated, assertion strength preserved.
    const indexEntry = page.locator('.px-work-index-item', { hasText: 'ClusterBid' });
    // Retained baseline class as comment: original `.work-index-item` renamed to `.px-work-index-item`.
    await expect(indexEntry).toContainText('Engineering advisor · process & platform');
    await expect(indexEntry).toContainText('pre-production');

    await page.goto('/work/clusterbid');
    // Detail body: baseline `article.work-detail-body` → pixel `article.px-work-body`.
    // Same live article, class renamed — selector migrated.
    const article = page.locator('article.px-work-body');
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

  test('ClusterBid renders one art field without media requests', async ({ page }) => {
    await page.goto('/');

    // The home Work stack itself carries no media — it is MatterRows — but the
    // page's separate About portrait does. Start observing at the detail
    // navigation so this assertion isolates the reel contract.
    const clusterBidMediaRequests: string[] = [];
    page.on('request', (request) => {
      if (/\.(?:mp4|webp)(?:\?|$)/.test(request.url())) {
        clusterBidMediaRequests.push(request.url());
      }
    });

    await page.goto('/work/clusterbid');
    await expect(page.locator('.px-work-detail > .px-route-field')).toHaveCount(0);
    await expect(page.locator('.px-reel .px-reel-field')).toHaveCount(1);
    expect(clusterBidMediaRequests).toEqual([]);
  });

  test('Neev card links to /work/neev and the detail page renders', async ({ page }) => {
    await page.goto('/');
    // The whole row is the link now; there is no separate "Read the case study"
    // affordance to click.
    await page.locator('#work a.px-matter[href="/work/neev"]').click();

    await expect(page).toHaveURL(/\/work\/neev$/, { timeout: 30_000 });

    // MDX owns the title + dek (per Phase 2 review fix). The H1 lives inside
    // the article, not the JSX header, so target the article scope.
    // Baseline `article.work-detail-body` → pixel `article.px-work-body`; selector migrated.
    const article = page.locator('article.px-work-body');
    await expect(article.getByRole('heading', { level: 1 })).toContainText('Neev');

    // The frontmatter spec renders as ruled rows rather than a definition list.
    // Assert the rows and their labels, which is what the reader actually gets.
    const spec = page.locator('.px-work-detail-spec');
    await expect(spec).toBeVisible();
    for (const label of ['Role', 'Stack', 'Evidence']) {
      await expect(spec.locator('.px-row-tag', { hasText: label })).toBeVisible();
    }
  });

  test('Bluehost stub renders the confidentiality paragraph', async ({ page }) => {
    await page.goto('/work/bluehost-agents');

    // Baseline `article.work-detail-body` → pixel `article.px-work-body` (see above); migrated.
    const article = page.locator('article.px-work-body');
    await expect(article).toContainText(/under scope review/i);
    await expect(article).toContainText('hello@akaushik.org');
  });
});
