import { Header } from '@/components/layout/Header';
import { EditorForm } from '@/components/editor/EditorForm';
import { getPortalDal } from '@/lib/portal-dal';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dal = await getPortalDal();
  if (!dal) {
    redirect('/');
  }

  let principal;
  try {
    // Authorize resource edit capability
    principal = await dal.principal('resource.edit');
  } catch {
    redirect('/overview');
  }

  const resourceRes = await dal.getResource(id);
  if (!resourceRes.ok) {
    notFound();
  }

  const user = {
    name: principal.context.accountId,
    role: principal.role,
  };

  return (
    <div>
      <Header activeNav="editor" user={user} />
      <EditorForm resource={resourceRes.value} workspaceId={principal.workspaceId} />
    </div>
  );
}
