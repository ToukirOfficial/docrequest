'use client';

import type { RequestDetail } from '@docrequest/shared';
import { ItemStatusBadge } from '@/components/requests/status';

/** The request's documents and their state. */
export function ReviewPanel({
  request,
}: {
  request: RequestDetail;
  onChange: (r: RequestDetail) => void;
}) {
  return (
    <ol className="divide-y">
      {request.items.map((item, i) => (
        <li key={item.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">
              {item.title}
              {!item.required && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
              )}
            </p>
            {item.helpText && <p className="text-sm text-muted-foreground">{item.helpText}</p>}
            <p className="mt-1.5 flex flex-wrap gap-1">
              {item.allowedTypes.map((t) => (
                <span
                  key={t}
                  className="rounded border px-1.5 py-px font-mono text-[10.5px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </p>
          </div>
          <ItemStatusBadge status={item.status} />
        </li>
      ))}
    </ol>
  );
}
