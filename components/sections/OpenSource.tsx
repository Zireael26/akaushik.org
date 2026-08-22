import { ContributionField } from '@/components/pixel/ContributionField';
import { RuledRow } from '@/components/pixel/RuledRow';
import { SectionHead } from '@/components/pixel/SectionHead';
import { formatMonthYear } from '@/lib/dates';
import { getStats } from '@/lib/stats';

/**
 * In the open — GitHub contribution stats, in the split-editorial shape.
 *
 * Presentation only: the data wiring is unchanged. Every number on screen comes
 * from public/data/stats.json (regenerated daily by scripts/fetch-github-stats.mjs
 * via .github/workflows/stats.yml); nothing here is written by hand, including
 * the statement heading, which interpolates the contribution total.
 *
 * The old sparkline was an SVG bar chart with per-repo progress bars beside it.
 * Bars are not the pixel language, so the weekly series is redrawn on the cell
 * grid — 7px squares with a 1px gutter, the skyline/marquee cell size — and the
 * per-repo bars are dropped in favour of the ruled rows the rest of the site
 * uses. Height ramps cobalt -> amber -> red from the baseline up, echoing the
 * heatfield.
 */

/** 7px cell, 1px gutter. Eight rows is the tallest column the scale allows. */

function formatRelativeDays(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.max(0, Math.round((now - then) / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

export default function OpenSource() {
  const stats = getStats();

  // One entry per filled cell. A week with any activity keeps at least one cell,
  // so a quiet week reads as quiet rather than as missing.

  return (
    <section className="px-section px-split px-open" id="open" data-screen-label="07 In the open">
      <SectionHead
        variant="column"
        heading={`${stats.totalContributions.toLocaleString('en-US')} contributions in the last twelve months.`}
        label="In the open"
        headingTarget
        headingMax={18}
      />

      <div className="px-split-body">
        <ContributionField className="px-open-contrib" weeks={stats.weeks} />

        <p className="px-split-intro">
          Counts come from the GitHub contributions API
          {stats.includesPrivate ? ', private repositories included' : ''}, and refresh daily from a
          script in this repo. The repositories below are the ones that script names by hand; each
          count is commits to that repository over the same twelve months.
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

        <p className="px-open-meta">
          Refreshed {formatRelativeDays(stats.generatedAt)} &middot;{' '}
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
