/** Dates are stored in UTC. "Today", due dates and weeks follow the UK calendar (Europe/London). */
export const DAY_MS = 24 * 60 * 60 * 1000;

const londonDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** A YYYY-MM-DD date as a Date at 00:00 UTC (how Prisma stores @db.Date). */
export function dateOnly(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

/** Today's UK date, as a @db.Date-comparable value. */
export function todayLondon(now: Date = new Date()): Date {
  return dateOnly(londonDate.format(now));
}

/** Monday of the current UK week. */
export function startOfWeekLondon(now: Date = new Date()): Date {
  const today = todayLondon(now);
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  return new Date(today.getTime() - daysSinceMonday * DAY_MS);
}
