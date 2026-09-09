import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import type {
  AuthorizedPrincipal,
  Backlink,
  CommentRecord,
  DataResult,
  QuestionRecord,
  ResourceDetail,
  ResourceKind,
  ResourceSummary,
  SearchHit,
  UnreadItem,
  WorkspaceSummary,
  AssetSummary,
} from './contracts';
import {
  first,
  type D1Database,
  PortalDataError,
} from './db';
import { createPortalDal, type PortalDal } from './dal';
import { getPortalAuth, getRequestContextFromHeaders } from './auth';
import { isAllowedHost } from './portal-security';
import type { LinkResolverResult, AssetResolverResult } from './markdown';
import {
  createSourceAwareLinkResolver,
  type AuthorizedSourceLinkEntry,
} from './source-link-resolver';

async function getBindings(): Promise<Env> {
  try {
    const { env } = await getCloudflareContext();
    return env as unknown as Env;
  } catch (err) {
    throw new PortalDataError(
      'UNAVAILABLE',
      `Cloudflare Worker runtime context unavailable: ${err instanceof Error ? err.message : String(err)}`,
      true,
    );
  }
}

/**
 * Instantiates Sol's PortalDal using createPortalDal with live D1 and verified auth context.
 * Strictly fails closed if configuration, databases, or secrets are missing.
 */
export async function getPortalDal(): Promise<PortalDal> {
  const env = await getBindings();

  if (!env.CONTENT_DB) {
    throw new PortalDataError('UNAVAILABLE', 'Database binding CONTENT_DB is missing from environment', false);
  }
  if (!env.AUTH_DB) {
    throw new PortalDataError('UNAVAILABLE', 'Database binding AUTH_DB is missing from environment', false);
  }

  // Strictly fail closed if authentication secret is missing; no hardcoded or process.env fallback allowed
  const baSecret = (env as unknown as Record<string, string | undefined>).BA_SECRET;
  if (!baSecret || typeof baSecret !== 'string' || baSecret.trim().length === 0) {
    throw new PortalDataError('UNAVAILABLE', 'Authentication secret BA_SECRET is unconfigured (fail-closed)', false);
  }

  // Canonical host must come from verified environment configuration; never fallback to request headers
  const canonicalHost = env.CANONICAL_HOST;
  if (!canonicalHost || typeof canonicalHost !== 'string' || canonicalHost.trim().length === 0) {
    throw new PortalDataError('UNAVAILABLE', 'Configuration variable CANONICAL_HOST is unconfigured (fail-closed)', false);
  }

  const isLocalDev = env.ENVIRONMENT !== 'production';
  if (!isAllowedHost(canonicalHost, { isLocalDev, isQualification: env.ENVIRONMENT === 'qualification' })) {
    throw new PortalDataError('UNAUTHENTICATED', 'Canonical host is unauthorized for portal access', false);
  }

  const auth = await getPortalAuth({
    AUTH_DB: env.AUTH_DB,
    BA_SECRET: baSecret,
    canonicalHost,
  });

  return createPortalDal({
    db: env.CONTENT_DB as unknown as D1Database,
    getRequestContext: () => getRequestContextFromHeaders(auth),
  });
}

/**
 * Resolves current authenticated principal from request headers and D1.
 * Returns null ONLY when user is genuinely unauthenticated (no session token).
 */
export async function getCurrentPrincipal(): Promise<AuthorizedPrincipal | null> {
  const dal = await getPortalDal();

  try {
    return await dal.principal();
  } catch (error) {
    if (error instanceof PortalDataError && error.code === 'UNAUTHENTICATED') {
      return null;
    }
    throw error;
  }
}

/**
 * Resolves user display name scoped to active membership in principal's workspace (M3).
 */
export async function getUserDisplayName(
  principal: AuthorizedPrincipal,
  accountId: string,
): Promise<string> {
  const env = await getBindings();
  const db = env.CONTENT_DB as unknown as D1Database;

  // Verify target account is an active member in the caller's authorized workspace
  const member = await first<{ id: string }>(
    db,
    `SELECT id FROM memberships WHERE workspace_id = ?1 AND account_id = ?2 AND status = 'active' LIMIT 1`,
    principal.workspaceId,
    accountId,
  );
  if (!member) return 'Member';

  if (!env.AUTH_DB) return accountId;
  const authDb = env.AUTH_DB as unknown as D1Database;
  const user = await first<{ name?: string | null; username?: string | null }>(
    authDb,
    `SELECT name, username FROM user WHERE id = ?1 LIMIT 1`,
    accountId,
  );
  return user?.name || user?.username || accountId;
}

/**
 * Fetches active workspace summary for the current principal.
 */
export async function getWorkspaceSummary(
  principal: AuthorizedPrincipal,
): Promise<WorkspaceSummary | null> {
  const env = await getBindings();
  const db = env.CONTENT_DB as unknown as D1Database;

  const row = await first<{ id: string; slug: string; name: string }>(
    db,
    `SELECT id, slug, name FROM workspaces WHERE id = ?1 AND status = 'active' LIMIT 1`,
    principal.workspaceId,
  );
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    role: principal.role,
  };
}

