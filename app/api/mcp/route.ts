import { handleMcpHttpRequest } from '@/lib/mcp-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return handleMcpHttpRequest(request.method, request.headers, await request.text());
}

export function GET(request: Request): Promise<Response> {
  return handleMcpHttpRequest(request.method, request.headers);
}

export function HEAD(request: Request): Promise<Response> {
  return GET(request);
}

export function DELETE(request: Request): Promise<Response> {
  return GET(request);
}

export function PUT(request: Request): Promise<Response> {
  return GET(request);
}

export function PATCH(request: Request): Promise<Response> {
  return GET(request);
}

export function OPTIONS(request: Request): Promise<Response> {
  return handleMcpHttpRequest(request.method, request.headers);
}
