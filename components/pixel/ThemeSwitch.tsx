'use client';

import { useCallback } from 'react';

/**
 * SHIM. The real one is a 52×26 pixel canvas — an outlined track with an amber
 * sun / lime moon knob that slides on toggle — and is being built on the
 * feat/pixel-engines branch. Expect a conflict on this path at merge, and take
 * theirs.
 *
 * This exists because SiteNav imports it and the whole site 500s without it.
 * The behaviour below is the contract the canvas version must keep: write
 * html[data-mode] and persist under `abhishek.portfolio.mode`, the key
 * public/init-theme.js reads before first paint. A second key would reintroduce
 * the FOUC that key exists to prevent.
 */
const STORAGE_KEY = 'abhishek.portfolio.mode';

export function ThemeSwitch() {
  const toggle = useCallback(() => {
    const next = document.documentElement.getAttribute('data-mode') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-mode', next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing: the attribute still applied, only persistence is lost.
    }
  }, []);

  return (
    <button type="button" className="px-theme-switch" aria-label="Toggle colour theme" onClick={toggle}>
      <span className="px-theme-switch-track" aria-hidden="true" />
    </button>
  );
}
