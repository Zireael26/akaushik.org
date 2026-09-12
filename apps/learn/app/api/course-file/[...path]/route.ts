/**
 * Gated delivery of course files (labs, notebooks, templates, atlases, PDFs).
 *
 * Files live in R2 rather than in the Worker bundle or `public/`. `public/` was
 * not an option at all: Cloudflare serves matching static assets before the
 * Worker runs, so anything placed there would be downloadable by anyone who
 * guessed the path, which is the one thing this app exists to prevent.
 *
 * Keys in the bucket are the course-relative paths, uploaded by
 * scripts/sync-course-assets.mjs.
 */
import { NextResponse } from 'next/server';
import { currentReader, learnEnv } from '@/lib/session';
import { DOWNLOADABLE } from '@/lib/course';
import { SANDBOXED_DOCUMENT_HEADER } from '@/lib/learn-security';

export const dynamic = 'force-dynamic';

interface R2ObjectLike {
  body: ReadableStream | null;
  size: number;
  httpEtag: string;
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
}

const CONTENT_TYPES: Record<string, string> = {
  css: 'text/css; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  html: 'text/html; charset=utf-8',
  ipynb: 'application/x-ipynb+json',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  pdf: 'application/pdf',
  png: 'image/png',
  py: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  yaml: 'text/yaml; charset=utf-8',
  yml: 'text/yaml; charset=utf-8',
};

/** Atlases render in an iframe; everything else is a download or a plain read. */
const SANDBOXED = new Set(['visuals/harness-experiments.html', 'visuals/advanced-atlas.html']);

function deny(status: number, message: string) {
  return NextResponse.json({ message }, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const reader = await currentReader();
  if (!reader) return deny(401, 'Authentication required');

  const key = (await params).path.map(decodeURIComponent).join('/');

  // Allowlist, not a traversal check. The set is built from the compiled course
  // manifest, so a key that is not a real course file is rejected before it can
  // be interpreted as a path at all.
  if (!DOWNLOADABLE.has(key)) return deny(404, 'Not found');

  const bucket = learnEnv().COURSE_FILES as R2BucketLike | undefined;
  if (!bucket) return deny(503, 'Course files are not available');

  const object = await bucket.get(key);
  if (!object || !object.body) return deny(404, 'Not found');

  const extension = key.split('.').pop()?.toLowerCase() ?? '';
  const isSandboxed = SANDBOXED.has(key);
  const contentType = CONTENT_TYPES[extension] ?? 'application/octet-stream';

  const headers = new Headers({
    'content-type': contentType,
    'content-length': String(object.size),
    etag: object.httpEtag,
    // Private, because the response is only meaningful for this reader's
    // session and must not sit in a shared cache after access is revoked.
    'cache-control': 'private, no-store, must-revalidate',
    'x-content-type-options': 'nosniff',
  });

  if (isSandboxed) {
    headers.set(SANDBOXED_DOCUMENT_HEADER, '1');
  } else if (extension === 'html' || extension === 'svg') {
    // Any other HTML or SVG is served as an attachment: both can carry script,
    // and only the two atlases are meant to execute.
    headers.set('content-type', 'application/octet-stream');
    headers.set('content-disposition', `attachment; filename="${key.split('/').pop()}"`);
  }

  return new NextResponse(object.body as ReadableStream, { headers });
}
