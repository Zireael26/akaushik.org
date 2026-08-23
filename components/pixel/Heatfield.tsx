'use client';

import { PixelField } from '@/components/pixel/PixelField';
import { neuralTraining } from '@/lib/pixel/neural';
import { prompt, trellis, wordmark } from '@/lib/pixel/sources';

/**
 * The hero field.
 *
 * Exhibit 0 is a small network training on repeat — forward pass, loss,
 * backward pass, weight update — and it is what the page shows by default. The
 * other three cycle in on click.
 *
 * It replaces the static agent graph that was here: the graph said "this person
 * works on agents" and then stopped, while this says the same thing and keeps
 * saying it. The agent graph's swing is gone with it — a network mid-training
 * should not also be swinging on a spring, and `animate` and `swing` both own
 * `base`, so the engine refuses to run them together anyway.
 *
 * `animate: 2` rebuilds the source every second frame. That is the expensive
 * path — a full offscreen redraw plus a getImageData over ~26k cells — so it is
 * deliberately not the default for fields that do not need it.
 */
const EXHIBITS = [neuralTraining, prompt, trellis, wordmark('AK.')];

export function Heatfield() {
  return (
    <div className="px-heatfield">
      <PixelField
        sources={EXHIBITS}
        preset="hero"
        cellSize={5}
        interactive
        cycleOnClick
        animate={2}
      />
    </div>
  );
}
