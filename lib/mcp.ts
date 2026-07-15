import { CANONICAL_ORIGIN } from './canonical';
import { getAllPosts, getPost } from './content';
import type { Post } from './content';

export const MCP_PROTOCOL_VERSION = '2025-11-25';
export const MCP_FALLBACK_PROTOCOL_VERSION = '2025-03-26';
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  MCP_PROTOCOL_VERSION,
  '2025-06-18',
  MCP_FALLBACK_PROTOCOL_VERSION,
] as const;
export const MCP_ENDPOINT = `${CANONICAL_ORIGIN}/api/mcp`;
export const MCP_SERVER_VERSION = '1.0.0';

export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export const MCP_TOOLS = [
  {
    name: 'lookup_case_study',
    title: 'Look up a case study',
    description: 'Return one published portfolio case study as structured data and Markdown.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          pattern: '^[a-z0-9_-]+$',
          description: 'Published case-study slug, for example "neev".',
        },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        title: { type: 'string' },
        dek: { type: 'string' },
        role: { type: 'string' },
        year: { type: 'string' },
        stack: { type: 'array', items: { type: 'string' } },
        url: { type: 'string', format: 'uri' },
        markdown: { type: 'string' },
      },
      required: ['slug', 'title', 'dek', 'role', 'year', 'stack', 'url', 'markdown'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_availability',
    title: 'Get project availability',
    description: 'Return current public project availability and contact details.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', const: 'open' },
        capacity: { type: 'string', const: 'one project this quarter' },
        contactUrl: { type: 'string', format: 'uri' },
        email: { type: 'string', format: 'email' },
      },
      required: ['status', 'capacity', 'contactUrl', 'email'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
] as const;

type McpProtocolVersion = (typeof MCP_SUPPORTED_PROTOCOL_VERSIONS)[number];
type JsonRpcRequestId = string | number;
type JsonRpcResponseId = JsonRpcRequestId | null;
type JsonRpcErrorCode = (typeof JSON_RPC_ERROR_CODES)[keyof typeof JSON_RPC_ERROR_CODES];

export type JsonRpcSuccessResponse = {
  jsonrpc: '2.0';
  id: JsonRpcRequestId;
  result: Record<string, unknown>;
};

export type JsonRpcErrorResponse = {
  jsonrpc: '2.0';
  id: JsonRpcResponseId;
  error: {
    code: JsonRpcErrorCode;
    message: string;
    data?: unknown;
  };
};

export type McpDispatchResult =
  | { status: 200 | 400; body: JsonRpcSuccessResponse | JsonRpcErrorResponse }
  | { status: 202; body: null };

export type McpPayloadDispatchResult =
  McpDispatchResult | { status: 200; body: Array<JsonRpcSuccessResponse | JsonRpcErrorResponse> };

export type McpHttpError = {
  status: 400 | 403 | 406 | 415;
  body: JsonRpcErrorResponse;
};

type CaseStudyResult = {
  slug: string;
  title: string;
  dek: string;
  role: string;
  year: string;
  stack: string[];
  url: string;
  markdown: string;
};

export type McpServices = {
  lookupPublishedCaseStudy: (slug: string) => CaseStudyResult | null;
};

export type McpContentSources = {
  listCaseStudies: () => Array<Omit<Post<'case-studies'>, 'content'>>;
  readCaseStudy: (slug: string) => Post<'case-studies'> | null;
};

const DEFAULT_CONTENT_SOURCES: McpContentSources = {
  listCaseStudies: () => getAllPosts('case-studies'),
  readCaseStudy: (slug) => getPost('case-studies', slug),
};

export function lookupPublishedCaseStudy(
  slug: string,
  sources: McpContentSources = DEFAULT_CONTENT_SOURCES,
): CaseStudyResult | null {
  const published = sources.listCaseStudies().find((post) => post.slug === slug);
  if (!published) return null;

  const post = sources.readCaseStudy(published.slug);
  if (!post || post.frontmatter.draft === true) return null;

  const { title, dek, role, year, stack } = published.frontmatter;
  return {
    slug: published.slug,
    title,
    dek,
    role,
    year,
    stack,
    url: `${CANONICAL_ORIGIN}/work/${published.slug}`,
    markdown: post.content.trim(),
  };
}

