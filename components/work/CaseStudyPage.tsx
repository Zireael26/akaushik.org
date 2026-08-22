import Link from 'next/link';
import { MDXRemote } from 'next-mdx-remote/rsc';
import type { Post, CaseStudyFrontmatter } from '@/lib/content';
import { MDX_OPTIONS } from '@/lib/mdx-options';
import { HyperframesLoop } from '@/components/media/hyperframes-loop';
import { RouteField } from '@/components/pixel/RouteField';
import { RuledRow } from '@/components/pixel/RuledRow';
import { Reel, type ReelSlug } from './reels';

export function CaseStudyPage({
  post,
  routeSlug,
  reelSlug,
}: {
  post: Post<'case-studies'>;
  routeSlug: string;
  reelSlug: ReelSlug | null;
}) {
  const fm = post.frontmatter as CaseStudyFrontmatter;
  return (
    <main id="top" className="px-work-detail">
      <RouteField slug={routeSlug} />
      <Link href="/#work" className="px-work-back">
        ← Back to selected work
      </Link>
      <header className="px-work-detail-head">
        <div className="px-work-detail-meta">
          {fm.index ? <span className="px-work-detail-index">{fm.index}</span> : null}
          {fm.tag ? <span className="px-work-detail-tag">{fm.tag}</span> : null}
          {fm.year ? <span className="px-work-detail-year">{fm.year}</span> : null}
        </div>
        <div className="px-work-detail-spec">
          {fm.role ? <RuledRow tag="Role">{fm.role}</RuledRow> : null}
          {fm.stack?.length ? <RuledRow tag="Stack">{fm.stack.join(' · ')}</RuledRow> : null}
          {fm.evidenceOf ? (
            <RuledRow tag="Evidence" last>
              {fm.evidenceOf}
            </RuledRow>
          ) : null}
        </div>
      </header>
      {reelSlug === 'neev' ? (
        <HyperframesLoop kind="work-inline" slug="neev" className="px-work-inline-loop" />
      ) : reelSlug ? (
        <figure className="px-work-detail-reel" aria-hidden="true">
          <Reel slug={reelSlug} variant="card" />
        </figure>
      ) : null}
      <article className="px-work-body">
        <MDXRemote source={post.content} options={MDX_OPTIONS} />
      </article>
    </main>
  );
}
