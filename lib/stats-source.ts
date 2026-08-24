/**
 * The GitHub-stats snapshot: fetch, normalize, and staleness, as pure functions.
 *
 * Three consumers, one module:
 *   - the Worker cron trigger (`worker/index.ts` `scheduled`) calls
 *     `runStatsRefresh` to fetch from GitHub and write KV;
 *   - the site (`lib/stats.ts` `getStats`) calls `resolveStats` to read KV and
 *     fall back to the checked-in snapshot;
 *   - the tests call both with a fake `fetch` and a plain-object KV.
 *
 * This is the same layering doctrine as `lib/agent-proxy.ts`: the policy lives
 * here, the adapters stay thin. It is Worker-safe by construction — no `fs`,
 * no `process.exit`, no top-level network — because it is bundled into the
 * Worker that serves akaushik.org. The Node-only script
 * `scripts/fetch-github-stats.mjs` keeps its own copy of the pipeline and
 * stays working for local runs; the REPOS list and the GraphQL query below are
 * its deliberate twins, and the two must move together.
 *
 * The JSON contract is the one `lib/stats.ts` has always served, null-safety
 * included (gotchas.md 2026-05-02): `commits12mo` and `lastCommit` are
 * `number | null` / `string | null`, and an absent `public` flag means "do not
 * link", never "link and hope".
 */
import statsJson from '@/public/data/stats.json';

/**
 * The public JSON contract. Owned here so the cron that writes KV and the
 * site that reads it cannot drift; `lib/stats.ts` re-exports these names so
 * existing consumers of the contract keep their import path.
 */
