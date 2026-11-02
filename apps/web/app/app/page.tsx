'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileStack,
  Inbox,
  Plus,
  Search,
  SearchX,
  TimerOff,
} from 'lucide-react';
import type { Dashboard, RequestFilter, RequestList, RequestSummary } from '@docrequest/shared';
import { PageHeader } from '@/components/page-header';
import { FormError } from '@/components/form-error';
import { RequestProgress, RequestStatusBadge } from '@/components/requests/status';
import { useWorkspace } from '@/components/workspace-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { activityText, timeAgo } from '@/lib/activity';
import { api } from '@/lib/api';
import { formatDay } from '@/lib/format';
import { cn } from '@/lib/utils';

const FILTERS: { id: RequestFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'REVIEW', label: 'To review' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'DRAFT', label: 'Drafts' },
  { id: 'COMPLETE', label: 'Complete' },
  { id: 'EXPIRED', label: 'Ended' },
];

export default function DashboardPage() {
  const { workspace } = useWorkspace();
  const base = `/w/${workspace.workspaceId}`;
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [list, setList] = useState<RequestList | null>(null);
  const [filter, setFilter] = useState<RequestFilter>('ALL');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Debounce typing in the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const loadList = useCallback(
    () =>
      api<RequestList>(
        `${base}/requests?filter=${filter}&page=${page}&q=${encodeURIComponent(query)}`,
      )
        .then(setList)
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Could not load requests'),
        ),
    [base, filter, page, query],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    api<Dashboard>(`${base}/dashboard`)
      .then(setDash)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not load the dashboard'),
      );
  }, [base]);

  const pick = (f: RequestFilter) => {
    setFilter(f);
    setPage(1);
  };
  const empty =
    dash && list && list.total === 0 && filter === 'ALL' && !query && dash.stats.open === 0;

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Requests"
        description={`Everything ${workspace.workspaceName} has asked clients for, and what's still missing.`}
        action={
          <Button asChild>
            <Link href="/app/requests/new">
              <Plus /> New request
            </Link>
          </Button>
        }
      />
      <FormError message={error} />

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Open requests"
          value={dash?.stats.open}
          icon={Inbox}
          onClick={() => pick('OPEN')}
          active={filter === 'OPEN'}
        />
        <StatCard
          label="Waiting for review"
          value={dash?.stats.toReview}
          icon={FileStack}
          tone="brand"
          onClick={() => pick('REVIEW')}
          active={filter === 'REVIEW'}
        />
        <StatCard
          label="Overdue"
          value={dash?.stats.overdue}
          icon={TimerOff}
          tone="warning"
          onClick={() => pick('OVERDUE')}
          active={filter === 'OVERDUE'}
        />
        <StatCard
          label="Completed this week"
          value={dash?.stats.completedThisWeek}
          icon={CheckCircle2}
          tone="success"
          onClick={() => pick('COMPLETE')}
          active={filter === 'COMPLETE'}
        />
      </section>

      {empty ? (
        <FirstRequest />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 gap-6">
            {dash && dash.attention.length > 0 && <Attention items={dash.attention} />}

            <section
              className="min-w-0 rounded-lg border bg-card shadow-xs"
              aria-labelledby="all-requests"
            >
              <div className="grid gap-3 border-b p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="all-requests" className="font-semibold text-ink">
                    All requests
                  </h2>
                  <div className="relative w-full sm:w-64">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      type="search"
                      aria-label="Search by client name or email"
                      placeholder="Search clients"
                      className="pl-9"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                </div>
                <div
                  role="tablist"
                  aria-label="Filter requests"
                  className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]"
                >
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      role="tab"
                      aria-selected={filter === f.id}
                      onClick={() => pick(f.id)}
                      className={cn(
                        'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        filter === f.id
                          ? 'bg-ink text-white'
                          : 'text-muted-foreground hover:bg-accent hover:text-ink',
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {!list ? (
                <ListSkeleton />
              ) : list.requests.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-3 font-medium text-ink">No requests match</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try another filter or search, or start a new request.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-5"
                    onClick={() => {
                      setQ('');
                      pick('ALL');
                    }}
                  >
                    Show all requests
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="divide-y">
                    {list.requests.map((r) => (
                      <RequestRow key={r.id} r={r} />
                    ))}
                  </ul>
                  {list.total > list.pageSize && (
                    <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-muted-foreground">
                      <span className="tabular-nums">
                        {(page - 1) * list.pageSize + 1}–
                        {Math.min(page * list.pageSize, list.total)} of {list.total}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page * list.pageSize >= list.total}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          <Activity dash={dash} />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'ink',
  onClick,
  active,
}: {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'ink' | 'brand' | 'warning' | 'success';
  onClick: () => void;
  active: boolean;
}) {
  const tones = {
    ink: 'bg-secondary text-ink',
    brand: 'bg-brand-soft text-brand',
    warning: 'bg-warning-soft text-warning',
    success: 'bg-success-soft text-success',
  };
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group rounded-lg border bg-card p-4 text-left shadow-xs transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-5',
        active && 'border-ink/30',
      )}
    >
      <span className={cn('grid size-9 place-items-center rounded-lg', tones[tone])}>
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      {value === undefined ? (
        <Skeleton className="mt-4 h-8 w-12" />
      ) : (
        <p className="mt-4 font-display text-3xl leading-none font-semibold text-ink tabular-nums">
          {value}
        </p>
      )}
      <p className="mt-1.5 text-sm text-muted-foreground">{label}</p>
    </button>
  );
}

