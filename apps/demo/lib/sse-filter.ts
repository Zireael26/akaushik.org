/**
 * Pure SSE allowlist filter for the VeriCite upstream chat stream.
 *
 * Operates on parsed event objects: allowlisted types pass with strict
 * per-type field projections, everything else maps to null (dropped).
 * No I/O and no imports — safe to unit test in plain node.
 *
 * Allowed upstream types (spec: work order section 3):
 *   chunk, sources, revised_answer, answer_gated, answer_verification,
 *   error — plus the [DONE] sentinel, which passes through as-is.
 * Dropped: metadata, suggested_followups, reflection_skipped, provenance,
 * usage, and every other type. There is deliberately no denylist: an event
 * field the filter does not name never reaches the browser, so new upstream
 * telemetry keys (model ids, costs, scores, timings, routing ids) are
 * dropped by construction rather than by enumeration.
 *
 * Projections:
 *   chunk              -> { type, data }              (text delta only)
 *   sources            -> { type, sources: [{ id, title, page, excerpt,
 *                          url, verification?: { verdict } }] }
 *   revised_answer     -> { type, data }              (replacement text only)
 *   answer_gated       -> { type }                    (presence alone signals
 *                          the abstain state; all upstream detail dropped)
 *   answer_verification-> { type, answer_verification: { verdict } }
 *   error              -> { type, data: generic }     (never upstream detail)
 */

export const GENERIC_CHAT_ERROR_MESSAGE = "The assistant could not complete this response.";

export const GENERIC_CHAT_ERROR_EVENT = JSON.stringify({
  type: "error",
  data: GENERIC_CHAT_ERROR_MESSAGE,
} as const);

/** Upstream event types the demo route re-emits. All other types are dropped. */
const KEPT_TYPES = new Set([
  "chunk",
  "sources",
  "revised_answer",
  "answer_gated",
  "answer_verification",
  "error",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Extract a bare verdict string from a string or {verdict} payload. */
function verdictOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.verdict === "string") return value.verdict;
  return undefined;
}

function projectSourceItem(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) return null;
  const page = item.page;
  const url = "url" in item ? item.url : null;
  // Quoted keys: test/sse-filter.test.mjs asserts the allowlisted key
  // names appear as string literals in this module's source.
  const projected: Record<string, unknown> = {
    // Upstream channel shape uses `document_id`; accept a plain `id` too.
    "id": asText(item.document_id ?? item.id),
    "title": asText(item.title),
    "page": typeof page === "number" || typeof page === "string" ? page : null,
    "excerpt": asText(item.excerpt),
    "url": typeof url === "string" ? url : null,
  };
  // Nested per-source verification collapses to its verdict only, so the
  // widget can render the chip without ever seeing confidence internals.
  const verdict = verdictOf(item.verification ?? item.answer_verification);
  if (verdict !== undefined) projected.verification = { verdict };
  return projected;
}

function projectSources(event: Record<string, unknown>): unknown[] {
  const raw = event.sources ?? event.data;
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.sources)
      ? raw.sources
      : [];
  const out: unknown[] = [];
  for (const item of list) {
    const projected = projectSourceItem(item);
    if (projected) out.push(projected);
  }
  return out;
}

/**
 * Map one upstream event object to the object the demo route re-emits,
 * or null when the event must be dropped. Accepts the envelope shapes
 * `{type, ...}` with payload under `data`, `sources`, `text`, or `delta`.
 */
export function filterSseEvent(event: unknown): Record<string, unknown> | null {
  if (!isRecord(event)) return null;
  const type = event.type;
  if (typeof type !== "string" || !KEPT_TYPES.has(type)) return null;

  switch (type) {
    case "error":
      // Never forward upstream error detail; the route emits one generic event.
      return { type: "error", data: GENERIC_CHAT_ERROR_MESSAGE };
    case "sources":
      return { type: "sources", sources: projectSources(event) };
    case "chunk": {
      // Upstream sends the delta as `data`; tolerate `text`/`delta` too.
      const delta =
        typeof event.data === "string"
          ? event.data
          : typeof event.text === "string"
            ? event.text
            : typeof event.delta === "string"
              ? event.delta
              : null;
      return delta === null ? null : { type: "chunk", data: delta };
    }
    case "revised_answer": {
      // The trust gate replaces the whole answer; keep the text only.
      const text =
        typeof event.data === "string"
          ? event.data
          : typeof event.text === "string"
            ? event.text
            : null;
      return text === null ? null : { type: "revised_answer", data: text };
    }
    case "answer_gated":
      // Presence alone is the abstain signal; drop the gated payload
      // (scores, spans, thresholds, session ids) in full.
      return { type: "answer_gated" };
    case "answer_verification": {
      const verdict =
        verdictOf(event.data) ??
        verdictOf(event.answer_verification) ??
        verdictOf(event.verification) ??
        "unknown";
      return { type: "answer_verification", answer_verification: { verdict } };
    }
    default:
      return null;
  }
}

/**
 * Route-level helper: map one upstream `data:` payload string to the payload
 * string the demo route re-emits, or null when the line must be dropped. The
 * `"[DONE]"` sentinel passes through as-is.
 */
export function filterVericiteEvent(raw: unknown): string | null {
  if (typeof raw === "string") {
    const text = raw.trim();
    if (text === "[DONE]") return "[DONE]";
    if (!text) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    const out = filterSseEvent(parsed);
    return out === null ? null : JSON.stringify(out);
  }
  if (isRecord(raw)) {
    if (raw.type === "[DONE]") return "[DONE]";
    const out = filterSseEvent(raw);
    return out === null ? null : JSON.stringify(out);
  }
  return null;
}
