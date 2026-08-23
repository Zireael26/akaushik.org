// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURSOR_LEAVE_EVENT, CURSOR_NEAR_EVENT } from '@/lib/scenes/cursor';
import { ProcessPipeline, type ProcessStep } from './ProcessPipeline';

vi.mock('@/components/pixel/PixelField', () => ({
  PixelField: ({
    className,
    cellSize,
    stage,
  }: {
    className?: string;
    cellSize?: number;
    stage?: number;
  }) =>
    createElement('canvas', {
      className,
      'data-cell-size': cellSize === undefined ? undefined : String(cellSize),
      'data-stage': stage === undefined ? undefined : String(stage),
    }),
}));

const STEPS: readonly ProcessStep[] = [
  { kind: 'read', label: '01 · Read', tone: 'cobalt', body: 'Take the record seriously.' },
  { kind: 'spec', label: '02 · Spec', tone: 'amber', body: 'Make the decision explicit.' },
  { kind: 'build', label: '03 · Build', tone: 'red', body: 'Put the useful thing together.' },
  { kind: 'harden', label: '04 · Harden', tone: 'ink', body: 'Leave it stronger than found.' },
];

describe('ProcessPipeline cursor interaction', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('moves and reverses the band stage from bubbling cursor events', async () => {
    await act(async () => {
      root.render(<ProcessPipeline steps={STEPS} />);
    });

    const band = container.querySelector<HTMLCanvasElement>('.px-pipeline-band');
    const steps = container.querySelectorAll<HTMLElement>('.px-pipeline-step');
    const secondTile = steps[1]!;

    expect(band?.dataset.stage).toBe('0');
    expect(band?.dataset.cellSize).toBe('3');
    expect(steps).toHaveLength(4);
    expect([...steps].every((step) => step.hasAttribute('data-pixel-hover'))).toBe(true);

    await act(async () => {
      secondTile.dispatchEvent(
        new CustomEvent(CURSOR_NEAR_EVENT, {
          bubbles: true,
          detail: { distance: 12, progress: 0.7 },
        }),
      );
    });

    expect(band?.dataset.stage).toBe('2');
    expect(steps[1]?.style.getPropertyValue('--px-pipeline-cursor-progress')).toBe('0.7');
    expect(steps[1]?.dataset.pixelCursorResponse).toBe('active');

    await act(async () => {
      secondTile.dispatchEvent(new CustomEvent(CURSOR_LEAVE_EVENT, { bubbles: true }));
    });

    expect(band?.dataset.stage).toBe('0');
    expect(steps[1]?.style.getPropertyValue('--px-pipeline-cursor-progress')).toBe('0');
    expect(steps[1]?.dataset.pixelCursorResponse).toBeUndefined();
  });

  it('keeps the nearest live cursor stage and ignores a non-winning leave', async () => {
    await act(async () => {
      root.render(<ProcessPipeline steps={STEPS} />);
    });

    const band = container.querySelector<HTMLCanvasElement>('.px-pipeline-band');
    const steps = container.querySelectorAll<HTMLElement>('.px-pipeline-step');

    await act(async () => {
      steps[1]!.dispatchEvent(
        new CustomEvent(CURSOR_NEAR_EVENT, {
          bubbles: true,
          detail: { distance: 12, progress: 1, hit: true },
        }),
      );
      steps[0]!.dispatchEvent(
        new CustomEvent(CURSOR_NEAR_EVENT, {
          bubbles: true,
          detail: { distance: 12, progress: 0.8, hit: true },
        }),
      );
    });
    expect(band?.dataset.stage).toBe('1');

    await act(async () => {
      steps[0]!.dispatchEvent(
        new CustomEvent(CURSOR_NEAR_EVENT, {
          bubbles: true,
          detail: { distance: 4, progress: 0.8, hit: true },
        }),
      );
    });
    expect(band?.dataset.stage).toBe('1');

    await act(async () => {
      steps[1]!.dispatchEvent(
        new CustomEvent(CURSOR_NEAR_EVENT, {
          bubbles: true,
          detail: { distance: 2, progress: 0.9, hit: true },
        }),
      );
    });
    expect(band?.dataset.stage).toBe('2');

    await act(async () => {
      steps[0]!.dispatchEvent(new CustomEvent(CURSOR_LEAVE_EVENT, { bubbles: true }));
    });
    expect(band?.dataset.stage).toBe('2');

    await act(async () => {
      steps[1]!.dispatchEvent(
        new CustomEvent(CURSOR_NEAR_EVENT, {
          bubbles: true,
          detail: { distance: 30, progress: 0.6, hit: false },
        }),
      );
    });
    expect(band?.dataset.stage).toBe('0');
  });

  it('keeps keyboard focus ahead of cursor proximity', async () => {
    await act(async () => {
      root.render(<ProcessPipeline steps={STEPS} />);
    });

    const band = container.querySelector<HTMLCanvasElement>('.px-pipeline-band');
    const steps = container.querySelectorAll<HTMLElement>('.px-pipeline-step');

    await act(async () => {
      steps[0]!.focus();
    });
    expect(band?.dataset.stage).toBe('1');

    await act(async () => {
      steps[1]!.dispatchEvent(
        new CustomEvent(CURSOR_NEAR_EVENT, {
          bubbles: true,
          detail: { distance: 12, progress: 1 },
        }),
      );
    });
    expect(band?.dataset.stage).toBe('1');

    await act(async () => {
      steps[0]!.blur();
    });
    expect(band?.dataset.stage).toBe('2');
  });
});