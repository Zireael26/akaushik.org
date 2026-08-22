/**
 * The source library — every silhouette the pixel field knows how to draw.
 *
 * A source is a pure drawing function. It gets an offscreen 2D context already
 * sized to the cell grid, with white fill, white stroke and a soft glow set up,
 * and it draws. The field samples alpha, so a source that wants to express
 * brightness rather than coverage has to convert luminance to alpha itself —
 * `fromImage` is the one that does.
 *
 * Sources take no view of colour. The palette ramp is the field's, applied by
 * intensity, which is why the same silhouette reads correctly in both themes
 * and why none of these functions imports a hex.
 */
import type { FieldSource, SourceContext } from './field';

/* ------------------------------------------------------------------ *
 * Hero exhibits
 * ------------------------------------------------------------------ */

/**
 * A directed agent graph: a root, three intermediaries, two leaves each, and
 * cross-edges between the middle tier so it reads as a mesh rather than a tidy
 * tree. Reads `angle`, so it swings when the field is mounted with `swing`.
 */
export const agentGraph: FieldSource = (o, { cols, rows, angle }) => {
  const CX = cols * 0.5;
  const ROOT = rows * 0.13;

  // The grid is roughly 2.2:1, so x is scaled through the rotation to keep the
  // swing circular on screen rather than elliptical.
  const AR = rows / cols;
  const rot = (x: number, y: number): [number, number] => {
    const dx = (x - CX) * AR;
    const dy = y - ROOT;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [CX + (dx * c - dy * s) / AR, ROOT + (dx * s + dy * c)];
  };

  const node = (x: number, y: number, r: number): void => {
    o.beginPath();
    o.arc(x, y, r, 0, 7);
    o.fill();
  };
  const edge = (ax: number, ay: number, bx: number, by: number, w: number): void => {
    o.lineWidth = w;
    o.beginPath();
    o.moveTo(ax, ay);
    o.lineTo(bx, by);
    o.stroke();
  };

  const TIER1 = rows * 0.45;
  const TIER2 = rows * 0.74;
  const mids: Array<[number, number]> = [-0.19, 0, 0.19].map((f) => rot(CX + cols * f, TIER1));

  node(CX, ROOT, rows * 0.055);
  for (const [mx, my] of mids) {
    edge(CX, ROOT, mx, my, 1.9);
    node(mx, my, rows * 0.04);
  }
  mids.forEach(([mx, my], i) => {
    for (const off of [-0.072, 0.072]) {
      const [lx, ly] = rot(mx + cols * off, TIER2);
      edge(mx, my, lx, ly, 1.4);
      node(lx, ly, rows * 0.028);
    }
    if (i < mids.length - 1) {
      const [nx, ny] = mids[i + 1]!;
      edge(mx, my, nx, ny, 0.9);
    }
  });
};

/**
 * A shell prompt: chevron and block caret. Drawn as paths rather than set as
 * type — at ~100 rows a glyph outline breaks up, and the chevron's stroke has
 * to survive the cell threshold.
 */
export const prompt: FieldSource = (o, { cols, rows }) => {
  const CX = cols * 0.5;
  const CY = rows * 0.5;
  const S = rows * 0.3;
  o.lineWidth = rows * 0.055;
  o.lineCap = 'square';
  o.beginPath();
  o.moveTo(CX - S * 1.15, CY - S * 0.62);
  o.lineTo(CX - S * 0.34, CY);
  o.lineTo(CX - S * 1.15, CY + S * 0.62);
  o.stroke();
  o.fillRect(CX + S * 0.12, CY - S * 0.42, S * 0.62, S * 0.84);
};

/**
 * A trellis panel. Spacing is the whole design: battens closer than about a
 * fifth of the frame height close the diamonds up and the panel reads as one
 * solid block of heat instead of a lattice.
 */
export const trellis: FieldSource = (o, { cols, rows }) => {
  const L = cols * 0.5 - cols * 0.125;
  const R = cols * 0.5 + cols * 0.125;
  const T = rows * 0.11;
  const B = rows * 0.85;
  const STEP = rows * 0.34;
  const w = rows * 0.022;

  o.lineWidth = w;
  o.save();
  o.beginPath();
  o.rect(L, T, R - L, B - T);
  o.clip();
  for (let d = -(B - T); d < R - L + (B - T); d += STEP) {
    o.beginPath();
    o.moveTo(L + d, T);
    o.lineTo(L + d + (B - T), B);
    o.stroke();
    o.beginPath();
    o.moveTo(L + d, B);
    o.lineTo(L + d + (B - T), T);
    o.stroke();
  }
  o.restore();
  o.lineWidth = w * 1.5;
  o.strokeRect(L, T, R - L, B - T);
};