const DEFAULT_SERVICES: McpServices = {
  lookupPublishedCaseStudy,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRequestId(value: unknown): value is JsonRpcRequestId {
  return typeof value === 'string' || (typeof value === 'number' && Number.isInteger(value));
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlyArray<string>): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function jsonRpcError(
  id: JsonRpcResponseId,
  code: JsonRpcErrorCode,
  message: string,
  data?: unknown,
): JsonRpcErrorResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function jsonRpcSuccess(
  id: JsonRpcRequestId,
  result: Record<string, unknown>,
): JsonRpcSuccessResponse {
  return { jsonrpc: '2.0', id, result };
}

export function isAllowedMcpOrigin(origin: string | null): boolean {
  return origin === null || origin === CANONICAL_ORIGIN;
}

function acceptedMediaTypes(accept: string | null): Set<string> {
  const mediaTypes = new Set<string>();
  if (accept === null) return mediaTypes;

  for (const range of accept.split(',')) {
    const [rawMediaType, ...rawParameters] = range.split(';');
    let quality = 1;
    for (const rawParameter of rawParameters) {
      const [rawName, rawValue] = rawParameter.split('=', 2);
      if (rawName?.trim().toLowerCase() !== 'q') continue;
      const parsed = Number(rawValue?.trim());
      quality = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
    }
    if (quality > 0 && rawMediaType) mediaTypes.add(rawMediaType.trim().toLowerCase());
  }

  return mediaTypes;
}

function isSupportedProtocolVersion(value: string): value is McpProtocolVersion {
  return MCP_SUPPORTED_PROTOCOL_VERSIONS.some((version) => version === value);
}

export function getMcpProtocolVersion(headers: Headers): McpProtocolVersion | null {
  const protocolVersion = headers.get('mcp-protocol-version') ?? MCP_FALLBACK_PROTOCOL_VERSION;
  return isSupportedProtocolVersion(protocolVersion) ? protocolVersion : null;
}

export function validateMcpProtocolVersionHeader(headers: Headers): McpHttpError | null {
  if (getMcpProtocolVersion(headers) !== null) return null;
  return {
    status: 400,
    body: jsonRpcError(
      null,
      JSON_RPC_ERROR_CODES.INVALID_PARAMS,
      'Unsupported MCP protocol version.',
      {
        supported: MCP_SUPPORTED_PROTOCOL_VERSIONS,
        fallback: MCP_FALLBACK_PROTOCOL_VERSION,
      },
    ),
  };
}

export function validateMcpPostHeaders(headers: Headers): McpHttpError | null {
  const origin = headers.get('origin');
  if (!isAllowedMcpOrigin(origin)) {
    return {
      status: 403,
      body: jsonRpcError(null, JSON_RPC_ERROR_CODES.INVALID_REQUEST, 'Origin is not allowed.'),
    };
  }

  const contentType = headers.get('content-type');
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return {
      status: 415,
      body: jsonRpcError(
        null,
        JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        'Content-Type must be application/json.',
      ),
    };
  }

  const accepted = acceptedMediaTypes(headers.get('accept'));
  if (!accepted.has('application/json') || !accepted.has('text/event-stream')) {
    return {
      status: 406,
      body: jsonRpcError(
        null,
        JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        'Accept must list both application/json and text/event-stream.',
      ),
    };
  }

  return validateMcpProtocolVersionHeader(headers);
}

function invalidRequest(
  message = 'Invalid JSON-RPC request.',
  id: JsonRpcResponseId = null,
): McpDispatchResult {
  return {
    status: 400,
    body: jsonRpcError(id, JSON_RPC_ERROR_CODES.INVALID_REQUEST, message),
  };
}

function invalidParams(id: JsonRpcRequestId, message = 'Invalid params.'): McpDispatchResult {
  return {
    status: 200,
    body: jsonRpcError(id, JSON_RPC_ERROR_CODES.INVALID_PARAMS, message),
  };
}

function validInitializeParams(params: unknown): params is Record<string, unknown> {
  if (!isRecord(params)) return false;
  if (typeof params['protocolVersion'] !== 'string' || params['protocolVersion'].length === 0) {
    return false;
  }
  if (!isRecord(params['capabilities'])) return false;

  const clientInfo = params['clientInfo'];
  if (!isRecord(clientInfo)) return false;
  return (
    typeof clientInfo['name'] === 'string' &&
    clientInfo['name'].length > 0 &&
    typeof clientInfo['version'] === 'string' &&
    clientInfo['version'].length > 0
  );
}

function negotiateProtocolVersion(requested: string): McpProtocolVersion {
  return isSupportedProtocolVersion(requested) ? requested : MCP_PROTOCOL_VERSION;
}

function validNotificationParams(params: unknown): boolean {
  return params === undefined || isRecord(params);
}

function validPingParams(params: unknown): boolean {
  return params === undefined || isRecord(params);
}

function validToolsListParams(params: unknown): boolean {
  if (params === undefined) return true;
  return isRecord(params) && hasOnlyKeys(params, ['_meta']);
}

function toolResult(structuredContent: Record<string, unknown>): Record<string, unknown> {
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
    isError: false,
  };
}

