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
