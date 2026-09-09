import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { getPortalDal, getUserDisplayName } from '@/lib/portal-dal';
import { PortalDataError } from '@/lib/db';
import type { SearchHit } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const dal = await getPortalDal();
  let principal;
  try {
    principal = await dal.principal('resource.read');
  } catch (error) {
    if (error instanceof PortalDataError && error.code === 'UNAUTHENTICATED') redirect('/');
    throw error;
  }

  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] ?? '' : q ?? '').trim();
  const displayName = await getUserDisplayName(principal, principal.context.accountId);
  let hits: SearchHit[] = [];
  let errorMessage: string | null = null;
  if (query.length > 200) {
    errorMessage = 'Use a search phrase of 200 characters or fewer.';
  } else if (query) {
    const result = await dal.search(query);
    if (result.ok) hits = result.value;
    else errorMessage = 'Search is temporarily unavailable. Please try again.';
  }

  return (
    <div>
      <Header activeNav="search" user={{ name: displayName, role: principal.role }} />
      <section className="px-article">
        <div className="px-article-crumb"><Link href="/overview">← Workspace Overview</Link></div>
        <h1 className="px-article-title">Search workspace</h1>
        <p className="px-article-dek">Find meetings, transcripts, research, and working documents.</p>

        <form action="/search" method="get" role="search" style={{ margin: '28px 0 32px' }}>
          <label htmlFor="workspace-search" style={{ display: 'block', marginBottom: '8px' }}>Search documents</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <input
              id="workspace-search"
              type="search"
              name="q"
              defaultValue={query}
              maxLength={200}
              placeholder="Notes, transcripts, research topics…"
              style={{ flex: '1 1 240px', minWidth: 0, minHeight: '48px', padding: '12px 16px', fontSize: '16px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
            <button type="submit" style={{ minHeight: '48px', padding: '12px 24px', background: 'var(--px-cobalt)', color: 'white', border: 0, fontSize: '16px', cursor: 'pointer' }}>Search</button>
          </div>
        </form>

        {errorMessage ? <p role="alert">{errorMessage}</p> : query ? (
          <div aria-label="Search results">
            {hits.length > 0 ? (
              <>
                <p style={{ color: 'var(--ink60)', marginBottom: '24px' }}>Showing {hits.length} matching {hits.length === 1 ? 'document' : 'documents'}.</p>
                {hits.map((hit) => (
                  <article key={`${hit.resource.id}:${hit.resource.headRevisionId}`} style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid var(--line)' }}>
                    <h2 style={{ fontSize: '22px', margin: '0 0 8px', lineHeight: 1.35 }}>
                      <Link href={`/reader/${hit.resource.slug}`}>{hit.resource.title}</Link>
                    </h2>
                    <p style={{ margin: 0, color: 'var(--ink70)', fontSize: '16px', lineHeight: 1.65 }}>{hit.snippet.replace(/<\/?mark>/g, '')}</p>
                  </article>
                ))}
              </>
            ) : <p>No matching documents found for “{query}”. Try a different word or phrase.</p>}
          </div>
        ) : <p style={{ color: 'var(--ink60)' }}>Enter a keyword to search the documents available to you.</p>}
      </section>
    </div>
  );
}
