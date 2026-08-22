'use client';

import { PixelField } from '@/components/pixel/PixelField';
import { prompt, seedFrom } from '@/lib/pixel/sources';

export function ApiDocsField() {
  return <PixelField sources={[prompt]} preset="strip" seed={seedFrom('api-docs')} className="px-docs-field" />;
}