/**
 * Fetches all authorized resources in workspace, optionally filtered by kind.
 */
export async function getWorkspaceResources(
  dal: PortalDal,
  kind?: ResourceKind,
): Promise<DataResult<ResourceSummary[]>> {
  return dal.listResources(kind ? { kind } : {});
}

/**
 * Fetches unread items and assigned pending questions for the current member.
 */
export async function getUnreadItems(dal: PortalDal): Promise<DataResult<UnreadItem[]>> {
  return dal.unread();
}

/**
 * Extended ResourceDetail type with resolved target slugs for links.
 */
export interface ResolvedResourceDetail extends ResourceDetail {
  resolvedLinks: Array<{
    targetResourceId: string;
    targetSlug: string;
    targetTitle: string;
    label: string | null;
  }>;
}

/**
 * Fetches authorized resource detail by slug.
 * Targets are authorized individually through dal.getResource() to prevent leaking owner-only metadata.
 */
export async function getResourceBySlug(
  dal: PortalDal,
  slug: string,
): Promise<DataResult<ResolvedResourceDetail>> {
  return dal.result(async () => {
    const principal = await dal.principal('resource.read');
    const row = await first<{ id: string }>(
      dal.db,
      `SELECT id FROM resources WHERE workspace_id = ?1 AND slug = ?2 LIMIT 1`,
      principal.workspaceId,
      slug,
    );
    if (!row) {
      throw new PortalDataError('NOT_FOUND', 'Resource not found');
    }
    const detail = await dal.getResource(row.id);
    if (!detail.ok) {
      throw new PortalDataError(detail.code, detail.message, detail.retryable);
    }

    // Authorize each link target individually; owner-only or unshared targets are omitted
    const resolvedLinks: Array<{
      targetResourceId: string;
      targetSlug: string;
      targetTitle: string;
      label: string | null;
    }> = [];

    for (const link of detail.value.links) {
      if (!link.targetResourceId) continue;
      const targetRes = await dal.getResource(link.targetResourceId);
      if (targetRes.ok) {
        resolvedLinks.push({
          targetResourceId: link.targetResourceId,
          targetSlug: targetRes.value.slug ?? link.targetResourceId,
          targetTitle: targetRes.value.title ?? 'Linked Resource',
          label: link.label ?? null,
        });
      }
    }

    return {
      ...detail.value,
      resolvedLinks,
    };
  });
}

/**
 * Fetches comment records for a resource using dal.listComments().
 */
export async function getResourceComments(
  dal: PortalDal,
  resourceId: string,
  revisionId?: string,
): Promise<CommentRecord[]> {
  const res = await dal.listComments(resourceId, revisionId);
  return res.ok ? res.value : [];
}

/**
 * Builds authorized link & asset resolvers for markdown parsing.
 * Assets are strictly precomputed from the request-authorized server catalog.
 */
export function buildMarkdownResolvers(
  authorizedEntries: AuthorizedSourceLinkEntry[],
  authorizedAssets: AssetSummary[],
  currentSourceRef?: string | null,
): {
  resolveLink: (target: string) => LinkResolverResult | null;
  resolveAsset: (assetId: string) => AssetResolverResult | null;
} {
  const resolveAuthorizedSourceLink = createSourceAwareLinkResolver(authorizedEntries, currentSourceRef);
  const authorizedAssetIds = new Set(
    authorizedEntries.filter((entry) => entry.kind === 'asset').map((entry) => entry.id),
  );
  for (const asset of authorizedAssets) authorizedAssetIds.add(asset.id);

  return {
    resolveLink: (target: string): LinkResolverResult | null => resolveAuthorizedSourceLink(target),
    resolveAsset: (assetId: string): AssetResolverResult | null => {
      if (!authorizedAssetIds.has(assetId)) return null;
      return { id: assetId, href: `/api/media/${assetId}`, isAuthorized: true };
    },
  };
}

/**
 * Fetches questions for a resource.
 */
export async function getResourceQuestions(
  dal: PortalDal,
  resourceId: string,
): Promise<DataResult<QuestionRecord[]>> {
  return dal.questions(resourceId);
}

/**
 * Fetches backlinks for a resource with authorized source resolution.
 */
export async function getBacklinks(
  dal: PortalDal,
  resourceId: string,
): Promise<DataResult<Array<Backlink & { sourceSlug: string }>>> {
  return dal.result(async () => {
    const rawBacklinks = await dal.backlinks(resourceId);
    if (!rawBacklinks.ok) throw new PortalDataError(rawBacklinks.code, rawBacklinks.message, rawBacklinks.retryable);

    const output: Array<Backlink & { sourceSlug: string }> = [];
    for (const b of rawBacklinks.value) {
      const sourceRes = await dal.getResource(b.sourceResourceId);
      if (sourceRes.ok) {
        output.push({
          ...b,
          sourceSlug: sourceRes.value.slug,
        });
      }
    }
    return output;
  });
}

/**
 * Searches authorized resources in workspace using D1 FTS5.
 */
export async function searchResources(
  dal: PortalDal,
  query: string,
): Promise<DataResult<SearchHit[]>> {
  return dal.search(query);
}
