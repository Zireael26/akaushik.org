import { createElement } from 'react';
import Link from 'next/link';
import type { Post, CaseStudyFrontmatter } from '@/lib/content';
import { getMdxModule } from '@/lib/mdx/generated';
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
        <MdxBody slug={post.slug} />
      </article>
    </main>
  );
}

/**
 * The compiled body for this case study.
 *
 * MDX is compiled during the build (`scripts/build-mdx-modules.ts`) rather
 * than per request: Cloudflare Workers refuse both halves of runtime
 * compilation — `new Function` and instantiating Shiki's WebAssembly grammar
 * engine — so `next-mdx-remote` cannot run there at all.
 *
 * A missing module means a slug reached this component without a compiled
 * body, which the route's own `notFound()` should have caught. Render nothing
 * rather than throw: the header, spec rows and media above are still the
 * correct page.
 */
function MdxBody({ slug }: { slug: string }) {
  // `createElement` rather than `<MDXContent />`: the registry is a
  // module-scope constant, so the reference is stable across renders, but the
  // capitalised-local-from-a-call shape reads to react-hooks/static-components
  // as a component being minted during render. This says the same thing
  // without the false positive.
  const mdx = getMdxModule('case-studies', slug);
  return mdx ? createElement(mdx) : null;
}
