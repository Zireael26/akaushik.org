import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Policy: every ink token must remain legible against its own theme's
 * page background. The muted scale and the palette's text-safe siblings
 * were tuned to clear WCAG AA (4.5:1) on both themes — a regression that
 * drops any step below that again carries real copy (labels, chip keys,
 * small print). This is the deterministic guard.
 *
 * Reads app/styles/tokens.css, parses the two theme blocks (:root and
 * [data-mode='dark']), enumerates every --ink* and --px-*-ink token
 * (no hard-coded names beyond the prefixes), parses the colour forms
 * already present, composites alpha colours over that theme's --bg,
 * computes WCAG relative luminance and contrast, and asserts ≥4.5:1.
 * Failure reports theme / token / ratio.
 */

const TOKENS_PATH = path.join(process.cwd(), 'app/styles/tokens.css');
const css = fs.readFileSync(TOKENS_PATH, 'utf8');

function extractBlock(source: string, re: RegExp): string {
  const m = source.match(re);
  if (!m) throw new Error(`tokens-contrast: no match for ${re}`);
  return m[1]!;
}

function parseVars(block: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    out.set(m[1]!.trim(), m[2]!.trim());
  }
  return out;
}

type Rgba = { r: number; g: number; b: number; a: number };
type Rgb = { r: number; g: number; b: number };

function parseColor(raw: string): Rgba | null {
  const s = raw.trim().toLowerCase();
  // hex: #rgb, #rrggbb, #rrggbbaa (alpha channel optional, not currently used)
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return { r, g, b, a };
    }
    return null;
  }
  // rgb / rgba — the only other forms present in tokens.css
  const rgba = s.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+|1\.0*)\s*)?\)$/,
  );
  if (rgba) {
    const r = Number(rgba[1]);
    const g = Number(rgba[2]);
    const b = Number(rgba[3]);
    const a = rgba[4] !== undefined ? Number(rgba[4]) : 1;
    if ([r, g, b, a].some((v) => Number.isNaN(v))) return null;
    return { r, g, b, a };
  }
  return null;
}

function compositeOver(fg: Rgba, bg: Rgba): Rgb {
  if (fg.a >= 1) return { r: fg.r, g: fg.g, b: fg.b };
  return {
    r: Math.round(fg.a * fg.r + (1 - fg.a) * bg.r),
    g: Math.round(fg.a * fg.g + (1 - fg.a) * bg.g),
    b: Math.round(fg.a * fg.b + (1 - fg.a) * bg.b),
  };
}

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * srgbToLinear(rgb.r) +
    0.7152 * srgbToLinear(rgb.g) +
    0.0722 * srgbToLinear(rgb.b)
  );
}

function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}


// ---------------------------------------------------------------------------
// Extract theme maps once, deterministically, so future tokens are covered
// automatically via the prefix filter rather than a hard-coded list.
// ---------------------------------------------------------------------------

const rootBlock = extractBlock(css, /:root\s*\{([\s\S]*?)\}/);
const darkBlock = extractBlock(css, /\[data-mode=['"]dark['"]\]\s*\{([\s\S]*?)\}/);

const lightVars = parseVars(rootBlock);
const darkVars = parseVars(darkBlock);

type ThemeInfo = { label: 'light' | 'dark'; vars: Map<string, string> };

const themes: ThemeInfo[] = [
  { label: 'light', vars: lightVars },
  { label: 'dark', vars: darkVars },
];

type Case = {
  theme: 'light' | 'dark';
  token: string;
  raw: string;
  bgRaw: string;
  blended: Rgb;
  ratio: number;
};

function buildCases(): Case[] {
  const cases: Case[] = [];
  for (const { label, vars } of themes) {
    const bgRaw = vars.get('--bg');
    if (!bgRaw) throw new Error(`tokens-contrast: --bg missing for ${label}`);
    const bg = parseColor(bgRaw);
    if (!bg) throw new Error(`tokens-contrast: unparseable --bg for ${label}: ${bgRaw}`);

    for (const [name, raw] of vars) {
      if (!(name.startsWith('--ink') || /^--px-.+-ink$/.test(name))) continue;
      const fg = parseColor(raw);
      if (!fg)
        throw new Error(
          `tokens-contrast: unparseable color form for ${label} ${name}: "${raw}" — add a parser branch for this form`,
        );
      const blended = compositeOver(fg, bg as Rgba);
      const ratio = contrastRatio(relativeLuminance(blended), relativeLuminance(bg as unknown as Rgb));
      cases.push({ theme: label, token: name, raw, bgRaw, blended, ratio });
    }
  }
  return cases;
}

const cases = buildCases();

describe('tokens.css — WCAG AA contrast policy', () => {
  it('parses both theme blocks and discovers ink tokens', () => {
    // Guard against a parser regression that would silently test nothing.
    const lightCount = cases.filter((c) => c.theme === 'light').length;
    const darkCount = cases.filter((c) => c.theme === 'dark').length;
    expect(lightCount, 'no --ink* / --px-*-ink tokens found in :root').toBeGreaterThan(0);
    expect(darkCount, "no --ink* / --px-*-ink tokens found in [data-mode='dark']").toBeGreaterThan(0);
    // Each theme should expose at least one of each family so the prefix
    // filter is not accidentally narrowed.
    for (const label of ['light', 'dark'] as const) {
      const slice = cases.filter((c) => c.theme === label);
      expect(
        slice.some((c) => c.token.startsWith('--ink')),
        `${label}: expected at least one --ink* token`,
      ).toBe(true);
      expect(
        slice.some((c) => /^--px-.+-ink$/.test(c.token)),
        `${label}: expected at least one --px-*-ink token`,
      ).toBe(true);
    }
  });

  it.each(cases)(
    '$theme $token is ≥4.5:1 against --bg (ratio $ratio)',
    ({ theme, token, raw, bgRaw, blended, ratio }) => {
      const msg =
        `${theme} ${token} ${ratio.toFixed(2)}:1 < 4.5:1 — ` +
        `token "${raw}" over bg "${bgRaw}" → rgb(${blended.r}, ${blended.g}, ${blended.b})`;
      expect(ratio, msg).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('fails loudly with theme/token/ratio when aggregated', () => {
    const failures = cases.filter((c) => c.ratio < 4.5);
    // The per-token test above already fails per item; this aggregate gives
    // a single loud summary if the runner collapses individual failures.
    if (failures.length) {
      const detail = failures
        .map((f) => `${f.theme} ${f.token} ${f.ratio.toFixed(2)}:1`)
        .join('; ');
      expect.fail(`contrast failures — ${detail}`);
    }
    expect(failures.length).toBe(0);
  });
});
