import type { PortalDal } from "./dal";
import { PortalDataError } from "./db";

export interface R2ChecksumsLike { sha256?: ArrayBuffer }
export interface R2ObjectLike {
  key: string;
  size: number;
  etag: string;
  httpEtag?: string;
  uploaded: Date;
  checksums?: R2ChecksumsLike;
  customMetadata?: Record<string, string>;
}
export interface R2ObjectBodyLike extends R2ObjectLike { body: ReadableStream<Uint8Array> }
export interface R2Bucket {
  head(key: string): Promise<R2ObjectLike | null>;
  get(key: string, options?: { range?: { offset: number; length: number } }): Promise<R2ObjectBodyLike | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | Uint8Array, options?: {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
    onlyIf?: { etagDoesNotMatch?: string };
    sha256?: string | ArrayBuffer;
  }): Promise<R2ObjectLike | null>;
  delete(key: string | string[]): Promise<void>;
}

export interface MediaHandlerOptions {
  dal: PortalDal;
  bucket: R2Bucket;
  onIntegrityFailure?: (event: { workspaceId: string; assetId: string }) => void | Promise<void>;
}

const SAFE_NOT_FOUND = new Uint8Array();
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/** Same-origin media route handler. Authentication/ACL always precede R2 lookup. */
export async function serveAuthorizedMedia(
  request: Request,
  assetId: string,
  options: MediaHandlerOptions,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...PRIVATE_HEADERS, Allow: "GET, HEAD" } });
  }

  let authorized;
  try {
    authorized = await options.dal.authorizeAsset(assetId);
  } catch (error) {
    if (error instanceof PortalDataError && (error.code === "NOT_FOUND" || error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")) {
      return hiddenNotFound();
    }
    return unavailable();
  }

  const { row } = authorized;
  const metadata = await options.bucket.head(row.object_key).catch(() => null);
  if (!metadata || !metadataMatches(metadata, row.byte_length, row.sha256)) {
    await recordIntegrityFailure(options, authorized.principal, row.id);
    return unavailable();
  }

  const etag = `"${row.sha256}"`;
  const lastModified = new Date(row.uploaded_at);
  const baseHeaders = representationHeaders(row.media_type, row.original_filename, row.purpose, row.byte_length, etag, lastModified);
  const notModified = evaluateNotModified(request.headers, etag, lastModified);
  if (notModified) return new Response(null, { status: 304, headers: withoutEntityLength(baseHeaders) });

  // RFC 9110 Range is defined for GET. HEAD ignores Range and If-Range entirely.
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: baseHeaders });

  const parsed = parseSingleByteRange(request.headers.get("range"), row.byte_length);
  let selected = parsed;
  if (parsed.kind === "satisfiable" && !ifRangeMatches(request.headers.get("if-range"), etag, lastModified)) {
    selected = { kind: "none" };
  }
  // Chosen portal policy: unknown units, malformed bytes, and ordinary multi-range
  // are ignored and receive the normal bounded full representation.
  if (selected.kind === "ignore") selected = { kind: "none" };
  if (selected.kind === "unsatisfiable") {
    const headers = new Headers(baseHeaders);
    headers.delete("Content-Length");
    headers.set("Content-Range", `bytes */${row.byte_length}`);
    return new Response(null, { status: 416, headers });
  }

  if (selected.kind === "satisfiable") {
    const length = selected.end - selected.start + 1;
    const object = await options.bucket.get(row.object_key, { range: { offset: selected.start, length } }).catch(() => null);
    if (!object) {
      await recordIntegrityFailure(options, authorized.principal, row.id);
      return unavailable();
    }
    const headers = new Headers(baseHeaders);
    headers.set("Content-Length", String(length));
    headers.set("Content-Range", `bytes ${selected.start}-${selected.end}/${row.byte_length}`);
    return new Response(object.body, { status: 206, headers });
  }

  const object = await options.bucket.get(row.object_key).catch(() => null);
  if (!object || !metadataMatches(object, row.byte_length, row.sha256)) {
    await recordIntegrityFailure(options, authorized.principal, row.id);
    return unavailable();
  }
  return new Response(object.body, { status: 200, headers: baseHeaders });
}

export type ParsedRange =
  | { kind: "none" | "ignore" | "unsatisfiable" }
  | { kind: "satisfiable"; start: number; end: number };

