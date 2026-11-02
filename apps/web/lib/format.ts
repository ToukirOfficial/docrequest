const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Dates are stored in UTC and always shown in UK time. */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export const roleLabel: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', STAFF: 'Staff' };

const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
/** A date-only value (YYYY-MM-DD), e.g. due dates: "Fri 13 Nov 2026". */
export function formatDay(ymd: string): string {
  return dayFmt.format(new Date(`${ymd}T00:00:00Z`));
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}
