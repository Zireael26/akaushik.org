import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_QUALIFICATION_ENDPOINTS !== 'true') {
    return new Response('Not Found', { status: 404 });
  }

  const host = request.headers.get('host');
  const nonce = request.headers.get('x-nonce');

  return NextResponse.json({
    status: 'ok',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
    host,
    nonceReceived: Boolean(nonce),
  });
}