export type StatsRepo = {
  name: string;
  label: string;
  url: string;
  /**
   * Whether an anonymous visitor can open `url`.
   *
   * Optional because old payloads predate the field, and absent must mean
   * "do not link" rather than "link and hope". The pipeline runs with a
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

/** Key under which the cron publishes the snapshot in the STATS_KV namespace.
 * Versioned, so a future contract change can write a second key and migrate. */
export const STATS_KV_KEY = 'github-stats:v1';

/** A snapshot older than this renders as visibly degraded, not as measured. */
export const STALE_AFTER_HOURS = 36;
const STALE_AFTER_MS = STALE_AFTER_HOURS * 60 * 60 * 1000;

/** The account the contribution snapshot describes. Twin of the script's USERNAME. */
export const GITHUB_USERNAME = 'Zireael26';

/** The repositories the section names by hand. Twin of the script's REPOS. */
export const STATS_REPOS = [
  { name: 'neev', label: 'Neev', repo: 'msme-neev/neev' },
  { name: 'vericite', label: 'VeriCite', repo: 'vericite-ai/vericite' },
  { name: 'curat-money', label: 'curat.money', repo: 'curat-money/curat' },
  { name: 'clusterbid', label: 'ClusterBid', repo: 'ClusterBid/console' },
];

/** Twin of the script's contribQuery. */
const CONTRIBUTION_QUERY = `query($login:String!, $from:DateTime!, $to:DateTime!) {
  user(login:$login) {
    contributionsCollection(from:$from, to:$to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount } }
      }
    }
  }
}`;

const GITHUB_API = 'https://api.github.com';

/**
 * GitHub rejects an API request with no `User-Agent` — measured 2026-08-24:
 * `curl -A '' https://api.github.com/rate_limit` is 403, the same call with a
 * UA is 200. This is easy to miss because nothing local reproduces it: curl
 * sends one by default and Node's fetch sends `node`, so every test and every
 * `pnpm dev` run passes. `workerd` sends none, so the deployed cron would have
 * 403'd on its first refresh and kept the site on its stale banner forever.
 * Every call in this file must carry this header.
 */
const GITHUB_UA = 'akaushik.org-stats (+https://akaushik.org)';

/**
 * The slice of a Workers KV namespace the stats path uses. Structural on
 * purpose: the real binding fits without a cast, and tests pass plain objects.
 */
export type StatsKVReader = { get(key: string): Promise<string | null> };
export type StatsKVWriter = { put(key: string, value: string): Promise<void> };
export type StatsKV = StatsKVReader & StatsKVWriter;

/** What `getStats()` serves: the snapshot, plus an honest account of where it came from. */
export type StatsView = {
  stats: Stats;
  /** True unless the snapshot came from KV inside the freshness window. */
  degraded: boolean;
  /** live — fresh from KV. stale — a snapshot older than the window (or with
   * no parseable generatedAt). missing — KV had nothing usable and the
   * checked-in snapshot is being served instead. */
  reason: 'live' | 'stale' | 'missing';
};

/** The Worker env the cron needs. `GH_STATS_TOKEN` is a wrangler secret; the
 * code only ever reads the binding, never a token value. */
export type StatsCronEnv = {
  GH_STATS_TOKEN?: string;
  STATS_KV?: StatsKV;
};

export type StatsFetchDeps = {
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Clock for the rolling 365-day window and for `generatedAt`. */
  now?: Date;
};

/**
 * Is this repository visible to someone who is not signed in?
 *
 * The cron runs with a `repo`-scoped token, so commit counts come back for
 * private repositories too — which is the point, they are the work. But the
 * URL built from the same name is a 404 for every visitor, and a portfolio
 * that links four 404s is worse than one that links none. Asked here
 * unauthenticated, because that is exactly the request a reader's browser
 * makes.
 */
async function repoIsPublic(repo: string, doFetch: typeof fetch): Promise<boolean> {
  try {
    const res = await doFetch(`${GITHUB_API}/repos/${repo}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': GITHUB_UA },
    });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    // Rate-limited or otherwise unclear. Say so rather than guessing public:
    // the consumer treats anything but an explicit true as "do not link".
    console.warn(`stats: repoIsPublic ${repo} returned ${res.status} — treating as not linkable`);
    return false;
  } catch {
    return false;
  }
}

/**
 * Per-repo commit counts, ported from the script's repoStats: the twelve-month
 * count comes from the `Link` pagination header of a `per_page=1` search, and
 * the last-commit date from a separate latest-commit call. A repo the token
 * cannot see returns nulls — that is the contract, not an error.
 */
async function repoCommitStats(
  repo: string,
  token: string,
  doFetch: typeof fetch,
  from: Date,
): Promise<Pick<StatsRepo, 'commits12mo' | 'lastCommit'>> {
  const headers = {
    authorization: `bearer ${token}`,
    accept: 'application/vnd.github+json',
    'user-agent': GITHUB_UA,
  };
  const url = `${GITHUB_API}/repos/${repo}/commits?author=${GITHUB_USERNAME}&since=${from.toISOString()}&per_page=1`;
  const res = await doFetch(url, { headers });
  if (!res.ok) {
    console.warn(`stats: ${repo} returned ${res.status} — commits will be null`);
    return { commits12mo: null, lastCommit: null };
  }
  const link = res.headers.get('link') || '';
  const last = /page=(\d+)>;\s*rel="last"/.exec(link);
  const commits12mo = last ? Number(last[1]) : ((await res.json()) as unknown[]).length;

  let lastCommit: string | null = null;
  try {
    const latest = await doFetch(
      `${GITHUB_API}/repos/${repo}/commits?author=${GITHUB_USERNAME}&per_page=1`,
      { headers },
    );
    const body = (await latest.json()) as Array<{ commit?: { author?: { date?: string } } }>;
    lastCommit = body[0]?.commit?.author?.date ?? null;
  } catch {
    // lastCommit stays null; the UI renders the row without a date tag.
  }
  return { commits12mo, lastCommit };
}

/**
 * Fetch the contribution snapshot from GitHub and normalize it to the
 * `Stats` contract. Throws rather than returning a degraded blob: the caller
 * decides what "last good" means (the cron keeps the previous KV value; the
 * script exits non-zero).
 */
export async function fetchStatsFromGitHub(
  token: string,
  deps: StatsFetchDeps = {},
): Promise<Stats> {
  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? new Date();
  const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const headers = {
    authorization: `bearer ${token}`,
    accept: 'application/vnd.github+json',
    'user-agent': GITHUB_UA,
  };

  // Whether the token can see private contributions decides the
  // `includesPrivate` claim, and the claim must match the token actually used
  // (2026-07-13 audit: it was once hardcoded true).
  const userRes = await doFetch(`${GITHUB_API}/user`, { headers });
  if (!userRes.ok) {
    throw new Error(`stats: REST /user ${userRes.status}: ${await userRes.text()}`);
  }
  const scopes = userRes.headers.get('x-oauth-scopes') ?? '';
  const includesPrivate = scopes
    .split(',')
    .map((scope) => scope.trim())
    .includes('repo');

  const gqlRes = await doFetch(`${GITHUB_API}/graphql`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: CONTRIBUTION_QUERY,
      variables: { login: GITHUB_USERNAME, from: from.toISOString(), to: now.toISOString() },
    }),
  });
  if (!gqlRes.ok) {
    throw new Error(`stats: GraphQL ${gqlRes.status}: ${await gqlRes.text()}`);
  }
  const gqlBody = (await gqlRes.json()) as {
    errors?: unknown[];
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar?: {
            totalContributions: number;
            weeks: Array<{ contributionDays: Array<{ contributionCount: number }> }>;
          };
        };
      };
    };
  };
  if (gqlBody.errors) {
    throw new Error(`stats: GraphQL errors: ${JSON.stringify(gqlBody.errors)}`);
  }
  const calendar = gqlBody.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    throw new Error('stats: GraphQL returned no contribution calendar');
  }
  const weeks = calendar.weeks.map((w) =>
    w.contributionDays.reduce((total, day) => total + day.contributionCount, 0),
  );

  const repos: StatsRepo[] = [];
  for (const entry of STATS_REPOS) {
    const counts = await repoCommitStats(entry.repo, token, doFetch, from);
    const isPublic = await repoIsPublic(entry.repo, doFetch);
    repos.push({
      name: entry.name,
      label: entry.label,
      url: `https://github.com/${entry.repo}`,
      public: isPublic,
      commits12mo: counts.commits12mo,
      lastCommit: counts.lastCommit,
    });
  }

  // Fail-safe, carried over from the script: if every repo returned null
  // (token scope insufficient, revoked, or rate-limited), abort rather than
  // overwrite the last good snapshot with a body of nulls. The cron's throw
  // leaves the previous KV value in place.
  if (repos.every((repo) => repo.commits12mo === null)) {
    throw new Error(
      'stats: every repo returned null commits12mo — likely token-scope, revoked-token, or ' +
        'rate-limit. Aborting without overwriting the last good snapshot.',
    );
  }

  return {
    generatedAt: now.toISOString(),
    username: GITHUB_USERNAME,
    window: 'last-365-days',
    includesPrivate,
    totalContributions: calendar.totalContributions,
    weeks,
    repos,
  };
}

