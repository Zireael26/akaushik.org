'use client';

import { useMemo, useState } from 'react';
import { PixelField } from '@/components/pixel/PixelField';
import { pipeline, stage, STAGE_ORDER, type StageKind } from '@/lib/pixel/stages';

export type ProcessStep = {
  kind: StageKind;
  /** "01 · Read" */
  label: string;
  tone: 'cobalt' | 'amber' | 'red' | 'ink';
  body: string;
};

/**
 * The method, as a pipeline.
 *
 * The band across the top is one field carrying all four stage glyphs joined by
 * a conduit with packets moving along it. Below it, each step gets its own small
 * field showing the same glyph beside its caption.
 *
 * Hovering or focusing a step swells that stage in the band and dims the others,
 * which is the whole reason the band and the tiles draw from the same glyph
 * library rather than being two sets of art that have to be kept in sync.
 *
 * Hover state is deliberately not persisted anywhere: with no pointer, the band
 * simply shows all four stages at equal weight, which is the correct resting
 * state rather than a degraded one.
 */
export function ProcessPipeline({ steps }: { steps: readonly ProcessStep[] }) {
  const [active, setActive] = useState<number | null>(null);

  const kinds = useMemo(() => steps.map((s) => s.kind), [steps]);

  // The band is re-derived when `active` changes; the field treats each entry
  // as a stage and cross-fades, which is what makes the emphasis shift read as
  // a movement rather than a repaint.
  const bandSources = useMemo(
    () => [pipeline(kinds, null), ...kinds.map((_, i) => pipeline(kinds, i))],
    [kinds],
  );

  const tileSources = useMemo(() => steps.map((s) => [stage(s.kind)]), [steps]);

  return (
    <div className="px-pipeline">
      <PixelField
        sources={bandSources}
        stage={active === null ? 0 : active + 1}
        preset="band"
        className="px-pipeline-band"
        label={`The method: ${steps.map((s) => s.label.replace(/^\d+\s*·\s*/, '')).join(', then ')}.`}
      />

      <div className="px-pipeline-grid">
        {steps.map((step, i) => (
          <div
            key={step.kind}
            data-mstep={String(i)}
            className="px-pipeline-step"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
            onFocus={() => setActive(i)}
            onBlur={() => setActive((cur) => (cur === i ? null : cur))}
          >
            <div className="px-pipeline-tile">
              <PixelField
                sources={tileSources[i]!}
                preset="tile"
                ambient={false}
                seed={i * 137}
                className="px-pipeline-tile-canvas"
              />
            </div>
            <div className={`px-step is-${step.tone}`}>{step.label}</div>
            <p className="px-step-body">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export { STAGE_ORDER };
