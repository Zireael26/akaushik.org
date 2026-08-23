'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PixelField } from '@/components/pixel/PixelField';
import {
  CURSOR_LEAVE_EVENT,
  CURSOR_NEAR_EVENT,
  isCloserCursorTarget,
  type CursorNearDetail,
} from '@/lib/scenes/cursor';
import { pipeline, tileStage, STAGE_ORDER, type StageKind } from '@/lib/pixel/stages';

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
 * The band across the top is one field carrying four detailed stage drawings
 * joined by a conduit. Each tile uses a separate, simpler icon vocabulary for
 * the same subjects, so the section reads as diagram plus legend rather than
 * the same art repeated five times.
 *
 * Hovering or focusing a step emphasises that stage in the band.
 *
 * Fine-pointer proximity is a second input to the same active-stage selection.
 * The cursor engine owns the proximity ramp; the step owns the response, so
 * reduced-motion and touch users keep the band and focus behaviour without
 * inheriting a decorative hover animation.
 *
 * When no pointer is near a step, the band simply shows all four stages at
 * equal weight, which is the correct resting state rather than a degraded one.
 */
export function ProcessPipeline({ steps }: { steps: readonly ProcessStep[] }) {
  const [mouseActive, setMouseActive] = useState<number | null>(null);
  const [focusActive, setFocusActive] = useState<number | null>(null);
  const [cursorActive, setCursorActive] = useState<number | null>(null);
  const [cursorProgress, setCursorProgress] = useState<Record<number, number>>({});
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  const kinds = useMemo(() => steps.map((s) => s.kind), [steps]);
  const active = focusActive ?? mouseActive ?? cursorActive;

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const cursorCandidates = new Map<number, { distance: number }>();

    const selectCursorWinner = (): number | null => {
      let winner: { distance: number; index: number } | null = null;
      for (const [index, candidate] of cursorCandidates) {
        const next = { distance: candidate.distance, index };
        if (isCloserCursorTarget(next, winner)) winner = next;
      }
      return winner?.index ?? null;
    };

    steps.forEach((_, i) => {
      const element = stepRefs.current[i];
      if (!element) return;

      const onNear = (event: Event) => {
        const detail = (event as CustomEvent<CursorNearDetail>).detail;
        const progress = Math.max(0, Math.min(1, Number(detail?.progress) || 0));
        if (detail?.hit === false || progress === 0) {
          cursorCandidates.delete(i);
        } else {
          cursorCandidates.set(i, { distance: Number(detail.distance) });
        }
        setCursorActive(selectCursorWinner());
        setCursorProgress((current) =>
          current[i] === progress ? current : { ...current, [i]: progress },
        );
      };
      const onLeave = () => {
        cursorCandidates.delete(i);
        setCursorActive(selectCursorWinner());
        setCursorProgress((current) => (current[i] === 0 ? current : { ...current, [i]: 0 }));
      };

      element.addEventListener(CURSOR_NEAR_EVENT, onNear);
      element.addEventListener(CURSOR_LEAVE_EVENT, onLeave);
      cleanups.push(() => {
        element.removeEventListener(CURSOR_NEAR_EVENT, onNear);
        element.removeEventListener(CURSOR_LEAVE_EVENT, onLeave);
      });
    });

    return () => {
      cursorCandidates.clear();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [steps]);

  // The band is re-derived when `active` changes; the field treats each entry
  // as a stage and cross-fades, which is what makes the emphasis shift read as
  // a movement rather than a repaint.
  const bandSources = useMemo(
    () => [pipeline(kinds, null), ...kinds.map((_, i) => pipeline(kinds, i))],
    [kinds],
  );

  const tileSources = useMemo(() => steps.map((s) => [tileStage(s.kind)]), [steps]);

  return (
    <div className="px-pipeline">
      <PixelField
        sources={bandSources}
        stage={active === null ? 0 : active + 1}
        preset="band"
        cellSize={3}
        className="px-pipeline-band"
        label={`The method: ${steps.map((s) => s.label.replace(/^\d+\s*·\s*/, '')).join(', then ')}.`}
      />

      <div className="px-pipeline-grid">
        {steps.map((step, i) => {
          const progress = cursorProgress[i] ?? 0;
          return (
            <div
              key={step.kind}
              ref={(element) => {
                stepRefs.current[i] = element;
              }}
              data-mstep={String(i)}
              data-pixel-hover=""
              data-pixel-cursor-response={progress > 0 ? 'active' : undefined}
              className="px-pipeline-step"
              style={
                {
                  '--px-pipeline-cursor-progress': progress,
                } as CSSProperties
              }
              tabIndex={0}
              onMouseEnter={() => setMouseActive(i)}
              onMouseLeave={() => setMouseActive((current) => (current === i ? null : current))}
              onFocus={() => setFocusActive(i)}
              onBlur={() => setFocusActive((current) => (current === i ? null : current))}
            >
              <div className="px-pipeline-tile">
                <PixelField
                  sources={tileSources[i]!}
                  preset="tile"
                  color="ink"
                  gain={1}
                  scatter={0}
                  shapeNoise={0}
                  ambient={false}
                  seed={i * 137}
                  className="px-pipeline-tile-canvas"
                />
              </div>
              <div className={`px-step is-${step.tone}`}>{step.label}</div>
              <p className="px-step-body">{step.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { STAGE_ORDER };
