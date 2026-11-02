import type { ActivityEntry } from '@docrequest/shared';

/** Plain-English line for an activity feed entry. Unknown actions fall back to a generic line. */
export function activityText(a: ActivityEntry): string {
  const who =
    a.actorType === 'SYSTEM'
      ? 'DocRequest'
      : a.actorType === 'CLIENT'
        ? (a.clientName ?? 'The client')
        : (a.actorName ?? 'Someone');
  const client = a.clientName ?? 'a client';
  const lines: Record<string, string> = {
    'request.created': `${who} created a request for ${client}`,
    'request.sent': `${who} sent the link to ${client}`,
    'request.link_resent': `${who} sent ${client} a new link`,
    'request.updated': `${who} edited ${client}'s request`,
    'request.items_updated': `${who} changed ${client}'s checklist`,
    'request.cancelled': `${who} cancelled ${client}'s request`,
    'request.deleted': `${who} deleted a draft`,
    'request.completed': `${client}'s request is complete`,
    'client.opened': `${client} opened the link`,
    'client.verified': `${client} confirmed their code`,
    'file.uploaded': `${client} uploaded a document`,
    'file.removed': `${client} removed a document`,
    'file.infected': `A file from ${client} failed the virus scan`,
    'file.viewed': `${who} viewed a document from ${client}`,
    'item.accepted': `${who} accepted a document from ${client}`,
    'item.rejected': `${who} asked ${client} for a retake`,
    'export.created': `${who} downloaded ${client}'s documents`,
    'reminder.sent': `${a.actorType === 'SYSTEM' ? 'A reminder was sent' : `${who} sent a reminder`} to ${client}`,
    'request.expired': `${client}'s link expired`,
    'retention.files_deleted': `Files for ${client} were deleted on schedule`,
  };
  return lines[a.action] ?? `${who} updated ${client}'s request`;
}

const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
});

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(s / 86400), 'day');
  return timeFmt.format(new Date(iso));
}
