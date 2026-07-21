import { describe, expect, it } from 'vitest';
import mcpDiscovery from '../public/.well-known/mcp.json';
import {
  JSON_RPC_ERROR_CODES,
  MCP_ENDPOINT,
  MCP_FALLBACK_PROTOCOL_VERSION,
  MCP_MAX_BATCH_SIZE,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  MCP_TOOLS,
  handleMcpPayload,
  handleMcpMessage,
  isAllowedMcpOrigin,
  lookupPublishedCaseStudy,
  validateMcpProtocolVersionHeader,
  validateMcpPostHeaders,
  type JsonRpcErrorResponse,
  type JsonRpcSuccessResponse,
  type McpDispatchResult,
} from './mcp';
import { OPENAPI_SPEC } from './openapi-spec';

const REQUIRED_ACCEPT = 'application/json, text/event-stream';

function transportHeaders(overrides: Record<string, string> = {}) {
  return new Headers({
    Accept: REQUIRED_ACCEPT,
    'Content-Type': 'application/json',
    ...overrides,
  });
}

function request(method: string, params?: Record<string, unknown>, id: string | number = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    ...(params === undefined ? {} : { params }),
  };
}

function responseBody(result: McpDispatchResult): JsonRpcSuccessResponse | JsonRpcErrorResponse {
  if (result.body === null) throw new Error('expected a JSON-RPC response body');
  return result.body;
}

function successResult(result: McpDispatchResult): Record<string, unknown> {
  const body = responseBody(result);
  if (!('result' in body)) throw new Error('expected a JSON-RPC success response');
  return body.result;
}

function expectError(result: McpDispatchResult, code: number) {
  const body = responseBody(result);
  expect('error' in body ? body.error.code : null).toBe(code);
  return body as JsonRpcErrorResponse;
}

