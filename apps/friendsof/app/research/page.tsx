import { Header } from '@/components/layout/Header';
import Link from 'next/link';
import { getPortalDal, getWorkspaceResources, getUserDisplayName } from '@/lib/portal-dal';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ResearchPage() {
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

  const [researchResult, displayName] = await Promise.all([
    getWorkspaceResources(dal, 'research'),
    getUserDisplayName(principal, principal.context.accountId),
  ]);

  const researchItems = researchResult.ok ? researchResult.value : [];

  const user = {
    name: displayName,
    role: principal.role,
  };

  return (
    <div>
      <Header activeNav="research" user={user} />

      <section className="px-article" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px var(--wrap-pad)' }}>
        <div className="px-article-crumb">
          <Link href="/overview">&larr; Workspace Overview</Link>
        </div>

        <h1 className="px-article-title">Research &amp; Field Studies</h1>
        <div className="px-article-dek">
          Operational studies, supply-chain models, and external technical citations.
        </div>

        <div style={{ marginTop: '32px' }}>
          {researchItems.length > 0 ? (
            researchItems.map((item) => (
              <div key={item.id} className="px-row is-interactive">
                <div className="px-row-tag is-cobalt">RESEARCH</div>
                <div className="px-row-body">
                  <strong>
                    <Link href={`/reader/${item.slug}`}>{item.title}</Link>
                  </strong>
                  {item.excerpt && (
                    <>
                      <br />
                      {item.excerpt}
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-row is-last">
              <div className="px-row-tag">EMPTY</div>
              <div className="px-row-body" style={{ color: 'var(--ink60)', fontStyle: 'italic' }}>
                No research records or field studies are currently shared in this workspace.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
