/**
 * Build for Cloudflare Workers.
 *
 * The one thing this does beyond calling `opennextjs-cloudflare build` is park
 * `proxy.ts` for the duration, and it is worth saying plainly why, because a
 * script that moves a source file out of the way looks like a hack:
 *
 *   Next 16 renamed `middleware.ts` to `proxy.ts` and, in the same move,
 *   dropped the edge runtime for it. `export const config = { runtime: 'edge' }`
 *   is rejected outright — "Proxy does not support Edge runtime". Meanwhile
 *   `@opennextjs/cloudflare` supports edge middleware only, and aborts the
 *   build with "Node.js middleware is not currently supported" the moment it
 *   finds a proxy. There is no version of either that satisfies the other; the
 *   adapter's own feature table lists Node middleware as unsupported.
 *
 * So on Cloudflare the contract lives in `worker/index.ts`, and `proxy.ts`
 * exists only for `next dev` / `next start`. Both call the same pure functions
 * in `lib/agent-proxy.ts`, so there is one implementation of the policy and
 * two thin adapters over it.
 *
 * The restore is in a `finally`, so an interrupted or failing build still puts
 * the file back. If this ever exits leaving `proxy.ts` missing, `git status`
 * will say so immediately.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// `proxy.test.ts` goes with it: the production tsconfig type-checks test files,
// so leaving the test behind fails the build on an unresolvable `./proxy`.
const PARK = ['proxy.ts', 'proxy.test.ts'].map((name) => ({
  live: join(root, name),
  parked: join(root, `${name}.cf-parked`),
}));

const stale = PARK.filter(({ parked }) => existsSync(parked));
if (stale.length > 0) {
  console.error(
    `Refusing to build: ${stale.map((f) => f.parked).join(', ')} already present, which means a ` +
      `previous build was interrupted before it could restore them. Move them back by hand and re-run.`,
  );
  process.exit(1);
}

const moved = PARK.filter(({ live }) => existsSync(live));
for (const { live, parked } of moved) renameSync(live, parked);

try {
  execFileSync('pnpm', ['exec', 'opennextjs-cloudflare', 'build', ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit',
  });
} finally {
  for (const { live, parked } of moved) renameSync(parked, live);
}
