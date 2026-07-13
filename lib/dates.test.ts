import { describe, expect, it } from 'vitest';
import { formatMonthYear } from './dates';

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
