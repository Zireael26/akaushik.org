#!/usr/bin/env node
/**
 * Uploads the course's non-lesson files to the R2 bucket the gated download
 * route reads from.
 *
 * The set of files is taken from lib/generated/course.json, which is the same
 * list the route will serve — so a file that was not in the bundle at build
 * time is neither uploaded nor downloadable, and the two cannot drift.
 *
 * Usage:
 *   node scripts/sync-course-assets.mjs                # preview bucket
 *   node scripts/sync-course-assets.mjs --env production
 *   node scripts/sync-course-assets.mjs --local        # miniflare, for `next dev`
 *   node scripts/sync-course-assets.mjs --dry-run
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const COURSE = join(APP, 'course');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const local = args.includes('--local');
const envIndex = args.indexOf('--env');
const env = envIndex >= 0 ? args[envIndex + 1] : null;

const config = JSON.parse(
  readFileSync(join(APP, 'wrangler.jsonc'), 'utf8')
    // Minimal JSONC handling: strip whole-line comments only. The config is
    // ours and never puts a comment after code on the same line.
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n'),
);

const buckets = env ? config.env?.[env]?.r2_buckets : config.r2_buckets;
const bucket = buckets?.find((entry) => entry.binding === 'COURSE_FILES')?.bucket_name;
if (!bucket) {
  console.error(`No COURSE_FILES bucket configured for env=${env ?? 'default'}`);
  process.exit(1);
}

const bundlePath = join(APP, 'lib', 'generated', 'course.json');
if (!existsSync(bundlePath)) {
  console.error('Course bundle missing. Run `pnpm course` first.');
  process.exit(1);
}
const { assets } = JSON.parse(readFileSync(bundlePath, 'utf8'));

console.log(
  `${dryRun ? 'Would upload' : 'Uploading'} ${assets.length} files to ` +
    `r2://${bucket}${local ? ' (local miniflare state)' : ''}`,
);

let uploaded = 0;
for (const asset of assets) {
  const file = join(COURSE, asset.path);
  if (!existsSync(file)) {
    console.error(`  missing on disk, skipped: ${asset.path}`);
    continue;
  }
  if (dryRun) {
    console.log(`  ${asset.path} (${asset.bytes} B)`);
    continue;
  }
  // Default is `--remote`: the deployed route reads the real bucket, and a
  // local-only copy would make `next dev` work while production 404s.
  execFileSync(
    'pnpm',
    [
      'exec', 'wrangler', 'r2', 'object', 'put', `${bucket}/${asset.path}`,
      '--file', file, local ? '--local' : '--remote',
    ],
    { cwd: APP, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  uploaded += 1;
  if (uploaded % 20 === 0) console.log(`  ${uploaded}/${assets.length}`);
}

console.log(dryRun ? 'Dry run complete.' : `Uploaded ${uploaded} files.`);
