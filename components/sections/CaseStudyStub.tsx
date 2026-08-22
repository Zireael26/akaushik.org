import Link from 'next/link';
import { CASE_STUDIES } from './Work';
import { Reel, type ReelSlug } from '@/components/work/reels';

/**
 * Fallback rendered by `app/work/[slug]/page.tsx` when no MDX body exists
 * for a known card slug. Today only `bluehost-agents` hits this path — the
 * Bluehost framework write-up is under NDA review and the stub is the
 * permanent surface, not a transitional placeholder.
 */
export function CaseStudyStub({ slug }: { slug: ReelSlug }) {
  const study = CASE_STUDIES.find((c) => c.slug === slug);
  if (!study) {
    return (
      <main id="top" className="work-stub">
        <p className="work-stub-lede">Case study not found.</p>
      </main>
    );
  }

  return (
    <main id="top" className="work-stub">
      <Link href="/#work" className="work-stub-back">
        ← Back to selected work
      </Link>
      <div className="work-stub-meta">
        <span className="case-index">{study.index}</span>
        <span className="case-tag">{study.tag}</span>
        <span className="case-year">{study.year}</span>
      </div>
      <h1 className="work-stub-title">{study.title}</h1>
      <p className="work-stub-dek">{study.dek}</p>
      <p className="work-stub-lede">{study.lede}</p>
      <figure className="work-stub-reel" aria-hidden="true">
        <Reel slug={slug} variant="hero" />
      </figure>
      <dl className="case-spec">
        {study.spec.map((s) => (
          <div key={s.term}>
            <dt>{s.term}</dt>
            <dd>{s.def}</dd>
          </div>
        ))}
      </dl>
      <div className="work-stub-notice">
        Case study available on request. Scope is under client review. The
        home-page card above is the honest headline; email{' '}
        <a href="mailto:hello@akaushik.org">hello@akaushik.org</a> for the
        full story.
      </div>
    </main>
  );
}
