import { getPortalDal } from '@/lib/portal-dal';
import { serveAuthorizedMedia, type R2Bucket } from '@/lib/media';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const dal = await getPortalDal();
  if (!dal) {
    return new Response('503 Service Unavailable', { status: 503 });
  }

  const { env } = await getCloudflareContext();
  const bucket = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
  if (!bucket) {
    return new Response('503 Service Unavailable (Media Storage Unbound)', { status: 503 });
  }

  return serveAuthorizedMedia(request, assetId, { dal, bucket });
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const dal = await getPortalDal();
  if (!dal) {
    return new Response(null, { status: 503 });
  }

  const { env } = await getCloudflareContext();
  const bucket = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
  if (!bucket) {
    return new Response(null, { status: 503 });
  }

  return serveAuthorizedMedia(request, assetId, { dal, bucket });
}
