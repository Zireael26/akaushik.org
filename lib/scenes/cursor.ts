/**
 * The full-viewport pixel cursor.
 *
 * The arrow, proximity bounds, velocity smoothing and trail are ported from
 * gaurijha.com's cursor engine. The source coupled cursor state to method-icon
 * drawing; this port ends that ownership at bubbling DOM events so each hovered
 * element can render its own response.
 *
 * Decorative only. The engine runs for fine pointers with motion enabled,
 * never receives pointer events, and restores the native cursor on every
 * inactive or teardown path.
 */
import { PALETTE, canvasBg, h, inkAlpha, isFinePointer, navy, prefersReducedMotion } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

export const CURSOR_NEAR_EVENT = 'pixel:cursor-near';
export const CURSOR_LEAVE_EVENT = 'pixel:cursor-leave';

export type CursorNearDetail = Readonly<{
  /** Euclidean distance from the pointer to the element border; zero inside. */
  distance: number;
  /** Symmetric dissolve ramp, 0..1 in 0.07 steps per animation frame. */
  progress: number;
  /** False while a previously hit target is dissolving outside the halo. */
  hit?: boolean;
}>;

export type CursorPoint = Readonly<{
  x: number;
  y: number;
}>;

type CursorTargetCandidate = Readonly<{
  distance: number;
  index: number;
}>;

/** Selects the nearest target, using DOM order to break equal-distance ties. */
export function isCloserCursorTarget(
  candidate: CursorTargetCandidate,
  current: CursorTargetCandidate | null,
): boolean {
  if (!current) return true;

  const candidateDistance =
    Number.isFinite(candidate.distance) && candidate.distance >= 0
      ? candidate.distance
      : Number.POSITIVE_INFINITY;
  const currentDistance =
    Number.isFinite(current.distance) && current.distance >= 0
      ? current.distance
      : Number.POSITIVE_INFINITY;

  return (
    candidateDistance < currentDistance ||
    (candidateDistance === currentDistance && candidate.index < current.index)
  );
}

/** The original snap mode eased 20% toward its element anchor each frame. */
export const CURSOR_SNAP_EASE = 0.2;

/**
 * Ease a cursor point toward a proximity target.
 *
 * A null point is the explicit reset state used when proximity ends or the
 * engine is disabled. The grid alignment used by the drawn sprites is kept
 * separate; snapping a target to that grid would make this interaction jump.
 */
export function easeCursorPosition(
  current: CursorPoint | null,
  target: CursorPoint,
  origin: CursorPoint,
): CursorPoint {
  if (!current) return { x: origin.x, y: origin.y };
  return {
    x: current.x + (target.x - current.x) * CURSOR_SNAP_EASE,
    y: current.y + (target.y - current.y) * CURSOR_SNAP_EASE,
  };
}

type Cell = readonly [number, number];
type VisibleMode = 'arrow' | 'caret' | 'keycap';
type Point = { x: number; y: number };

const CURSOR_GRID = 4;
const HOVER_PAD = 30;
const PROGRESS_STEP = 0.07;
const PRESS_MS = 150;
const CARET_HALF_PERIOD_MS = 550;

const KEYCAP_FACE = [
  '.XXXXXXXXX.',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  '.XXXXXXXXX.',
] as const;

const RETURN_GLYPH: readonly Cell[] = [
  [7, 2],
  [7, 3],
  [7, 4],
  [6, 4],
  [5, 4],
  [4, 4],
  [3, 4],
  [4, 3],
  [4, 5],
];

const KEYCAP_SPARKS: readonly Cell[] = [
  [-1, 1],
  [11, 2],
  [-1, 6],
  [11, 7],
];

function buildArrowCells(): Cell[] {
  const cells: Cell[] = [];
  for (let x = 0; x <= 6; x++) {
    for (let y = 2; y <= 4; y++) cells.push([x, y]);
  }
  for (let k = 0; k <= 3; k++) {
    for (let y = k; y <= 6 - k; y++) cells.push([7 + k, y]);
  }
  return cells;
}

const ARROW_CELLS = buildArrowCells();
const ARROW_OCCUPANCY = new Set(ARROW_CELLS.map(([x, y]) => x * 100 + y));
const ARROW_EDGE = ARROW_CELLS.filter(([x, y]) => !ARROW_OCCUPANCY.has(x * 100 + y + 1));

