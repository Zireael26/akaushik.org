import { Header } from '@/components/layout/Header';
import Link from 'next/link';
import { getPortalDal, getWorkspaceResources, getUserDisplayName } from '@/lib/portal-dal';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
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

  const [updatesResult, displayName] = await Promise.all([
    getWorkspaceResources(dal, 'progress_update'),
    getUserDisplayName(principal, principal.context.accountId),
  ]);

  const updates = updatesResult.ok ? updatesResult.value : [];

  const user = {
    name: displayName,
    role: principal.role,
  };

  return (
    <div>
      <Header activeNav="progress" user={user} />

      <section className="px-article" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px var(--wrap-pad)' }}>
        <div className="px-article-crumb">
          <Link href="/overview">&larr; Workspace Overview</Link>
        </div>

        <h1 className="px-article-title">Progress Updates</h1>
        <div className="px-article-dek">
          Narrative, revisioned project updates reflecting verified milestone status.
        </div>

        <div style={{ marginTop: '32px' }}>
          {updates.length > 0 ? (
            updates.map((u) => (
              <div key={u.id} className="px-row is-interactive">
                <div className="px-row-tag is-cobalt">UPDATE</div>
                <div className="px-row-body">
                  <strong>
                    <Link href={`/reader/${u.slug}`}>{u.title}</Link>
                  </strong>
                  {u.excerpt && (
                    <>
                      <br />
                      {u.excerpt}
                    </>
                  )}
                  <span style={{ display: 'block', marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink45)' }}>
                    Updated: {u.updatedAt}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-row is-last">
              <div className="px-row-tag">EMPTY</div>
              <div className="px-row-body" style={{ color: 'var(--ink60)', fontStyle: 'italic' }}>
                No progress updates have been published in this workspace yet.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
