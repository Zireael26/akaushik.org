import { describe, expect, it, vi } from 'vitest';
import {
  GITHUB_USERNAME,
  STATS_KV_KEY,
  STATS_REPOS,
  fetchStatsFromGitHub,
  isStaleStats,
  parseStats,
  resolveStats,
  runStatsRefresh,
  type Stats,
} from './stats-source';

/**
 * No network. Every fetch is a fake installed per test; every KV is a
 * plain-object stand-in for the Workers binding. These tests pin the three
 * contracts that keep "In the open" honest: the normalized payload shape, the
 * 36-hour staleness line, and the visibly-degraded fallback when KV holds
 * nothing usable.
 */

const HOUR = 60 * 60 * 1000;

/** generatedAt of public/data/stats.json as checked in; see the fallback tests below. */
const CHECKED_IN_GENERATED_AT = '2026-08-13T05:50:08.537Z';

/** A GitHub response factory covering every call the pipeline makes. */
function githubHarness(options?: {
  scopes?: string | null;
  totalContributions?: number;
  repoStatuses?: Record<string, number>;
}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = vi.fn(async (input: unknown, init?: unknown) => {
    const url = String(input);
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    calls.push({ url, init: init as RequestInit | undefined });
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    if (url === 'https://api.github.com/user') {
      return new Response(null, {
        status: 200,
        headers: { 'x-oauth-scopes': options?.scopes ?? 'repo, read:user' },
      });
    }
    if (url === 'https://api.github.com/graphql') {
      const body = JSON.parse(String((init as RequestInit).body)) as {
        variables: { login: string };
      };
      expect(body.variables.login).toBe(GITHUB_USERNAME);
      return json({
        data: {
          user: {
            contributionsCollection: {
              contributionCalendar: {
                totalContributions: options?.totalContributions ?? 13012,
                weeks: [
                  { contributionDays: [{ contributionCount: 3 }, { contributionCount: 4 }] },
                  { contributionDays: [{ contributionCount: 0 }, { contributionCount: 10 }] },
                ],
              },
            },
          },
        },
      });
    }
    for (const entry of STATS_REPOS) {
      const repoRoot = `https://api.github.com/repos/${entry.repo}`;
      const status = options?.repoStatuses?.[entry.repo] ?? 200;
      if (url === repoRoot) {
        return new Response(null, { status });
      }
      if (url.startsWith(`${repoRoot}/commits`)) {
        if (status !== 200) {
          return new Response('nope', { status });
        }
        if (!url.includes('since=')) {
          return json([{ commit: { author: { date: '2026-08-20T01:02:03Z' } } }]);
        }
        return new Response(null, {
          status: 200,
          headers: { link: `<${url}&page=42>; rel="last"` },
        });
      }
    }
    throw new Error(`unexpected fetch in harness: ${url}`);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const NOW = new Date('2026-08-23T06:00:00.000Z');

function freshStats(generatedAt = NOW.toISOString()): Stats {
  return {
    generatedAt,
    username: GITHUB_USERNAME,
    window: 'last-365-days',
    includesPrivate: true,
    totalContributions: 13012,
    weeks: [1, 2, 3],
    repos: [
      {
        name: 'neev',
        label: 'Neev',
        url: 'https://github.com/msme-neev/neev',
        public: false,
        commits12mo: 1637,
        lastCommit: '2026-08-12T02:28:30Z',
      },
    ],
  };
}

/** Minimal stand-in for the Workers KV binding, backed by an in-memory store. */
function memoryKV(initial?: [string, string]) {
  const store = new Map<string, string>(initial ? [initial] : []);
  const reads: Array<string | null> = [];
  return {
    store,
    reads,
    kv: {
      get: async (key: string) => {
        const value = store.get(key) ?? null;
        reads.push(value);
        return value;
      },
      put: async (key: string, value: string) => void store.set(key, value),
    },
  };
}

describe('fetchStatsFromGitHub', () => {
  it('normalizes the GraphQL calendar and REST counts into the Stats contract', async () => {
    const { fetchImpl } = githubHarness();
    const stats = await fetchStatsFromGitHub('fake-token', { fetchImpl, now: NOW });

    expect(stats.username).toBe(GITHUB_USERNAME);
    expect(stats.window).toBe('last-365-days');
    expect(stats.generatedAt).toBe(NOW.toISOString());
    expect(stats.totalContributions).toBe(13012);
    // Weeks are summed across days: [3+4, 0+10].
    expect(stats.weeks).toEqual([7, 10]);
    expect(stats.repos).toHaveLength(STATS_REPOS.length);
    for (const repo of stats.repos) {
      expect(repo.commits12mo).toBe(42);
      expect(repo.lastCommit).toBe('2026-08-20T01:02:03Z');
      expect(typeof repo.public).toBe('boolean');
    }
  });

  it('claims includesPrivate only from the token actually used', async () => {
    const withoutRepoScope = await fetchStatsFromGitHub('weak', {
      fetchImpl: githubHarness({ scopes: 'read:user' }).fetchImpl,
      now: NOW,
    });
    expect(withoutRepoScope.includesPrivate).toBe(false);

    const withRepoScope = await fetchStatsFromGitHub('strong', {
      fetchImpl: githubHarness({ scopes: 'repo, read:user' }).fetchImpl,
      now: NOW,
    });
    expect(withRepoScope.includesPrivate).toBe(true);
  });

  // Measured 2026-08-24: `curl -A '' https://api.github.com/rate_limit` returns
  // 403, the same call with a UA returns 200. GitHub requires a User-Agent on
  // every API request. Nothing local reproduces the failure — curl and Node's
  // fetch both supply a default — but `workerd` supplies none, so a missing
  // header here means the deployed cron 403s on its first refresh while every
  // test stays green. This asserts the header on EVERY outbound call, the
  // unauthenticated public-visibility probe included.
  it('sends a User-Agent on every GitHub request, or the deployed cron 403s', async () => {
    const { fetchImpl, calls } = githubHarness();
    await fetchStatsFromGitHub('t', { fetchImpl, now: NOW });
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const ua = new Headers(call.init?.headers).get('user-agent');
      expect(ua, `no User-Agent on ${call.url}`).toBeTruthy();
    }
  });

  it('keeps null-safe repo fields when a private repo 404s (gotchas 2026-05-02)', async () => {
    const neev = STATS_REPOS[0]!.repo;
    const { fetchImpl } = githubHarness({ repoStatuses: { [neev]: 404 } });
    const stats = await fetchStatsFromGitHub('t', { fetchImpl, now: NOW });
    const recorded = stats.repos.find((repo) => repo.name === 'neev')!;
    expect(recorded.commits12mo).toBeNull();
    expect(recorded.lastCommit).toBeNull();
    // Not linkable either — absent would also be legal here, but explicit
    // false is what an unauthenticated 404 means.
    expect(recorded.public).toBe(false);
    // ...and the other repos are unaffected.
    expect(stats.repos.find((repo) => repo.name === 'vericite')!.commits12mo).toBe(42);
  });

  it('refuses to produce a snapshot when every repo came back null', async () => {
    const statuses = Object.fromEntries(STATS_REPOS.map((repo) => [repo.repo, 404]));
    const { fetchImpl } = githubHarness({ repoStatuses: statuses });
    await expect(fetchStatsFromGitHub('t', { fetchImpl, now: NOW })).rejects.toThrow(
      /every repo returned null/,
    );
  });

  it('surfaces GraphQL errors instead of writing zeros', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ errors: [{ message: 'bad token' }] }), {
        status: 200,
      })) as unknown as typeof fetch;
    await expect(fetchStatsFromGitHub('t', { fetchImpl, now: NOW })).rejects.toThrow(
      /GraphQL errors/,
    );
  });
});

