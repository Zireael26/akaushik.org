import { Header } from '@/components/layout/Header';
import Link from 'next/link';
import { getPortalDal, getWorkspaceResources, getUserDisplayName } from '@/lib/portal-dal';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DiscussionsPage() {
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

  const [questionsResult, displayName] = await Promise.all([
    getWorkspaceResources(dal, 'question'),
    getUserDisplayName(principal, principal.context.accountId),
  ]);

  const questions = questionsResult.ok ? questionsResult.value : [];

  const user = {
    name: displayName,
    role: principal.role,
  };

  return (
    <div>
      <Header activeNav="discussions" user={user} />

      <section className="px-article" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px var(--wrap-pad)' }}>
        <div className="px-article-crumb">
          <Link href="/overview">&larr; Workspace Overview</Link>
        </div>

        <h1 className="px-article-title">Inquiries &amp; Decisions</h1>
        <div className="px-article-dek">
          Questions awaiting guidance, discussion threads, and recorded decisions.
        </div>

        <div style={{ marginTop: '32px' }}>
          {questions.length > 0 ? (
            questions.map((q, idx) => (
              <div key={q.id} style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--px-cobalt-ink)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Question &middot; {String(idx + 1).padStart(2, '0')}
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 500, margin: '0 0 8px' }}>
                  <Link href={`/reader/${q.slug}`}>{q.title}</Link>
                </h2>
                {q.excerpt && (
                  <p style={{ fontSize: '14.5px', color: 'var(--ink70)', margin: '0 0 16px' }}>
                    {q.excerpt}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="px-row is-last">
              <div className="px-row-tag">EMPTY</div>
              <div className="px-row-body" style={{ color: 'var(--ink60)', fontStyle: 'italic' }}>
                No focus questions or discussion topics are currently awaiting input.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
