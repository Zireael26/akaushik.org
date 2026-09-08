import { ContributionField } from '@/components/pixel/ContributionField';
import { RuledRow } from '@/components/pixel/RuledRow';
import { SectionHead } from '@/components/pixel/SectionHead';
import { formatMonthYear, formatRelativeAge } from '@/lib/dates';
import { getStats } from '@/lib/stats';

/**
 * In the open — GitHub contribution stats, in the split-editorial shape.
 *
 * The numbers come from the `STATS_KV` namespace the Worker cron refreshes
 * daily (worker/index.ts `scheduled` → lib/stats-source.ts), with the
 * checked-in public/data/stats.json as a fallback. Nothing here is written by
 * hand, including the statement heading, which interpolates the contribution
 * total — which is exactly why the fallback must not be silent. A stale or
 * fallback snapshot renders with a degraded label and the age of the last good
 * number; an old total presented as if it were measured today is the one thing
 * this section must never do (public-data truthfulness, ADR-0013).
 *
 * Degradation is carried by copy and the amber accent token only — no new
 * colours, no layout shift: `.px-open-degraded` styles the provenance meta
 * line, and when the heading itself quotes an old number it says so inline.
 *
 * The old sparkline was an SVG bar chart with per-repo progress bars beside it.
 * Bars are not the pixel language, so the weekly series is redrawn on the cell
 * grid — 7px squares with a 1px gutter, the skyline/marquee cell size — and the
 * per-repo bars are dropped in favour of the ruled rows the rest of the site
 * uses. Height ramps cobalt -> amber -> red from the baseline up, echoing the
 * heatfield.
 */

/** 7px cell, 1px gutter. Eight rows is the tallest column the scale allows. */

function degradedCopy(reason: 'stale' | 'missing', generatedAt: string): string {
  if (reason === 'missing') {
    return (
      'Live refresh not connected yet — numbers below come from the snapshot checked into this ' +
      `repo, last measured ${formatRelativeAge(generatedAt)}.`
    );
  }
  return (
    'Stale — the daily refresh has been failing; numbers below are the last good snapshot, ' +
    `last measured ${formatRelativeAge(generatedAt)}.`
  );
}

export default async function OpenSource() {
  const view = await getStats();
  const { stats, degraded } = view;
  // Narrowed once here: the copy below only distinguishes live from not.
  const reason = view.reason === 'live' ? undefined : view.reason;

  // One entry per filled cell. A week with any activity keeps at least one cell,
  // so a quiet week reads as quiet rather than as missing.

  const refreshed =
    reason === undefined
      ? `Refreshed ${formatRelativeAge(stats.generatedAt)}`
      : `Last good ${formatRelativeAge(stats.generatedAt)}`;

  return (
    <section className="px-section px-split px-open" id="open" data-screen-label="07 In the open">
      <SectionHead
        variant="column"
        heading={
          degraded
            ? `${stats.totalContributions.toLocaleString('en-US')} contributions in the last twelve months, as of the last good snapshot.`
            : `${stats.totalContributions.toLocaleString('en-US')} contributions in the last twelve months.`
        }
        label={degraded ? 'In the open · data stale' : 'In the open'}
        headingTarget
        headingMax={18}
      />

      <div className="px-split-body">
        <ContributionField className="px-open-contrib" weeks={stats.weeks} />

        {degraded && reason ? (
          <p className="px-split-intro px-open-degraded" role="status">
            {degradedCopy(reason, stats.generatedAt)}
          </p>
        ) : null}

        <p className="px-split-intro">
          Counts come from the GitHub contributions API
          {stats.includesPrivate ? ', private repositories included' : ''}, and refresh daily from a
          scheduled job on this site&rsquo;s Worker. The repositories below are the ones that job
          names by hand; each count is commits to that repository over the same twelve months.
        </p>

        {stats.repos.map((repo, i) => (
          <RuledRow
            key={repo.name}
            last={i === stats.repos.length - 1}
            tag={repo.lastCommit ? formatMonthYear(repo.lastCommit).toUpperCase() : ''}
          >
            <strong>
              {/* Only public repositories are linked. Four of these are
                  private: the commit counts are real, but the GitHub URL
                  built from the same name is a 404 for every reader, and a
                  dead link on a portfolio is worse than a plain label. */}
              {repo.public ? (
                <a href={repo.url} rel="noopener noreferrer" target="_blank">
                  {repo.label}
                </a>
              ) : (
                repo.label
              )}
              .
            </strong>{' '}
            {repo.commits12mo === null
              ? 'Commit count unavailable for the last twelve months.'
              : `${repo.commits12mo.toLocaleString('en-US')} commits in the last twelve months.`}
          </RuledRow>
        ))}

        <p className={`px-open-meta${degraded ? ' px-open-meta--degraded' : ''}`}>
          {refreshed} &middot;{' '}
          <a
            href={`https://github.com/${stats.username}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            @{stats.username}
          </a>
        </p>
      </div>
    </section>
  );
}
