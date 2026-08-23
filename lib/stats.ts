import statsJson from '@/public/data/stats.json';

export type StatsRepo = {
  name: string;
  label: string;
  url: string;
  /**
   * Whether an anonymous visitor can open `url`.
   *
   * Optional because `stats.json` predates the field, and absent must mean
   * "do not link" rather than "link and hope". The fetch script runs with a
   * `repo`-scoped token, so it reports real commit counts for private
   * repositories — the URL it builds from the same name is a 404 for everyone
   * reading the site.
   */
  public?: boolean;
  commits12mo: number | null;
  lastCommit: string | null;
};

export type Stats = {
  generatedAt: string;
  username: string;
  window: string;
  includesPrivate: boolean;
  totalContributions: number;
  weeks: number[];
  repos: StatsRepo[];
};

export function getStats(): Stats {
  const {
    generatedAt,
    username,
    window,
    includesPrivate,
    totalContributions,
    weeks,
    repos,
  } = statsJson as Stats;
  return {
    generatedAt,
    username,
    window,
    includesPrivate,
    totalContributions,
    weeks,
    repos,
  };
}
