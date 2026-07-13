import { describe, expect, it } from 'vitest';
import { scopesIncludePrivate } from './fetch-github-stats.mjs';

describe('scopesIncludePrivate', () => {
  it.each([
    { header: 'repo, read:user', expected: true },
    { header: 'read:user', expected: false },
    { header: '', expected: false },
    { header: null, expected: false },
  ])('returns $expected for $header', ({ header, expected }) => {
    expect(scopesIncludePrivate(header)).toBe(expected);
  });
});
