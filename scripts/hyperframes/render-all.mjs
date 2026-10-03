#!/usr/bin/env node
/* =====================================================================
   scripts/hyperframes/render-all.mjs
   --------------------------------------------------------------------
   Orchestrator for all HyperFrames compositions. Walks `SLUGS`, renders
   each composition via `pnpm dlx hyperframes render`, then post-processes the
   MP4 with ffmpeg to add +faststart (move the moov atom to the head of
   the file, required so <video autoplay> can start before download ends).

   Usage:
     node scripts/hyperframes/render-all.mjs              # render all 8
     node scripts/hyperframes/render-all.mjs --only neev  # one slug
     node scripts/hyperframes/render-all.mjs --skip-ffmpeg

   Notes
   -----
   - CI does NOT run this script. The MP4s are committed artifacts; this
     is an author-time script.
   - Requires Node ≥22, a working ffmpeg on PATH, and the HyperFrames CLI
     reachable via `pnpm dlx hyperframes`. First render will auto-bootstrap
     headless Chrome via `pnpm dlx hyperframes browser ensure`.
   --------------------------------------------------------------------- */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const OUT_DIR = resolve(REPO_ROOT, 'public', 'video', 'work');

// Order matters only insofar as the cards render before the heroes —
// heroes are heavier (1600×900 × 300 frames) and a failure on a hero
// shouldn't block the cards shipping.
const SLUGS = [
  // cards (600×400, 5s, 150 frames)
  'neev',
  'vericite',
  'bluehost-agents',
  'curat-money',
  // hero bands (1600×900, 10s, 300 frames)
  'neev-hero',
  'vericite-hero',
  'bluehost-agents-hero',
  'curat-money-hero',
];

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const skipFfmpeg = args.includes('--skip-ffmpeg');

const targets = only
  ? SLUGS.filter((s) => s === only)
  : SLUGS;

if (!targets.length) {
  console.error(`No matching slug — got --only ${only}. Known:\n  ${SLUGS.join('\n  ')}`);
  process.exit(1);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Silence telemetry + update checks so CI-ish runs don't hit the network
process.env.HYPERFRAMES_NO_UPDATE_CHECK = '1';
process.env.HYPERFRAMES_NO_TELEMETRY = '1';

let ok = 0;
let failed = [];

for (const slug of targets) {
  const projectDir = resolve(__dirname, slug);
  const rawOut = resolve(OUT_DIR, `${slug}.raw.mp4`);
  const finalOut = resolve(OUT_DIR, `${slug}.mp4`);

  console.log(`\n▶ ${slug}`);
  console.log(`  project: ${projectDir}`);

  if (!existsSync(projectDir)) {
    console.error(`  ✗ missing composition dir`);
    failed.push(slug);
    continue;
  }

  // 1) Render via HyperFrames CLI. Composition id defaults to "root".
  const render = spawnSync(
    'pnpm',
    [
      'dlx',
      'hyperframes',
      'render',
      '--output', rawOut,
      '--fps', '30',
      '--quality', 'standard',
    ],
    { cwd: projectDir, stdio: 'inherit' },
  );

  if (render.status !== 0) {
    console.error(`  ✗ render failed for ${slug}`);
    failed.push(slug);
    continue;
  }

  // 2) Post-process for streaming. -movflags +faststart lets <video>
  //    start painting before the whole file arrives. Re-encode to H.264
  //    baseline + yuv420p for the widest client compat.
  if (skipFfmpeg) {
    renameSync(rawOut, finalOut);
  } else {
    const ff = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-i', rawOut,
        '-c:v', 'libx264',
        '-profile:v', 'high',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-an',                         // silent — no audio track
        '-crf', '23',
        '-preset', 'slow',
        finalOut,
      ],
      { stdio: 'inherit' },
    );

    if (ff.status !== 0) {
      console.error(`  ✗ ffmpeg post-process failed for ${slug}`);
      failed.push(slug);
      continue;
    }
    try { unlinkSync(rawOut); } catch {}
  }

  console.log(`  ✓ ${finalOut}`);
  ok += 1;
}

console.log(`\n${ok}/${targets.length} rendered`);
if (failed.length) {
  console.error(`failed: ${failed.join(', ')}`);
  process.exit(1);
}
