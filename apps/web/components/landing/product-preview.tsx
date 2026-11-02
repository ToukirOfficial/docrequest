import { Camera, Check, Clock, LockKeyhole, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Illustrative product preview for the landing page. All names are made up. */
export function ProductPreview() {
  return (
    <div aria-hidden="true" className="relative w-full">
      <DashboardMock className="hidden lg:mr-[170px] lg:block" />
      <PhoneMock className="mx-auto lg:absolute lg:top-10 lg:right-0" />
    </div>
  );
}

const rows = [
  {
    name: 'Amara Okafor',
    kind: 'New tenant',
    done: 3,
    total: 5,
    status: 'In progress',
    tone: 'info',
  },
  {
    name: 'Daniel Whitfield',
    kind: 'Guarantor',
    done: 4,
    total: 4,
    status: 'Complete',
    tone: 'success',
  },
  {
    name: 'Sofia Marchetti',
    kind: 'New tenant',
    done: 1,
    total: 5,
    status: 'Overdue',
    tone: 'warning',
  },
  {
    name: 'Rhys Llewellyn',
    kind: 'Landlord onboarding',
    done: 0,
    total: 6,
    status: 'Sent',
    tone: 'neutral',
  },
] as const;

const tones = {
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  neutral: 'bg-muted text-muted-foreground',
};

function DashboardMock({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-md', className)}>
      <div className="flex items-center gap-2 border-b bg-background px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-input" />
        <span className="size-2.5 rounded-full bg-input" />
        <span className="size-2.5 rounded-full bg-input" />
        <span className="ml-3 rounded-md bg-card px-3 py-0.5 text-[11px] text-muted-foreground">
          docs.cranbrooklettings.co.uk/app
        </span>
      </div>
      <div className="p-6 pr-[120px]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">Cranbrook Lettings</p>
            <p className="text-base font-semibold text-ink">Requests</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground">
            <Plus className="size-3" strokeWidth={3} /> New request
          </span>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            ['Open', '18'],
            ['Waiting for review', '5'],
            ['Overdue', '2'],
            ['Completed this week', '9'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border px-3 py-2">
              <p className="text-lg leading-tight font-semibold text-ink tabular-nums">{value}</p>
              <p className="truncate text-[10.5px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <ul className="mt-4 divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">{r.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{r.kind}</p>
              </div>
              <div className="w-32">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      r.done === r.total ? 'bg-success' : 'bg-brand',
                    )}
                    style={{ width: `${(r.done / r.total) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[10.5px] text-muted-foreground tabular-nums">
                  {r.done} of {r.total} documents
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
                  tones[r.tone],
                )}
              >
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PhoneMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-[260px] rounded-[2rem] border-[6px] border-ink bg-ink shadow-md',
        'animate-in fade-in slide-in-from-bottom-6 duration-700 motion-reduce:animate-none',
        className,
      )}
    >
      <div className="overflow-hidden rounded-[1.6rem] bg-card">
        <div className="flex items-center gap-2 border-b px-4 pt-4 pb-3">
          <span className="grid size-7 place-items-center rounded-md bg-ink text-[10px] font-bold text-white">
            CL
          </span>
          <p className="text-xs font-semibold text-ink">Cranbrook Lettings</p>
        </div>
        <div className="px-4 pt-3 pb-4">
          <p className="text-sm font-semibold text-ink">Hi Amara</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            We need 5 documents for your new tenancy. You can come back to this link any time.
          </p>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-ink">3 of 5 sent</span>
            <span className="text-muted-foreground">Due 14 Nov</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-3/5 rounded-full bg-brand" />
          </div>

          <ul className="mt-3 grid gap-1.5">
            <PhoneItem title="Passport" note="Accepted" state="done" />
            <PhoneItem title="Proof of address" note="Accepted" state="done" />
            <PhoneItem title="Last 3 payslips" note="Being checked" state="wait" />
            <li className="rounded-lg border border-danger/20 bg-danger-soft/60 p-2">
              <div className="flex items-center gap-2">
                <RotateCcw className="size-3.5 text-danger" />
                <p className="text-[11px] font-semibold text-ink">Bank statement</p>
              </div>
              <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
                The photo is a little blurry. Could you take it again in good light?
              </p>
            </li>
          </ul>

          <span className="mt-3 flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            <Camera className="size-4" /> Take photo or choose file
          </span>
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-snug text-success">
            <LockKeyhole className="mt-px size-3 shrink-0" />
            Your files are encrypted. Only Cranbrook Lettings can see them.
          </p>
        </div>
      </div>
    </div>
  );
}

function PhoneItem({
  title,
  note,
  state,
}: {
  title: string;
  note: string;
  state: 'done' | 'wait';
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
      <span
        className={cn(
          'grid size-5 place-items-center rounded-full',
          state === 'done' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
        )}
      >
        {state === 'done' ? (
          <Check className="size-3" strokeWidth={3} />
        ) : (
          <Clock className="size-3" strokeWidth={2.5} />
        )}
      </span>
      <span className="flex-1 truncate text-[11px] font-medium text-ink">{title}</span>
      <span className="text-[10px] text-muted-foreground">{note}</span>
    </li>
  );
}
