import { describe, expect, it, vi } from 'vitest';
import * as route from './route';

type RouteHandler = (request: Request) => Response | Promise<Response>;

describe('MCP unsupported HTTP methods', () => {
  it('origin-checks PUT and PATCH before returning method not allowed', async () => {
    for (const method of ['PUT', 'PATCH'] as const) {
      const handler = Reflect.get(route, method) as RouteHandler | undefined;
      expect(handler, `${method} must have an explicit route handler`).toBeTypeOf('function');
      if (!handler) continue;

      const forbidden = await handler(
        new Request('https://akaushik.org/api/mcp', {
          method,
          headers: { Origin: 'https://evil.example' },
        }),
      );
      expect(forbidden.status).toBe(403);
      await expect(forbidden.json()).resolves.toMatchObject({ error: { code: -32600 } });

      const methodNotAllowed = await handler(
        new Request('https://akaushik.org/api/mcp', { method }),
      );
      expect(methodNotAllowed.status).toBe(405);
      expect(methodNotAllowed.headers.get('allow')).toBe('POST, OPTIONS');
    }
  });

  it('keeps HEAD origin-guarded', async () => {
    const response = await route.HEAD(
      new Request('https://akaushik.org/api/mcp', {
        method: 'HEAD',
        headers: { Origin: 'https://evil.example' },
      }),
    );
    expect(response.status).toBe(403);
  });
});

describe('MCP POST body reads', () => {
  function postRequest(): Request {
    return new Request('https://akaushik.org/api/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-11-25',
        Origin: 'https://akaushik.org',
      },
      body: '{}',
    });
  }

  it('rejects invalid headers before consuming the request body', async () => {
    const request = postRequest();
    request.headers.set('Origin', 'https://evil.example');
    const readBody = vi.spyOn(request, 'text');

    const response = await route.POST(request);

    expect(response.status).toBe(403);
    expect(readBody).not.toHaveBeenCalled();
  });

  it('maps a rejected body reader to the bounded parse-error response', async () => {
    const request = postRequest();
    const readBody = vi.spyOn(request, 'text').mockRejectedValue(new Error('stream failed'));

    const response = await route.POST(request);

    expect(readBody).toHaveBeenCalledOnce();
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    await expect(response.json()).resolves.toMatchObject({ error: { code: -32700 } });
  });
});
