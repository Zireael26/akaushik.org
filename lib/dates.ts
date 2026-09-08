const MONTH_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

// ISO date ("YYYY-MM-DD") → "MMM YYYY". Parsed in UTC so a post dated
// 2026-04-01 renders as "Apr 2026" regardless of server timezone — the Date
// constructor treats a bare date string as UTC midnight, and formatting in the
// local zone would regress to "Mar 2026" west of UTC.
export function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (
    isoDate &&
    (d.getUTCFullYear() !== Number(isoDate[1]) ||
      d.getUTCMonth() + 1 !== Number(isoDate[2]) ||
      d.getUTCDate() !== Number(isoDate[3]))
  ) {
    return iso;
  }
  return MONTH_YEAR.format(d);
}

/**
 * ISO timestamp → "3 days ago", in the same register as formatMonthYear.
 *
 * Shared because the provenance line under "In the open" and its degraded
 * variant both describe the age of the same snapshot, and two formatters for
 * one number is how they drift apart. Negative ages clamp to today: a
 * generatedAt a few seconds in the future — clock skew between the Worker
 * that wrote KV and the one rendering — must not read as "-1 days ago".
 */
export function formatRelativeAge(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown time ago';
  const days = Math.max(0, Math.round((now - then) / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