function gridSnap(value: number): number {
  return Math.round(value / CURSOR_GRID) * CURSOR_GRID;
}

/** The source uses ink in light mode and the light navy substitution in dark mode. */
function trailInk(dark: boolean): string {
  return dark ? navy(true) : inkAlpha(1, false);
}

function fillCells(
  ctx: CanvasRenderingContext2D,
  cells: readonly Cell[],
  x: number,
  y: number,
  cell: number,
  color: string,
): void {
  ctx.fillStyle = color;
  for (const [column, row] of cells) {
    ctx.fillRect(x + column * cell, y + row * cell, cell - 1, cell - 1);
  }
}

function fillMask(
  ctx: CanvasRenderingContext2D,
  mask: readonly string[],
  x: number,
  y: number,
  cell: number,
  color: string,
): void {
  ctx.fillStyle = color;
  for (let row = 0; row < mask.length; row++) {
    for (let column = 0; column < mask[row]!.length; column++) {
      if (mask[row]![column] !== 'X') continue;
      ctx.fillRect(x + column * cell, y + row * cell, cell - 1, cell - 1);
    }
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  offsetX: number,
  offsetY: number,
  targetX: number,
  targetY: number,
  dark: boolean,
  solid?: string,
): void {
  const angle = Math.atan2(targetY - y, targetX - x);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const cell = 5;

  const drawPass = (cells: readonly Cell[], localY: number, color: string): void => {
    ctx.fillStyle = color;
    for (const [column, row] of cells) {
      const localX = (column - 5.5) * cell;
      const localRow = (row + localY - 3) * cell;
      const drawX = x + localX * cosine - localRow * sine;
      const drawY = y + localX * sine + localRow * cosine;
      ctx.fillRect(gridSnap(drawX) + offsetX, gridSnap(drawY) + offsetY, cell - 1, cell - 1);
    }
  };

  if (solid) {
    drawPass(ARROW_CELLS, 0, solid);
    return;
  }

  // Deliberately one-sided: outer ink, cobalt separator, then lime face.
  drawPass(ARROW_EDGE, 2, trailInk(dark));
  drawPass(ARROW_EDGE, 1, PALETTE.cobalt);
  drawPass(ARROW_CELLS, 0, PALETTE.lime);
}

function drawCaret(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  offsetX: number,
  offsetY: number,
  dark: boolean,
  solid?: string,
): void {
  const cell = CURSOR_GRID;
  const left = gridSnap(x) - 8 + offsetX;
  const top = gridSnap(y) - 14 + offsetY;

  ctx.fillStyle = solid ?? inkAlpha(1, dark);
  for (let row = 0; row < 7; row++) {
    for (let column = 0; column < 3; column++) {
      ctx.fillRect(left + column * cell, top + row * cell, cell - 1, cell - 1);
    }
  }

  ctx.fillStyle = solid ?? PALETTE.cobalt;
  for (let row = 0; row < 7; row++) {
    ctx.fillRect(left + 3 * cell, top + row * cell, cell - 1, cell - 1);
  }
}

function drawKeycap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  offsetX: number,
  offsetY: number,
  dark: boolean,
  now: number,
  pressedAt: number,
  solid?: string,
): void {
  const cell = CURSOR_GRID;
  const left = gridSnap(x) - 22 + offsetX;
  const top = gridSnap(y) - 18 + offsetY;
  const pressed = pressedAt > 0 && now - pressedAt < PRESS_MS;
  const faceOffset = pressed ? cell : 0;
  const silhouette = solid ?? navy(dark);

  // The matching one-cell offset exposes only a mechanical wall beneath the face.
  fillMask(ctx, KEYCAP_FACE, left, top + cell, cell, silhouette);
  fillMask(ctx, KEYCAP_FACE, left, top + faceOffset, cell, solid ?? PALETTE.amber);

  if (solid) return;

  fillCells(ctx, RETURN_GLYPH, left, top + faceOffset, cell, navy(dark));
  if (pressed) fillCells(ctx, KEYCAP_SPARKS, left, top, cell, PALETTE.red);
}

