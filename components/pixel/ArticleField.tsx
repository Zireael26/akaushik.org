'use client';

import { useEffect, useRef } from 'react';
import { mountField } from '@/lib/pixel/field';
import { seedFrom, trellis } from '@/lib/pixel/sources';

export type ArticleFieldProps = {
  slug: string;
  topic?: string;
};

/**
 * Per-article pixel header — a thin field above the article chrome.
 *
 * Same slug produces the same texture on every load, via seedFrom(slug) into
 * the shared hash. Uses the strip preset (cell 5, gain 1.15, shapeNoise 0.3,
 * scatter 0.6), which is the size the field was tuned for at this height.
 *
 * Topic handling: the brief says to pick a source by topic only if frontmatter
 * topics map cleanly, otherwise use one restrained source varied only by the
 * per-slug seed. WritingFrontmatter in lib/content.ts carries no topic field
 * at all and none of the files under content/writing/*.mdx set one, so a
 * per-topic map here would be invented art. trellis is the restrained choice:
 * a lattice, not an illustration. It reads as texture at strip height, survives
 * the 5px cell without losing its structure, and leaves the hero exhibits
 * (agentGraph, prompt, the "AK." wordmark) where they belong. If topics are
 * added later, branch on topic right where trellis is passed below.
 *
 * React surface is only a ref, an effect, and a disposer — the field owns its
 * rAF, resize listener, and theme subscription and hands back a teardown, so
 * StrictMode's double-mount in dev leaves one loop. The canvas is decorative:
 * aria-hidden and never focusable, with no label to duplicate surrounding copy.
 */
export function ArticleField({ slug, topic: _topic }: ArticleFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const handle = mountField(canvas, {
      sources: [trellis],
      preset: 'strip',
      seed: seedFrom(slug),
    });
    return () => handle.dispose();
  }, [slug]);

  return <canvas ref={ref} className="px-article-field" aria-hidden="true" />;
}
