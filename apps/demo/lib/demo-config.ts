/**
 * Demo portal configuration helpers.
 *
 * Pure functions over the Worker env (passed in structurally so they stay
 * runnable under `node --test` with no Cloudflare runtime). All getters are
 * fail-closed: missing or malformed values fall back to safe defaults and
 * never throw.
 */

export interface DemoConfigEnv {
  DEMO_TITLE?: string;
  DEMO_SUBTITLE?: string;
  VERICITE_API_BASE?: string;
  VERICITE_CHANNEL_ID?: string;
  VERICITE_MAX_SOURCES?: string;
  DEMO_SUGGESTIONS?: string;
}

export const DEFAULT_DEMO_TITLE = "Demo";
export const DEFAULT_DEMO_SUBTITLE = "A private demonstration";
export const DEFAULT_VERICITE_API_BASE = "https://api.vericite.ai";
export const DEFAULT_VERICITE_MAX_SOURCES = 5;
export const MAX_VERICITE_SOURCES = 10;
export const MAX_SUGGESTIONS = 12;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

export function getDemoTitle(env: DemoConfigEnv): string {
  return clean(env.DEMO_TITLE) || DEFAULT_DEMO_TITLE;
}

export function getDemoSubtitle(env: DemoConfigEnv): string {
  return clean(env.DEMO_SUBTITLE) || DEFAULT_DEMO_SUBTITLE;
}

export function getVericiteApiBase(env: DemoConfigEnv): string {
  const base = clean(env.VERICITE_API_BASE) || DEFAULT_VERICITE_API_BASE;
  return base.replace(/\/+$/, "");
}

export function getVericiteChannelId(env: DemoConfigEnv): string {
  return clean(env.VERICITE_CHANNEL_ID);
}

export function getVericiteMaxSources(env: DemoConfigEnv): number {
  const parsed = Number.parseInt(clean(env.VERICITE_MAX_SOURCES), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_VERICITE_MAX_SOURCES;
  return Math.min(Math.max(parsed, 1), MAX_VERICITE_SOURCES);
}

/**
 * Parses the DEMO_SUGGESTIONS secret (a JSON array of strings) into starter
 * chips for the chat UI. Returns null when there is nothing usable to show —
 * unset, invalid JSON, a non-array, or an array with no non-empty strings —
 * so the UI renders no chips instead of throwing.
 */
export function parseSuggestions(raw: unknown): string[] | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const out = parsed
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, MAX_SUGGESTIONS);
  return out.length > 0 ? out : null;
}

/** Convenience wrapper: parse suggestions straight from the env binding. */
export function getSuggestions(env: DemoConfigEnv): string[] | null {
  return parseSuggestions(env.DEMO_SUGGESTIONS);
}