export function parseSingleByteRange(value: string | null, size: number): ParsedRange {
  if (!value) return { kind: "none" };
  if (!value.toLowerCase().startsWith("bytes=")) return { kind: "ignore" };
  const spec = value.slice(value.indexOf("=") + 1);
  if (spec.includes(",")) return { kind: "ignore" };
  const match = /^(\d*)-(\d*)$/.exec(spec);
  if (!match || (!match[1] && !match[2])) return { kind: "ignore" };
  const left = match[1] ?? "";
  const right = match[2] ?? "";
  if (left === "") {
    if (!/^\d+$/.test(right)) return { kind: "ignore" };
    const suffix = Number(right);
    if (!Number.isSafeInteger(suffix)) return { kind: "ignore" };
    if (suffix === 0 || size === 0) return { kind: "unsatisfiable" };
    return { kind: "satisfiable", start: Math.max(0, size - suffix), end: size - 1 };
  }
  if (!/^\d+$/.test(left) || (right && !/^\d+$/.test(right))) return { kind: "ignore" };
  const start = Number(left);
  const requestedEnd = right ? Number(right) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd)) return { kind: "ignore" };
  if (start >= size || requestedEnd < start || size === 0) return { kind: "unsatisfiable" };
  return { kind: "satisfiable", start, end: Math.min(requestedEnd, size - 1) };
}

function evaluateNotModified(headers: Headers, etag: string, lastModified: Date): boolean {
  const inm = headers.get("if-none-match");
  if (inm !== null) return inm.split(",").map((value) => value.trim()).some((value) => value === "*" || weakEtag(value) === weakEtag(etag));
  const ims = headers.get("if-modified-since");
  if (!ims) return false;
  const timestamp = Date.parse(ims);
  return Number.isFinite(timestamp) && Math.floor(lastModified.getTime() / 1000) <= Math.floor(timestamp / 1000);
}

function ifRangeMatches(value: string | null, etag: string, lastModified: Date): boolean {
  if (!value) return true;
  if (value.startsWith('"')) return value === etag; // If-Range requires strong comparison.
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && Math.floor(lastModified.getTime() / 1000) <= Math.floor(timestamp / 1000);
}

function metadataMatches(object: R2ObjectLike, size: number, sha256: string): boolean {
  if (object.size !== size) return false;
  const customHash = object.customMetadata?.sha256?.toLowerCase();
  const checksum = object.checksums?.sha256 ? hex(new Uint8Array(object.checksums.sha256)) : null;
  return customHash === sha256.toLowerCase() || checksum === sha256.toLowerCase();
}

function representationHeaders(
  mediaType: string,
  filename: string,
  purpose: string,
  size: number,
  etag: string,
  uploaded: Date,
): Headers {
  const headers = new Headers(PRIVATE_HEADERS);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(size));
  headers.set("Content-Type", allowlistedMediaType(mediaType));
  headers.set("Content-Disposition", `${purpose === "playback" && isInlineAudio(mediaType) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename.replace(/[\r\n]/gu, ""))}`);
  headers.set("ETag", etag);
  headers.set("Last-Modified", uploaded.toUTCString());
  return headers;
}

async function recordIntegrityFailure(
  options: MediaHandlerOptions,
  principal: Awaited<ReturnType<PortalDal["principal"]>>,
  assetId: string,
): Promise<void> {
  await options.dal.recordAssetIntegrityFailure(principal, assetId).catch(() => undefined);
  const event = { workspaceId: principal.workspaceId, assetId };
  if (options.onIntegrityFailure) await Promise.resolve(options.onIntegrityFailure(event)).catch(() => undefined);
  else console.error("friendsof.media.integrity_failure", event);
}

function allowlistedMediaType(value: string): string {
  return new Set(["audio/mp4", "audio/mpeg", "audio/wav", "application/pdf", "image/png", "image/jpeg", "text/plain"]).has(value)
    ? value : "application/octet-stream";
}
function isInlineAudio(value: string): boolean { return value === "audio/mp4" || value === "audio/mpeg" || value === "audio/wav"; }
function weakEtag(value: string): string { return value.replace(/^W\//u, ""); }
function withoutEntityLength(headers: Headers): Headers { const next = new Headers(headers); next.delete("Content-Length"); return next; }
function hex(bytes: Uint8Array): string { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function hiddenNotFound(): Response { return new Response(SAFE_NOT_FOUND, { status: 404, headers: PRIVATE_HEADERS }); }
function unavailable(): Response { return new Response(null, { status: 503, headers: { ...PRIVATE_HEADERS, "Retry-After": "30" } }); }
