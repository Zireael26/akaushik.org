import { ABOUT_COPY } from '@/lib/about-copy';
import {
  type CaseStudyFrontmatter,
  type WritingFrontmatter,
  getAllPosts,
  getPost,
} from '@/lib/content';
import { SERVICES } from '@/lib/services';

// Served at /llms-full.txt per AGENT_READINESS §4.3: the entire portfolio
// corpus as a single Markdown document so an agent can grab it in one
// request. Route Handler (not a static file) so it stays in sync with the
// MDX sources without a build step. 5-minute edge cache balances freshness
// against traffic; isitagentready.com re-fetches on each scan.
//
// Section wrappers (`<about>`, `<services>`, `<case-study slug=...>`,
// `<post slug=...>`) are pseudo-HTML tags — valid Markdown (inline HTML is
// part of CommonMark) and trivially parseable for agents that want to slice
// the corpus by section.

export const dynamic = 'force-static';
export const revalidate = 300;

function renderAbout(): string {
  return [
    '<about>',
    '',
    `> ${ABOUT_COPY.kicker}`,
    '',
    ABOUT_COPY.lede,
    '',
    ABOUT_COPY.paragraphs.join('\n\n'),
    '',
    ...ABOUT_COPY.meta.map((row) => `- **${row.label}** — ${row.value}`),
    '',
    '</about>',
  ].join('\n');
}

function renderServices(): string {
  const cards = SERVICES.map((s) => {
    const lines = [
      `### ${s.num} · ${s.title} — ${s.duration}`,
      '',
      s.lede,
      '',
      ...s.list.map((row) => `- **${row.label}** — ${row.value}`),
    ];
    return lines.join('\n');
  });
  return [
    '<services>',
    '',
    '## Services',
    '',
    'Three engagement shapes. In / Out / Fit called out explicitly so you can tell whether a conversation is worth starting.',
    '',
    ...cards.map((c) => c + '\n'),
    '</services>',
  ].join('\n');
}

// MDX bodies already lead with `# <title>` + `> <dek>` per AGENT_READINESS
// §4.4. Keep the H1 + blockquote so agents see semantically complete
// documents; the wrapper contributes only the slug + metadata list that the
// body can't carry inline.
function renderCaseStudy(slug: string, fm: CaseStudyFrontmatter, body: string): string {
  const stack = fm.stack?.length ? fm.stack.join(', ') : '—';
  return [
    `<case-study slug="${slug}">`,
    '',
    body.trim(),
    '',
    `- **Role** — ${fm.role}`,
    `- **Year** — ${fm.year}`,
    `- **Stack** — ${stack}`,
    `- **Evidence of** — ${fm.evidenceOf}`,
    `- **Canonical** — https://akaushik.org/work/${slug}`,
    '',
    '</case-study>',
  ].join('\n');
}

function renderWritingPost(slug: string, fm: WritingFrontmatter, body: string): string {
  return [
    `<post slug="${slug}">`,
    '',
    body.trim(),
    '',
    `- **Date** — ${fm.date}`,
    `- **Canonical** — https://akaushik.org/writing/${slug}`,
    '',
    '</post>',
  ].join('\n');
}

// Home-page order from HANDOFF §4.03. Alphabetical slug ordering buries the
// lead case study; agents should read the corpus in the curated order.
const CASE_STUDY_ORDER: ReadonlyArray<string> = [
  'neev',
  'vericite',
  'bluehost-agents',
  'curat-money',
  'clusterbid',
];

function buildCorpus(): string {
  const available = new Set(getAllPosts('case-studies').map((p) => p.slug));
  const caseStudies = CASE_STUDY_ORDER.filter((slug) => available.has(slug))
    .map((slug) => {
      const full = getPost('case-studies', slug);
      if (!full) return null;
      return renderCaseStudy(slug, full.frontmatter, full.content);
    })
    .filter((s): s is string => s !== null);

  const writing = getAllPosts('writing')
    // Newest first by frontmatter.date — matches the home Writing section.
    .slice()
    .sort((a, b) => (b.frontmatter.date ?? '').localeCompare(a.frontmatter.date ?? ''))
    .map((p) => {
      const full = getPost('writing', p.slug);
      if (!full) return null;
      return renderWritingPost(p.slug, full.frontmatter, full.content);
    })
    .filter((s): s is string => s !== null);

  const timestamp = new Date().toISOString();

  return [
    '# Abhishek Kaushik — akaushik.org (full content)',
    '',
    `> Single-file concatenation of all portfolio content. Generated ${timestamp}.`,
    '',
    'This file follows the [llms-full.txt](https://llmstxt.org) convention. Section wrappers (`<about>`, `<services>`, `<case-study>`, `<post>`) let agents slice by section without parsing HTML.',
    '',
    '---',
    '',
    renderAbout(),
    '',
    '---',
    '',
    renderServices(),
    '',
    '---',
    '',
    '# Case studies',
    '',
    caseStudies.join('\n\n---\n\n'),
    '',
    '---',
    '',
    '# Writing',
    '',
    writing.join('\n\n---\n\n'),
    '',
  ].join('\n');
}

export function GET() {
  const body = buildCorpus();
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'X-Robots-Tag': 'index, follow',
    },
  });
}
