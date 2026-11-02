import type { ItemStatus, RequestSummary } from '@docrequest/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** One label and colour per request state. Overdue wins over Sent / In progress. */
export function RequestStatusBadge({ r }: { r: Pick<RequestSummary, 'status' | 'overdue'> }) {
  if (r.overdue) return <Badge variant="warning">Overdue</Badge>;
  switch (r.status) {
    case 'DRAFT':
      return <Badge variant="neutral">Draft</Badge>;
    case 'SENT':
      return <Badge variant="info">Sent</Badge>;
    case 'IN_PROGRESS':
      return <Badge variant="info">In progress</Badge>;
    case 'COMPLETE':
      return <Badge variant="success">Complete</Badge>;
    case 'EXPIRED':
      return <Badge variant="neutral">Ended</Badge>;
  }
}

export const itemStatusLabel: Record<ItemStatus, string> = {
  PENDING: 'Not sent yet',
  SUBMITTED: 'To review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Retake asked',
};

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const variant = {
    PENDING: 'neutral',
    SUBMITTED: 'warning',
    ACCEPTED: 'success',
    REJECTED: 'danger',
  } as const;
  return <Badge variant={variant[status]}>{itemStatusLabel[status]}</Badge>;
}

/** "3 of 5 documents" with a bar. Green when everything is in. */
export function RequestProgress({
  r,
  className,
}: {
  r: Pick<RequestSummary, 'receivedCount' | 'itemCount' | 'status'>;
  className?: string;
}) {
  const pct = r.itemCount ? Math.round((r.receivedCount / r.itemCount) * 100) : 0;
  const done = r.status === 'COMPLETE';
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={r.itemCount}
        aria-valuenow={r.receivedCount}
        aria-label={`${r.receivedCount} of ${r.itemCount} documents received`}
      >
        <div
          className={cn('h-full rounded-full', done ? 'bg-success' : 'bg-brand')}
          style={{ width: `${done ? 100 : pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {r.receivedCount} of {r.itemCount} documents
      </p>
    </div>
  );
}
