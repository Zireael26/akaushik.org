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
