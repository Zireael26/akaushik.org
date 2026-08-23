// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDark, onThemeChange } from './pixel-theme';

/**
 * The canvases re-theme by watching `html[data-mode]` rather than by being told.
 *
 * That indirection is the whole design — this site has two independent writers
 * of the attribute (`public/init-theme.js` before first paint, and
 * `ThemeSwitch` on click) and neither knows the canvases exist. The failure it
 * prevents is a canvas that keeps painting light-mode ink after the page goes
 * dark, which no other test in this repo would notice: the DOM is correct, the
 * theme is correct, and only the pixels are wrong.
 *
 * `MutationObserver` delivers asynchronously, so every assertion here awaits a
 * microtask turn. A synchronous expect would pass or fail on timing rather than
 * on behaviour.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.documentElement.removeAttribute('data-mode');
});

describe('isDark', () => {
  it('is false when the attribute is absent', () => {
    expect(isDark()).toBe(false);
  });

  it('reads dark from the attribute', () => {
    document.documentElement.setAttribute('data-mode', 'dark');
    expect(isDark()).toBe(true);
  });

  it('treats anything that is not exactly "dark" as light', () => {
    for (const value of ['light', 'DARK', '', 'auto']) {
      document.documentElement.setAttribute('data-mode', value);
      expect(isDark(), `"${value}" should not read as dark`).toBe(false);
    }
  });
});

describe('onThemeChange', () => {
  it('fires with the new value when the theme flips', async () => {
    const seen: boolean[] = [];
    const stop = onThemeChange((dark) => seen.push(dark));

    document.documentElement.setAttribute('data-mode', 'dark');
    await settle();
    expect(seen).toEqual([true]);

    document.documentElement.setAttribute('data-mode', 'light');
    await settle();
    expect(seen).toEqual([true, false]);

    stop();
  });

  /**
   * The de-duplication matters more than it looks. Each canvas island
   * subscribes, and a theme change rebuilds its palette and repaints; firing on
   * a write that did not change the value would repaint every field on the page
   * for nothing, on any unrelated attribute write.
   */
  it('does not fire when the attribute is rewritten to the same value', async () => {
    document.documentElement.setAttribute('data-mode', 'dark');
    const fn = vi.fn();
    const stop = onThemeChange(fn);

    document.documentElement.setAttribute('data-mode', 'dark');
    await settle();
    expect(fn).not.toHaveBeenCalled();

    stop();
  });

  it('ignores attributes other than data-mode', async () => {
    const fn = vi.fn();
    const stop = onThemeChange(fn);

    document.documentElement.setAttribute('data-motion', 'off');
    document.documentElement.setAttribute('lang', 'fr');
    await settle();
    expect(fn).not.toHaveBeenCalled();

    stop();
  });

  /**
   * Every island calls this in an effect and returns the result as its
   * disposer. A leak here means a React remount leaves the old observer live,
   * repainting a canvas that is no longer on the page.
   */
  it('stops firing once unsubscribed', async () => {
    const fn = vi.fn();
    const stop = onThemeChange(fn);
    stop();

    document.documentElement.setAttribute('data-mode', 'dark');
    await settle();
    expect(fn).not.toHaveBeenCalled();
  });

  it('supports several independent subscribers', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const stopA = onThemeChange(a);
    const stopB = onThemeChange(b);

    document.documentElement.setAttribute('data-mode', 'dark');
    await settle();
    expect(a).toHaveBeenCalledWith(true);
    expect(b).toHaveBeenCalledWith(true);

    // One unsubscribing must not silence the other.
    stopA();
    document.documentElement.setAttribute('data-mode', 'light');
    await settle();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);

    stopB();
  });
});
