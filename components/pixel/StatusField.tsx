'use client';

import { PixelField } from '@/components/pixel/PixelField';
import { brokenGraph, errorGraph } from '@/lib/pixel/sources';

export type StatusFieldProps = {
  variant: 'not-found' | 'error';
};

const SOURCES = {
  'not-found': brokenGraph,
  error: errorGraph,
} as const;

/**
 * Decorative hero field for the status pages. Source functions stay inside the
 * client island; callers choose a serializable status variant only.
 */
export function StatusField({ variant }: StatusFieldProps) {
  return (
    <PixelField
      sources={[SOURCES[variant]]}
      preset="hero"
      seed={0}
      className="px-status-field"
    />
  );
}
