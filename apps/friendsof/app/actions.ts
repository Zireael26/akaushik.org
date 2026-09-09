'use server';

import { getPortalDal } from '@/lib/portal-dal';
import type { CreateResourceInput, SaveRevisionInput } from '@/lib/contracts';
import { revalidatePath } from 'next/cache';

export async function createCommentAction(
  resourceId: string,
  revisionId: string,
  bodyMarkdown: string,
) {
  const dal = await getPortalDal();
  if (!dal) {
    return { ok: false, error: 'Database or authentication service unavailable' };
  }

  const res = await dal.createComment({
    resourceId,
    revisionId,
    bodyMarkdown,
  });

  if (!res.ok) {
    return { ok: false, error: res.message };
  }

  revalidatePath('/reader/[slug]', 'page');
  return { ok: true, comment: res.value };
}

export async function saveRevisionAction(input: SaveRevisionInput) {
  const dal = await getPortalDal();
  if (!dal) {
    return { ok: false, error: 'Database or authentication service unavailable' };
  }

  const res = await dal.saveRevision(input);
  if (!res.ok) {
    const isConflict = res.code === 'CONFLICT';
    return {
      ok: false,
      conflict: isConflict,
      error: isConflict
        ? 'The document was updated in another session. Please reload to see the latest revision.'
        : res.message,
    };
  }

  revalidatePath('/reader/[slug]', 'page');
  revalidatePath('/overview');
  return { ok: true, resource: res.value };
}

export async function createResourceAction(
  input: CreateResourceInput,
  options?: { shareWithWorkspace?: boolean },
) {
  const dal = await getPortalDal();
  if (!dal) {
    return { ok: false, error: 'Database or authentication service unavailable' };
  }

  const res = await dal.createResource(input);
  if (!res.ok) {
    return { ok: false, error: res.message };
  }

  const resource = res.value;

  // If share was requested, create actual share release & grant in D1
  if (options?.shareWithWorkspace) {
    const shareRes = await dal.share({
      resourceId: resource.id,
      revisionId: resource.headRevisionId,
      audienceType: 'role',
      audienceId: 'commenter',
      assetIds: [],
    });

    if (!shareRes.ok) {
      return {
        ok: true,
        resource,
        shareWarning: `Saved as draft, but share release failed: ${shareRes.message}`,
      };
    }
  }

  revalidatePath('/overview');
  return { ok: true, resource };
}

export async function shareResourceAction(
  resourceId: string,
  revisionId: string,
  audienceType: 'member' | 'role' = 'role',
  audienceId: string = 'commenter',
) {
  const dal = await getPortalDal();
  if (!dal) {
    return { ok: false, error: 'Database or authentication service unavailable' };
  }

  const res = await dal.share({
    resourceId,
    revisionId,
    audienceType,
    audienceId,
    assetIds: [],
  });

  if (!res.ok) {
    return { ok: false, error: res.message };
  }

  revalidatePath('/reader/[slug]', 'page');
  revalidatePath('/overview');
  return { ok: true, release: res.value };
}

export async function revokeShareAction(releaseId: string) {
  const dal = await getPortalDal();
  if (!dal) {
    return { ok: false, error: 'Database or authentication service unavailable' };
  }

  const res = await dal.revokeShare(releaseId);
  if (!res.ok) {
    return { ok: false, error: res.message };
  }

  revalidatePath('/reader/[slug]', 'page');
  revalidatePath('/overview');
  return { ok: true };
}
