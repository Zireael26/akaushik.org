import { describe, expect, it, vi } from 'vitest';
import { handleMcpHttpRequest } from './mcp-http';

function validPostHeaders(overrides?: Record<string, string>): Headers {
  return new Headers({
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2025-11-25',
    Origin: 'https://akaushik.org',
    ...overrides,
  });
}

describe('MCP HTTP transport boundary', () => {
  it('origin-checks every method, including raw TRACE', async () => {
    for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE']) {
      const response = await handleMcpHttpRequest(
        method,
        new Headers({ Origin: 'https://evil.example' }),
      );
      expect(response.status, method).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ error: { code: -32600 } });
    }
  });

  it('fails closed when Origin is duplicated', async () => {
    const headers = validPostHeaders();
    headers.append('Origin', 'https://evil.example');
    const readBody = vi.fn(async () => '{}');

    const response = await handleMcpHttpRequest('POST', headers, readBody);

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(readBody).not.toHaveBeenCalled();
  });

  it('returns 405 with Allow for every non-POST, non-OPTIONS method', async () => {
    for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'TRACE']) {
      const response = await handleMcpHttpRequest(method, new Headers());
      expect(response.status, method).toBe(405);
      expect(response.headers.get('allow')).toBe('POST, OPTIONS');
      await expect(response.json()).resolves.toMatchObject({ error: { code: -32601 } });
    }
  });

  it('keeps OPTIONS bodyless and advertises the transport headers', async () => {
    const response = await handleMcpHttpRequest(
      'OPTIONS',
      new Headers({ Origin: 'https://akaushik.org' }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://akaushik.org');
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });

  it('keeps bounded security headers on transport errors', async () => {
    const responses = await Promise.all([
      handleMcpHttpRequest('GET', new Headers({ Origin: 'https://evil.example' })),
      handleMcpHttpRequest('GET', new Headers()),
      handleMcpHttpRequest('POST', validPostHeaders(), async () => null),
      handleMcpHttpRequest('POST', validPostHeaders(), async () => Promise.reject(new Error('x'))),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([403, 405, 413, 400]);
    for (const response of responses) {
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-security-policy')).toBe(
        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      );
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    }
  });

  it('rejects invalid POST headers without invoking a lazy body reader', async () => {
    const readBody = vi.fn(async () => '{}');

    const response = await handleMcpHttpRequest(
      'POST',
      validPostHeaders({ Origin: 'https://evil.example' }),
      readBody,
    );

    expect(response.status).toBe(403);
    expect(readBody).not.toHaveBeenCalled();
  });

  it('invokes a valid POST body reader exactly once', async () => {
    const readBody = vi.fn(async () => JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }));

    const response = await handleMcpHttpRequest('POST', validPostHeaders(), readBody);

    expect(response.status).toBe(200);
    expect(readBody).toHaveBeenCalledOnce();
  });

  it('maps a rejected body reader to a bounded parse-error response', async () => {
    const response = await handleMcpHttpRequest(
      'POST',
      validPostHeaders(),
      vi.fn(async () => Promise.reject(new Error('stream failed'))),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    await expect(response.json()).resolves.toMatchObject({ error: { code: -32700 } });
  });

  it('rejects a lazily detected oversized POST before parsing it', async () => {
    const response = await handleMcpHttpRequest(
      'POST',
      validPostHeaders(),
      vi.fn(async () => null),
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: -32600 } });
  });
});
