import { AGENT_DISCOVERY_LINK_HEADER } from './agent-discovery';
import { CANONICAL_ORIGIN } from './canonical';
import {
  JSON_RPC_ERROR_CODES,
  getMcpProtocolVersion,
  handleMcpPayload,
  isAllowedMcpOrigin,
  jsonRpcError,
  validateMcpPostHeaders,
  validateMcpProtocolVersionHeader,
} from './mcp';

export const MCP_ALLOWED_METHODS = 'POST, OPTIONS';

function responseHeaders(origin: string | null, extra?: Record<string, string>): Headers {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    Link: AGENT_DISCOVERY_LINK_HEADER,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    Vary: 'Origin, Accept',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'index, follow',
    ...extra,
  });
  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  if (origin === CANONICAL_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', CANONICAL_ORIGIN);
  }
  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  extraHeaders?: Record<string, string>,
): Response {
  return Response.json(body, {
    status,
    headers: responseHeaders(origin, extraHeaders),
  });
}

function forbiddenOrigin(origin: string | null): Response | null {
  if (isAllowedMcpOrigin(origin)) return null;
  return jsonResponse(
    jsonRpcError(null, JSON_RPC_ERROR_CODES.INVALID_REQUEST, 'Origin is not allowed.'),
    403,
    origin,
  );
}

export async function handleMcpHttpRequest(
  method: string,
  headers: Headers,
  rawBody: string | (() => Promise<string>) = '',
): Promise<Response> {
  const normalizedMethod = method.toUpperCase();
  const origin = headers.get('origin');

  if (normalizedMethod === 'POST') {
    const headerError = validateMcpPostHeaders(headers);
    if (headerError) return jsonResponse(headerError.body, headerError.status, origin);
    const protocolVersion = getMcpProtocolVersion(headers);
    if (protocolVersion === null) {
      throw new Error('validated MCP protocol version was unexpectedly unavailable');
    }
    let message: unknown;
    try {
      const body = typeof rawBody === 'function' ? await rawBody() : rawBody;
      message = JSON.parse(body);
    } catch {
      return jsonResponse(
        jsonRpcError(null, JSON_RPC_ERROR_CODES.PARSE_ERROR, 'Parse error.'),
        400,
        origin,
      );
    }

    const result = handleMcpPayload(message, protocolVersion);
    if (result.body === null) {
      return new Response(null, { status: result.status, headers: responseHeaders(origin) });
    }
    return jsonResponse(result.body, result.status, origin);
  }

  const forbidden = forbiddenOrigin(origin);
  if (forbidden) return forbidden;
  const protocolError = validateMcpProtocolVersionHeader(headers);
  if (protocolError) return jsonResponse(protocolError.body, protocolError.status, origin);

  if (normalizedMethod === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: responseHeaders(origin, {
        Allow: MCP_ALLOWED_METHODS,
        'Access-Control-Allow-Methods': MCP_ALLOWED_METHODS,
        'Access-Control-Allow-Headers': 'Accept, Content-Type, MCP-Protocol-Version',
      }),
    });
  }

  return jsonResponse(
    jsonRpcError(null, JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND, 'HTTP method not allowed.'),
    405,
    origin,
    { Allow: MCP_ALLOWED_METHODS },
  );
}