function drawMode(
  ctx: CanvasRenderingContext2D,
  mode: VisibleMode,
  x: number,
  y: number,
  offsetX: number,
  offsetY: number,
  dark: boolean,
  now: number,
  pressedAt: number,
  targetX: number,
  targetY: number,
  solid?: string,
): void {
  if (mode === 'arrow') {
    drawArrow(ctx, x, y, offsetX, offsetY, targetX, targetY, dark, solid);
  } else if (mode === 'caret') {
    drawCaret(ctx, x, y, offsetX, offsetY, dark, solid);
  } else {
    drawKeycap(ctx, x, y, offsetX, offsetY, dark, now, pressedAt, solid);
  }
}

/** Cell size of the button noise band, and how often it re-hashes. */
const BTN_CELL = 6;
const BTN_RETICK_MS = 90;

/**
 * The CTA hover effect: a band of noise pixels inside any [data-btnfx] element
 * the pointer is over, with the middle left clear so the label stays readable.
 *
 * It draws into the cursor overlay rather than into the button, which is why it
 * lives here and not in a component — the overlay already sits above everything
 * at the right z-index, and painting into the button would mean a second canvas
 * per CTA. The 26x12px inset that defines the clear zone is the prototype's, and
 * it is measured from the button's padding, so a CTA with different padding will
 * want a different inset rather than this one scaled.
 */
function drawButtonNoise(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  now: number,
  dark: boolean,
): void {
  for (const button of document.querySelectorAll('[data-btnfx]')) {
    const r = button.getBoundingClientRect();
    if (!r.width || x < r.left || x > r.right || y < r.top || y > r.bottom) continue;

    const tick = Math.floor(now / BTN_RETICK_MS);
    const cols = Math.ceil(r.width / BTN_CELL);
    const rows = Math.ceil(r.height / BTN_CELL);
    const padX = Math.ceil(26 / BTN_CELL);
    const padY = Math.ceil(12 / BTN_CELL);
    const noise = [PALETTE.lime, PALETTE.amber, PALETTE.cobalt, PALETTE.red, canvasBg(dark)];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // The text zone stays clear.
        if (col >= padX && col < cols - padX && row >= padY && row < rows - padY) continue;
        const hv = h(col * 19 + tick * 5, row * 23 + tick * 11);
        if (hv < 0.78) continue;
        ctx.fillStyle = noise[Math.floor(hv * 500) % 5]!;
        ctx.fillRect(
          r.left + col * BTN_CELL + 1,
          r.top + row * BTN_CELL + 1,
          BTN_CELL - 2,
          BTN_CELL - 2,
        );
      }
    }
  }
}

function distanceToRect(x: number, y: number, rect: DOMRect): number {
  const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(dx, dy);
}

