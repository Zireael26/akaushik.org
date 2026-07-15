import { CANONICAL_ORIGIN } from './canonical';

/**
 * MCP Streamable HTTP requires rejecting a present non-canonical Origin.
 * Keep this dependency edge runtime-light so the proxy can enforce the rule
 * before Next.js rejects unsupported methods such as TRACE.
 */
export function isAllowedMcpOrigin(origin: string | null): boolean {
  return origin === null || origin === CANONICAL_ORIGIN;
}
