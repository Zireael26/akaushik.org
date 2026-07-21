import { Readable } from 'node:stream';
import type { NextApiRequest, NextApiResponse } from 'next';
import { describe, expect, it } from 'vitest';
import handler, { config } from '../pages/api/mcp';

const MAX_REQUEST_BYTES = 1024 * 1024;

const VALID_HEADERS = {
  accept: 'application/json, text/event-stream',
  'content-type': 'application/json',
  'mcp-protocol-version': '2025-11-25',
  origin: 'https://akaushik.org',
};

interface ResponseState {
  status: number;
  headers: Map<string, string | number | readonly string[]>;
  body: Buffer;
}

function requestFrom(
  readable: Readable,
  headers: Record<string, string | string[]> = VALID_HEADERS,
): NextApiRequest {
  return Object.assign(readable, {
    method: 'POST',
    headers: { ...headers },
  }) as unknown as NextApiRequest;
}

function responseDouble(): { response: NextApiResponse; state: ResponseState } {
  const state: ResponseState = {
    status: 200,
    headers: new Map(),
    body: Buffer.alloc(0),
  };
  const response = {
    status(status: number) {
      state.status = status;
      return response;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      state.headers.set(name.toLowerCase(), value);
      return response;
    },
    end(body?: Buffer | Uint8Array | string) {
      state.body = body === undefined ? Buffer.alloc(0) : Buffer.from(body);
      return response;
    },
  };
  return { response: response as unknown as NextApiResponse, state };
}

function chunkedRequest(
  chunks: Array<Buffer | string>,
  headers: Record<string, string | string[]> = VALID_HEADERS,
): { readable: Readable; request: NextApiRequest; reads: () => number } {
  let readCount = 0;
  let index = 0;
  const readable = new Readable({
    read() {
      readCount += 1;
      this.push(chunks[index++] ?? null);
    },
  });
  return { readable, request: requestFrom(readable, headers), reads: () => readCount };
}

function finiteRequest(
  body: string,
  headers: Record<string, string | string[]> = VALID_HEADERS,
): { request: NextApiRequest; reads: () => number } {
  return chunkedRequest([body], headers);
}

describe('raw MCP Pages API boundary', () => {
  it('pins framework body parsing off', () => {
    expect(config).toEqual({ api: { bodyParser: false } });
  });

  it.each([
    ['foreign Origin', { origin: 'https://evil.example' }, 403],
    ['unsupported Content-Type', { 'content-type': 'text/plain' }, 415],
    ['incomplete Accept', { accept: 'application/json' }, 406],
    ['unsupported protocol', { 'mcp-protocol-version': '2099-01-01' }, 400],
  ])('rejects %s without consuming the request stream', async (_label, overrides, status) => {
    const source = finiteRequest('{}', { ...VALID_HEADERS, ...overrides });
    const { response, state } = responseDouble();

    await handler(source.request, response);

    expect(state.status).toBe(status);
    expect(source.reads()).toBe(0);
  });

  it('consumes a valid request and returns the protocol response', async () => {
    const source = finiteRequest(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }));
    const { response, state } = responseDouble();

    await handler(source.request, response);

    expect(source.reads()).toBeGreaterThan(0);
    expect(state.status).toBe(200);
    expect(JSON.parse(state.body.toString('utf8'))).toMatchObject({ id: 1, result: {} });
  });

  it('accepts an exactly 1 MiB fragmented body before parsing', async () => {
    const exactLimit = Buffer.concat([
      Buffer.from('"'),
      Buffer.alloc(MAX_REQUEST_BYTES - 2, 'x'),
      Buffer.from('"'),
    ]);
    const source = chunkedRequest([
      exactLimit.subarray(0, MAX_REQUEST_BYTES / 2),
      exactLimit.subarray(MAX_REQUEST_BYTES / 2),
    ]);
    const { response, state } = responseDouble();

    await handler(source.request, response);

    expect(state.status).toBe(400);
    expect(JSON.parse(state.body.toString('utf8'))).toMatchObject({ error: { code: -32600 } });
  });

  it('rejects a fragmented multibyte body at exactly 1 MiB plus one byte', async () => {
    const source = chunkedRequest([Buffer.alloc(MAX_REQUEST_BYTES - 2, 'x'), Buffer.from('€')]);
    const { response, state } = responseDouble();

    await handler(source.request, response);

    expect(state.status).toBe(413);
    expect(JSON.parse(state.body.toString('utf8'))).toMatchObject({ error: { code: -32600 } });
  });

  it('maps body-stream failures to a bounded parse-error response', async () => {
    const request = requestFrom(
      new Readable({
        read() {
          this.destroy(new Error('stream failed'));
        },
      }),
    );
    const { response, state } = responseDouble();

    await expect(handler(request, response)).resolves.toBeUndefined();

    expect(state.status).toBe(400);
    expect(state.headers.get('cache-control')).toBe('no-store');
    const body = state.body.toString('utf8');
    expect(JSON.parse(body)).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error.' },
    });
    expect(body).not.toContain('stream failed');
  });

  it('returns 413 without awaiting the end of an oversized stream', async () => {
    let pushed = false;
    const readable = new Readable({
      read() {
        if (pushed) return;
        pushed = true;
        this.push(Buffer.alloc(1024 * 1024 + 1, 'x'));
      },
    });
    const request = requestFrom(readable);
    const { response, state } = responseDouble();
    const handling = handler(request, response);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const completedPromptly = await Promise.race([
      handling.then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), 250);
      }),
    ]);
    if (timer !== undefined) clearTimeout(timer);
    const destroyedBeforeCleanup = readable.destroyed;
    const endedBeforeCleanup = readable.readableEnded;
    expect(() => readable.emit('error', new Error('late drain failure'))).not.toThrow();
    expect(() => readable.emit('aborted')).not.toThrow();
    readable.destroy();
    await handling.catch(() => undefined);

    expect(completedPromptly).toBe(true);
    expect(destroyedBeforeCleanup).toBe(false);
    expect(endedBeforeCleanup).toBe(false);
    expect(state.status).toBe(413);
    expect(JSON.parse(state.body.toString('utf8'))).toMatchObject({ error: { code: -32600 } });
  });
});
