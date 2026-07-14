#!/usr/bin/env node
/**
 * Regenerates public/data/stats.json from the GitHub GraphQL API.
 *
 * Requires a personal-access token in env var GITHUB_TOKEN with
 *   - read:user
 *   - repo         (so private-repo contributions are counted)
 *
 * The classic `repo` scope is not read-only. The scheduled workflow therefore
 * treats this as a privileged automation credential and exposes it only after
 * resetting the worktree to the reviewed default-branch commit.
 *
 * Contributions returned by contributionsCollection include private
 * commits as long as the token can see them. The official profile
 * "Include private contributions" toggle mirrors the same data.
 *
 * Per-repo commit counts use the REST API (search/commits) which is
 * enough for well-known owned repos; if you move repos under an org,
 * update the REPOS list below.
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const USERNAME = 'Zireael26';
const REPOS = [
  { name: 'neev', label: 'Neev', repo: 'msme-neev/neev' },
  { name: 'vericite', label: 'VeriCite', repo: 'vericite-ai/vericite' },
  { name: 'curat-money', label: 'curat.money', repo: 'curat-money/curat' },
  { name: 'clusterbid', label: 'ClusterBid', repo: 'ClusterBid/console' },
];

const TOKEN = process.env.GITHUB_TOKEN;
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public', 'data', 'stats.json');

const now = new Date();
const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

const contribQuery = `query($login:String!, $from:DateTime!, $to:DateTime!) {
  user(login:$login) {
    contributionsCollection(from:$from, to:$to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount } }
      }
    }
  }
}`;

/**
 * @param {string | null} xOAuthScopesHeader
 */
export function scopesIncludePrivate(xOAuthScopesHeader) {
  return (xOAuthScopesHeader ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .includes('repo');
}

async function tokenIncludesPrivate() {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      authorization: `bearer ${TOKEN}`,
      accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`REST /user ${res.status}: ${await res.text()}`);
  return scopesIncludePrivate(res.headers.get('x-oauth-scopes'));
}

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `bearer ${TOKEN}`,
      'content-type': 'application/json',
      accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error('GraphQL errors: ' + JSON.stringify(json.errors));
  return json.data;
}

async function rest(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `bearer ${TOKEN}`,
      accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`REST ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function repoStats(repo) {
  const since = from.toISOString();
  const url = `/repos/${repo}/commits?author=${USERNAME}&since=${since}&per_page=1`;
  const res = await fetch(`https://api.github.com${url}`, {
    headers: { authorization: `bearer ${TOKEN}`, accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    console.warn(`repoStats: ${repo} returned ${res.status} — commits will be null`);
    return { commits12mo: null, lastCommit: null };
  }
  const link = res.headers.get('link') || '';
  const m = link.match(/page=(\d+)>;\s*rel="last"/);
  const count = m ? Number(m[1]) : (await res.json()).length;

  let lastCommit = null;
  try {
    const latest = await rest(`/repos/${repo}/commits?author=${USERNAME}&per_page=1`);
    lastCommit = latest?.[0]?.commit?.author?.date || null;
  } catch {}
  return { commits12mo: count, lastCommit };
}

async function main() {
  if (!TOKEN) {
    console.error('GITHUB_TOKEN is required');
    process.exit(1);
  }

  const includesPrivate = await tokenIncludesPrivate();
  const { user } = await gql(contribQuery, {
    login: USERNAME,
    from: from.toISOString(),
    to: now.toISOString(),
  });
  const cal = user.contributionsCollection.contributionCalendar;
  const weeks = cal.weeks.map((w) =>
    w.contributionDays.reduce((a, d) => a + d.contributionCount, 0),
  );

  const repos = [];
  for (const r of REPOS) {
    const stats = await repoStats(r.repo);
    repos.push({
      name: r.name,
      label: r.label,
      url: `https://github.com/${r.repo}`,
      commits12mo: stats.commits12mo,
      lastCommit: stats.lastCommit,
    });
  }

  // Fail-safe: if every repo returned null (token scope insufficient, revoked,
  // or rate-limited), abort rather than overwrite stats.json with zeros. The
  // workflow's commit step won't fire on non-zero exit, so the widget keeps
  // its last-known-good values until the underlying issue is fixed.
  if (repos.every((r) => r.commits12mo === null)) {
    console.error(
      'fetch-github-stats: every repo returned null commits12mo. ' +
        'Likely token-scope, revoked-token, or rate-limit issue. ' +
        'Aborting without overwriting stats.json.',
    );
    process.exit(1);
  }

  const out = {
    _note: 'Auto-generated by scripts/fetch-github-stats.mjs. Do not edit by hand.',
    generatedAt: now.toISOString(),
    username: USERNAME,
    window: 'last-365-days',
    includesPrivate,
    totalContributions: cal.totalContributions,
    weeks,
    repos,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(
    `wrote ${OUT}: ${cal.totalContributions} contributions, ${weeks.length} weeks, ${repos.length} repos`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
