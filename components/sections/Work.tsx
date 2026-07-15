import Link from 'next/link';
import type { ReactNode } from 'react';
import { SectionHeader } from './SectionHeader';
import { Reel, type ReelSlug } from '@/components/work/reels';

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

export function Work() {
  return (
    <section
      className="work"
      id="work"
      data-screen-label="03 Work"
      data-companion-pose="work"
      aria-label="03 Work"
    >
      <SectionHeader
        num="03"
        title="Selected work"
        kicker="Five case studies, ordered by strategic weight. Each is a problem in the client's words, an approach, what shipped, and honest scope on what was and wasn't included."
      />
      <ol className="case-list" role="list">
        {CASE_STUDIES.filter((c) => c.draft !== true).map((c) => (
          <li
            key={c.slug}
            className={`case-item${c.lead ? ' case-item--lead' : ''}`}
            id={`case-${c.slug}`}
          >
            <div className="case-meta">
              <span className="case-index">{c.index}</span>
              <span className="case-tag">{c.tag}</span>
              <span className="case-year">{c.year}</span>
            </div>
            <div className="case-body">
              <h3 className="case-title">{c.title}</h3>
              <p className="case-dek">{c.dek}</p>
              <p className="case-lede">{c.lede}</p>
              <dl className="case-spec">
                {c.spec.map((s) => (
                  <div key={s.term}>
                    <dt>{s.term}</dt>
                    <dd>{s.def}</dd>
                  </div>
                ))}
              </dl>
              <Link className="case-link" href={`/work/${c.slug}`}>
                Read the case study
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
            <div className="case-reel" aria-hidden="true">
              <Reel slug={c.slug} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
