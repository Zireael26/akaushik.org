import { describe, expect, it } from 'vitest';
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
