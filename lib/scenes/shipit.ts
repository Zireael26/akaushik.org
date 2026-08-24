/**
 * Ship It scene — one canvas, one rAF, one AbortController.
 *
 * Mounts the deterministic engine onto the page: keyboard/swipe/button input,
 * theme and both motion vetoes, DPR-capped sizing, allocation-free drawing,
 * and complete disposal. The engine never touches the DOM; this file never
 * touches rules beyond driving them.
 */
import { createShipItAudio } from '../shipit/audio';
import {
  DOWN,
  FRIGHT_FLASHES,
  FRIGHT_MS,
  GAME_EVENT_DEATH,
  GAME_EVENT_EAT,
  GAME_EVENT_ENERGIZER,
  GAME_EVENT_LOST,
  GAME_EVENT_PELLET,
  GAME_EVENT_WON,
  LEFT,
  RIGHT,
  UP,
  createShipItGame,
  directionFromKey,
  drainGameEvents,
  queueDirection,
  restartGame,
  snapshotGame,
  startGame,
  stepDiscrete,
  stepGame,
  type Actor,
  type Direction,
  type Ghost,
  type ShipItGame,
  type ShipItSnapshot,
} from '../shipit/game';
import {
  BOARD_HEIGHT,
  BOARD_SIZE,
  BOARD_WIDTH,
  indexX,
  indexY,
  isWalkable,
} from '../shipit/layout';
import { PALETTE, canvasBg, deepBlue, h, inkAlpha, navy, prefersReducedMotion } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

const SWIPE_MIN_PX = 24;
const SWIPE_AXIS_RATIO = 1.25;
const TILE = 16;

export type ShipItOptions = Readonly<{
  onSnapshot?: (snapshot: ShipItSnapshot) => void;
  onAnnouncement?: (message: string) => void;
}>;

export type ShipItHandle = Readonly<{
  start(): boolean;
  restart(): void;
  input(direction: Direction): boolean;
  setSoundEnabled(enabled: boolean): boolean;
  isSoundEnabled(): boolean;
  snapshot(): ShipItSnapshot;
  focus(): void;
  dispose(): void;
}>;

function isActive(game: ShipItGame): boolean {
  return game.phase === 'running' || game.phase === 'respawn';
}

/**
 * The player is a block caret whose leading edge splits into two prongs that
 * travel apart and rejoin over the eat cycle, oriented to travel direction.
 * At a 16px tile the caret body is ~10px with 2px prongs; at full open the
 * prong gap reads as a cursor mid-bite, never as a wedge or `<`.
 */
const CARET_BODY_FRACTION = 0.62;
const CARET_PRONG_FRACTION = 0.14;

function drawCaret(
  ctx: CanvasRenderingContext2D,
  cell: number,
  px: number,
  py: number,
  direction: Direction,
  openAmount: number,
  visible: boolean,
  ink: string,
): void {
  if (!visible) return;
  ctx.fillStyle = ink;
  const body = Math.max(3, Math.round(cell * CARET_BODY_FRACTION));
  const prong = Math.max(2, Math.round(cell * CARET_PRONG_FRACTION));
  const maxGap = Math.floor((body - prong) / 2);
  const gap = Math.round(openAmount * maxGap);
  const left = Math.round(px - body / 2);
  const top = Math.round(py - body / 2);

  if (direction === LEFT || direction === RIGHT) {
    // Two horizontal bars + a vertical leading edge joining them.
    ctx.fillRect(left, top + gap, body - prong, prong);
    ctx.fillRect(left, top + body - prong - gap, body - prong, prong);
    const leadX = direction === RIGHT ? left + body - prong : left;
    ctx.fillRect(leadX, top + gap, prong, body - gap * 2);
  } else {
    ctx.fillRect(left + gap, top, prong, body - prong);
    ctx.fillRect(left + body - prong - gap, top, prong, body - prong);
    const leadY = direction === DOWN ? top + body - prong : top;
    ctx.fillRect(left + gap, leadY, body - gap * 2, prong);
  }
}

type BugMask = Readonly<{ bits: readonly number[]; span: number }>;

