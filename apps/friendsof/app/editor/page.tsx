import { Header } from '@/components/layout/Header';
import { EditorForm } from '@/components/editor/EditorForm';
import { getPortalDal } from '@/lib/portal-dal';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function NewEditorPage() {
  const dal = await getPortalDal();
  if (!dal) {
    redirect('/');
  }

  let principal;
  try {
    // Authorize resource creation capability
    principal = await dal.principal('resource.create');
  } catch {
    redirect('/overview');
  }

  const user = {
    name: principal.context.accountId,
    role: principal.role,
  };

  return (
    <div>
      <Header activeNav="editor" user={user} />
      <EditorForm workspaceId={principal.workspaceId} />
    </div>
  );
}
