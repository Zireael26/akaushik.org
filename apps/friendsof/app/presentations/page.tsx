import { Header } from '@/components/layout/Header';
import Link from 'next/link';
import { getPortalDal, getWorkspaceResources, getUserDisplayName } from '@/lib/portal-dal';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PresentationsPage() {
  const dal = await getPortalDal();
  if (!dal) {
    redirect('/');
  }

  let principal;
  try {
    principal = await dal.principal('resource.read');
  } catch {
    redirect('/');
  }

  const [presentationsResult, displayName] = await Promise.all([
    getWorkspaceResources(dal, 'presentation'),
    getUserDisplayName(principal, principal.context.accountId),
  ]);

  const presentations = presentationsResult.ok ? presentationsResult.value : [];

  const user = {
    name: displayName,
    role: principal.role,
  };

  return (
    <div>
      <Header activeNav="presentations" user={user} />

      <section className="px-article" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px var(--wrap-pad)' }}>
        <div className="px-article-crumb">
          <Link href="/overview">&larr; Workspace Overview</Link>
        </div>

        <h1 className="px-article-title">Presentations &amp; Decks</h1>
        <div className="px-article-dek">
          Slide decks and visual packs prepared for meetings with authorized downloads.
        </div>

        <div style={{ marginTop: '32px' }}>
          {presentations.length > 0 ? (
            presentations.map((p) => (
              <div key={p.id} className="px-row is-interactive">
                <div className="px-row-tag is-cobalt">DECK</div>
                <div className="px-row-body">
                  <strong>
                    <Link href={`/reader/${p.slug}`}>{p.title}</Link>
                  </strong>
                  {p.excerpt && (
                    <>
                      <br />
                      {p.excerpt}
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-row is-last">
              <div className="px-row-tag">EMPTY</div>
              <div className="px-row-body" style={{ color: 'var(--ink60)', fontStyle: 'italic' }}>
                No presentation decks are currently shared in this workspace.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