/**
 * Four bugs, four geometries — distinguishable without colour:
 * direct = round beetle with a centre seam; ambush = arrow shield pointing
 * its heading; flank = X cross wings; shy = split oval with a notch tail.
 */
const BUG_MASKS: Readonly<Record<string, BugMask>> = {
  direct: { bits: [0b01110, 0b11111, 0b11011, 0b11111, 0b01110], span: 5 },
  ambush: { bits: [0b00100, 0b01110, 0b11111, 0b01110, 0b01010], span: 5 },
  flank: { bits: [0b10001, 0b01010, 0b00100, 0b01010, 0b10001], span: 5 },
  shy: { bits: [0b01110, 0b10001, 0b11111, 0b01010, 0b10100], span: 5 },
};

function drawBug(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cell: number,
  px: number,
  py: number,
  frightened: boolean,
  flashInk: string | null,
  dark: boolean,
): void {
  const mask = BUG_MASKS[kind] ?? BUG_MASKS.direct!;
  const unit = Math.max(1, Math.round(cell / (mask.span + 2)));
  const originX = Math.round(px - (mask.span * unit) / 2);
  const originY = Math.round(py - (mask.span * unit) / 2);
  ctx.fillStyle = frightened ? (flashInk !== null ? flashInk : deepBlue(dark)) : PALETTE.red;
  for (let row = 0; row < mask.bits.length; row++) {
    const bits = mask.bits[row]!;
    for (let col = 0; col < mask.span; col++) {
      if (((bits >> (mask.span - 1 - col)) & 1) === 0) continue;
      ctx.fillRect(originX + col * unit, originY + row * unit, unit, unit);
    }
  }
}

/** Eyes for eaten ghosts racing home. */
function drawEyes(
  ctx: CanvasRenderingContext2D,
  cell: number,
  px: number,
  py: number,
  direction: Direction,
  ink: string,
): void {
  const eye = Math.max(2, Math.floor(cell * 0.18));
  const spread = Math.max(2, Math.floor(cell * 0.24));
  const dx = direction === RIGHT ? eye : direction === LEFT ? -eye : 0;
  const dy = direction === DOWN ? eye : direction === UP ? -eye : 0;
  ctx.fillStyle = ink;
  ctx.fillRect(Math.round(px - spread / 2 + dx), Math.round(py - eye), eye, eye);
  ctx.fillRect(Math.round(px + spread / 2 - eye + dx), Math.round(py - eye), eye, eye);
}

/** Pellets are code characters: a two-dot semicolon pair of rects. */
function drawPelletGlyph(
  ctx: CanvasRenderingContext2D,
  cell: number,
  x: number,
  y: number,
  ink: string,
): void {
  const size = Math.max(2, Math.floor(cell * 0.15));
  const cx = x * cell + cell / 2;
  const cy = y * cell + cell / 2;
  ctx.fillStyle = ink;
  ctx.fillRect(Math.round(cx - size / 2), Math.round(cy - size * 1.4), size, size);
  ctx.fillRect(Math.round(cx - size / 2), Math.round(cy + size * 0.4), size, size);
}

/** Energizers are commits: a pulsing node disc with two branch ticks. */
function drawCommit(
  ctx: CanvasRenderingContext2D,
  cell: number,
  x: number,
  y: number,
  pulsePhase: number,
  bg: string,
): void {
  const radius = Math.max(3, Math.round(cell * (0.26 + 0.07 * pulsePhase)));
  const cx = x * cell + cell / 2;
  const cy = y * cell + cell / 2;
  ctx.fillStyle = PALETTE.red;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  const tick = Math.max(1, Math.floor(radius / 3));
  ctx.fillStyle = bg;
  ctx.fillRect(Math.round(cx - tick / 2), Math.round(cy - radius - tick), tick, tick * 2);
  ctx.fillRect(Math.round(cx + radius / 2), Math.round(cy + radius / 2 - tick / 2), tick * 2, tick);
}

/**
 * Opt-in diagnostic surface for the movement e2e contract. It exists only
 * when a test init script sets `window.__shipitProbeWanted` before mount;
 * normal visitors never allocate it, and it reads live engine state without
 * touching the draw or step paths. Every operation either writes actor
 * fields directly (placement, desired direction) or resets release timers,
 * so tests can stage exact positions the way unit tests do.
 */
