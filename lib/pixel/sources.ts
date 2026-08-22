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
 * Internal graph geometry
 * ------------------------------------------------------------------ */

type GraphPoints = {
  CX: number;
  ROOT: number;
  mids: Array<[number, number]>;
  leaves: Array<Array<[number, number]>>;
};

/**
 * Shared geometry for the agent network. The hero graph, the broken 404 graph,
 * and the error graph all draw the same network — a root, three intermediaries,
 * two leaves each, and cross-edges between the middle tier — so the positions
 * live here. Nothing is copied between sources; they all call this helper and
 * then decide which edges and nodes to render.
 *
 * The rotation keeps the swing circular on screen rather than elliptical: the
 * grid is roughly 2.2:1, so x is scaled through the rotation. Leaf positions
 * are derived from the already-rotated mid positions exactly as the original
 * `agentGraph` did, so the art remains identical when this helper is used.
 */
function graphGeometry(cols: number, rows: number, angle: number): GraphPoints {
  const CX = cols * 0.5;
  const ROOT = rows * 0.13;
  const AR = rows / cols;
  const rot = (x: number, y: number): [number, number] => {
    const dx = (x - CX) * AR;
    const dy = y - ROOT;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [CX + (dx * c - dy * s) / AR, ROOT + (dx * s + dy * c)];
  };

  const TIER1 = rows * 0.45;
  const TIER2 = rows * 0.74;
  const mids: Array<[number, number]> = [-0.19, 0, 0.19].map((f) => rot(CX + cols * f, TIER1));
  const leaves: Array<Array<[number, number]>> = mids.map(([mx, my]) =>
    ([-0.072, 0.072].map((off) => rot(mx + cols * off, TIER2)) as Array<[number, number]>),
  );

  return { CX, ROOT, mids, leaves };
}

/* ------------------------------------------------------------------ *
 * Hero exhibits
 * ------------------------------------------------------------------ */

/**
 * A directed agent graph: a root, three intermediaries, two leaves each, and
 * cross-edges between the middle tier so it reads as a mesh rather than a tidy
 * tree. Reads `angle`, so it swings when the field is mounted with `swing`.
 */
