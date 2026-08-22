/**
 * Shared pixel-language primitives. Every canvas island draws through these —
 * one hash, one palette, one cell rule.
 *
 * Ported from gaurijha.com's src/lib/pixel.ts. The palette constants mirror
 * app/styles/tokens.css; canvas code cannot read CSS variables cheaply on a
 * per-frame basis, so the values live in both places. Change one, change both.
 */

/** The one hash. Determinism is the point: the art must be identical on every load. */
export function h(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const PALETTE = {
  cobalt: '#3B5BF6',
  amber: '#F6A61C',
  red: '#E8401C',
  lime: '#C8F218',
  navy: '#1B2331',
} as const;

/** Dark-mode substitutions the canvas code applies; nothing else changes. */
export function navy(dark: boolean): string {
  return dark ? '#E9ECF4' : '#1B2331';
}

export function deepBlue(dark: boolean): string {
  return dark ? '#5F74D9' : '#2C3F94';
}

export function canvasBg(dark: boolean): string {
  return dark ? '#0F1218' : '#FFFFFF';
}

/**
 * Themed ink at an arbitrary alpha, for canvas code that cannot read a CSS var.
 * The two bases are --ink light (#111318) and --ink dark (#EFF1F6) from tokens.css.
 */
const INK_RGB_LIGHT = '17, 19, 24';
const INK_RGB_DARK = '239, 241, 246';

export function inkAlpha(alpha: number, dark: boolean): string {
  return `rgba(${dark ? INK_RGB_DARK : INK_RGB_LIGHT}, ${alpha})`;
}

/** A cell is a square with a 1px gutter. Nothing draws a pixel any other way. */
export function cellRect(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number): void {
  ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
}

/** Size a canvas for devicePixelRatio and return the 2D context, pre-scaled to CSS px. */
export function fitCanvas(
  el: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): CanvasRenderingContext2D {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  el.width = Math.round(cssWidth * d);
  el.height = Math.round(cssHeight * d);
  el.style.height = `${cssHeight}px`;
  const ctx = el.getContext('2d')!;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  return ctx;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isFinePointer(): boolean {
  return window.matchMedia('(pointer: fine)').matches;
}