/** Mounts the cursor engine and returns its complete teardown. */
export function mountCursor(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const ctx: CanvasRenderingContext2D = context;

  const ac = new AbortController();
  const { signal } = ac;
  const finePointer = window.matchMedia('(pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hoverStates = new Map<HTMLElement, number>();
  const arrowTarget: Point = { x: 0, y: 0 };
  let snapPosition: CursorPoint | null = null;

  let dpr = 1;
  let dark = isDark();
  let enabled = false;
  let pointerInside = false;
  let mouseX = -200;
  let mouseY = -200;
  let previousX: number | null = null;
  let previousY: number | null = null;
  let velocityX = 0;
  let velocityY = 0;
  let pressedAt = 0;
  let caretEnteredAt = 0;
  let previousMode: VisibleMode | 'hidden' | null = null;
  let raf = 0;
  let hoverElements: HTMLElement[] = [];
  let arrowElements: HTMLElement[] = [];
  let wrapElement: HTMLElement | null = null;
  let targetsDirty = true;

  function clearCanvas(): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  let hiddenCursorElement: HTMLElement | null = null;

  /**
   * Scoped native-cursor hiding. The drawn glyph takes over exactly one
   * element while the pointer sits inside it, so the rest of the page keeps
   * a working native cursor even mid-hover.
   */
  function setNativeCursorHidden(element: HTMLElement | null): void {
    if (hiddenCursorElement === element) return;
    if (hiddenCursorElement && hiddenCursorElement.isConnected) {
      hiddenCursorElement.removeAttribute('data-pixel-cursor-hide');
    }
    hiddenCursorElement = element;
    if (element) element.setAttribute('data-pixel-cursor-hide', '');
  }

  function resetHoverStates(): void {
    for (const element of hoverStates.keys()) {
      if (element.isConnected) {
        element.dispatchEvent(new CustomEvent(CURSOR_LEAVE_EVENT, { bubbles: true }));
      }
    }
    hoverStates.clear();
    snapPosition = null;
  }

  function resetMotionState(): void {
    previousX = null;
    previousY = null;
    velocityX = 0;
    velocityY = 0;
    previousMode = null;
    snapPosition = null;
  }

  function sizeOverlay(): void {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }

  function shouldEnable(): boolean {
    return (
      isFinePointer() &&
      !prefersReducedMotion() &&
      document.documentElement.getAttribute('data-motion') !== 'off'
    );
  }

  function stop(): void {
    enabled = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    setNativeCursorHidden(null);
    resetHoverStates();
    resetMotionState();
    clearCanvas();
  }

  function syncActivation(): void {
    const next = shouldEnable();
    if (next === enabled) return;
    if (!next) {
      stop();
      return;
    }

    enabled = true;
    sizeOverlay();
    setNativeCursorHidden(null);
    raf = requestAnimationFrame(frame);
  }
  function refreshTargets(): void {
    if (!targetsDirty) return;
    targetsDirty = false;
    hoverElements = Array.from(document.querySelectorAll<HTMLElement>('[data-pixel-hover]'));
    arrowElements = Array.from(document.querySelectorAll<HTMLElement>('[data-cursor-target]'));
    wrapElement = document.querySelector<HTMLElement>('[data-wrap]');
  }

  function updateHoverTargets(): { target: Point | null; hitElement: HTMLElement | null } {
    let target: (CursorTargetCandidate & { point: Point; element: HTMLElement }) | null = null;
    for (let index = 0; index < hoverElements.length; index += 1) {
      const element = hoverElements[index];
      if (!element) continue;

      const rect = element.getBoundingClientRect();
      const distance = distanceToRect(mouseX, mouseY, rect);
      const hit = Boolean(
        pointerInside &&
          rect.width &&
          mouseX > rect.left - HOVER_PAD &&
          mouseX < rect.right + HOVER_PAD &&
          mouseY > rect.top - HOVER_PAD &&
          mouseY < rect.bottom + HOVER_PAD,
      );
      if (hit) {
        // The snap anchor is the element's own centre, so the drawn glyph
        // lands on the tile instead of parked at a corner. DOM order still
        // breaks ties through isCloserCursorTarget.
        const candidate = {
          distance,
          index,
          element,
          point: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        };
        if (isCloserCursorTarget(candidate, target)) target = candidate;
      }

      const previousProgress = hoverStates.get(element);
      if (!hit && previousProgress == null) continue;

      const progress = Math.max(
        0,
        Math.min(1, (previousProgress ?? 0) + (hit ? PROGRESS_STEP : -PROGRESS_STEP)),
      );

      if (progress > 0) {
        hoverStates.set(element, progress);
        element.dispatchEvent(
          new CustomEvent<CursorNearDetail>(CURSOR_NEAR_EVENT, {
            bubbles: true,
            detail: { distance, progress, hit },
          }),
        );
      } else if (previousProgress != null) {
        hoverStates.delete(element);
        element.dispatchEvent(new CustomEvent(CURSOR_LEAVE_EVENT, { bubbles: true }));
      }
    }

    for (const element of hoverStates.keys()) {
      if (element.isConnected && element.matches('[data-pixel-hover]')) continue;
      hoverStates.delete(element);
      if (element.isConnected) {
        element.dispatchEvent(new CustomEvent(CURSOR_LEAVE_EVENT, { bubbles: true }));
      }
    }

    return { target: target?.point ?? null, hitElement: target?.element ?? null };
  }

  function findArrowTarget(): boolean {
    for (const element of arrowElements) {
      const rect = element.getBoundingClientRect();
      if (
        rect.width &&
        mouseX > rect.left - 34 &&
        mouseX < rect.right + 34 &&
        mouseY > rect.top - 30 &&
        mouseY < rect.bottom + 30
      ) {
        arrowTarget.x = (rect.left + rect.right) / 2;
        arrowTarget.y = (rect.top + rect.bottom) / 2;
        return true;
      }
    }
    return false;
  }

  function isInGutter(): boolean {
    if (!wrapElement) return false;
    const rect = wrapElement.getBoundingClientRect();
    const inset = Math.max(20, Math.min(56, window.innerWidth * 0.04));
    return mouseX < rect.left + inset || mouseX > rect.right - inset;
  }

  function frame(): void {
    raf = 0;
    if (!enabled) return;
    raf = requestAnimationFrame(frame);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    refreshTargets();

    const deltaX = previousX == null ? 0 : mouseX - previousX;
    const deltaY = previousY == null ? 0 : mouseY - previousY;
    previousX = mouseX;
    previousY = mouseY;
    velocityX = velocityX * 0.72 + deltaX * 0.28;
    velocityY = velocityY * 0.72 + deltaY * 0.28;

    const hover = updateHoverTargets();
    snapPosition = hover.target
      ? easeCursorPosition(snapPosition, hover.target, { x: mouseX, y: mouseY })
      : null;
    setNativeCursorHidden(hover.hitElement);
    if (!pointerInside) {
      previousMode = null;
      return;
    }

    const now = performance.now();
    // Before the mode branch and before the caret's blink gate, so a CTA keeps
    // its noise band while the caret is in an off beat.
    drawButtonNoise(ctx, mouseX, mouseY, now, isDark());

    const hasArrowTarget = findArrowTarget();
    const mode: VisibleMode = hasArrowTarget ? 'arrow' : isInGutter() ? 'caret' : 'keycap';
    if (mode === 'caret' && previousMode !== 'caret') caretEnteredAt = now;
    previousMode = mode;

    const caretVisible =
      mode !== 'caret' || Math.floor((now - caretEnteredAt) / CARET_HALF_PERIOD_MS) % 2 === 0;
    if (!caretVisible) return;

    const drawX = snapPosition?.x ?? mouseX;
    const drawY = snapPosition?.y ?? mouseY;
    const targetX = hover.target?.x ?? (hasArrowTarget ? arrowTarget.x : mouseX);
    const targetY = hover.target?.y ?? (hasArrowTarget ? arrowTarget.y : mouseY);
    const speed = Math.hypot(velocityX, velocityY);
    if (!snapPosition && speed > 2.5) {
      const unitX = -velocityX / speed;
      const unitY = -velocityY / speed;
      const magnitude = Math.min(26, speed * 1.4);
      drawMode(
        ctx,
        mode,
        drawX,
        drawY,
        gridSnap(unitX * magnitude * 2),
        gridSnap(unitY * magnitude * 2),
        dark,
        now,
        pressedAt,
        targetX,
        targetY,
        trailInk(dark),
      );
      drawMode(
        ctx,
        mode,
        drawX,
        drawY,
        gridSnap(unitX * magnitude),
        gridSnap(unitY * magnitude),
        dark,
        now,
        pressedAt,
        targetX,
        targetY,
        PALETTE.cobalt,
      );
    }

    drawMode(
      ctx,
      mode,
      drawX,
      drawY,
      0,
      0,
      dark,
      now,
      pressedAt,
      targetX,
      targetY,
    );
  }

  window.addEventListener(
    'pointermove',
    (event) => {
      pointerInside = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    },
    { signal },
  );
  window.addEventListener(
    'pointerdown',
    () => {
      if (enabled) pressedAt = performance.now();
    },
    { signal },
  );
  window.addEventListener(
    'blur',
    () => {
      pointerInside = false;
      mouseX = -200;
      mouseY = -200;
      setNativeCursorHidden(null);
      resetMotionState();
    },
    { signal },
  );
  document.documentElement.addEventListener(
    'pointerleave',
    () => {
      pointerInside = false;
      mouseX = -200;
      mouseY = -200;
      setNativeCursorHidden(null);
      resetMotionState();
    },
    { signal },
  );
  window.addEventListener('resize', sizeOverlay, { signal });
  finePointer.addEventListener('change', syncActivation, { signal });
  reducedMotion.addEventListener('change', syncActivation, { signal });

  const targetObserver = new MutationObserver(() => {
    targetsDirty = true;
  });
  targetObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-cursor-target', 'data-pixel-hover', 'data-wrap'],
    childList: true,
    subtree: true,
  });

  const motionObserver = new MutationObserver(syncActivation);
  motionObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  const unsubscribeTheme = onThemeChange((next) => {
    dark = next;
  });

  syncActivation();

  return () => {
    ac.abort();
    motionObserver.disconnect();
    unsubscribeTheme();
    stop();
    targetObserver.disconnect();
  };
}
