'use client';

import { useEffect, useRef, useState } from 'react';
import type { Direction, ShipItSnapshot } from '@/lib/shipit/game';
import { DOWN, LEFT, RIGHT, UP } from '@/lib/shipit/game';
import { INITIAL_PELLET_COUNT } from '@/lib/shipit/layout';
import { mountShipIt, type ShipItHandle } from '@/lib/scenes/shipit';

const INITIAL_SNAPSHOT: ShipItSnapshot = {
  phase: 'idle',
  score: 0,
  lives: 3,
  pelletsRemaining: INITIAL_PELLET_COUNT,
  initialPellets: INITIAL_PELLET_COUNT,
  mode: 'scatter',
  frightActive: false,
  frightFlashesLeft: 0,
};

const PHASE_LABEL: Readonly<Record<ShipItSnapshot['phase'], string>> = {
  idle: 'Ready',
  running: 'Shipping',
  respawn: 'Respawning',
  won: 'Board clear',
  lost: 'Run ended',
};

type DirectionControlProps = Readonly<{
  direction: Direction;
  label: string;
  symbol: string;
  className: string;
  onInput(direction: Direction): void;
}>;

function DirectionControl({ direction, label, symbol, className, onInput }: DirectionControlProps) {
  return (
    <button
      type="button"
      className={`px-shipit-direction ${className}`}
      aria-label={`Move ${label.toLowerCase()}`}
      onClick={() => onInput(direction)}
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

export function ShipItGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<ShipItHandle | null>(null);
  const [snapshot, setSnapshot] = useState<ShipItSnapshot>(INITIAL_SNAPSHOT);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = mountShipIt(canvas, {
      onSnapshot: setSnapshot,
      onAnnouncement: setAnnouncement,
    });
    handleRef.current = handle;
    setSoundEnabled(handle.isSoundEnabled());
    setMounted(true);

    return () => {
      setMounted(false);
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

  const eaten = snapshot.initialPellets - snapshot.pelletsRemaining;

  return (
    <div className="px-shipit-game">
      <dl className="px-shipit-status" aria-label="Ship It status">
        <div>
          <dt>Score</dt>
          <dd>{snapshot.score.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>Lives</dt>
          <dd>{snapshot.lives}</dd>
        </div>
        <div>
          <dt>Characters</dt>
          <dd>
            {eaten}/{snapshot.initialPellets}
          </dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{PHASE_LABEL[snapshot.phase]}</dd>
        </div>
      </dl>

      <canvas
        ref={canvasRef}
        className="px-shipit-canvas"
        role="img"
        aria-label="Ship It maze — a blinking cursor eats code characters while four bugs give chase"
        aria-describedby="shipit-objective shipit-controls-note shipit-legend"
        tabIndex={0}
      >
        A maze of code characters. You are a blinking block caret eating them. Four bugs chase you:
        the Beetle follows your tile, the Arrow aims four ahead, the Cross mirrors its leader across
        your position, and the Notch chases only from far away. Pushing a commit frightens them
        briefly. Arrow keys, W A S D, swipe, or the direction buttons move you.
      </canvas>

      <div className="px-shipit-controls" aria-label="Ship It controls">
        <div className="px-shipit-actions">
          {snapshot.phase === 'idle' ? (
            <button type="button" className="px-shipit-action" onClick={start} disabled={!mounted}>
              Start shipping
            </button>
          ) : null}
          {snapshot.phase === 'won' || snapshot.phase === 'lost' ? (
            <button
              type="button"
              className="px-shipit-action"
              onClick={restart}
              disabled={!mounted}
            >
              Restart run
            </button>
          ) : null}
          <button
            type="button"
            className="px-shipit-action"
            aria-label="Toggle game sound"
            aria-pressed={soundEnabled}
            onClick={toggleSound}
            disabled={!mounted}
          >
            Sound {soundEnabled ? 'on' : 'off'}
          </button>
        </div>

        <div className="px-shipit-directions" aria-label="Direction buttons">
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

      <p id="shipit-controls-note" className="px-shipit-note">
        Focus the board for arrow keys or W A S D. Swipe at least 24 pixels, or use the visible
        direction buttons. With motion reduced, each legal input advances one fixed step.
      </p>

      <div id="shipit-legend" className="px-shipit-legend" aria-label="Board symbol legend">
        <p>
          <span className="px-shipit-mark is-player" aria-hidden="true" />
          <strong>Caret</strong> — you, eating characters
        </p>
        <p>
          <span className="px-shipit-mark is-direct" aria-hidden="true" />
          <strong>Beetle</strong> — Direct, follows your tile
        </p>
        <p>
          <span className="px-shipit-mark is-ambush" aria-hidden="true" />
          <strong>Arrow</strong> — Ambush, aims four ahead
        </p>
        <p>
          <span className="px-shipit-mark is-flank" aria-hidden="true" />
          <strong>Cross</strong> — Flank, mirrors its leader through you
        </p>
        <p>
          <span className="px-shipit-mark is-shy" aria-hidden="true" />
          <strong>Notch</strong> — Shy, chases only from afar
        </p>
        <p>
          <span className="px-shipit-mark is-commit" aria-hidden="true" />
          <strong>Commit</strong> — frightens all four bugs
        </p>
      </div>

      <p className="px-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
