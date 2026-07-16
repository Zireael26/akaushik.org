import type { NextApiRequest, NextApiResponse } from 'next';
import { handleMcpHttpRequest } from '@/lib/mcp-http';

const MAX_REQUEST_BYTES = 1024 * 1024;

export const config = {
  api: {
    bodyParser: false,
  },
};

function requestHeaders(request: NextApiRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(name, entry));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

async function readRawBody(request: NextApiRequest): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const detachReader = () => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onAborted);
    };
    const settle = (result: string | null) => {
      if (settled) return;
      settled = true;
      detachReader();
      resolve(result);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      detachReader();
      reject(error);
    };
    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.byteLength;
      if (size <= MAX_REQUEST_BYTES) {
        chunks.push(buffer);
        return;
      }

      // The response can be decided as soon as the limit is crossed. Drain the
      // remaining socket bytes in the background without retaining or awaiting them.
      const ignoreDrainError = () => undefined;
      const stopIgnoringDrainErrors = () => request.off('error', ignoreDrainError);
      request.on('error', ignoreDrainError);
      request.once('close', stopIgnoringDrainErrors);
      settle(null);
      request.resume();
    };
    const onEnd = () => settle(Buffer.concat(chunks).toString('utf8'));
    const onError = (error: Error) => fail(error);
    const onAborted = () => fail(new Error('request body stream aborted'));

    request.once('end', onEnd);
    request.once('error', onError);
    request.once('aborted', onAborted);
    request.on('data', onData);
  });
}

async function sendResponse(
  request: NextApiRequest,
  response: NextApiResponse,
  webResponse: Response,
): Promise<void> {
  response.status(webResponse.status);
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));
  if (request.method?.toUpperCase() === 'HEAD' || webResponse.body === null) {
    response.end();
    return;
  }
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
): Promise<void> {
  const method = request.method?.toUpperCase() ?? 'GET';
  const headers = requestHeaders(request);
  const rawBody = method === 'POST' ? () => readRawBody(request) : '';
  await sendResponse(request, response, await handleMcpHttpRequest(method, headers, rawBody));
}