describe('runStatsRefresh (cron handler core)', () => {
  it('writes the normalized snapshot to KV under the versioned key', async () => {
    const { kv, store } = memoryKV();
    const { fetchImpl } = githubHarness();

    await runStatsRefresh({ GH_STATS_TOKEN: 'fake-token', STATS_KV: kv }, { fetchImpl, now: NOW });

    const written = store.get(STATS_KV_KEY);
    expect(written).toBeDefined();
    expect(parseStats(written!)).toMatchObject({ totalContributions: 13012, weeks: [7, 10] });
  });

  it('fails loudly when GH_STATS_TOKEN is missing and writes nothing', async () => {
    const put = vi.fn(async () => {});
    await expect(runStatsRefresh({ STATS_KV: { get: async () => null, put } })).rejects.toThrow(
      /GH_STATS_TOKEN is not set/,
    );
    expect(put).not.toHaveBeenCalled();
  });

  it('fails loudly when the KV binding is missing', async () => {
    await expect(runStatsRefresh({ GH_STATS_TOKEN: 't' })).rejects.toThrow(/STATS_KV/);
  });

  it('leaves the previous snapshot intact when GitHub fails mid-run', async () => {
    const previous = JSON.stringify(freshStats());
    const { kv, store } = memoryKV([STATS_KV_KEY, previous]);

    // A revoked token: /user answers 401 before anything is fetched or written.
    const fetchImpl = vi.fn(async () => new Response('bad credentials', { status: 401 }));

    await expect(
      runStatsRefresh({ GH_STATS_TOKEN: 'revoked', STATS_KV: kv }, { fetchImpl, now: NOW }),
    ).rejects.toThrow(/\/user 401/);
    expect(store.get(STATS_KV_KEY)).toBe(previous);
  });
});