function installProbeIfWanted(game: ShipItGame): (() => void) | null {
  const w = window as typeof window & {
    __shipitProbeWanted?: boolean;
    __shipitProbe?: {
      placePlayer(tileX: number, tileY: number, facing: Direction, desired: Direction | null): void;
      parkGhost(kind: string, tileX: number, tileY: number, facing?: Direction): void;
      setDesired(direction: Direction | null): void;
      holdHouse(): void;
      advance(deltaMs: number): void;
      read(): {
        phase: ShipItSnapshot['phase'];
        player: { x: number; y: number; facing: Direction; desired: Direction | null };
        ghosts: Record<
          string,
          { x: number; y: number; facing: Direction; desired: Direction | null }
        >;
      };
    };
  };
  if (!w.__shipitProbeWanted || w.__shipitProbe) return null;
  const centre = (tileX: number, tileY: number): { x: number; y: number } => ({
    x: tileX * TILE + 8,
    y: tileY * TILE + 8,
  });
  const probe = {
    placePlayer(tileX: number, tileY: number, facing: Direction, desired: Direction | null): void {
      if (game.phase === 'idle') startGame(game);
      Object.assign(game.player, centre(tileX, tileY), {
        facing,
        desired,
      } satisfies Partial<Actor>);
    },
    parkGhost(kind: string, tileX: number, tileY: number, facing: Direction = LEFT): void {
      const ghost = game.ghosts.find((candidate) => candidate.kind === kind);
      if (!ghost) return;
      Object.assign(ghost, centre(tileX, tileY), {
        state: 'active',
        facing,
        desired: null,
        frightenedTimerMs: 0,
      } satisfies Partial<Ghost>);
    },
    setDesired(direction: Direction | null): void {
      game.player.desired = direction;
    },
    holdHouse() {
      game.houseIdleTimerMs = 0;
      for (const ghost of game.ghosts) ghost.dotsEatenSinceRelease = 0;
    },
    advance(deltaMs: number): void {
      stepGame(game, deltaMs);
    },
    read() {
      return {
        phase: game.phase,
        player: { ...game.player },
        ghosts: Object.fromEntries(
          game.ghosts.map((ghost) => [
            ghost.kind,
            { x: ghost.x, y: ghost.y, facing: ghost.facing, desired: ghost.desired },
          ]),
        ),
      };
    },
  };
  w.__shipitProbe = probe;
  return () => {
    if (w.__shipitProbe === probe) delete w.__shipitProbe;
  };
}

