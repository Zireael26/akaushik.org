import { formatHeadingAnchor } from './markdown';
import type { LinkResolverResult } from './markdown';

/** Server-populated from resources/assets already authorized by the DAL. */
export interface AuthorizedSourceLinkEntry {
  kind: 'resource' | 'asset';
  id: string;
  slug: string;
  title: string;
  sourceRef: string | null;
}

/**
 * Resolve imported logical source paths without exposing sourceRef in the result.
 * Missing, ambiguous, traversal, hidden (absent from catalog), and unsafe targets
 * all collapse to null.
 */
export function createSourceAwareLinkResolver(
  entries: readonly AuthorizedSourceLinkEntry[],
  currentSourceRef: string | null | undefined,
): (target: string) => LinkResolverResult | null {
  const aliases = new Map<string, AuthorizedSourceLinkEntry | null>();
  const sourcePaths = new Map<string, AuthorizedSourceLinkEntry | null>();
  const assetBasenames = new Map<string, AuthorizedSourceLinkEntry | null>();

  for (const entry of entries) {
    addUnique(aliases, lookupKey(entry.id), entry);
    addUnique(aliases, lookupKey(entry.slug), entry);
    addUnique(aliases, lookupKey(entry.title), entry);

    const sourcePath = normalizeLogicalPath(entry.sourceRef ?? '');
    if (sourcePath) {
      addUnique(sourcePaths, lookupKey(sourcePath), entry);
      if (/\.md$/iu.test(sourcePath)) addUnique(sourcePaths, lookupKey(sourcePath.slice(0, -3)), entry);
      if (entry.kind === 'asset') {
        const basename = sourcePath.slice(sourcePath.lastIndexOf('/') + 1);
        addUnique(assetBasenames, lookupKey(basename), entry);
      }
    }
  }

  const currentPath = normalizeLogicalPath(currentSourceRef ?? '');
  const currentDirectory = currentPath?.includes('/')
    ? currentPath.slice(0, currentPath.lastIndexOf('/'))
    : '';

  return (target: string): LinkResolverResult | null => {
    const parsed = parseTarget(target);
    if (!parsed) return null;

    let match = unique(aliases, lookupKey(parsed.path));
    if (!match) {
      const directPath = normalizeLogicalPath(parsed.path);
      if (directPath) match = unique(sourcePaths, lookupKey(directPath));
    }
    const relativePath = currentPath
      ? normalizeLogicalPath(currentDirectory ? `${currentDirectory}/${parsed.path}` : parsed.path)
      : null;
    if (!match && relativePath) match = unique(sourcePaths, lookupKey(relativePath));

    // Some reviewed imports preserve a relocated binary's true provenance path
    // while source Markdown points at its former sibling directory. Permit only
    // a unique, authorized asset basename within the same source tree. Never
    // guess a resource target or cross the current document's source directory.
    if (!match && currentDirectory && relativePath && parsed.path.includes('/')
      && isWithin(currentDirectory, relativePath)) {
      const candidate = unique(assetBasenames, lookupKey(parsed.path.slice(parsed.path.lastIndexOf('/') + 1)));
      const candidatePath = normalizeLogicalPath(candidate?.sourceRef ?? '');
      if (candidate?.kind === 'asset' && candidatePath && isWithin(currentDirectory, candidatePath)) {
        match = candidate;
      }
    }
    if (!match) return null;

    const baseHref = match.kind === 'asset' ? `/api/media/${match.id}` : `/reader/${match.slug}`;
    const href = parsed.fragment ? `${baseHref}#${formatHeadingAnchor(parsed.fragment)}` : baseHref;
    return { id: match.id, slug: match.slug, href, title: match.title, isAuthorized: true };
  };
}

function parseTarget(target: string): { path: string; fragment: string | null } | null {
  const value = target.trim();
  if (!value || value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  if (/^[a-z][a-z0-9+.-]*:/iu.test(value)) return null;
  const hashIndex = value.indexOf('#');
  const beforeHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const fragment = hashIndex >= 0 ? value.slice(hashIndex + 1) : null;
  const queryIndex = beforeHash.indexOf('?');
  const path = (queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash).trim();
  if (!path || (fragment !== null && !safeDecode(fragment))) return null;
  return { path, fragment };
}

function normalizeLogicalPath(value: string): string | null {
  const path = value.trim();
  if (!path || path.startsWith('/') || path.includes('\\') || /[\u0000-\u001f\u007f]/u.test(path)) return null;
  const output: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (output.length === 0) return null;
      output.pop();
      continue;
    }
    output.push(segment);
  }
  return output.length ? output.join('/') : null;
}

function isWithin(directory: string, path: string): boolean {
  return path.startsWith(`${directory}/`);
}

function safeDecode(value: string): boolean {
  try { decodeURIComponent(value); return true; } catch { return false; }
}
function lookupKey(value: string): string { return value.normalize('NFKC').trim().toLocaleLowerCase(); }
function unique(map: Map<string, AuthorizedSourceLinkEntry | null>, key: string): AuthorizedSourceLinkEntry | null {
  return map.get(key) ?? null;
}
function addUnique(
  map: Map<string, AuthorizedSourceLinkEntry | null>,
  key: string,
  entry: AuthorizedSourceLinkEntry,
): void {
  if (!key) return;
  const existing = map.get(key);
  if (existing === undefined) map.set(key, entry);
  else if (existing?.id !== entry.id) map.set(key, null);
}