/** Set text in the display face. Used for the "AK." exhibit. */
export function wordmark(text: string, scale = 0.52): FieldSource {
  return (o, { cols, rows }) => {
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.font = `900 ${Math.floor(rows * scale)}px "Cabinet Grotesk", Arial, sans-serif`;
    o.fillText(text, cols * 0.5, rows * 0.48);
  };
}

/* ------------------------------------------------------------------ *
 * Images
 * ------------------------------------------------------------------ */

export type ImageSourceOptions = {
  /** Below this luminance a pixel contributes nothing. Raises contrast. */
  floor?: number;
  /** Gamma applied to luminance before it becomes alpha. <1 lifts midtones. */
  gamma?: number;
  /** Invert, for light subjects on dark grounds. */
  invert?: boolean;
  /** 'cover' fills the grid and crops; 'contain' fits and letterboxes. */
  fit?: 'cover' | 'contain';
  /**
   * Stretch the image's own luminance range across the full ramp before
   * mapping. Without it a photograph with a narrow range — most photographs —
   * lands in the middle of the five-colour ramp everywhere at once and renders
   * as a flat slab of one colour. On by default; turn it off for art that is
   * already drawn to full range.
   */
  autoContrast?: boolean;
};

/**
 * Turn a loaded image into a living pixel field.
 *
 * The image is drawn into the cell grid, then luminance is rewritten into the
 * alpha channel and the colour channels are flattened to white — because the
 * field samples alpha and applies its own palette ramp. The result is that a
 * photograph arrives already speaking the site's five colours, and the ambient
 * drift and pointer heat play over it exactly as they do over a drawn shape.
 *
 * Note the grid is coarse by design (a `tile` preset is ~96 cells wide). Faces
 * survive at that resolution; fine detail does not. Crop tight before using it.
 */
export function fromImage(image: CanvasImageSource, opts: ImageSourceOptions = {}): FieldSource {
  const { floor = 0.06, gamma = 0.85, invert = false, fit = 'cover', autoContrast = true } = opts;

  return (o, { cols, rows }) => {
    const iw = 'naturalWidth' in image ? image.naturalWidth : (image as { width: number }).width;
    const ih = 'naturalHeight' in image ? image.naturalHeight : (image as { height: number }).height;
    if (!iw || !ih) return;

    const scale =
      fit === 'cover' ? Math.max(cols / iw, rows / ih) : Math.min(cols / iw, rows / ih);
    const dw = iw * scale;
    const dh = ih * scale;

    // The glow that helps drawn shapes bleed would smear a photograph.
    o.save();
    o.shadowBlur = 0;
    o.drawImage(image, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    o.restore();

    const frame = o.getImageData(0, 0, cols, rows);
    const d = frame.data;
    const n = d.length / 4;
    const lum = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      // Rec. 601 luma. Cheap, and closer to perceived brightness than a mean.
      const v = (0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!) / 255;
      lum[i] = invert ? 1 - v : v;
    }

    let lo = 0;
    let hi = 1;
    if (autoContrast && n > 0) {
      // Percentile endpoints rather than min/max: a single blown highlight or
      // one black pixel would otherwise set the whole range and undo the stretch.
      const sorted = Float32Array.from(lum).sort();
      lo = sorted[Math.floor(n * 0.04)] ?? 0;
      hi = sorted[Math.floor(n * 0.96)] ?? 1;
      if (hi - lo < 0.08) {
        lo = 0;
        hi = 1;
      }
    }

    for (let i = 0; i < n; i++) {
      const a = d[i * 4 + 3]! / 255;
      const stretched = Math.max(0, Math.min(1, (lum[i]! - lo) / (hi - lo)));
      const out = Math.pow(Math.max(0, stretched - floor) / (1 - floor), gamma) * a;
      d[i * 4] = 255;
      d[i * 4 + 1] = 255;
      d[i * 4 + 2] = 255;
      d[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, out)) * 255);
    }
    o.putImageData(frame, 0, 0);
  };
}

/** Load an image and resolve once it can be drawn. Rejects on network failure. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`pixel: could not load ${src}`));
    img.src = src;
  });
}

/* ------------------------------------------------------------------ *
 * Utility
 * ------------------------------------------------------------------ */

/**
 * A stable small integer from a string, for seeding a field off a slug. Every
 * article gets its own noise texture without anyone authoring one, and the same
 * article gets the same texture forever.
 */
export function seedFrom(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) n = (n * 31 + text.charCodeAt(i)) % 100000;
  return n;
}

/** Compose sources so one stage can draw several things. */
export function layer(...parts: FieldSource[]): FieldSource {
  return (o, c: SourceContext) => {
    for (const p of parts) p(o, c);
  };
}
