import type { Metadata } from 'next';
import Link from 'next/link';
import { CASE_STUDIES } from '@/components/sections/Work';
import { canonical } from '@/lib/canonical';

const DESCRIPTION =
  'Five case studies — Neev, VeriCite, Bluehost agents framework, curat.money, and ClusterBid — ordered by strategic weight.';

export const metadata: Metadata = {
  title: 'Selected work',
  description: DESCRIPTION,
  alternates: { canonical: '/work' },
  openGraph: {
    url: canonical('/work'),
    type: 'website',
    siteName: 'akaushik.org',
    title: 'Selected work',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@abhi2601k',
    title: 'Selected work',
    description: DESCRIPTION,
  },
};

export default function WorkIndex() {
  return (
    <main id="top" className="work-index">
      <div className="work-index-inner">
        <Link href="/" className="work-stub-back">
          ← Back to home
        </Link>
        <h1 className="work-index-title">Selected work</h1>
        <p className="work-index-lede">
          Each case study is a problem in the client&apos;s words, an approach,
          what shipped, and honest scope on what was and wasn&apos;t included.
        </p>
        <ol className="work-index-list" role="list">
          {CASE_STUDIES.filter((c) => c.draft !== true).map((c) => (
            <li key={c.slug} className="work-index-item">
              <span className="case-index">{c.index}</span>
              <div className="work-index-body">
                <Link href={`/work/${c.slug}`} className="work-index-link">
                  <h2 className="work-index-item-title">{c.title}</h2>
                  <p className="work-index-item-dek">{c.dek}</p>
                </Link>
                <p className="work-index-item-lede">{c.lede}</p>
                <dl className="work-index-item-spec">
                  {c.spec.map((s) => (
                    <div key={s.term}>
                      <dt>{s.term}</dt>
                      <dd>{s.def}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <span className="case-year">{c.year}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
