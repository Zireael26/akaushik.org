import { createArcadeAudio } from '../arcade/audio';
import {
  GAME_EVENT_COLLISION,
  GAME_EVENT_LOST,
  GAME_EVENT_READING,
  GAME_EVENT_WON,
  NO_DIRECTION,
  createArcadeGame,
  directionFromKey,
  drainGameEvents,
  queueDirection,
  restartGame,
  snapshotGame,
  startGame,
  stepGame,
  stepTurn,
  RESPAWN_MS,
  type ArcadeGame,
  type ArcadeMover,
  type ArcadeSnapshot,
  type Direction,
} from '../arcade/game';
import {
  BOARD_HEIGHT,
  BOARD_SIZE,
  BOARD_WIDTH,
  INITIAL_READING_COUNT,
  indexX,
  indexY,
  isWalkable,
} from '../arcade/layout';
import { PALETTE, canvasBg, deepBlue, h, inkAlpha, navy, prefersReducedMotion } from '../pixel';
import { isDark, onThemeChange } from '../pixel-theme';

const SWIPE_MIN_PX = 24;
const SWIPE_AXIS_RATIO = 1.25;
const PERIMETER_CELL_COUNT = BOARD_WIDTH * 2 + (BOARD_HEIGHT - 2) * 2;
const perimeterCells = new Int16Array(PERIMETER_CELL_COUNT);

let perimeterCursor = 0;
for (let x = 0; x < BOARD_WIDTH; x++) perimeterCells[perimeterCursor++] = x;
for (let y = 1; y < BOARD_HEIGHT; y++) {
  perimeterCells[perimeterCursor++] = y * BOARD_WIDTH + BOARD_WIDTH - 1;
}
for (let x = BOARD_WIDTH - 2; x >= 0; x--) {
  perimeterCells[perimeterCursor++] = (BOARD_HEIGHT - 1) * BOARD_WIDTH + x;
}
for (let y = BOARD_HEIGHT - 2; y > 0; y--) perimeterCells[perimeterCursor++] = y * BOARD_WIDTH;

export type ArcadeOptions = Readonly<{
  onSnapshot?: (snapshot: ArcadeSnapshot) => void;
  onAnnouncement?: (message: string) => void;
}>;

export type ArcadeHandle = Readonly<{
  start(): boolean;
  restart(): void;
  input(direction: Direction): boolean;
  setSoundEnabled(enabled: boolean): boolean;
  isSoundEnabled(): boolean;
  snapshot(): ArcadeSnapshot;
  focus(): void;
  dispose(): void;
}>;

function isActive(game: ArcadeGame): boolean {
  return game.phase === 'running' || game.phase === 'respawn';
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  cell: number,
  x: number,
  y: number,
  direction: ArcadeMover['direction'],
): void {
  const stroke = Math.max(2, Math.floor(cell * 0.16));
  const inset = Math.max(2, Math.floor(cell * 0.2));
  const span = Math.max(stroke, cell - inset * 2);
  const left = x * cell + inset;
  const top = y * cell + inset;
  const horizontal = direction === 2 || direction === 3 || direction === NO_DIRECTION;
  const openingForward = direction === 0 || direction === 3 || direction === NO_DIRECTION;

  if (horizontal) {
    const spineX = openingForward ? left : left + span - stroke;
    ctx.fillRect(spineX, top, stroke, span);
    ctx.fillRect(openingForward ? spineX : left, top, span, stroke);
    ctx.fillRect(openingForward ? spineX : left, top + span - stroke, span, stroke);
    return;
  }

  const spineY = openingForward ? top + span - stroke : top;
  ctx.fillRect(left, spineY, span, stroke);
  ctx.fillRect(left, openingForward ? top : spineY, stroke, span);
  ctx.fillRect(left + span - stroke, openingForward ? top : spineY, stroke, span);
}

function drawNeedle(
  ctx: CanvasRenderingContext2D,
  cell: number,
  x: number,
  y: number,
  direction: ArcadeMover['direction'],
): void {
  const stroke = Math.max(2, Math.floor(cell * 0.14));
  const inset = Math.max(2, Math.floor(cell * 0.2));
  const span = cell - inset * 2;
  if (direction === 0 || direction === 1) {
    ctx.fillRect(x * cell + (cell - stroke) * 0.5, y * cell + inset, stroke, span);
  } else {
    ctx.fillRect(x * cell + inset, y * cell + (cell - stroke) * 0.5, span, stroke);
  }
}

