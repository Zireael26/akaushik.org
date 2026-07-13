import { notFound } from 'next/navigation';
import { getAllPosts, getPost, isDraftHidden } from '@/lib/content';

// Pattern B (suffix route) for AGENT_READINESS §4.1 content negotiation.
// Externally reachable as `/work/<slug>.md` via the middleware rewrite;
// this handler lives at the canonical internal path `/work/<slug>/md`.
//
// The MDX body already leads with `# <title>` + `> <dek>` per §4.4, so the
// handler appends only the frontmatter metadata list + canonical URL.
// Same shape as `renderCaseStudy` in `/llms-full.txt` — if either drifts,
// fix both.

export const dynamic = 'force-static';
export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts('case-studies').map((post) => ({ slug: post.slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const post = getPost('case-studies', slug);
  if (!post) notFound();
  if (isDraftHidden(post.frontmatter)) notFound();

  const fm = post.frontmatter;
  const stack = fm.stack?.length ? fm.stack.join(', ') : '—';
  const body = [
    post.content.trim(),
    '',
    '---',
    '',
    `- **Role** — ${fm.role}`,
    `- **Year** — ${fm.year}`,
    `- **Stack** — ${stack}`,
    `- **Evidence of** — ${fm.evidenceOf}`,
    `- **Canonical** — https://akaushik.org/work/${slug}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'X-Robots-Tag': 'index, follow',
      'Link': `<https://akaushik.org/work/${slug}>; rel="canonical"`,
    },
  });
}