describe('parseStats', () => {
  it('round-trips a valid snapshot', () => {
    expect(parseStats(JSON.stringify(freshStats()))).toEqual(freshStats());
  });

  it('rejects garbage without throwing', () => {
    expect(parseStats('not json at all')).toBeNull();
    expect(parseStats('{}')).toBeNull();
    expect(parseStats('[]')).toBeNull();
    expect(parseStats('null')).toBeNull();
  });

  it('rejects a payload with no usable generatedAt', () => {
    const broken = { ...freshStats(), generatedAt: 'not-a-date' };
    expect(parseStats(JSON.stringify(broken))).toBeNull();
    const missing = { ...freshStats() } as Partial<Stats>;
    delete missing.generatedAt;
    expect(parseStats(JSON.stringify(missing))).toBeNull();
  });

  it('keeps null commits12mo / lastCommit but rejects wrong types (gotchas 2026-05-02)', () => {
    const nullable = freshStats();
    nullable.repos[0]!.commits12mo = null;
    nullable.repos[0]!.lastCommit = null;
    expect(parseStats(JSON.stringify(nullable))).toEqual(nullable);

    const negative = freshStats();
    negative.repos[0]!.commits12mo = -5;
    expect(parseStats(JSON.stringify(negative))).toBeNull();

    const badDate = freshStats();
    badDate.repos[0]!.lastCommit = 17 as unknown as string;
    expect(parseStats(JSON.stringify(badDate))).toBeNull();
  });

  it('preserves an absent public flag rather than inventing public:true', () => {
    const legacy = freshStats();
    const { public: _dropped, ...repo } = legacy.repos[0]!;
    legacy.repos = [{ ...repo }];
    const parsed = parseStats(JSON.stringify(legacy))!;
    expect(parsed.repos[0]!.public).toBeUndefined();
  });
});

describe('isStaleStats', () => {
  it('is fresh inside 36 hours and stale past it', () => {
    const generated = '2026-08-21T18:00:00.000Z'; // exactly 36h before NOW
    expect(isStaleStats({ generatedAt: generated }, NOW.getTime())).toBe(false);

    const older = '2026-08-21T17:59:59.999Z'; // 36h minus 1ms past the line
    expect(isStaleStats({ generatedAt: older }, NOW.getTime())).toBe(true);
  });

  it('treats a missing or unparseable generatedAt as stale', () => {
    expect(isStaleStats({ generatedAt: '' }, NOW.getTime())).toBe(true);
    expect(isStaleStats({ generatedAt: 'garbage' }, NOW.getTime())).toBe(true);
  });
});

describe('resolveStats', () => {
  it('serves KV live when a fresh snapshot is there', async () => {
    const raw = JSON.stringify(freshStats(new Date(NOW.getTime() - 2 * HOUR).toISOString()));
    const view = await resolveStats({ get: async () => raw }, NOW.getTime());
    expect(view.degraded).toBe(false);
    expect(view.reason).toBe('live');
    expect(view.stats.totalContributions).toBe(freshStats().totalContributions);
  });

  it('serves a stale KV snapshot, labelled stale, over the fallback', async () => {
    const stale = freshStats(new Date(NOW.getTime() - 48 * HOUR).toISOString());
    const view = await resolveStats({ get: async () => JSON.stringify(stale) }, NOW.getTime());
    expect(view.degraded).toBe(true);
    expect(view.reason).toBe('stale');
    expect(view.stats.generatedAt).toBe(stale.generatedAt);
  });

  it('falls back to the checked-in snapshot, labelled degraded+stale, when KV is empty', async () => {
    const view = await resolveStats({ get: async () => null }, NOW.getTime());
    expect(view.degraded).toBe(true);
    // The checked-in file's own generatedAt (2026-08-13) is long past the
    // window, so its honest label is stale — it IS a stale snapshot being
    // served as last-good. 'missing' is reserved for a fallback file that is
    // somehow still fresh.
    expect(view.reason).toBe('stale');
    expect(view.stats.generatedAt).toBe(CHECKED_IN_GENERATED_AT);
  });

  it('falls back when the KV value fails the contract', async () => {
    const view = await resolveStats({ get: async () => '{"generatedAt":"nope"}' }, NOW.getTime());
    expect(view.degraded).toBe(true);
    expect(view.stats.generatedAt).toBe(CHECKED_IN_GENERATED_AT);
  });

  it('falls back when the KV read throws instead of taking the render down', async () => {
    const view = await resolveStats(
      {
        get: async () => {
          throw new Error('kv unavailable');
        },
      },
      NOW.getTime(),
    );
    expect(view.degraded).toBe(true);
    expect(view.stats.generatedAt).toBe(CHECKED_IN_GENERATED_AT);
  });

  it('degrades gracefully with no KV at all', async () => {
    const view = await resolveStats(null, NOW.getTime());
    expect(view.degraded).toBe(true);
    expect(view.stats.generatedAt).toBe(CHECKED_IN_GENERATED_AT);
  });
});