function drawChevron(ctx: CanvasRenderingContext2D, cell: number, x: number, y: number): void {
  const unit = Math.max(2, Math.floor(cell * 0.18));
  const left = x * cell + (cell - unit * 3) * 0.5;
  const top = y * cell + (cell - unit * 3) * 0.5;
  ctx.fillRect(left, top, unit, unit);
  ctx.fillRect(left + unit, top + unit, unit, unit);
  ctx.fillRect(left, top + unit * 2, unit, unit);
}

function drawKnot(ctx: CanvasRenderingContext2D, cell: number, x: number, y: number): void {
  const unit = Math.max(2, Math.floor(cell * 0.16));
  const left = x * cell + (cell - unit * 3) * 0.5;
  const top = y * cell + (cell - unit * 3) * 0.5;
  ctx.fillRect(left + unit, top, unit, unit * 3);
  ctx.fillRect(left, top + unit, unit * 3, unit);
}

function moverX(mover: ArcadeMover, game: ArcadeGame, snap: boolean): number {
  if (snap || game.phase !== 'running' || mover.previousCell === mover.cell) {
    return indexX(mover.cell);
  }
  const progress = Math.min(1, mover.accumulatorMs / mover.periodMs);
  return indexX(mover.previousCell) + (indexX(mover.cell) - indexX(mover.previousCell)) * progress;
}

function moverY(mover: ArcadeMover, game: ArcadeGame, snap: boolean): number {
  if (snap || game.phase !== 'running' || mover.previousCell === mover.cell) {
    return indexY(mover.cell);
  }
  const progress = Math.min(1, mover.accumulatorMs / mover.periodMs);
  return indexY(mover.previousCell) + (indexY(mover.cell) - indexY(mover.previousCell)) * progress;
}

function snapMovers(game: ArcadeGame): void {
  game.player.previousCell = game.player.cell;
  for (let index = 0; index < game.pursuers.length; index++) {
    const pursuer = game.pursuers[index]!;
    pursuer.previousCell = pursuer.cell;
  }
}

