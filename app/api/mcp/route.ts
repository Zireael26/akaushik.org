import {
  JSON_RPC_ERROR_CODES,
  getMcpProtocolVersion,
  handleMcpPayload,
  isAllowedMcpOrigin,
  jsonRpcError,
  validateMcpProtocolVersionHeader,
  validateMcpPostHeaders,
} from '@/lib/mcp';
import { CANONICAL_ORIGIN } from '@/lib/canonical';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_METHODS = 'POST, OPTIONS';

function responseHeaders(origin: string | null, extra?: Record<string, string>): Headers {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin, Accept',
    ...extra,
  });
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

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  const headerError = validateMcpPostHeaders(request.headers);
  if (headerError) return jsonResponse(headerError.body, headerError.status, origin);
  const protocolVersion = getMcpProtocolVersion(request.headers);
  if (protocolVersion === null) {
    throw new Error('validated MCP protocol version was unexpectedly unavailable');
  }

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return jsonResponse(
      jsonRpcError(null, JSON_RPC_ERROR_CODES.PARSE_ERROR, 'Parse error.'),
      400,
      origin,
    );
  }

  const result = handleMcpPayload(message, protocolVersion);
  if (result.status === 202) {
    return new Response(null, { status: 202, headers: responseHeaders(origin) });
  }
  return jsonResponse(result.body, result.status, origin);
}

export function GET(request: Request): Response {
  const origin = request.headers.get('origin');
  const forbidden = forbiddenOrigin(origin);
  if (forbidden) return forbidden;
  const protocolError = validateMcpProtocolVersionHeader(request.headers);
  if (protocolError) return jsonResponse(protocolError.body, protocolError.status, origin);
  return jsonResponse(
    jsonRpcError(null, JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND, 'HTTP method not allowed.'),
    405,
    origin,
    { Allow: ALLOWED_METHODS },
  );
}

export function DELETE(request: Request): Response {
  return GET(request);
}

export function OPTIONS(request: Request): Response {
  const origin = request.headers.get('origin');
  const forbidden = forbiddenOrigin(origin);
  if (forbidden) return forbidden;
  const protocolError = validateMcpProtocolVersionHeader(request.headers);
  if (protocolError) return jsonResponse(protocolError.body, protocolError.status, origin);

  return new Response(null, {
    status: 204,
    headers: responseHeaders(origin, {
      Allow: ALLOWED_METHODS,
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Allow-Headers': 'Accept, Content-Type, MCP-Protocol-Version',
    }),
  });
}
