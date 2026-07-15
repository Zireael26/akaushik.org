import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { calculateVisiblePoseRatios, selectDominantPose } from './WandererCrane';

const VIEWPORT = { width: 1_000, height: 1_000 };

function rect({
  top,
  left = 0,
  width = 1_000,
  height = 1_000,
}: {
  top: number;
  left?: number;
  width?: number;
  height?: number;
}) {
  return {
    top,
    right: left + width,
    bottom: top + height,
    left,
    width,
    height,
  };
}

describe('Wanderer pose arbitration', () => {
  it('selects from fresh geometry for every section on sparse observer callbacks', () => {
    const hero = { id: 'hero' } as unknown as Element;
    const work = { id: 'work' } as unknown as Element;

    const initialRatios = calculateVisiblePoseRatios(
      [
        [hero, rect({ top: 0 })],
        [work, rect({ top: 600 })],
      ],
      VIEWPORT,
    );
    expect(selectDominantPose(initialRatios)).toBe(hero);

    // A later callback may contain only Work. Hero's cached 1.0 ratio would
    // be stale here, so arbitration must remeasure both current rectangles.
    const currentRatios = calculateVisiblePoseRatios(
      [
        [hero, rect({ top: -900 })],
        [work, rect({ top: 550 })],
      ],
      VIEWPORT,
    );
    expect(currentRatios.get(hero)).toBeCloseTo(0.1);
    expect(currentRatios.get(work)).toBeCloseTo(0.45);
    expect(selectDominantPose(currentRatios)).toBe(work);
  });

  it('uses clipped visible area and excludes offscreen sections', () => {
    const partial = { id: 'partial' } as unknown as Element;
    const offscreen = { id: 'offscreen' } as unknown as Element;

    const ratios = calculateVisiblePoseRatios(
      [
        [partial, rect({ top: -500, left: -500 })],
        [offscreen, rect({ top: 1_100 })],
      ],
      VIEWPORT,
    );

    expect(ratios.get(partial)).toBeCloseTo(0.25);
    expect(ratios.has(offscreen)).toBe(false);
  });
});

const INIT_THEME_SOURCE = readFileSync(
  new URL('../../public/init-theme.js', import.meta.url),
  'utf8',
);

type MotionChangeListener = () => void;

function runPreferenceBootstrap({
  reducedMotion,
  storedMotion,
}: {
  reducedMotion: boolean;
  storedMotion?: 'on' | 'off';
}) {
  const attributes = new Map<string, string>();
  const motionListeners = new Set<MotionChangeListener>();
  let persistedMotion = storedMotion;
  const reducedMotionQuery = {
    matches: reducedMotion,
    addEventListener(type: string, listener: MotionChangeListener) {
      if (type === 'change') motionListeners.add(listener);
    },
  };

  runInNewContext(INIT_THEME_SOURCE, {
    document: {
      documentElement: {
        setAttribute(name: string, value: string) {
          attributes.set(name, value);
        },
      },
    },
    localStorage: {
      getItem(key: string) {
        if (key !== 'dl-tweaks-v1' || persistedMotion === undefined) return null;
        return JSON.stringify({ motion: persistedMotion });
      },
    },
    matchMedia(query: string) {
      if (query === '(prefers-reduced-motion: reduce)') return reducedMotionQuery;
      return { matches: false };
    },
  });

  return {
    get motion() {
      return attributes.get('data-motion');
    },
    get motionListenerCount() {
      return motionListeners.size;
    },
    setReducedMotion(matches: boolean) {
      reducedMotionQuery.matches = matches;
      motionListeners.forEach((listener) => listener());
    },
    storeMotion(motion: 'on' | 'off') {
      persistedMotion = motion;
      attributes.set('data-motion', motion);
    },
  };
}

describe('pre-hydration motion preference', () => {
  it('mirrors reduced-motion changes when the user has no stored choice', () => {
    const bootstrap = runPreferenceBootstrap({ reducedMotion: true });

    expect(bootstrap.motion).toBe('off');
    expect(bootstrap.motionListenerCount).toBe(1);

    bootstrap.setReducedMotion(false);
    expect(bootstrap.motion).toBe('on');

    bootstrap.setReducedMotion(true);
    expect(bootstrap.motion).toBe('off');
  });

  it('does not overwrite a choice stored after bootstrap', () => {
    const bootstrap = runPreferenceBootstrap({ reducedMotion: true });

    bootstrap.storeMotion('off');
    bootstrap.setReducedMotion(false);

    expect(bootstrap.motion).toBe('off');
  });

  it.each([
    { reducedMotion: true, storedMotion: 'on' as const },
    { reducedMotion: false, storedMotion: 'off' as const },
  ])('preserves an explicit stored $storedMotion choice', ({ reducedMotion, storedMotion }) => {
    const bootstrap = runPreferenceBootstrap({ reducedMotion, storedMotion });

    expect(bootstrap.motion).toBe(storedMotion);
    expect(bootstrap.motionListenerCount).toBe(0);

    bootstrap.setReducedMotion(!reducedMotion);
    expect(bootstrap.motion).toBe(storedMotion);
  });
});
