import { describe, expect, it } from 'vitest';
import { selectDominantPose, updateVisiblePoseRatios } from './WandererCrane';

function entry(target: Element, intersectionRatio: number, isIntersecting = intersectionRatio > 0) {
  return { target, intersectionRatio, isIntersecting };
}

describe('Wanderer pose arbitration', () => {
  it('retains the globally most-visible section across incremental observer callbacks', () => {
    const hero = { id: 'hero' } as unknown as Element;
    const work = { id: 'work' } as unknown as Element;
    const ratios = new Map<Element, number>();

    updateVisiblePoseRatios(ratios, [entry(hero, 0.8), entry(work, 0.4)]);
    expect(selectDominantPose(ratios)).toBe(hero);

    // IntersectionObserver reports only entries that crossed a threshold.
    // Updating Work must not forget that Hero is still more visible.
    updateVisiblePoseRatios(ratios, [entry(work, 0.45)]);
    expect(selectDominantPose(ratios)).toBe(hero);

    updateVisiblePoseRatios(ratios, [entry(hero, 0, false)]);
    expect(selectDominantPose(ratios)).toBe(work);
  });
});
