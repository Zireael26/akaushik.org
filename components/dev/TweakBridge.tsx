'use client';

import { useEffect, useRef, useState } from 'react';

// Gate: production builds that aren't mounted as an edit-mode iframe host
// return null before any state or effect kicks in. Avoids exposing the panel
// + iframe protocol on the public site.
const SHOULD_RENDER =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_EDIT_MODE === '1';

const CONFIGURED_PARENT_ORIGINS =
  process.env.NEXT_PUBLIC_EDIT_MODE_PARENT_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

/**
 * TweakBridge — dev / Claude Design iframe edit-mode protocol.
 *
 * Port of `_reference/portfolio/tweaks.js` kept behaviour-compatible with the
 * host protocol in HANDOFF §6. Differences from the reference:
 *  - writes `html[data-*]` instead of `body[data-*]` so the CSS selectors
 *    (already keyed off `html`) work without a second read target.
 *  - localStorage key `dl-tweaks-v1` persists the five values between reloads
 *    when running standalone (outside the Claude Design iframe).
 *  - Only mounted by `app/layout.tsx` when
 *      `process.env.NODE_ENV !== 'production'` OR
 *      `process.env.NEXT_PUBLIC_EDIT_MODE === '1'`.
 *    Production visitors never ship the bundle.
 *  - Cross-origin iframe hosts must be listed in
 *      `NEXT_PUBLIC_EDIT_MODE_PARENT_ORIGINS` (comma-separated).
 */

const TWEAK_KEYS = ['tagline', 'accent', 'mode', 'density', 'motion'] as const;
type TweakKey = (typeof TWEAK_KEYS)[number];
type TweakState = Record<TweakKey, string>;
type ParentMessage =
  | { type: '__edit_mode_available' }
  | { type: '__edit_mode_set_keys'; edits: Partial<TweakState> }
  | { type: '__edit_mode_close' };

const DEFAULTS: TweakState = {
  tagline: 'a',
  accent: 'forest',
  mode: 'light',
  density: 'airy',
  motion: 'on',
};

const STORAGE_KEY = 'dl-tweaks-v1';

function apply(key: TweakKey, value: string): void {
  const root = document.documentElement;
  if (key === 'tagline') {
    root.setAttribute('data-tagline', value);
    document
      .querySelectorAll<HTMLElement>('[data-slot="tagline"] > span')
      .forEach((span) => {
        const which = 'taglineA' in span.dataset
          ? 'a'
          : 'taglineB' in span.dataset
          ? 'b'
          : 'taglineC' in span.dataset
          ? 'c'
          : null;
        if (which === value) span.removeAttribute('hidden');
        else span.setAttribute('hidden', '');
      });
    return;
  }
  root.setAttribute(`data-${key}`, value);
}

function loadPersisted(): Partial<TweakState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<TweakState>;
    return parsed;
  } catch {
    return {};
  }
}

function persist(state: TweakState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* non-persistent context (incognito / disabled storage) */
  }
}

function allowedMessageOrigins(): Set<string> {
  return new Set([window.location.origin, ...CONFIGURED_PARENT_ORIGINS]);
}

function parentTargetOrigin(): string | null {
  if (window.parent === window) return window.location.origin;
  return CONFIGURED_PARENT_ORIGINS[0] ?? null;
}

function postToParent(message: ParentMessage): void {
  const targetOrigin = parentTargetOrigin();
  if (!targetOrigin) return;
  try {
    window.parent.postMessage(message, targetOrigin);
  } catch {
    /* standalone */
  }
}

function isTrustedHostMessage(ev: MessageEvent): boolean {
  if (ev.source !== window.parent && ev.source !== window) return false;
  return allowedMessageOrigins().has(ev.origin);
}

export function TweakBridge() {
  if (!SHOULD_RENDER) return null;
  return <TweakBridgeImpl />;
}