export function mountArcade(canvas: HTMLCanvasElement, options: ArcadeOptions = {}): ArcadeHandle {
  const game = createArcadeGame();
  const audio = createArcadeAudio();
  const controller = new AbortController();
  const { signal } = controller;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let context: CanvasRenderingContext2D | null = null;
  let cssWidth = 0;
  let cssHeight = 0;
  let dpr = 1;
  let cell = 1;
  let boardOffsetX = 0;
  let boardOffsetY = 0;
  let frame = 0;
  let lastFrame = 0;
  let disposed = false;
  let reduced = prefersReducedMotion();
  let pointerId = -1;
  let pointerX = 0;
  let pointerY = 0;
  let lastPhase = game.phase;
  let lastScore = game.score;
  let lastLives = game.lives;
  let lastReadings = game.readingsRemaining;
  let background = canvasBg(isDark());
  let wall = inkAlpha(0.14, isDark());
  let wallAccent = deepBlue(isDark());
  let playerInk = navy(isDark());
  let readingInk = inkAlpha(0.62, isDark());

  function updateTheme(dark: boolean): void {
    background = canvasBg(dark);
    wall = inkAlpha(dark ? 0.2 : 0.14, dark);
    wallAccent = deepBlue(dark);
    playerInk = navy(dark);
    readingInk = inkAlpha(dark ? 0.72 : 0.62, dark);
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

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.setTransform(dpr, 0, 0, dpr, boardOffsetX * dpr, boardOffsetY * dpr);

    for (let index = 0; index < BOARD_SIZE; index++) {
      const x = indexX(index);
      const y = indexY(index);
      if (!isWalkable(index)) {
        ctx.fillStyle = h(x * 1.37 + 4, y * 2.11 + 9) > 0.78 ? wallAccent : wall;
        ctx.fillRect(x * cell, y * cell, Math.max(0, cell - 1), Math.max(0, cell - 1));
      } else if (game.readings[index]) {
        const readingSize = Math.max(2, Math.floor(cell * 0.16));
        ctx.fillStyle = readingInk;
        ctx.fillRect(
          x * cell + (cell - readingSize) * 0.5,
          y * cell + (cell - readingSize) * 0.5,
          readingSize,
          readingSize,
        );
      }
    }

    const cleared = INITIAL_READING_COUNT - game.readingsRemaining;
    const registerCount = Math.floor((cleared * PERIMETER_CELL_COUNT) / INITIAL_READING_COUNT);
    ctx.fillStyle = PALETTE.red;
    for (let index = 0; index < registerCount; index++) {
      const boardIndex = perimeterCells[index]!;
      ctx.fillRect(
        indexX(boardIndex) * cell,
        indexY(boardIndex) * cell,
        Math.max(0, cell - 1),
        Math.max(0, cell - 1),
      );
    }

    ctx.fillStyle = playerInk;
    drawPlayer(
      ctx,
      cell,
      moverX(game.player, game, reduced),
      moverY(game.player, game, reduced),
      game.player.direction,
    );

    const direct = game.pursuers[0];
    ctx.fillStyle = PALETTE.cobalt;
    drawNeedle(
      ctx,
      cell,
      moverX(direct, game, reduced),
      moverY(direct, game, reduced),
      direct.direction,
    );

    const cutline = game.pursuers[1];
    ctx.fillStyle = PALETTE.lime;
    drawChevron(ctx, cell, moverX(cutline, game, reduced), moverY(cutline, game, reduced));

    const drift = game.pursuers[2];
    ctx.fillStyle = PALETTE.amber;
    drawKnot(ctx, cell, moverX(drift, game, reduced), moverY(drift, game, reduced));
  }

  function notifySnapshot(force = false): void {
    if (
      !force &&
      lastPhase === game.phase &&
      lastScore === game.score &&
      lastLives === game.lives &&
      lastReadings === game.readingsRemaining
    ) {
      return;
    }
    lastPhase = game.phase;
    lastScore = game.score;
    lastLives = game.lives;
    lastReadings = game.readingsRemaining;
    options.onSnapshot?.(snapshotGame(game));
  }

  function processEvents(): void {
    const event = drainGameEvents(game);
    if (event.flags & GAME_EVENT_WON) {
      audio.play('won');
      options.onAnnouncement?.(`Field clear. Final score ${game.score}.`);
    } else if (event.flags & GAME_EVENT_LOST) {
      audio.play('lost');
      options.onAnnouncement?.(`Run ended. Final score ${game.score}.`);
    } else if (event.flags & GAME_EVENT_COLLISION) {
      audio.play('collision');
      options.onAnnouncement?.(`Contact. ${game.lives} ${game.lives === 1 ? 'life' : 'lives'} remaining.`);
    } else if (event.flags & GAME_EVENT_READING) {
      audio.play('reading', event.cell);
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
    const changed = stepGame(game, now - lastFrame);
    lastFrame = now;
    if (changed) processEvents();
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
    if (reduced) {
      cancelLoop();
      // A live collision may already be inside its timed respawn when motion is
      // vetoed. Advance that bounded engine-only delay immediately so discrete
      // play cannot become stranded in an input-locked phase.
      while (game.phase === 'respawn') stepGame(game, RESPAWN_MS);
      processEvents();
      draw();
    } else {
      snapMovers(game);
      startLoop();
    }
  }

  function unlockAudio(): void {
    void audio.unlock();
  }

  function input(direction: Direction): boolean {
    if (disposed || game.phase !== 'running') return false;
    unlockAudio();
    if (!queueDirection(game, direction)) return false;
    if (!reduced) {
      startLoop();
      return true;
    }
    const changed = stepTurn(game);
    if (!changed) return false;
    processEvents();
    draw();
    return true;
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
      if (ax >= ay * SWIPE_AXIS_RATIO) input(dx < 0 ? 2 : 3);
      else if (ay >= ax * SWIPE_AXIS_RATIO) input(dy < 0 ? 0 : 1);
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
  motionQuery.addEventListener('change', syncMotion, { signal });

  const motionObserver = new MutationObserver(syncMotion);
  motionObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  const unsubscribeTheme = onThemeChange((dark) => {
    updateTheme(dark);
    draw();
  });

  size();
  updateTheme(isDark());
  draw();
  notifySnapshot(true);

  return {
    start(): boolean {
      if (disposed || !startGame(game)) return false;
      unlockAudio();
      processEvents();
      options.onAnnouncement?.(`Survey started. ${game.readingsRemaining} readings remain.`);
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
      options.onAnnouncement?.(`Survey restarted. ${game.readingsRemaining} readings remain.`);
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
    snapshot(): ArcadeSnapshot {
      return snapshotGame(game);
    },
    focus(): void {
      canvas.focus({ preventScroll: true });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      controller.abort();
      motionObserver.disconnect();
      unsubscribeTheme();
      cancelLoop();
      audio.dispose();
      context = null;
    },
  };
}