export const agentGraph: FieldSource = (o, { cols, rows, angle }) => {
  const { CX, ROOT, mids, leaves } = graphGeometry(cols, rows, angle);

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

  node(CX, ROOT, rows * 0.055);
  for (const [mx, my] of mids) {
    edge(CX, ROOT, mx, my, 1.9);
    node(mx, my, rows * 0.04);
  }
  mids.forEach(([mx, my], i) => {
    const ls = leaves[i]!;
    for (const [lx, ly] of ls) {
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
 * The 404 graph: the same network as `agentGraph`, with one severed edge and
 * one unreachable node. Geometry comes from `graphGeometry` so the two remain
 * in lockstep; only which edges are drawn differs.
 *
 * The unreachable leaf is `leaves[0][0]` — its incident edge is omitted and the
 * node floats with no connection, which reads as a dropped destination. The
 * severed edge is `mids[2] → leaves[2][1]` — it is drawn in two segments with a
 * centred gap, so the line is visibly broken rather than simply missing. Both
 * alters are deterministic; no ad-hoc randomness is involved and colour is
 * still the field's, never a hard-coded hex.
 */
export const brokenGraph: FieldSource = (o, { cols, rows, angle }) => {
  const { CX, ROOT, mids, leaves } = graphGeometry(cols, rows, angle);

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
  const severedEdge = (ax: number, ay: number, bx: number, by: number, w: number): void => {
    const mx = (ax + bx) * 0.5;
    const my = (ay + by) * 0.5;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      edge(ax, ay, bx, by, w);
      return;
    }
    const ux = dx / len;
    const uy = dy / len;
    const gap = len * 0.18;
    const half = gap * 0.5;
    o.lineWidth = w;
    o.beginPath();
    o.moveTo(ax, ay);
    o.lineTo(mx - ux * half, my - uy * half);
    o.stroke();
    o.beginPath();
    o.moveTo(mx + ux * half, my + uy * half);
    o.lineTo(bx, by);
    o.stroke();
  };

  const UNREACHABLE_MID = 0;
  const UNREACHABLE_LEAF = 0;
  const SEVERED_MID = 2;
  const SEVERED_LEAF = 1;

  node(CX, ROOT, rows * 0.055);
  for (const [mx, my] of mids) {
    edge(CX, ROOT, mx, my, 1.9);
    node(mx, my, rows * 0.04);
  }

  mids.forEach(([mx, my], i) => {
    const ls = leaves[i]!;
    ls.forEach(([lx, ly], j) => {
      const isUnreachable = i === UNREACHABLE_MID && j === UNREACHABLE_LEAF;
      const isSevered = i === SEVERED_MID && j === SEVERED_LEAF;
      if (isUnreachable) {
        node(lx, ly, rows * 0.028);
        return;
      }
      if (isSevered) {
        severedEdge(mx, my, lx, ly, 1.4);
      } else {
        edge(mx, my, lx, ly, 1.4);
      }
      node(lx, ly, rows * 0.028);
    });
    if (i < mids.length - 1) {
      const [nx, ny] = mids[i + 1]!;
      edge(mx, my, nx, ny, 0.9);
    }
  });
};

/**
 * The error graph: the same network, with one node overdriven and its incident
 * edges recoiling. The centre mid (`mids[1]`) is drawn larger than its peers,
 * and every edge that touches it stops short of the node so a gap appears —
 * the edges visibly pull away from the failure.
 *
 * Like `brokenGraph`, this reuses `graphGeometry` and carries no hard-coded
 * colour. The recoil inset is proportional to `rows` so the gap survives across
 * presets, and the hash-driven field is never bypassed.
 */
export const errorGraph: FieldSource = (o, { cols, rows, angle }) => {
  const { CX, ROOT, mids, leaves } = graphGeometry(cols, rows, angle);

  const OVER = 1;
  const normalR = rows * 0.04;
  const overR = rows * 0.062;
  const recoilGap = rows * 0.014;
  const overInset = overR + recoilGap;

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
  const recoiledEdge = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    w: number,
    recoilStart: boolean,
    recoilEnd: boolean,
  ): void => {
    let sx = ax;
    let sy = ay;
    let ex = bx;
    let ey = by;
    const len = Math.hypot(bx - ax, by - ay);
    if (len > 0.001) {
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      if (recoilStart) {
        sx = ax + ux * overInset;
        sy = ay + uy * overInset;
      }
      if (recoilEnd) {
        ex = bx - ux * overInset;
        ey = by - uy * overInset;
      }
    }
    o.lineWidth = w;
    o.beginPath();
    o.moveTo(sx, sy);
    o.lineTo(ex, ey);
    o.stroke();
  };

  node(CX, ROOT, rows * 0.055);
  for (let i = 0; i < mids.length; i++) {
    const [mx, my] = mids[i]!;
    const isOver = i === OVER;
    if (isOver) {
      recoiledEdge(CX, ROOT, mx, my, 1.9, false, true);
    } else {
      edge(CX, ROOT, mx, my, 1.9);
    }
    node(mx, my, isOver ? overR : normalR);
  }

  mids.forEach(([mx, my], i) => {
    const ls = leaves[i]!;
    const midIsOver = i === OVER;
    ls.forEach(([lx, ly]) => {
      if (midIsOver) {
        recoiledEdge(mx, my, lx, ly, 1.4, true, false);
      } else {
        edge(mx, my, lx, ly, 1.4);
      }
      node(lx, ly, rows * 0.028);
    });
    if (i < mids.length - 1) {
      const [nx, ny] = mids[i + 1]!;
      const touchesOver = i === OVER || i + 1 === OVER;
      if (touchesOver) {
        const recoilStart = i === OVER;
        const recoilEnd = i + 1 === OVER;
        recoiledEdge(mx, my, nx, ny, 0.9, recoilStart, recoilEnd);
      } else {
        edge(mx, my, nx, ny, 0.9);
      }
    }
  });
};

/** Backwards-compatible alias for the error source; both names point to the same restrained network. */
export const overloadedGraph: FieldSource = errorGraph;

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
   * Take only this rectangle of the source, in 0..1 of its own width and
   * height, before anything else happens.
   *
   * This is the difference between a portrait that reads and one that does not.
   * The ramp is driven by the luminance range of whatever is in frame, so a
   * face that occupies a third of a photograph competes with everything around
   * it — a lamp, a window, a black shirt — and loses. Cropping first means the
   * stretch is computed over the subject rather than over the room, and the
   * five colours land on the features instead of on the furniture.
   *
   * Match the crop's aspect to the canvas: `fit` still applies afterwards, so a
   * mismatched crop just gets cropped again.
   */
  crop?: { x: number; y: number; w: number; h: number };
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
  const crop = opts.crop;

  return (o, { cols, rows }) => {
    const nw = 'naturalWidth' in image ? image.naturalWidth : (image as { width: number }).width;
    const nh = 'naturalHeight' in image ? image.naturalHeight : (image as { height: number }).height;
    if (!nw || !nh) return;

    // Source rectangle: the whole image, or the requested crop of it.
    const sx = crop ? crop.x * nw : 0;
    const sy = crop ? crop.y * nh : 0;
    const iw = crop ? crop.w * nw : nw;
    const ih = crop ? crop.h * nh : nh;
    if (iw <= 0 || ih <= 0) return;

    const scale =
      fit === 'cover' ? Math.max(cols / iw, rows / ih) : Math.min(cols / iw, rows / ih);
    const dw = iw * scale;
    const dh = ih * scale;

    // The glow that helps drawn shapes bleed would smear a photograph.
    o.save();
    o.shadowBlur = 0;
    o.drawImage(image, sx, sy, iw, ih, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
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