describe('MCP transport validation', () => {
  it('pins the canonical endpoint and stable protocol revision', () => {
    expect(MCP_ENDPOINT).toBe('https://akaushik.org/api/mcp');
    expect(MCP_PROTOCOL_VERSION).toBe('2025-11-25');
    expect(MCP_SUPPORTED_PROTOCOL_VERSIONS).toEqual(['2025-11-25', '2025-06-18', '2025-03-26']);
    expect(MCP_FALLBACK_PROTOCOL_VERSION).toBe('2025-03-26');
  });

  it('accepts no Origin for server clients and the canonical Origin for browsers', () => {
    expect(isAllowedMcpOrigin(null)).toBe(true);
    expect(isAllowedMcpOrigin('https://akaushik.org')).toBe(true);
  });

  it('rejects every non-canonical Origin', () => {
    expect(isAllowedMcpOrigin('https://akaushik.dev')).toBe(false);
    expect(isAllowedMcpOrigin('https://akaushik.org.evil.example')).toBe(false);
    expect(isAllowedMcpOrigin('null')).toBe(false);
  });

  it('accepts application/json with an optional charset and no version header', () => {
    const headers = transportHeaders({ 'Content-Type': 'application/json; charset=utf-8' });
    expect(validateMcpPostHeaders(headers)).toBeNull();
  });

  it('accepts every supported explicit protocol header', () => {
    for (const protocolVersion of MCP_SUPPORTED_PROTOCOL_VERSIONS) {
      const headers = transportHeaders({
        'MCP-Protocol-Version': protocolVersion,
        Origin: 'https://akaushik.org',
      });
      expect(validateMcpPostHeaders(headers)).toBeNull();
    }
  });

  it('rejects unsupported media types with HTTP 415 and -32600', () => {
    const error = validateMcpPostHeaders(
      new Headers({ Accept: REQUIRED_ACCEPT, 'Content-Type': 'text/plain' }),
    );
    expect(error?.status).toBe(415);
    expect(error?.body.error.code).toBe(JSON_RPC_ERROR_CODES.INVALID_REQUEST);
  });

  it('requires Accept to list application/json and text/event-stream', () => {
    for (const accept of [null, 'application/json', 'text/event-stream', '*/*']) {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (accept !== null) headers.set('Accept', accept);
      const error = validateMcpPostHeaders(headers);
      expect(error?.status).toBe(406);
      expect(error?.body.error.code).toBe(JSON_RPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('does not count a required Accept type with q=0 as supported', () => {
    const error = validateMcpPostHeaders(
      transportHeaders({ Accept: 'application/json, text/event-stream; q=0' }),
    );
    expect(error?.status).toBe(406);
  });

  it('rejects unsupported protocol headers with HTTP 400 and -32602', () => {
    const error = validateMcpPostHeaders(
      transportHeaders({ 'MCP-Protocol-Version': '2099-01-01' }),
    );
    expect(error?.status).toBe(400);
    expect(error?.body.error.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
    expect(error?.body.error.data).toEqual({
      supported: MCP_SUPPORTED_PROTOCOL_VERSIONS,
      fallback: MCP_FALLBACK_PROTOCOL_VERSION,
    });
  });

  it('applies protocol-version validation independently of POST media headers', () => {
    const error = validateMcpProtocolVersionHeader(
      new Headers({ 'MCP-Protocol-Version': '2099-01-01' }),
    );
    expect(error?.status).toBe(400);
    expect(error?.body.error.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
    expect(validateMcpProtocolVersionHeader(new Headers())).toBeNull();
  });

  it('checks Origin before other transport headers', () => {
    const error = validateMcpPostHeaders(
      new Headers({
        Accept: REQUIRED_ACCEPT,
        'Content-Type': 'text/plain',
        Origin: 'https://evil.example',
      }),
    );
    expect(error?.status).toBe(403);
  });
});

describe('MCP lifecycle and utility methods', () => {
  it('echoes every supported initialize version with only the static tools capability', () => {
    for (const protocolVersion of MCP_SUPPORTED_PROTOCOL_VERSIONS) {
      const response = handleMcpMessage(
        request('initialize', {
          protocolVersion,
          capabilities: {},
          clientInfo: { name: 'vitest', version: '1.0.0' },
        }),
      );
      expect(response.status).toBe(200);
      expect(successResult(response)).toMatchObject({
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'akaushik-org', version: '1.0.0' },
      });
    }
  });

  it('negotiates an unsupported initialize preference to the current version', () => {
    const response = handleMcpMessage(
      request('initialize', {
        protocolVersion: '2099-01-01',
        capabilities: {},
        clientInfo: { name: 'vitest', version: '1.0.0' },
      }),
    );
    expect(successResult(response)['protocolVersion']).toBe(MCP_PROTOCOL_VERSION);
  });

  it('requires initialize client capabilities and implementation info', () => {
    const response = handleMcpMessage(
      request('initialize', { protocolVersion: MCP_PROTOCOL_VERSION }),
    );
    expectError(response, JSON_RPC_ERROR_CODES.INVALID_PARAMS);
  });

  it('responds to ping with an empty result', () => {
    const response = handleMcpMessage(request('ping', undefined, 'ping-1'));
    expect(response.status).toBe(200);
    expect(responseBody(response)).toEqual({ jsonrpc: '2.0', id: 'ping-1', result: {} });
  });

  it('accepts notifications/initialized with HTTP 202 and no body', () => {
    const response = handleMcpMessage({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(response).toEqual({ status: 202, body: null });
  });

  it('rejects notifications/initialized when it incorrectly includes an id', () => {
    const response = handleMcpMessage(request('notifications/initialized', undefined, 7));
    expect(response.status).toBe(400);
    expect(expectError(response, JSON_RPC_ERROR_CODES.INVALID_REQUEST).id).toBe(7);
  });
});

describe('MCP tools', () => {
  it('lists exactly the two read-only tools and their schemas', () => {
    const response = handleMcpMessage(request('tools/list', {}));
    const result = successResult(response);
    expect(result['tools']).toEqual(MCP_TOOLS);
    expect(MCP_TOOLS.map((tool) => tool.name)).toEqual(['lookup_case_study', 'get_availability']);
    for (const tool of MCP_TOOLS) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });

  it('looks up a published case study with structured and text content', () => {
    const response = handleMcpMessage(
      request('tools/call', { name: 'lookup_case_study', arguments: { slug: 'neev' } }),
    );
    const result = successResult(response);
    expect(result['isError']).toBe(false);
    expect(result['structuredContent']).toMatchObject({
      slug: 'neev',
      title: 'Neev',
      url: 'https://akaushik.org/work/neev',
    });
    const structured = result['structuredContent'] as Record<string, unknown>;
    expect(structured['markdown']).toEqual(expect.stringContaining('# Neev'));
    expect(result['content']).toEqual([
      { type: 'text', text: JSON.stringify(result['structuredContent']) },
    ]);
  });

  it('rejects a draft case study even if a listing source accidentally includes it', () => {
    const draft = {
      slug: 'draft-case-study',
      frontmatter: {
        title: 'Private launch',
        dek: 'Not approved',
        index: '99',
        tag: 'Private',
        year: '2026',
        role: 'Private',
        stack: ['private'],
        evidenceOf: 'Private',
        draft: true,
      },
      content: '# Confidential body',
    };

    const result = lookupPublishedCaseStudy(draft.slug, {
      listCaseStudies: () => [{ slug: draft.slug, frontmatter: draft.frontmatter }],
      readCaseStudy: () => draft,
    });

    expect(result).toBeNull();
  });

  it('returns the public availability contract', () => {
    const response = handleMcpMessage(
      request('tools/call', { name: 'get_availability', arguments: {} }),
    );
    expect(successResult(response)['structuredContent']).toEqual({
      status: 'open',
      capacity: 'one project this quarter',
      contactUrl: 'https://akaushik.org/#contact',
      email: 'hello@akaushik.org',
    });
  });

  it('returns actionable tool errors for known-tool argument validation', () => {
    const missingSlug = successResult(
      handleMcpMessage(request('tools/call', { name: 'lookup_case_study', arguments: {} })),
    );
    const extraAvailabilityArg = successResult(
      handleMcpMessage(
        request('tools/call', { name: 'get_availability', arguments: { force: true } }),
      ),
    );

    expect(missingSlug).toMatchObject({ isError: true });
    expect(JSON.stringify(missingSlug)).toContain('provide exactly one string slug');
    expect(extraAvailabilityArg).toMatchObject({ isError: true });
    expect(JSON.stringify(extraAvailabilityArg)).toContain('expected an empty arguments object');
  });

  it('returns -32602 for unknown tools and malformed tools/call structures', () => {
    const unknownTool = handleMcpMessage(
      request('tools/call', { name: 'delete_everything', arguments: {} }),
    );
    const malformedParams = handleMcpMessage(request('tools/call', { arguments: {} }));
    const malformedArguments = handleMcpMessage(
      request('tools/call', { name: 'get_availability', arguments: 'nope' }),
    );

    expectError(unknownTool, JSON_RPC_ERROR_CODES.INVALID_PARAMS);
    expectError(malformedParams, JSON_RPC_ERROR_CODES.INVALID_PARAMS);
    expectError(malformedArguments, JSON_RPC_ERROR_CODES.INVALID_PARAMS);
  });

  it('returns -32602 when tools/call params are not an object', () => {
    const response = handleMcpMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: [],
    });
    expectError(response, JSON_RPC_ERROR_CODES.INVALID_PARAMS);
  });

  it('keeps known-tool input errors distinct from malformed tool calls', () => {
    const inputError = handleMcpMessage(
      request('tools/call', { name: 'lookup_case_study', arguments: {} }),
    );
    expect(successResult(inputError)['isError']).toBe(true);
  });
});

describe('MCP JSON-RPC errors', () => {
  it('rejects arrays at current revisions, primitives, and response-shaped objects as -32600', () => {
    for (const input of [[], 'not an object', null, { jsonrpc: '2.0', id: 1, result: {} }]) {
      const response = handleMcpMessage(input);
      expect(response.status).toBe(400);
      expectError(response, JSON_RPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('rejects batch arrays even when every member is otherwise valid', () => {
    const response = handleMcpMessage([request('ping'), request('tools/list')]);
    expect(response.status).toBe(400);
    expectError(response, JSON_RPC_ERROR_CODES.INVALID_REQUEST);
  });

  it('supports 2025-03-26 batches and omits every no-id call response', () => {
    const response = handleMcpPayload(
      [
        request('ping', undefined, 'ping-batch'),
        { jsonrpc: '2.0', method: 'tools/list' },
        request('tools/list', {}, 'tools-batch'),
      ],
      MCP_FALLBACK_PROTOCOL_VERSION,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { jsonrpc: '2.0', id: 'ping-batch', result: {} },
      expect.objectContaining({ jsonrpc: '2.0', id: 'tools-batch' }),
    ]);
  });

  it('returns 202 without a body for an all-notification fallback batch', () => {
    const response = handleMcpPayload(
      [
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', method: 'tools/list' },
      ],
      MCP_FALLBACK_PROTOCOL_VERSION,
    );
    expect(response).toEqual({ status: 202, body: null });
  });

  it('publishes one centralized 32-member fallback batch limit', () => {
    expect(MCP_MAX_BATCH_SIZE).toBe(32);
  });

  it('rejects an oversized fallback batch before dispatching any member', () => {
    let dispatches = 0;
    const response = handleMcpPayload(
      Array.from({ length: MCP_MAX_BATCH_SIZE + 1 }, (_, index) =>
        request('tools/call', { name: 'lookup_case_study', arguments: { slug: 'neev' } }, index),
      ),
      MCP_FALLBACK_PROTOCOL_VERSION,
      {
        lookupPublishedCaseStudy() {
          dispatches += 1;
          return null;
        },
      },
    );

    expect(response).toMatchObject({
      status: 400,
      body: { id: null, error: { code: JSON_RPC_ERROR_CODES.INVALID_REQUEST } },
    });
    expect(dispatches).toBe(0);
  });

  it('rejects an empty fallback batch as one invalid request', () => {
    const response = handleMcpPayload([], MCP_FALLBACK_PROTOCOL_VERSION);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ id: null, error: { code: -32600 } });
  });

  it('returns -32601 for an unknown request method', () => {
    const response = handleMcpMessage(request('resources/list'));
    expect(response.status).toBe(200);
    expectError(response, JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND);
  });

  it('suppresses every no-id call response and preserves tool dispatch side effects', () => {
    for (const message of [
      { jsonrpc: '2.0', method: 'tools/list' },
      { jsonrpc: '2.0', method: 'tools/list', params: [] },
      { jsonrpc: '2.0', method: 'ping' },
    ]) {
      expect(handleMcpMessage(message)).toEqual({ status: 202, body: null });
    }

    let dispatches = 0;
    const response = handleMcpMessage(
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'lookup_case_study', arguments: { slug: 'neev' } },
      },
      {
        lookupPublishedCaseStudy() {
          dispatches += 1;
          return null;
        },
      },
    );
    expect(response).toEqual({ status: 202, body: null });
    expect(dispatches).toBe(1);
  });

  it('accepts valid unknown notifications with HTTP 202 and no body', () => {
    const response = handleMcpMessage({
      jsonrpc: '2.0',
      method: 'notifications/vendor-event',
      params: { value: true },
    });
    expect(response).toEqual({ status: 202, body: null });
  });

  it('accepts string and integer ids but rejects every other id shape as -32600', () => {
    for (const id of ['request-1', 0, -1, 42]) {
      expect(responseBody(handleMcpMessage(request('ping', undefined, id))).id).toBe(id);
    }

    for (const id of [1.5, null, true, {}, []]) {
      const response = handleMcpMessage({ jsonrpc: '2.0', id, method: 'ping' });
      expect(response.status).toBe(400);
      expectError(response, JSON_RPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('redacts unexpected internal errors as -32603', () => {
    const response = handleMcpMessage(
      request('tools/call', { name: 'lookup_case_study', arguments: { slug: 'neev' } }),
      {
        lookupPublishedCaseStudy() {
          throw new Error('/private/content/neev.mdx failed with secret context');
        },
      },
    );
    const body = expectError(response, JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
    expect(body.error.message).toBe('Internal error.');
    expect(JSON.stringify(body)).not.toContain('/private/content');
    expect(JSON.stringify(body)).not.toContain('secret context');
  });
});

describe('MCP published contracts', () => {
  it('keeps discovery tool definitions exactly equal to tools/list', () => {
    expect(mcpDiscovery.capabilities.tools).toEqual(MCP_TOOLS);
    expect(mcpDiscovery.protocolSupport.maxBatchSize).toBe(MCP_MAX_BATCH_SIZE);
  });

  it('documents batch and Accept negotiation without an invalid Accept parameter', () => {
    const post = OPENAPI_SPEC.paths['/api/mcp'].post as unknown as {
      description: string;
      parameters: Array<{ name: string }>;
      requestBody: {
        content: {
          'application/json': { schema: { oneOf: Array<Record<string, unknown>> } };
        };
      };
    };
    const batchSchema = post.requestBody.content['application/json'].schema.oneOf.find(
      (schema) => schema['type'] === 'array',
    );

    expect(post.parameters.map((parameter) => parameter.name.toLowerCase())).not.toContain(
      'accept',
    );
    expect(post.description).toContain('application/json');
    expect(post.description).toContain('text/event-stream');
    expect(batchSchema).toMatchObject({ minItems: 1, maxItems: MCP_MAX_BATCH_SIZE });
  });

  it('documents transport validation errors for every non-POST handler', () => {
    const operations = OPENAPI_SPEC.paths['/api/mcp'] as unknown as Record<
      'get' | 'delete' | 'options',
      { responses: Record<string, unknown> }
    >;

    for (const method of ['get', 'delete', 'options'] as const) {
      expect(operations[method].responses).toHaveProperty('400');
      expect(operations[method].responses).toHaveProperty('403');
    }
  });
});