function Attention({ items }: { items: RequestSummary[] }) {
  return (
    <section
      className="rounded-lg border border-warning/25 bg-card shadow-xs"
      aria-labelledby="attention"
    >
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
        <h2 id="attention" className="font-semibold text-ink">
          Needs your attention
        </h2>
      </div>
      <ul className="divide-y">
        {items.map((r) => (
          <li key={r.id}>
            <Link
              href={`/app/requests/${r.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-background focus-visible:bg-background focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{r.clientName}</span>
              <span className="text-sm text-muted-foreground">
                {r.toReviewCount > 0
                  ? `${r.toReviewCount} document${r.toReviewCount === 1 ? '' : 's'} to review`
                  : r.dueDate
                    ? `Was due ${formatDay(r.dueDate)}`
                    : 'Overdue'}
              </span>
              <RequestStatusBadge r={r} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RequestRow({ r }: { r: RequestSummary }) {
  return (
    <li>
      <Link
        href={`/app/requests/${r.id}`}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-background focus-visible:bg-background focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_160px_110px_auto] sm:px-5"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{r.clientName}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {r.checklistName || 'Custom checklist'}
          </span>
        </span>
        <span className="order-last col-span-2 sm:order-none sm:col-span-1">
          <RequestProgress r={r} />
        </span>
        <span className="hidden text-sm text-muted-foreground sm:block">
          {r.dueDate ? `Due ${formatDay(r.dueDate).replace(/ \d{4}$/, '')}` : 'No due date'}
        </span>
        <span className="justify-self-end">
          <RequestStatusBadge r={r} />
        </span>
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-2 w-36 sm:block" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function Activity({ dash }: { dash: Dashboard | null }) {
  return (
    <section className="rounded-lg border bg-card shadow-xs" aria-labelledby="activity">
      <h2 id="activity" className="border-b px-5 py-4 font-semibold text-ink">
        Recent activity
      </h2>
      {!dash ? (
        <div className="grid gap-4 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : dash.activity.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Uploads, reviews and reminders will show up here.
        </p>
      ) : (
        <ol className="grid gap-4 p-5">
          {dash.activity.map((a) => (
            <li key={a.id} className="grid grid-cols-[8px_minmax(0,1fr)] gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1.5 size-2 rounded-full',
                  a.actorType === 'CLIENT'
                    ? 'bg-brand'
                    : a.actorType === 'SYSTEM'
                      ? 'bg-input'
                      : 'bg-ink',
                )}
              />
              <div className="min-w-0">
                {a.requestId ? (
                  <Link
                    href={`/app/requests/${a.requestId}`}
                    className="text-sm text-ink hover:underline"
                  >
                    {activityText(a)}
                  </Link>
                ) : (
                  <p className="text-sm text-ink">{activityText(a)}</p>
                )}
                <p className="text-xs text-muted-foreground">{timeAgo(a.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function FirstRequest() {
  return (
    <section className="grid items-center gap-8 rounded-lg border bg-card p-6 shadow-xs sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
          Send your first request
        </h2>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Pick a checklist, add your client&apos;s name and email, and send. They get a secure link
          and upload from their phone. You&apos;ll see everything arrive here.
        </p>
        <Button asChild className="mt-6">
          <Link href="/app/requests/new">
            <Plus /> New request
          </Link>
        </Button>
      </div>
      <ol className="grid gap-3 text-sm">
        {[
          ['Pick a checklist', 'Start from a template like New tenant, or write your own.'],
          ['Your client uploads', 'They confirm a 6-digit code and upload from their phone.'],
          ['You review', 'Accept each document or ask for a retake, then download a zip.'],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3 rounded-lg border bg-background p-4">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-white tabular-nums">
              {i + 1}
            </span>
            <span>
              <span className="block font-medium text-ink">{t}</span>
              <span className="text-muted-foreground">{d}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