/**
 * One cron tick: fetch from GitHub and publish to KV. Throws when the secret
 * or the binding is missing — a cron invocation that fails loudly is the
 * signal; silently writing nothing would look identical to success. On a
 * GitHub-side failure the throw happens before `put`, so KV keeps its last
 * good snapshot and the site degrades visibly instead of regressing.
 */
export async function runStatsRefresh(env: StatsCronEnv, deps: StatsFetchDeps = {}): Promise<void> {
  if (!env.GH_STATS_TOKEN) {
    throw new Error('stats cron: GH_STATS_TOKEN is not set; the refresh cannot run');
  }
  if (!env.STATS_KV) {
    throw new Error('stats cron: STATS_KV binding is not configured');
  }
  const stats = await fetchStatsFromGitHub(env.GH_STATS_TOKEN, deps);
  await env.STATS_KV.put(STATS_KV_KEY, JSON.stringify(stats));
}

/**
 * Coerce an untrusted string back to the `Stats` contract, or null. The KV
 * value is written by our own cron but read at request time — a partial or
 * hand-mangled value must fail closed into the fallback, not throw into the
 * render. Null-safe per gotchas.md 2026-05-02: `commits12mo` / `lastCommit`
 * may be null, and an absent `public` flag stays absent (meaning "do not
 * link"), it is not invented as true.
 */
