import { describe, expect, it } from 'vitest';
import { formatMonthYear, formatRelativeAge } from './dates';

describe('formatMonthYear', () => {
  it('formats an ISO date as MMM YYYY', () => {
    expect(formatMonthYear('2026-04-15')).toBe('Apr 2026');
  });

  it('uses three-letter month abbreviations', () => {
    expect(formatMonthYear('2026-01-01')).toBe('Jan 2026');
    expect(formatMonthYear('2026-12-31')).toBe('Dec 2026');
  });

  it('parses dates as UTC so timezone never crosses the boundary', () => {
    // 2026-04-01 in UTC is still April even from US/Asian local zones.
    expect(formatMonthYear('2026-04-01')).toBe('Apr 2026');
    expect(formatMonthYear('2026-03-31')).toBe('Mar 2026');
  });

  it('handles single-digit months and days', () => {
    expect(formatMonthYear('2026-02-09')).toBe('Feb 2026');
  });

  it('handles leap-year February', () => {
    expect(formatMonthYear('2024-02-29')).toBe('Feb 2024');
  });

  it('rejects rolled-over calendar dates without changing valid ISO dates', () => {
    expect(formatMonthYear('2026-02-30')).toBe('2026-02-30');
    expect(formatMonthYear('2026-04-01')).toBe('Apr 2026');
  });

  it('returns the input unchanged when the date cannot be parsed', () => {
    expect(formatMonthYear('not-a-date')).toBe('not-a-date');
    expect(formatMonthYear('')).toBe('');
  });
});

describe('formatRelativeAge', () => {
  const NOW = Date.parse('2026-08-23T12:00:00.000Z');

  it('renders today, yesterday, then day counts', () => {
    expect(formatRelativeAge('2026-08-23T06:00:00Z', NOW)).toBe('today');
    expect(formatRelativeAge('2026-08-22T12:30:00Z', NOW)).toBe('yesterday');
    expect(formatRelativeAge('2026-08-13T05:50:08Z', NOW)).toBe('10 days ago');
  });

  it('rounds half-days up', () => {
    // 2.5 days old → "3 days ago"; the provenance line rounds, it does not floor.
    expect(formatRelativeAge('2026-08-21T00:00:00Z', NOW)).toBe('3 days ago');
  });

  it('clamps a future timestamp to today instead of going negative', () => {
    expect(formatRelativeAge('2026-08-23T13:00:00Z', NOW)).toBe('today');
  });

  it('says unknown for an unparseable timestamp rather than inventing an age', () => {
    expect(formatRelativeAge('garbage', NOW)).toBe('unknown time ago');
  });

  it('defaults the clock so call sites do not each thread Date.now()', () => {
    const recent = new Date(Date.now() - 30 * 1000).toISOString();
    expect(formatRelativeAge(recent)).toBe('today');
  });
});
