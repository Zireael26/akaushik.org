import { expect, test, type APIRequestContext } from '@playwright/test';

const PROTOCOL_VERSION = '2025-11-25';
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;
const FALLBACK_PROTOCOL_VERSION = '2025-03-26';
const MCP_HEADERS = {
  Accept: 'application/json, text/event-stream',
  'Content-Type': 'application/json',
  'MCP-Protocol-Version': PROTOCOL_VERSION,
};

function rpc(method: string, params?: Record<string, unknown>, id: string | number = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    ...(params === undefined ? {} : { params }),
  };
}

async function postRpc(
  request: APIRequestContext,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return request.post('/api/mcp', {
    headers: { ...MCP_HEADERS, ...headers },
    data: body,
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('MCP Streamable HTTP endpoint', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'MCP assertions exercise HTTP behavior; one engine is enough.',
  );

  test('initializes without server state, accepts initialized, and responds to ping', async ({
    request,
  }) => {
    const initialize = await postRpc(
      request,
      rpc('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'playwright', version: '1.0.0' },
      }),
    );
    expect(initialize.status()).toBe(200);
    expect(initialize.headers()['content-type']).toMatch(/application\/json/);
    expect(initialize.headers()['mcp-session-id']).toBeUndefined();
    await expect(initialize.json()).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'akaushik-org', version: '1.0.0' },
      },
    });

    const initialized = await postRpc(request, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(initialized.status()).toBe(202);
    expect((await initialized.body()).byteLength).toBe(0);

    const invalidInitialized = await postRpc(
      request,
      rpc('notifications/initialized', undefined, 7),
    );
    expect(invalidInitialized.status()).toBe(400);
    await expect(invalidInitialized.json()).resolves.toMatchObject({
      id: 7,
      error: { code: -32600 },
    });

    const ping = await postRpc(request, rpc('ping', undefined, 'ping-1'));
    expect(ping.status()).toBe(200);
    await expect(ping.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 'ping-1',
      result: {},
    });
  });

  test('echoes supported initialize versions and negotiates unsupported preferences to current', async ({
    request,
  }) => {
    for (const protocolVersion of SUPPORTED_PROTOCOL_VERSIONS) {
      const response = await postRpc(
        request,
        rpc('initialize', {
          protocolVersion,
          capabilities: {},
          clientInfo: { name: 'playwright', version: '1.0.0' },
        }),
        { 'MCP-Protocol-Version': protocolVersion },
      );
      expect(response.status()).toBe(200);
      expect((await response.json()).result.protocolVersion).toBe(protocolVersion);
    }

    const negotiated = await postRpc(
      request,
      rpc('initialize', {
        protocolVersion: '2099-01-01',
        capabilities: {},
        clientInfo: { name: 'playwright', version: '1.0.0' },
      }),
    );
    expect(negotiated.status()).toBe(200);
    expect((await negotiated.json()).result.protocolVersion).toBe(PROTOCOL_VERSION);
  });

  test('accepts explicit compatibility versions and missing later headers as 2025-03-26', async ({
    request,
  }) => {
    for (const protocolVersion of SUPPORTED_PROTOCOL_VERSIONS) {
      const explicit = await postRpc(request, rpc('ping'), {
        'MCP-Protocol-Version': protocolVersion,
      });
      expect(explicit.status()).toBe(200);
    }

    const fallback = await request.post('/api/mcp', {
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      data: rpc('ping', undefined, FALLBACK_PROTOCOL_VERSION),
    });
    expect(fallback.status()).toBe(200);
    expect((await fallback.json()).id).toBe(FALLBACK_PROTOCOL_VERSION);
  });

  test('lists exactly the two advertised read-only tools', async ({ request }) => {
    const response = await postRpc(request, rpc('tools/list', {}));
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'lookup_case_study',
      'get_availability',
    ]);
    for (const tool of body.result.tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });

  test('returns published case-study Markdown as structured and mirrored text content', async ({
    request,
  }) => {
    const response = await postRpc(
      request,
      rpc('tools/call', {
        name: 'lookup_case_study',
        arguments: { slug: 'neev' },
      }),
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.result.isError).toBe(false);
    expect(body.result.structuredContent).toMatchObject({
      slug: 'neev',
      title: 'Neev',
      url: 'https://akaushik.org/work/neev',
    });
    expect(body.result.structuredContent.markdown).toContain('# Neev');
    expect(JSON.parse(body.result.content[0].text)).toEqual(body.result.structuredContent);
  });

  test('returns a non-disclosing error for an unavailable case-study slug', async ({ request }) => {
    const response = await postRpc(
      request,
      rpc('tools/call', {
        name: 'lookup_case_study',
        arguments: { slug: 'does-not-exist' },
      }),
    );
    expect(response.status()).toBe(200);
    const bodyText = await response.text();
    const body = JSON.parse(bodyText);
    expect(body.result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Case study not found or unavailable. Choose a published slug from https://akaushik.org/api/case-studies.',
        },
      ],
      isError: true,
    });
    expect(bodyText).not.toContain('frontmatter');
    expect(bodyText).not.toContain('content/case-studies');
  });

  test('returns current public availability', async ({ request }) => {
    const response = await postRpc(
      request,
      rpc('tools/call', { name: 'get_availability', arguments: {} }),
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.result.structuredContent).toEqual({
      status: 'open',
      capacity: 'one project this quarter',
      contactUrl: 'https://akaushik.org/#contact',
      email: 'hello@akaushik.org',
    });
  });

  test('uses -32700 only for malformed JSON and -32600 for parsed invalid input', async ({
    request,
  }) => {
    const malformed = await request.post('/api/mcp', {
      headers: MCP_HEADERS,
      data: Buffer.from('{'),
    });
    expect(malformed.status()).toBe(400);
    expect((await malformed.json()).error.code).toBe(-32700);

    const responseShaped = await postRpc(request, { jsonrpc: '2.0', id: 1, result: {} });
    expect(responseShaped.status()).toBe(400);
    expect((await responseShaped.json()).error.code).toBe(-32600);

    const batch = await postRpc(request, [rpc('ping'), rpc('tools/list')]);
    expect(batch.status()).toBe(400);
    expect((await batch.json()).error.code).toBe(-32600);
  });

  test('supports batches only for the 2025-03-26 fallback', async ({ request }) => {
    const fallback = await request.post('/api/mcp', {
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      data: [
        rpc('ping', undefined, 'fallback-ping'),
        { jsonrpc: '2.0', method: 'tools/list' },
        rpc('tools/list', {}, 'fallback-tools'),
      ],
    });
    expect(fallback.status()).toBe(200);
    const body = await fallback.json();
    expect(body).toHaveLength(2);
    expect(body.map((response: { id: string }) => response.id)).toEqual([
      'fallback-ping',
      'fallback-tools',
    ]);

    const notificationOnly = await request.post('/api/mcp', {
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      data: [
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', method: 'tools/list' },
      ],
    });
    expect(notificationOnly.status()).toBe(202);
    expect((await notificationOnly.body()).byteLength).toBe(0);

    const oversized = await request.post('/api/mcp', {
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      data: Array.from({ length: 33 }, (_, index) => rpc('ping', undefined, index)),
    });
    expect(oversized.status()).toBe(400);
    expect((await oversized.json()).error.code).toBe(-32600);

    const explicitCurrent = await postRpc(request, [rpc('ping')]);
    expect(explicitCurrent.status()).toBe(400);
    expect((await explicitCurrent.json()).error.code).toBe(-32600);
  });

  test('returns -32601 for unknown methods and -32602 for malformed or unknown tool calls', async ({
    request,
  }) => {
    const unknown = await postRpc(request, rpc('resources/list'));
    expect(unknown.status()).toBe(200);
    expect((await unknown.json()).error.code).toBe(-32601);

    const unknownTool = await postRpc(
      request,
      rpc('tools/call', { name: 'not_a_tool', arguments: {} }),
    );
    expect(unknownTool.status()).toBe(200);
    expect((await unknownTool.json()).error.code).toBe(-32602);

    const malformedCall = await postRpc(request, rpc('tools/call', { arguments: {} }));
    expect(malformedCall.status()).toBe(200);
    expect((await malformedCall.json()).error.code).toBe(-32602);
  });

  test('returns actionable isError tool results for known-tool argument validation', async ({
    request,
  }) => {
    const lookup = await postRpc(
      request,
      rpc('tools/call', { name: 'lookup_case_study', arguments: {} }),
    );
    expect(lookup.status()).toBe(200);
    const lookupResult = (await lookup.json()).result;
    expect(lookupResult.isError).toBe(true);
    expect(lookupResult.content[0].text).toContain('provide exactly one string slug');

    const availability = await postRpc(
      request,
      rpc('tools/call', { name: 'get_availability', arguments: { force: true } }),
    );
    expect(availability.status()).toBe(200);
    const availabilityResult = (await availability.json()).result;
    expect(availabilityResult.isError).toBe(true);
    expect(availabilityResult.content[0].text).toContain('expected an empty arguments object');
  });

  test('requires both Accept media types and rejects unsupported content or protocol versions', async ({
    request,
  }) => {
    const contentType = await request.post('/api/mcp', {
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'text/plain',
      },
      data: JSON.stringify(rpc('ping')),
    });
    expect(contentType.status()).toBe(415);
    expect((await contentType.json()).error.code).toBe(-32600);

    for (const accept of [undefined, 'application/json', 'text/event-stream']) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accept !== undefined) headers['Accept'] = accept;
      const response = await request.post('/api/mcp', { headers, data: rpc('ping') });
      expect(response.status()).toBe(406);
      expect((await response.json()).error.code).toBe(-32600);
    }

    const protocol = await postRpc(request, rpc('ping'), {
      'MCP-Protocol-Version': '2099-01-01',
    });
    expect(protocol.status()).toBe(400);
    expect((await protocol.json()).error.code).toBe(-32602);
  });

  test('accepts valid ids, rejects invalid ids, and suppresses every no-id response', async ({
    request,
  }) => {
    for (const id of ['request-1', 0, -1, 42]) {
      const response = await postRpc(request, rpc('ping', undefined, id));
      expect(response.status()).toBe(200);
      expect((await response.json()).id).toBe(id);
    }

    for (const id of [1.5, null]) {
      const response = await postRpc(request, { jsonrpc: '2.0', id, method: 'ping' });
      expect(response.status()).toBe(400);
      expect((await response.json()).error.code).toBe(-32600);
    }

    const notification = await postRpc(request, {
      jsonrpc: '2.0',
      method: 'notifications/vendor-event',
      params: { value: true },
    });
    expect(notification.status()).toBe(202);
    expect((await notification.body()).byteLength).toBe(0);

    const requestShapedNotification = await postRpc(request, {
      jsonrpc: '2.0',
      method: 'tools/list',
    });
    expect(requestShapedNotification.status()).toBe(202);
    expect((await requestShapedNotification.body()).byteLength).toBe(0);
  });

  test('accepts no Origin or the canonical Origin and rejects every other Origin', async ({
    request,
  }) => {
    const serverClient = await postRpc(request, rpc('ping'));
    expect(serverClient.status()).toBe(200);
    expect(serverClient.headers()['access-control-allow-origin']).toBeUndefined();

    const sameOrigin = await postRpc(request, rpc('ping'), {
      Origin: 'https://akaushik.org',
    });
    expect(sameOrigin.status()).toBe(200);
    expect(sameOrigin.headers()['access-control-allow-origin']).toBe('https://akaushik.org');

    const crossOrigin = await postRpc(request, rpc('ping'), {
      Origin: 'https://akaushik.org.evil.example',
    });
    expect(crossOrigin.status()).toBe(403);
    expect((await crossOrigin.json()).error.code).toBe(-32600);
    expect(crossOrigin.headers()['access-control-allow-origin']).toBeUndefined();
  });

  test('origin-checks every supported route method before method handling', async ({ request }) => {
    const get = await request.get('/api/mcp');
    expect(get.status()).toBe(405);
    expect(get.headers()['allow']).toBe('POST, OPTIONS');

    for (const method of ['HEAD', 'PUT', 'PATCH', 'DELETE']) {
      const response = await request.fetch('/api/mcp', { method });
      expect(response.status()).toBe(405);
    }

    const options = await request.fetch('/api/mcp', {
      method: 'OPTIONS',
      headers: { Origin: 'https://akaushik.org' },
    });
    expect(options.status()).toBe(204);
    expect(options.headers()['access-control-allow-origin']).toBe('https://akaushik.org');
    expect(options.headers()['access-control-allow-methods']).toBe('POST, OPTIONS');
    expect((await options.body()).byteLength).toBe(0);

    for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      const crossOrigin = await request.fetch('/api/mcp', {
        method,
        headers: { Origin: 'https://evil.example' },
      });
      expect(crossOrigin.status()).toBe(403);
      if (method !== 'HEAD') {
        expect((await crossOrigin.json()).error.code).toBe(-32600);
      }

      const invalidVersion = await request.fetch('/api/mcp', {
        method,
        headers: { 'MCP-Protocol-Version': '2099-01-01' },
      });
      expect(invalidVersion.status()).toBe(400);
      if (method !== 'HEAD') {
        expect((await invalidVersion.json()).error.code).toBe(-32602);
      }
    }
  });

});