export function parseStats(raw: string): Stats | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (typeof v.generatedAt !== 'string' || Number.isNaN(Date.parse(v.generatedAt))) return null;
  if (typeof v.username !== 'string' || typeof v.window !== 'string') return null;
  if (typeof v.includesPrivate !== 'boolean') return null;
  if (
    typeof v.totalContributions !== 'number' ||
    !Number.isFinite(v.totalContributions) ||
    v.totalContributions < 0
  ) {
    return null;
  }
  const isCount = (n: unknown): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0;
  if (!Array.isArray(v.weeks) || !v.weeks.every(isCount)) return null;
  if (!Array.isArray(v.repos)) return null;

  const repos: StatsRepo[] = [];
  for (const entry of v.repos) {
    if (typeof entry !== 'object' || entry === null) return null;
    const repo = entry as Record<string, unknown>;
    if (typeof repo.name !== 'string' || typeof repo.label !== 'string') return null;
    if (typeof repo.url !== 'string') return null;
    if (repo.commits12mo !== null && !isCount(repo.commits12mo)) return null;
    if (repo.lastCommit !== null && typeof repo.lastCommit !== 'string') return null;
    if (repo.public !== undefined && typeof repo.public !== 'boolean') return null;
    repos.push({
      name: repo.name,
      label: repo.label,
      url: repo.url,
      public: repo.public,
      commits12mo: repo.commits12mo,
      lastCommit: repo.lastCommit,
    });
  }

  return {
    generatedAt: v.generatedAt,
    username: v.username,
    window: v.window,
    includesPrivate: v.includesPrivate,
    totalContributions: v.totalContributions,
    weeks: v.weeks,
    repos,
  };
}

/**
 * Staleness. A snapshot with no parseable `generatedAt` is stale by
 * definition — an unknown age cannot be presented as fresh. The comparison is
 * strict: a snapshot exactly 36h old is still in the window; 36h + 1ms is not.
 */
export function isStaleStats(
  snapshot: Pick<Stats, 'generatedAt'>,
  now: number = Date.now(),
): boolean {
  const generated = Date.parse(snapshot.generatedAt);
  if (Number.isNaN(generated)) return true;
  return now - generated > STALE_AFTER_MS;
}

/** The checked-in snapshot, served only as the visibly-degraded path. */
const CHECKED_IN = statsJson as Stats;

/**
 * Resolve what the section should render: KV when it holds a fresh snapshot,
 * the checked-in file otherwise — degraded either way. A stale-but-present KV
 * value still wins over the fallback (it is the better last-good number), and
 * the view carries the reason so the UI can say exactly what went wrong. A KV
 * read failure falls through rather than throwing: the section must render
 * with a warning, not take the page down.
 */
export async function resolveStats(
  kv: StatsKVReader | null,
  now: number = Date.now(),
): Promise<StatsView> {
  if (kv) {
    try {
      const raw = await kv.get(STATS_KV_KEY);
      if (raw !== null) {
        const parsed = parseStats(raw);
        if (parsed) {
          return isStaleStats(parsed, now)
            ? { stats: parsed, degraded: true, reason: 'stale' }
            : { stats: parsed, degraded: false, reason: 'live' };
        }
      }
    } catch {
      // Degrade to the checked-in snapshot; the view below says so.
    }
  }
  // The checked-in snapshot is always degraded — it only exists because the
  // live path failed — and `reason` says which flavor: "stale" when its own
  // generatedAt is past the window (the usual case), "missing" when KV held
  // nothing usable and the checked-in file happens to still be fresh.
  return {
    stats: CHECKED_IN,
    degraded: true,
    reason: isStaleStats(CHECKED_IN, now) ? 'stale' : 'missing',
  };
}
