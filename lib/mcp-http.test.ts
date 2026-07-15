import { describe, expect, it } from 'vitest';
import { handleMcpHttpRequest } from './mcp-http';

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
    expect(await response.text()).toBe('');
  });

  it('rejects an oversized POST before parsing it', async () => {
    const response = await handleMcpHttpRequest(
      'POST',
      new Headers({
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      }),
      null,
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: -32600 } });
  });
});
