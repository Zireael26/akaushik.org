export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_QUALIFICATION_ENDPOINTS !== 'true') {
    return new Response('Not Found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 1, message: 'Stream initiation' })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 2, message: 'Worker streaming chunk' })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 3, message: 'Stream verified' })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
