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
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      tooLarge = true;
    } else if (!tooLarge) {
      chunks.push(buffer);
    }
  }
  return tooLarge ? null : Buffer.concat(chunks).toString('utf8');
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
  const rawBody = method === 'POST' ? await readRawBody(request) : '';
  await sendResponse(request, response, await handleMcpHttpRequest(method, headers, rawBody));
}