function TweakBridgeImpl() {
  const [state, setState] = useState<TweakState>(DEFAULTS);
  const [open, setOpen] = useState(false);
  const mountedRef = useRef(false);

  // Initial sync: seed state from persisted choice, apply to DOM, respect
  // prefers-reduced-motion, announce to parent iframe.
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const persisted = loadPersisted();
    const next: TweakState = {
      ...DEFAULTS,
      ...persisted,
      ...(reduced ? { motion: 'off' } : {}),
    };
    setState(next);
    TWEAK_KEYS.forEach((k) => apply(k, next[k]));

    postToParent({ type: '__edit_mode_available' });
  }, []);

  // Host protocol: accept activate / deactivate from the Claude Design iframe.
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (!isTrustedHostMessage(ev)) return;
      const data = ev.data as { type?: string } | null;
      if (!data?.type) return;
      if (data.type === '__activate_edit_mode') setOpen(true);
      else if (data.type === '__deactivate_edit_mode') setOpen(false);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Backtick toggles the panel in local dev.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '`') setOpen((o) => !o);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleChange(key: TweakKey, value: string) {
    const next = { ...state, [key]: value };
    setState(next);
    persist(next);
    apply(key, value);
    postToParent({ type: '__edit_mode_set_keys', edits: { [key]: value } });
  }

  function handleClose() {
    setOpen(false);
    postToParent({ type: '__edit_mode_close' });
  }

  return (
    <aside className="tweaks" id="tweaks" hidden={!open}>
      <header className="tweaks-head">
        <span className="tweaks-title">Tweaks</span>
        <button
          className="tweaks-close"
          aria-label="Close tweaks"
          onClick={handleClose}
          type="button"
        >
          ×
        </button>
      </header>
      <div className="tweaks-body">
        <fieldset>
          <legend>Hero tagline</legend>
          {[
            { value: 'a', label: 'A · MSME-readable, warm' },
            { value: 'b', label: 'B · Craft-first, dual audience' },
            { value: 'c', label: 'C · Identity-first, plain' },
          ].map((opt) => (
            <label key={opt.value}>
              <input
                type="radio"
                name="tagline"
                value={opt.value}
                checked={state.tagline === opt.value}
                onChange={() => handleChange('tagline', opt.value)}
              />{' '}
              {opt.label}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Primary accent</legend>
          <div className="tweak-swatches">
            {[
              { value: 'forest', swatch: '#13423D' },
              { value: 'terracotta', swatch: '#C44D2E' },
              { value: 'ochre', swatch: '#B8892B' },
              { value: 'ink', swatch: '#1A1A1E' },
            ].map((opt) => (
              <label key={opt.value}>
                <input
                  type="radio"
                  name="accent"
                  value={opt.value}
                  checked={state.accent === opt.value}
                  onChange={() => handleChange('accent', opt.value)}
                />
                <span style={{ background: opt.swatch }} />
                {opt.value}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Mode</legend>
          {[
            { value: 'light', label: 'Light · parchment' },
            { value: 'dark', label: 'Dark · slate' },
          ].map((opt) => (
            <label key={opt.value}>
              <input
                type="radio"
                name="mode"
                value={opt.value}
                checked={state.mode === opt.value}
                onChange={() => handleChange('mode', opt.value)}
              />{' '}
              {opt.label}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Density</legend>
          {[
            { value: 'airy', label: 'Airy' },
            { value: 'tight', label: 'Tight' },
          ].map((opt) => (
            <label key={opt.value}>
              <input
                type="radio"
                name="density"
                value={opt.value}
                checked={state.density === opt.value}
                onChange={() => handleChange('density', opt.value)}
              />{' '}
              {opt.label}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Node-graph motion</legend>
          {[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ].map((opt) => (
            <label key={opt.value}>
              <input
                type="radio"
                name="motion"
                value={opt.value}
                checked={state.motion === opt.value}
                onChange={() => handleChange('motion', opt.value)}
              />{' '}
              {opt.label}
            </label>
          ))}
        </fieldset>
      </div>
    </aside>
  );
}
