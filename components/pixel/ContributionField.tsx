'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { PALETTE, h } from '@/lib/pixel';

export type ContributionFieldProps = {
  /** Contribution counts, oldest week first. */
  weeks: readonly number[];
  /** Rows in the grid. More rows means finer resolution per week. */
  rows?: number;
  className?: string;
};

/** Palette ramp, quietest to loudest. Matches the field engine's ordering. */
const RAMP = [PALETTE.cobalt, PALETTE.amber, PALETTE.red, PALETTE.lime] as const;

/**
 * The contribution record, as a pixel field you can interrogate.
 *
 * This is drawn with CSS grid cells rather than through `lib/pixel/field.ts`,
 * and that is deliberate. The field engine renders to a canvas, and a canvas
 * cannot tell you which week you are pointing at without hit-testing maths and
 * cannot be reached by a keyboard at all. Here every week is a real focusable
 * element, so the chart is operable with Tab and readable by a screen reader —
 * which matters more for the one piece of art on this site that carries data.
 *
 * A note on the data: `public/data/stats.json` records **weekly** totals, not
 * daily ones, so this cannot be a GitHub-style day calendar. Each column is one
 * week and its height is that week's share of the peak. Inventing days to fill
 * a prettier grid would be fabricating the record.
 */
export function ContributionField({ weeks, rows = 15, className }: ContributionFieldProps) {
  const [active, setActive] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const peak = useMemo(() => Math.max(...weeks, 1), [weeks]);
  const total = useMemo(() => weeks.reduce((a, b) => a + b, 0), [weeks]);

  const cells = useMemo(
    () =>
      weeks.map((count, week) => {
        // Linear against the peak, but any week with work in it keeps at least
        // one cell. Rounding a quiet week to zero would read as "nothing
        // happened" when something did, and that is a different claim.
        const filled = count === 0 ? 0 : Math.max(1, Math.round((count / peak) * rows));
        return Array.from({ length: rows }, (_, r) => {
          // Row 0 is the top of the column, so fill from the bottom up.
          const fromBottom = rows - 1 - r;
          if (fromBottom >= filled) return null;
          // Intensity climbs toward the top of a tall week, and the hash keeps
          // the ramp from banding into four flat stripes.
          const t = filled <= 1 ? 0.5 : fromBottom / (filled - 1);
          const jitter = h(week * 7 + 3, r * 11 + 5) * 0.28 - 0.14;
          const idx = Math.max(0, Math.min(RAMP.length - 1, Math.round((t + jitter) * (RAMP.length - 1))));
          return RAMP[idx]!;
        });
      }),
    [weeks, peak, rows],
  );

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      setActive((cur) => {
        const base = cur ?? 0;
        const next = e.key === 'ArrowLeft' ? base - 1 : base + 1;
        return Math.max(0, Math.min(weeks.length - 1, next));
      });
    },
    [weeks.length],
  );

  const activeCount = active === null ? null : weeks[active]!;

  return (
    <div className={className}>
      <div
        ref={ref}
        className="px-contrib"
        role="img"
        aria-label={`${total.toLocaleString('en-US')} contributions across ${weeks.length} weeks, oldest to newest. Use arrow keys to step through weeks.`}
        tabIndex={0}
        onKeyDown={onKey}
        onMouseLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
      >
        {cells.map((column, week) => (
          <div
            key={week}
            className={`px-contrib-col${active === week ? ' is-active' : ''}`}
            onMouseEnter={() => setActive(week)}
          >
            {column.map((colour, r) => (
              <span
                key={r}
                className="px-contrib-cell"
                style={colour ? { background: colour } : undefined}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="px-contrib-readout" aria-live="polite">
        {activeCount === null ? (
          <>
            <strong>{total.toLocaleString('en-US')}</strong> contributions ·{' '}
            {weeks.length} weeks, oldest to newest
          </>
        ) : (
          <>
            <strong>{activeCount.toLocaleString('en-US')}</strong>{' '}
            {activeCount === 1 ? 'contribution' : 'contributions'} · week {active! + 1} of{' '}
            {weeks.length}
          </>
        )}
      </p>
    </div>
  );
}
