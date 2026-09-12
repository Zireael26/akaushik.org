#!/usr/bin/env node
/**
 * Creates the Cloudflare resources this app needs and writes their ids into
 * wrangler.jsonc, replacing the PROVISION_ME placeholders.
 *
 * Run once per environment:
 *   node scripts/provision.mjs                 # preview
 *   node scripts/provision.mjs --env production
 *
 * Creating a D1 database or an R2 bucket that already exists is reported and
 * skipped, so re-running after a partial failure is safe. Nothing here deploys
 * a Worker or touches DNS.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const CONFIG = join(APP, 'wrangler.jsonc');

const args = process.argv.slice(2);
const envIndex = args.indexOf('--env');
const env = envIndex >= 0 ? args[envIndex + 1] : null;
const suffix = env === 'production' ? 'PROD' : 'PREVIEW';

function wrangler(argv) {
  return execFileSync('pnpm', ['exec', 'wrangler', ...argv], {
    cwd: APP,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function config() {
  return JSON.parse(
    readFileSync(CONFIG, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n'),
  );
}

const parsed = config();
const scope = env ? parsed.env?.[env] : parsed;
if (!scope) {
  console.error(`No such environment in wrangler.jsonc: ${env}`);
  process.exit(1);
}

/** Returns the database id, creating the database if it does not exist. */
function ensureDatabase(name) {
  const listed = JSON.parse(wrangler(['d1', 'list', '--json']));
  const existing = listed.find((entry) => entry.name === name);
  if (existing) {
    console.log(`  d1 ${name}: exists (${existing.uuid})`);
    return existing.uuid;
  }
  console.log(`  d1 ${name}: creating`);
  wrangler(['d1', 'create', name]);
  const after = JSON.parse(wrangler(['d1', 'list', '--json']));
  const created = after.find((entry) => entry.name === name);
  if (!created) throw new Error(`d1 create reported success but ${name} is not listed`);
  return created.uuid;
}

function ensureBucket(name) {
  try {
    wrangler(['r2', 'bucket', 'create', name]);
    console.log(`  r2 ${name}: created`);
  } catch {
    // `bucket create` fails when it already exists; there is no --if-not-exists.
    console.log(`  r2 ${name}: exists or could not be created (see output above)`);
  }
}

console.log(`Provisioning ${env ?? 'preview'}:`);

const replacements = new Map();
for (const database of scope.d1_databases ?? []) {
  const id = ensureDatabase(database.database_name);
  const placeholder =
    database.binding === 'AUTH_DB' ? `PROVISION_ME_AUTH_${suffix}` : `PROVISION_ME_PROGRESS_${suffix}`;
  replacements.set(placeholder, id);
}
for (const bucket of scope.r2_buckets ?? []) ensureBucket(bucket.bucket_name);

let source = readFileSync(CONFIG, 'utf8');
for (const [placeholder, id] of replacements) {
  if (!source.includes(placeholder)) {
    console.log(`  ${placeholder}: already replaced, leaving as is`);
    continue;
  }
  source = source.replaceAll(placeholder, id);
  console.log(`  ${placeholder} -> ${id}`);
}
writeFileSync(CONFIG, source);

console.log('\nNext:');
console.log(`  pnpm exec wrangler d1 execute <auth-db> ${env ? `--env ${env} ` : ''}--remote --file migrations/auth/0001_auth.sql`);
console.log(`  pnpm exec wrangler d1 execute <progress-db> ${env ? `--env ${env} ` : ''}--remote --file migrations/learn/0001_progress.sql`);
console.log(`  pnpm exec wrangler secret put BA_SECRET${env ? ` --env ${env}` : ''}`);
console.log(`  pnpm assets:sync${env ? ` -- --env ${env}` : ''}`);
