'use client';

import { PixelField } from '@/components/pixel/PixelField';
import { agentGraph, prompt, trellis, wordmark } from '@/lib/pixel/sources';

/**
 * The hero field: four exhibits that cycle on click.
 *
 * Now a thin arrangement of `PixelField` rather than its own engine — the
 * heatfield was the first field, and generalising it turned this file into a
 * list of sources.
 *
 * The triple-click secret entrance is gone. It opened a hidden wing that this
 * site does not have, so what shipped was a dead gesture: three clicks in the
 * middle of the hero that swallowed the exhibit cycle and fired an event with
 * nothing listening. Its only remaining trace is that the agent graph's root
 * node sits high and centred, which is where it belongs anyway.
 */
const EXHIBITS = [agentGraph, prompt, trellis, wordmark('AK.')];

export function Heatfield() {
  return (
    <div className="px-heatfield">
      <PixelField sources={EXHIBITS} preset="hero" interactive cycleOnClick swing />
    </div>
  );
}
