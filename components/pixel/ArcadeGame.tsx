'use client';

import { useEffect, useRef, useState } from 'react';
import type { ArcadeSnapshot, Direction, GamePhase } from '@/lib/arcade/game';
import { DOWN, LEFT, RIGHT, UP } from '@/lib/arcade/game';
import { INITIAL_READING_COUNT } from '@/lib/arcade/layout';
import { mountArcade, type ArcadeHandle } from '@/lib/scenes/arcade';

const INITIAL_SNAPSHOT: ArcadeSnapshot = {
  phase: 'idle',
  score: 0,
  lives: 3,
  readingsRemaining: INITIAL_READING_COUNT,
  initialReadings: INITIAL_READING_COUNT,
};

const PHASE_LABEL: Readonly<Record<GamePhase, string>> = {
  idle: 'Ready',
  running: 'Survey active',
  respawn: 'Recalibrating',
  won: 'Field clear',
  lost: 'Run ended',
};

type DirectionControlProps = Readonly<{
  direction: Direction;
  label: string;
  symbol: string;
  className: string;
  onInput(direction: Direction): void;
}>;

function DirectionControl({
  direction,
  label,
  symbol,
  className,
  onInput,
}: DirectionControlProps) {
  return (
    <button
      type="button"
      className={`px-arcade-direction ${className}`}
      aria-label={`Move ${label.toLowerCase()}`}
      onClick={() => onInput(direction)}
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

export function ArcadeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<ArcadeHandle | null>(null);
  const [snapshot, setSnapshot] = useState<ArcadeSnapshot>(INITIAL_SNAPSHOT);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = mountArcade(canvas, {
      onSnapshot: setSnapshot,
      onAnnouncement: setAnnouncement,
    });
    handleRef.current = handle;
    setSoundEnabled(handle.isSoundEnabled());

    return () => {
      if (handleRef.current === handle) handleRef.current = null;
      handle.dispose();
    };
  }, []);

  function start(): void {
    handleRef.current?.start();
  }

  function restart(): void {
    handleRef.current?.restart();
  }

  function input(direction: Direction): void {
    handleRef.current?.input(direction);
  }

  function toggleSound(): void {
    const handle = handleRef.current;
    if (!handle) return;
    setSoundEnabled(handle.setSoundEnabled(!handle.isSoundEnabled()));
  }

  const cleared = snapshot.initialReadings - snapshot.readingsRemaining;

  return (
    <div className="px-arcade-game">
      <dl className="px-arcade-status" aria-label="Arcade status">
        <div>
          <dt>Score</dt>
          <dd>{snapshot.score.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>Lives</dt>
          <dd>{snapshot.lives}</dd>
        </div>
        <div>
          <dt>Readings</dt>
          <dd>
            {cleared}/{snapshot.initialReadings}
          </dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{PHASE_LABEL[snapshot.phase]}</dd>
        </div>
      </dl>

      <canvas
        ref={canvasRef}
        className="px-arcade-canvas"
        role="img"
        aria-label="Interactive asymmetric survey field"
        aria-describedby="arcade-objective arcade-controls-note arcade-legend"
        tabIndex={0}
      >
        An asymmetric field with readings to clear. The open bracket is your marker. A cobalt
        needle follows directly, a lime chevron cuts ahead, and an amber knot drifts through
        branches. Use arrow keys, W A S D, swipe, or the direction buttons.
      </canvas>

      <div className="px-arcade-controls" aria-label="Arcade controls">
        <div className="px-arcade-actions">
          {snapshot.phase === 'idle' ? (
            <button type="button" className="px-arcade-action" onClick={start}>
              Start survey
            </button>
          ) : null}
          {snapshot.phase === 'won' || snapshot.phase === 'lost' ? (
            <button type="button" className="px-arcade-action" onClick={restart}>
              Restart survey
            </button>
          ) : null}
          <button
            type="button"
            className="px-arcade-action"
            aria-label="Toggle arcade sound"
            aria-pressed={soundEnabled}
            onClick={toggleSound}
          >
            Sound {soundEnabled ? 'on' : 'off'}
          </button>
        </div>

        <div className="px-arcade-directions" aria-label="Direction buttons">
          <DirectionControl
            direction={UP}
            label="Up"
            symbol="↑"
            className="is-up"
            onInput={input}
          />
          <DirectionControl
            direction={LEFT}
            label="Left"
            symbol="←"
            className="is-left"
            onInput={input}
          />
          <DirectionControl
            direction={DOWN}
            label="Down"
            symbol="↓"
            className="is-down"
            onInput={input}
          />
          <DirectionControl
            direction={RIGHT}
            label="Right"
            symbol="→"
            className="is-right"
            onInput={input}
          />
        </div>
      </div>

      <p id="arcade-controls-note" className="px-arcade-note">
        Focus the field for arrow keys or W A S D. Swipe at least 24 pixels, or use the visible
        direction controls. With motion reduced, each legal input advances one measured turn.
      </p>

      <div id="arcade-legend" className="px-arcade-legend" aria-label="Field symbol legend">
        <p>
          <span className="px-arcade-mark is-player" aria-hidden="true" />
          <strong>Bracket</strong> — you
        </p>
        <p>
          <span className="px-arcade-mark is-direct" aria-hidden="true" />
          <strong>Needle</strong> — Direct follows your cell
        </p>
        <p>
          <span className="px-arcade-mark is-cutline" aria-hidden="true" />
          <strong>Chevron</strong> — Cutline aims ahead
        </p>
        <p>
          <span className="px-arcade-mark is-drift" aria-hidden="true" />
          <strong>Knot</strong> — Drift takes a stable branch
        </p>
      </div>

      <p className="px-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
