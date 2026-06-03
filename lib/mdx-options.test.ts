import { describe, expect, it } from 'vitest';
import { serialize } from 'next-mdx-remote/serialize';
import { MDX_OPTIONS } from './mdx-options';

// PROXY test for the shiki 1.x -> 4.x major bump (PR #92).
//
// shiki is NOT imported directly anywhere in source — it is the transitive
// syntax-highlighting engine behind `rehype-pretty-code`, which `MDX_OPTIONS`
// wires into every MDX render (writing posts + case studies). The real
// behavioral surface of the bump is therefore: "does a language-tagged code
// block still get tokenized into the configured dual theme (github-light /
// github-dark-dimmed) when compiled through our exact plugin stack?"
//
// We serialize a fenced, language-tagged block through the SAME rehype plugin
// chain the app uses — pulled from MDX_OPTIONS so the test cannot drift from
// the production config — via `next-mdx-remote/serialize` (the same compiler
// MDXRemote uses, and already a direct dependency). We then assert on the
// markers that prove the highlighter ran in dual-theme mode:
//   - `data-rehype-pretty-code-figure` — rehype-pretty-code wrapped the block
//   - `--shiki-light` / `--shiki-dark` — shiki emitted per-token color CSS vars
//     for BOTH themes (the dual-theme contract; a single-theme or failed run
//     would emit neither / only one). In the JSX `compiledSource` these appear
//     as quoted style-object keys (e.g. `"--shiki-light": "#D73A49"`); in the
//     prerendered HTML they appear as CSS `--shiki-light:` declarations — both
//     forms prove the same dual-theme tokenization ran.
//   - `data-theme="github-light github-dark-dimmed"` — the configured themes
//
// This runs at unit-test time (no full `next build` needed) and locks the
// behavior so a future shiki bump that silently breaks dual-theme output is
// caught in CI rather than only by eyeballing the rendered site.

async function compiledSourceFor(source: string): Promise<string> {
  const result = await serialize(source, {
    // Reuse the production MDX options so the proxy tracks the real rehype chain
    // (rehype-slug + rehype-pretty-code/shiki) rather than a hand-rolled copy.
    mdxOptions: MDX_OPTIONS.mdxOptions,
  });
  return result.compiledSource;
}

describe('mdx-options — shiki v4 dual-theme highlighting (PR #92 proxy)', () => {
  it('wraps a language-tagged code block in a rehype-pretty-code figure', async () => {
    const out = await compiledSourceFor(
      ['```ts', 'const overall = "BLOCKED" as const;', '```'].join('\n'),
    );
    expect(out).toContain('data-rehype-pretty-code-figure');
  });

  it('emits BOTH github-light and github-dark-dimmed token color variables', async () => {
    const out = await compiledSourceFor(
      ['```ts', 'export const x: number = 42;', '```'].join('\n'),
    );
    // The dual-theme contract: shiki v4 must emit per-token vars for each theme.
    // In the compiled JSX these are quoted style-object keys.
    expect(out).toContain('--shiki-light');
    expect(out).toContain('--shiki-dark');
    // ...and the configured theme pair must be the active one.
    expect(out).toContain('github-light github-dark-dimmed');
  });

  it('does NOT tokenize an un-tagged fence (plain block, no highlighter) — guards against false positives', async () => {
    const out = await compiledSourceFor(['```', 'Overall: BLOCKED', '```'].join('\n'));
    // A fence with no language is intentionally NOT tokenized — mirrors the
    // single plain block on /writing/trellis. If this ever starts emitting
    // shiki vars, the assertions above would no longer prove "language-aware
    // highlighting ran".
    expect(out).not.toContain('--shiki-light');
  });
});