function toolError(message: string): Record<string, unknown> {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function unavailableCaseStudyResult(): Record<string, unknown> {
  return toolError(
    'Case study not found or unavailable. Choose a published slug from https://akaushik.org/api/case-studies.',
  );
}

function callTool(id: JsonRpcRequestId, params: unknown, services: McpServices): McpDispatchResult {
  if (!isRecord(params) || !hasOnlyKeys(params, ['name', 'arguments', '_meta'])) {
    return invalidParams(id);
  }

  const name = params['name'];
  const rawArguments = params['arguments'];
  const args = rawArguments === undefined ? {} : rawArguments;
  if (
    typeof name !== 'string' ||
    !isRecord(args) ||
    (hasOwn(params, '_meta') && !isRecord(params['_meta']))
  ) {
    return invalidParams(id, 'Malformed tools/call params.');
  }

  if (name === 'lookup_case_study') {
    if (
      !hasOnlyKeys(args, ['slug']) ||
      typeof args['slug'] !== 'string' ||
      !/^[a-z0-9_-]+$/.test(args['slug'])
    ) {
      return {
        status: 200,
        body: jsonRpcSuccess(
          id,
          toolError(
            'Invalid arguments for lookup_case_study: provide exactly one string slug matching ^[a-z0-9_-]+$.',
          ),
        ),
      };
    }

    const caseStudy = services.lookupPublishedCaseStudy(args['slug']);
    return {
      status: 200,
      body: jsonRpcSuccess(id, caseStudy ? toolResult(caseStudy) : unavailableCaseStudyResult()),
    };
  }

  if (name === 'get_availability') {
    if (Object.keys(args).length > 0) {
      return {
        status: 200,
        body: jsonRpcSuccess(
          id,
          toolError('Invalid arguments for get_availability: expected an empty arguments object.'),
        ),
      };
    }
    return {
      status: 200,
      body: jsonRpcSuccess(
        id,
        toolResult({
          status: 'open',
          capacity: 'one project this quarter',
          contactUrl: `${CANONICAL_ORIGIN}/#contact`,
          email: 'hello@akaushik.org',
        }),
      ),
    };
  }

  return invalidParams(id, `Unknown tool: ${name}.`);
}

export function handleMcpMessage(
  message: unknown,
  services: McpServices = DEFAULT_SERVICES,
): McpDispatchResult {
  if (!isRecord(message)) return invalidRequest();
  if (message['jsonrpc'] !== '2.0' || typeof message['method'] !== 'string') {
    return invalidRequest();
  }

  const hasId = hasOwn(message, 'id');
  if (hasId && !isRequestId(message['id'])) return invalidRequest();

  const method = message['method'];
  const params = message['params'];

  if (!hasId) {
    if (!validNotificationParams(params)) return invalidRequest('Invalid notification.');
    if (['initialize', 'ping', 'tools/list', 'tools/call'].includes(method)) {
      return invalidRequest('Request id is required for this method.');
    }
    return { status: 202, body: null };
  }

  const id = message['id'] as JsonRpcRequestId;
  if (method === 'notifications/initialized') {
    return invalidRequest('notifications/initialized must not include an id.', id);
  }

  try {
    if (method === 'initialize') {
      if (!validInitializeParams(params)) {
        return invalidParams(id, 'Invalid initialize params.');
      }
      return {
        status: 200,
        body: jsonRpcSuccess(id, {
          protocolVersion: negotiateProtocolVersion(params['protocolVersion'] as string),
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: 'akaushik-org',
            title: 'akaushik.org portfolio MCP',
            version: MCP_SERVER_VERSION,
          },
          instructions: 'Read-only access to published case studies and public availability.',
        }),
      };
    }

    if (method === 'ping') {
      if (!validPingParams(params)) return invalidParams(id);
      return { status: 200, body: jsonRpcSuccess(id, {}) };
    }

    if (method === 'tools/list') {
      if (!validToolsListParams(params)) return invalidParams(id);
      return { status: 200, body: jsonRpcSuccess(id, { tools: MCP_TOOLS }) };
    }

    if (method === 'tools/call') return callTool(id, params, services);

    return {
      status: 200,
      body: jsonRpcError(id, JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND, 'Method not found.'),
    };
  } catch {
    return {
      status: 200,
      body: jsonRpcError(id, JSON_RPC_ERROR_CODES.INTERNAL_ERROR, 'Internal error.'),
    };
  }
}

export function handleMcpPayload(
  payload: unknown,
  protocolVersion: McpProtocolVersion,
  services: McpServices = DEFAULT_SERVICES,
): McpPayloadDispatchResult {
  if (!Array.isArray(payload) || protocolVersion !== MCP_FALLBACK_PROTOCOL_VERSION) {
    return handleMcpMessage(payload, services);
  }

  if (payload.length === 0) return invalidRequest();

  const responses: Array<JsonRpcSuccessResponse | JsonRpcErrorResponse> = [];
  for (const message of payload) {
    const result = handleMcpMessage(message, services);
    if (result.body !== null) responses.push(result.body);
  }

  if (responses.length === 0) return { status: 202, body: null };
  return { status: 200, body: responses };
}
