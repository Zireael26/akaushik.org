import { describe, expect, it } from 'vitest';
import { stripTitleChrome } from './strip-title-chrome';

/**
 * This function had no test and runs at build time on every writing body.
 *
 * It is the kind of thing that fails quietly: strip one line too many and the
 * first paragraph of an article disappears from the published page, with no
 * error anywhere — the build succeeds, the types are fine, and the only symptom
 * is missing prose that nobody diffs. So the assertions below care as much
 * about what it must *not* remove as what it must.
 */
describe('stripTitleChrome', () => {
  it('drops the leading H1 and its blockquote dek', () => {
    const body = ['# Notes on a thing', '', '> The dek, mirroring frontmatter.', '', '## First real section', '', 'Prose.'].join('\n');
    expect(stripTitleChrome(body)).toBe('## First real section\n\nProse.');
  });

  it('drops a multi-line blockquote dek', () => {
    const body = ['# Title', '', '> One line', '> and a second.', '', 'Body.'].join('\n');
    expect(stripTitleChrome(body)).toBe('Body.');
  });

  it('drops an H1 that has no dek under it', () => {
    expect(stripTitleChrome('# Title\n\nBody.')).toBe('Body.');
  });

  it('tolerates leading blank lines before the H1', () => {
    expect(stripTitleChrome('\n\n# Title\n\nBody.')).toBe('Body.');
  });

  /**
   * The guard that matters most. A body that never had the H1/dek pair — or one
   * an author later rewrote — must survive untouched.
   */
  it('leaves a body with no title chrome completely alone', () => {
    const body = '## Straight into a section\n\nProse that must not be eaten.';
    expect(stripTitleChrome(body)).toBe(body);
  });

  it('does not mistake an H2 for the H1 it strips', () => {
    const body = '## Not the title\n\n> A quote that is content, not a dek.';
    expect(stripTitleChrome(body)).toBe(body);
  });

  /**
   * A blockquote with no H1 above it is somebody quoting something in the first
   * paragraph, not a dek. Stripping it would delete real content.
   */
  it('keeps a leading blockquote when no H1 precedes it', () => {
    const body = '> An epigraph the author meant to publish.\n\nThen prose.';
    expect(stripTitleChrome(body)).toBe(body);
  });

  it('keeps blockquotes that appear later in the body', () => {
    const body = ['# Title', '', '> The dek.', '', 'Prose.', '', '> A pull quote.', '', 'More prose.'].join('\n');
    expect(stripTitleChrome(body)).toBe('Prose.\n\n> A pull quote.\n\nMore prose.');
  });

  it('handles a blockquote with no space after the marker', () => {
    expect(stripTitleChrome('# Title\n\n>Dek without a space.\n\nBody.')).toBe('Body.');
  });

  it('returns empty for a body that is nothing but title chrome', () => {
    expect(stripTitleChrome('# Title\n\n> Dek.\n')).toBe('');
  });

  it('is a no-op on an empty body', () => {
    expect(stripTitleChrome('')).toBe('');
  });
});
