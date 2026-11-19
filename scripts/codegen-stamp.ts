/**
 * Content-addressed stamps for the MDX codegen pair
 * (`build-content-bundle.ts`, `build-mdx-modules.ts`).
 *
 * `prebuild`, `pretypecheck` and `pretest` each run both generators, so one
 * gate cycle used to walk the corpus three times — and the mdx half paid the
 * full `@mdx-js/mdx` + Shiki compile on every pass. A stamp file records a
 * digest of everything a generator's output depends on, and a matching stamp
 * short-circuits the run before the expensive half happens.
 *
 * A stamp is a cache of the decision "these inputs produced that output", not
 * of the output itself: callers gate the fast path on the output file
 * existing too, and a miss falls through to full regeneration. Stamps are
 * machine-local and gitignored — a fresh clone regenerates once, then stamps.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

/** Digest of the `[key, content]` inputs a generator's output depends on. */
export function digestInputs(inputs: ReadonlyArray<readonly [string, string]>): string {
  const hash = createHash('sha256');
  for (const [key, content] of inputs) {
    hash.update(key);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

/** True when the stamp on disk was written for exactly this digest. */
export function stampMatches(stampPath: string, digest: string): boolean {
  try {
    return readFileSync(stampPath, 'utf8').trim() === digest;
  } catch {
    return false; // missing or unreadable stamp: regenerate
  }
}

/** Record `digest` as the freshest inputs this machine has generated from. */
export function writeStamp(stampPath: string, digest: string): void {
  writeFileSync(stampPath, `${digest}\n`);
}
