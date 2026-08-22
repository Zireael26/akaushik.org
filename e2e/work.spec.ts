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

    // Baseline home cards are `#case-<slug>` anchors rendered by the parchment template.
    // Regression: pixel Home `Work` mounts `MatterRow` links (`a.px-matter[href="/work/<slug>"]`) with no
    // `#case-*` ids. Retained selector documents that pixel removed the card id contract; the same live
    // cards are reachable via their detail hrefs but the id anchors are absent.
    // Individual presence checks, not an exact count — covers each published slug without tying to additive markup.
    for (const slug of PUBLISHED_CASE_STUDY_SLUGS) {
      await expect(page.locator(`#case-${slug}`)).toBeVisible();
    }
  });

  test('ClusterBid renders on both listings and its detail route', async ({ page }) => {
    await page.goto('/');

    // Baseline home ClusterBid card `#case-clusterbid` with tagline.
    // Regression: pixel home renders ClusterBid as a MatterRow without `#case-clusterbid` or its tagline wrapper;
    // the slug is still reachable via the Work stack, but the card id/text contract is pixel-absent. Retained
    // as baseline regression anchor.
    const card = page.locator('#case-clusterbid');
    await expect(card).toBeVisible();
    await expect(card).toContainText('pre-production proof');

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

  test('ClusterBid uses a static reel without media requests', async ({ page }) => {
    const clusterBidMediaRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/video\/work\/clusterbid(?:-hero)?\.(?:mp4|webp)$/.test(request.url())) {
        clusterBidMediaRequests.push(request.url());
      }
    });

    await page.goto('/');
    // Regression: pixel home renders no ClusterBid reel at all — the home Work stack is MatterRows with no
    // media. The `svg[data-reel-slug="clusterbid"]` on `#case-clusterbid` is the baseline home reel contract
    // and is retained as regression; on pixel the home card reel is absent (see finding “absent ClusterBid home reel”).
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
    // Regression: baseline Neev card is `#case-neev` with `a.case-link` “Read the case study”.
    // Pixel home uses `a.px-matter[href="/work/neev"]` with the title as link text and no `#case-*` id.
    // Retained selector documents that pixel removed the card id / case-link contract.
    await page
      .locator('#case-neev')
      .getByRole('link', { name: /Read the case study/i })
      .click();

    await expect(page).toHaveURL(/\/work\/neev$/, { timeout: 30_000 });

    // MDX owns the title + dek (per Phase 2 review fix). The H1 lives inside
    // the article, not the JSX header, so target the article scope.
    // Baseline `article.work-detail-body` → pixel `article.px-work-body`; selector migrated.
    const article = page.locator('article.px-work-body');
    await expect(article.getByRole('heading', { level: 1 })).toContainText('Neev');

    // Spec DL from frontmatter: baseline `dl.case-spec` (definition list semantics).
    // Regression: pixel `CaseStudyPage` renders spec as `div.px-work-detail-spec` with
    // `RuledRow` divs, not a `<dl>`. Retained selector documents that pixel removed dl semantics;
    // the same live spec rows are rendered but without definition-list structure.
    await expect(page.locator('dl.case-spec')).toBeVisible();
  });

  test('Bluehost stub renders the confidentiality paragraph', async ({ page }) => {
    await page.goto('/work/bluehost-agents');

    // Baseline `article.work-detail-body` → pixel `article.px-work-body` (see above); migrated.
    const article = page.locator('article.px-work-body');
    await expect(article).toContainText(/under scope review/i);
    await expect(article).toContainText('hello@akaushik.org');
  });
});
