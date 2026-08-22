import type { ReactNode } from 'react';
import type { ReelSlug } from '@/components/work/reels';
import { MatterRow } from '@/components/pixel/RuledRow';
import { SectionHead } from '@/components/pixel/SectionHead';
import { getAllPosts } from '@/lib/content';

type CaseStudy = {
  index: string;
  slug: ReelSlug;
  tag: string;
  year: string;
  title: string;
  dek: string;
  lede: ReactNode;
  spec: ReadonlyArray<{ term: string; def: ReactNode }>;
  lead?: boolean;
  draft?: boolean;
};

// Card data for the /work routes: app/work/page.tsx renders it as the index
// grid, app/work/[slug]/page.tsx reads it for the OG-card fallback, and
// CaseStudyStub renders it for slugs whose MDX body is still a stub. The
// section below no longer reads it — its rows come from the MDX frontmatter,
// which is where the editorial copy actually lives.
export const CASE_STUDIES: ReadonlyArray<CaseStudy> = [
  {
    index: '01',
    slug: 'neev',
    tag: 'Hero case · MSME thesis',
    year: '2026 — now',
    title: 'Neev',
    dek: 'Bringing AI to an industry that still runs on WhatsApp.',
    lede: 'A modular operations platform for Indian textile distributors — built to be boring where boring matters, and quietly smart where it counts.',
    spec: [
      { term: 'Role', def: 'Co-founder & CTO — product, architecture, build' },
      { term: 'Stack', def: 'Next.js · Postgres · multi-tenant monolith' },
      { term: 'Evidence of', def: 'MSME depth · systems & product discipline' },
    ],
    lead: true,
  },
  {
    index: '02',
    slug: 'vericite',
    tag: 'AI systems depth',
    year: '2026 — now',
    title: 'VeriCite',
    dek: 'A retrieval stack an institution can actually trust with its own words.',
    lede: (
      <>
        Multi-tenant institutional RAG, migrating from Fastembed ONNX to Hugging Face TEI for{' '}
        <code>BAAI/bge-reranker-v2-m3</code>. Qdrant as the backbone, Ory for identity.
      </>
    ),
    spec: [
      { term: 'Role', def: 'Co-founder & CTO — retrieval pipeline' },
      { term: 'Stack', def: 'HF TEI · Qdrant · Ory · k8s · Vercel' },
      { term: 'Evidence of', def: 'Institutional AI-systems sophistication' },
    ],
  },
  {
    index: '03',
    slug: 'bluehost-agents',
    tag: 'Production scale',
    year: '2025 — now',
    title: 'Bluehost · agents framework',
    dek: "The foundational platform behind Bluehost's agentic AI products.",
    lede: 'Where AI agents meet web-hosting reality — customer scale, production uptime, and real users with real bills. A major hand in maintaining and continuously improving the platform.',
    spec: [
      { term: 'Role', def: 'Platform engineer · ongoing' },
      { term: 'Stack', def: 'Agent runtime · tool-calling · observability' },
      { term: 'Evidence of', def: 'Operating at scale · team context' },
    ],
  },
  {
    index: '04',
    slug: 'curat-money',
    tag: 'Product breadth',
    year: '2026 — now',
    title: 'curat.money',
    dek: 'A fair-comparison tool for crypto cards, built like a real product.',
    lede: 'Custody checks, provider coverage, multi-environment deploys — the boring-but-important scaffolding most crypto product sites skip.',
    spec: [
      { term: 'Role', def: 'CTO · Tech Lead' },
      { term: 'Stack', def: 'High-throughput data pipeline · K8s · RBAC · CI/CD' },
      { term: 'Evidence of', def: 'Data pipeline to web product' },
    ],
  },
  {
    index: '05',
    slug: 'clusterbid',
    tag: 'UAT platform engineering',
    year: '2026 — UAT',
    title: 'ClusterBid',
    dek: 'From monorepo checks to a real-host k3s UAT, with every mock and boundary named.',
    lede: 'A Go-service and Next.js platform taken through root-level validation, Helm deployment, and a mock-inference metering-to-billing smoke — pre-production proof, not a production or customer outcome.',
    spec: [
      { term: 'Role', def: 'Engineering advisor · process & platform' },
      { term: 'Stack', def: 'Go · Next.js · TypeScript · Helm · k3s' },
      { term: 'Evidence of', def: 'Pre-production delivery · platform discipline' },
    ],
  },
];

/** Tag colour rotates across the stack, as in the matters list it ports from. */
const TAG_TONES = ['cobalt', 'amber', 'red', 'ink'] as const;

function tagTone(i: number): (typeof TAG_TONES)[number] {
  switch (i % 4) {
    case 0:
      return 'cobalt';
    case 1:
      return 'amber';
    case 2:
      return 'red';
    default:
      return 'ink';
  }
}

/**
 * Selected work — the matter-row stack.
 *
 * Rows are the case-study frontmatter, ordered by its `index` rather than by
 * filename, because `index` is the strategic ordering the case studies were
 * written against and getPostSlugs sorts alphabetically.
 *
 * The heading is short, so it carries no `headingTarget`: a lime cursor arrow
 * pointing at two words reads as noise rather than emphasis.
 */
export function Work() {
  const studies = getAllPosts('case-studies').sort((a, b) =>
    a.frontmatter.index.localeCompare(b.frontmatter.index),
  );

  return (
    <section
      className="px-section px-work"
      id="work"
      data-screen-label="03 Work"
      aria-labelledby="work-head"
    >
      <SectionHead heading="Selected work." label="2025 — present" id="work-head" />
      {studies.map((study, i) => (
        <MatterRow
          key={study.slug}
          title={study.frontmatter.title}
          tag={study.frontmatter.tag}
          tagTone={tagTone(i)}
          href={`/work/${study.slug}`}
        />
      ))}
    </section>
  );
}