export function mountShipIt(canvas: HTMLCanvasElement, options: ShipItOptions = {}): ShipItHandle {
  const game = createShipItGame();
  const audio = createShipItAudio();
  const controller = new AbortController();
  const { signal } = controller;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let context: CanvasRenderingContext2D | null = null;
  let cssWidth = 0;
  let cssHeight = 0;
  let dpr = 1;
  let cell = TILE;
  let boardOffsetX = 0;
  let boardOffsetY = 0;
  let frame = 0;
  let lastFrame = 0;
  let elapsedMs = 0;
  let disposed = false;
  let reduced = prefersReducedMotion();
  let pointerId = -1;
  let pointerX = 0;
  let pointerY = 0;
  let dark = isDark();
  let background = canvasBg(dark);
  let wall = inkAlpha(dark ? 0.2 : 0.14, dark);
  let wallAccent = deepBlue(dark);
  let playerInk = navy(dark);
  let pelletInk = inkAlpha(dark ? 0.72 : 0.62, dark);
  let lastPhase: ShipItSnapshot['phase'] = game.phase;
  let lastScore = -1;
  let lastLives = -1;
  let lastPellets = -1;

  function updateTheme(nextDark: boolean): void {
    dark = nextDark;
    background = canvasBg(dark);
    wall = inkAlpha(dark ? 0.2 : 0.14, dark);
    wallAccent = deepBlue(dark);
    playerInk = navy(dark);
    pelletInk = inkAlpha(dark ? 0.72 : 0.62, dark);
  }

  function size(): void {
    const width = Math.floor(canvas.getBoundingClientRect().width);
    if (width <= 0) return;
    cssWidth = width;
    cssHeight = Math.max(1, Math.round((width * BOARD_HEIGHT) / BOARD_WIDTH));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.height = `${cssHeight}px`;
    context = canvas.getContext('2d');
    cell = Math.min(cssWidth / BOARD_WIDTH, cssHeight / BOARD_HEIGHT);
    boardOffsetX = (cssWidth - cell * BOARD_WIDTH) * 0.5;
    boardOffsetY = (cssHeight - cell * BOARD_HEIGHT) * 0.5;
  }

  function draw(): void {
    const ctx = context;
    if (!ctx || cssWidth <= 0 || cssHeight <= 0) return;
    // Walls: authored mask, hash-textured accents.
    for (let index = 0; index < BOARD_SIZE; index++) {
      const x = indexX(index);
      const y = indexY(index);
      if (isWalkable(index)) continue;
      ctx.fillStyle = h(x * 1.37 + 4, y * 2.11 + 9) > 0.82 ? wallAccent : wall;
      ctx.fillRect(x * cell, y * cell, Math.max(0, cell - 1), Math.max(0, cell - 1));
    }
    for (let index = 0; index < BOARD_SIZE; index++) {
      const pellet = game.pellets[index];
      if (!pellet) continue;
      const x = indexX(index);
      const y = indexY(index);
      if (pellet === 2) {
        drawCommit(ctx, cell, x, y, 0.5 + 0.5 * Math.sin(elapsedMs / 180), background);
      } else {
        drawPelletGlyph(ctx, cell, x, y, pelletInk);
      }
    }

    const scale = cell / TILE;
    const frightLeft = game.globalFrightTimerMs;
    const flashWindow = FRIGHT_MS / FRIGHT_FLASHES / 2;
    const flashOn = frightLeft > 0 && Math.floor(frightLeft / flashWindow) % 2 === 1;

    for (const ghost of game.ghosts) {
      const gx = ghost.x * scale;
      const gy = ghost.y * scale;
      if (ghost.state === 'eyes') {
        drawEyes(ctx, cell, gx, gy, ghost.facing, playerInk);
        continue;
      }
      const frightened =
        ghost.state === 'frightened' ||
        ((ghost.state === 'house' || ghost.state === 'leaving') && frightLeft > 0);
      const flashInk = frightened && flashOn ? PALETTE.red : null;
      drawBug(ctx, ghost.kind, cell, gx, gy, frightened, flashInk, dark);
    }

    // Player caret blinks; prongs split and rejoin over the eat cycle.
    const blinkOpen = 0.5 + 0.5 * Math.sin(elapsedMs / 110);
    const blinkVisible = reduced || Math.sin(elapsedMs / 480) > -0.9;
    drawCaret(
      ctx,
      cell,
      game.player.x * scale,
      game.player.y * scale,
      game.player.facing,
      blinkOpen,
      blinkVisible,
      playerInk,
    );
  }

  function notifySnapshot(force = false): void {
    if (
      !force &&
      lastPhase === game.phase &&
      lastScore === game.score &&
      lastLives === game.lives &&
      lastPellets === game.pelletsRemaining
    ) {
      return;
    }
    lastPhase = game.phase;
    lastScore = game.score;
    lastLives = game.lives;
    lastPellets = game.pelletsRemaining;
    options.onSnapshot?.(snapshotGame(game));
  }

  function processEvents(): void {
    const event = drainGameEvents(game);
    if (event.flags & GAME_EVENT_WON) {
      audio.play('won');
      options.onAnnouncement?.(`Board clear. Final score ${game.score}.`);
    } else if (event.flags & GAME_EVENT_LOST) {
      audio.play('lost');
      options.onAnnouncement?.(`Run ended. Final score ${game.score}.`);
    } else if (event.flags & GAME_EVENT_DEATH) {
      audio.play('death');
      options.onAnnouncement?.(
        `Caught by a bug. ${game.lives} ${game.lives === 1 ? 'life' : 'lives'} remaining.`,
      );
    } else if (event.flags & GAME_EVENT_ENERGIZER) {
      audio.play('energizer');
      options.onAnnouncement?.('Commit pushed — the bugs are frightened.');
    } else if (event.flags & GAME_EVENT_EAT) {
      audio.play('eat');
    } else if (event.flags & GAME_EVENT_PELLET) {
      audio.play('pellet', game.pelletsEatenTotal);
    }
    notifySnapshot();
  }

  function cancelLoop(): void {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function loop(now: number): void {
    frame = 0;
    if (disposed || reduced || !isActive(game)) return;
    const delta = Math.min(now - lastFrame, 100);
    lastFrame = now;
    elapsedMs += delta;
    stepGame(game, delta);
    processEvents();
    draw();
    if (isActive(game) && !reduced) frame = requestAnimationFrame(loop);
  }

  function startLoop(): void {
    if (frame || reduced || !isActive(game)) return;
    lastFrame = performance.now();
    frame = requestAnimationFrame(loop);
  }

  function syncMotion(): void {
    const next = prefersReducedMotion();
    if (next === reduced) return;
    reduced = next;
    cancelLoop();
    processEvents();
    draw();
  }

  function unlockAudio(): void {
    void audio.unlock();
  }

  function input(direction: Direction): boolean {
    if (disposed || game.phase !== 'running') return false;
    unlockAudio();
    if (!queueDirection(game, direction)) return false;
    if (!reduced) return true;
    const advanced = stepDiscrete(game);
    processEvents();
    draw();
    return advanced;
  }

  canvas.addEventListener(
    'keydown',
    (event) => {
      const direction = directionFromKey(event.key);
      if (direction === null) return;
      event.preventDefault();
      if (event.repeat) return;
      input(direction);
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      pointerId = event.pointerId;
      pointerX = event.clientX;
      pointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      unlockAudio();
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerup',
    (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = -1;
      const dx = event.clientX - pointerX;
      const dy = event.clientY - pointerY;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax < SWIPE_MIN_PX && ay < SWIPE_MIN_PX) return;
      if (ax >= ay * SWIPE_AXIS_RATIO) input(dx < 0 ? LEFT : RIGHT);
      else if (ay >= ax * SWIPE_AXIS_RATIO) input(dy < 0 ? UP : DOWN);
    },
    { signal },
  );
  canvas.addEventListener(
    'pointercancel',
    () => {
      pointerId = -1;
    },
    { signal },
  );
  window.addEventListener(
    'resize',
    () => {
      size();
      draw();
    },
    { signal },
  );
  const resizeObserver = new ResizeObserver(() => {
    size();
    draw();
  });
  resizeObserver.observe(canvas);

  motionQuery.addEventListener('change', syncMotion, { signal });

  const motionObserver = new MutationObserver(syncMotion);
  motionObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  const unsubscribeTheme = onThemeChange((nextDark) => {
    updateTheme(nextDark);
    draw();
  });

  size();
  const disposeProbe = installProbeIfWanted(game);
  updateTheme(isDark());
  draw();
  notifySnapshot(true);

  return {
    start(): boolean {
      if (disposed || !startGame(game)) return false;
      unlockAudio();
      processEvents();
      options.onAnnouncement?.(`Ship It started. ${game.pelletsRemaining} characters remain.`);
      draw();
      startLoop();
      canvas.focus({ preventScroll: true });
      return true;
    },
    restart(): void {
      if (disposed) return;
      audio.stop();
      restartGame(game);
      unlockAudio();
      processEvents();
      options.onAnnouncement?.(`Ship It restarted. ${game.pelletsRemaining} characters remain.`);
      draw();
      startLoop();
      canvas.focus({ preventScroll: true });
    },
    input,
    setSoundEnabled(enabled: boolean): boolean {
      if (disposed) return false;
      audio.setEnabled(enabled);
      if (enabled) unlockAudio();
      return audio.isEnabled();
    },
    isSoundEnabled(): boolean {
      return audio.isEnabled();
    },
    snapshot(): ShipItSnapshot {
      return snapshotGame(game);
    },
    focus(): void {
      canvas.focus({ preventScroll: true });
    },
    dispose(): void {
      if (disposed) return;
      if (disposeProbe) disposeProbe();
      disposed = true;
      controller.abort();
      resizeObserver.disconnect();
      motionObserver.disconnect();
      unsubscribeTheme();
      cancelLoop();
      audio.dispose();
      context = null;
    },
  };
}
