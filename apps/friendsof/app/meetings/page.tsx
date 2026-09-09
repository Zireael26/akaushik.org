import { Header } from '@/components/layout/Header';
import Link from 'next/link';
import { getPortalDal, getWorkspaceResources, getUserDisplayName } from '@/lib/portal-dal';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MeetingsPage() {
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

  const [meetingsResult, displayName] = await Promise.all([
    getWorkspaceResources(dal, 'meeting'),
    getUserDisplayName(principal, principal.context.accountId),
  ]);

  const meetings = meetingsResult.ok ? meetingsResult.value : [];

  const user = {
    name: displayName,
    role: principal.role,
  };

  return (
    <div>
      <Header activeNav="meetings" user={user} />

      <section className="px-article" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px var(--wrap-pad)' }}>
        <div className="px-article-crumb">
          <Link href="/overview">&larr; Workspace Overview</Link>
        </div>

        <h1 className="px-article-title">Meeting Records &amp; Timeline</h1>
        <div className="px-article-dek">
          Chronological sessions, meeting packs, transcripts, and discussions.
        </div>

        <div style={{ marginTop: '32px' }}>
          {meetings.length > 0 ? (
            meetings.map((m) => (
              <div key={m.id} className="px-row is-interactive">
                <div className="px-row-tag is-cobalt">{m.lifecycle}</div>
                <div className="px-row-body">
                  <strong>
                    <Link href={`/meetings/${m.slug}`}>{m.title}</Link>
                  </strong>
                  {m.excerpt && (
                    <>
                      <br />
                      {m.excerpt}
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-row is-last">
              <div className="px-row-tag">EMPTY</div>
              <div className="px-row-body" style={{ color: 'var(--ink60)', fontStyle: 'italic' }}>
                No scheduled or recorded meetings are currently available in this workspace.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
