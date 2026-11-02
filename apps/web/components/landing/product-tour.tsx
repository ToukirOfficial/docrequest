'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  AlarmClock,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  FileText,
  LockKeyhole,
  Mail,
  MailCheck,
  RotateCcw,
  Send,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * Interactive walkthrough of one request, from sending to downloading.
 * Left: what the business sees. Right: the client's phone. All data is made up.
 */

type StepId = 'send' | 'verify' | 'upload' | 'review' | 'remind' | 'download';
interface Step {
  id: StepId;
  label: string;
  title: string;
  body: string;
  focus: 'staff' | 'client';
}

const FIRST: Step = {
  id: 'send',
  label: 'Send a request',
  title: 'Pick a checklist and send one secure link',
  body: "Choose a template, add the client's name and email, and send. DocRequest emails them a unique link that only opens this one request.",
  focus: 'staff',
};
const STEPS: Step[] = [
  FIRST,
  {
    id: 'verify',
    label: 'Client confirms',
    title: 'No account, no password',
    body: 'Your client opens the link and types a 6-digit code from their inbox. Five wrong tries and the code stops working.',
    focus: 'client',
  },
  {
    id: 'upload',
    label: 'Client uploads',
    title: 'One button per document',
    body: 'They take a photo or choose a file for each item, straight from their phone, and can come back later to finish.',
    focus: 'client',
  },
  {
    id: 'review',
    label: 'You review',
    title: 'Accept it, or ask for a retake',
    body: 'Preview every file in the browser. If something is wrong, say why. The client sees exactly what to fix.',
    focus: 'staff',
  },
  {
    id: 'remind',
    label: 'Reminders',
    title: 'Reminders go out by themselves',
    body: 'Set the schedule once (by default 2, 5 and 7 days). Each reminder lists only what is still missing, and they stop when the request is complete.',
    focus: 'client',
  },
  {
    id: 'download',
    label: 'Download',
    title: 'One zip, with clean file names',
    body: 'When every required document is accepted, the request completes. Download a zip, and the files delete themselves after your retention period.',
    focus: 'staff',
  },
];

const DURATION_MS = 7000;

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ProductTour() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [view, setView] = useState<'staff' | 'client' | null>(null);
  const reduced = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => true);
  const step = STEPS[active] ?? FIRST;
  const shown = view ?? step.focus;
  const playing = auto && !reduced;
  const tabsRef = useRef<HTMLDivElement>(null);

  // Keep the active step visible in the scrollable step bar (phones), without moving the page.
  useEffect(() => {
    const bar = tabsRef.current;
    const tab = bar?.children[active] as HTMLElement | undefined;
    if (!bar || !tab) return;
    bar.scrollTo({
      left: tab.offsetLeft - (bar.clientWidth - tab.clientWidth) / 2,
      behavior: 'smooth',
    });
  }, [active]);

  function choose(i: number) {
    setAuto(false);
    setView(null);
    setActive(i);
  }

  return (
    <div className="group/tour overflow-hidden rounded-2xl border bg-card shadow-md">
      {/* Steps */}
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Product tour"
        className="flex overflow-x-auto border-b [scrollbar-width:none]"
      >
        {STEPS.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={on}
              aria-controls="tour-panel"
              onClick={() => choose(i)}
              className={cn(
                'relative flex min-w-[9.5rem] flex-1 items-center gap-2.5 px-4 py-3.5 text-left text-sm transition-colors',
                'focus-visible:bg-accent focus-visible:outline-none',
                on ? 'bg-card text-ink' : 'bg-background text-muted-foreground hover:text-ink',
                i > 0 && 'border-l',
              )}
            >
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums',
                  on
                    ? 'bg-brand text-white'
                    : i < active
                      ? 'bg-brand-soft text-brand'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {i < active ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="font-medium whitespace-nowrap">{s.label}</span>
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-transparent">
                {on && playing ? (
                  <span
                    key={active}
                    className="block h-full origin-left bg-brand group-hover/tour:[animation-play-state:paused]"
                    style={{ animation: `tour-progress ${DURATION_MS}ms linear forwards` }}
                    onAnimationEnd={() => setActive((a) => (a + 1) % STEPS.length)}
                  />
                ) : (
                  on && <span className="block h-full bg-brand" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div id="tour-panel" role="tabpanel" className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Caption + phone/staff toggle on small screens */}
        <div className="border-b px-5 py-5 sm:px-7 lg:col-span-2">
          <div
            key={step.id}
            className="flex flex-wrap items-start justify-between gap-4 animate-in fade-in duration-300"
          >
            <div className="max-w-2xl">
              <h3 className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">
                {step.title}
              </h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
            <div
              className="flex rounded-lg border bg-background p-0.5 text-sm lg:hidden"
              aria-label="Choose view"
            >
              {(['staff', 'client'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={shown === v}
                  className={cn(
                    'rounded-md px-3 py-1.5 font-medium',
                    shown === v ? 'bg-card text-ink shadow-xs' : 'text-muted-foreground',
                  )}
                >
                  {v === 'staff' ? 'Your view' : "Client's phone"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'min-w-0 bg-background p-4 sm:p-6',
            shown === 'client' && 'hidden lg:block',
          )}
        >
          <StaffWindow>
            <div
              key={step.id}
              className="h-full animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
            >
              <StaffPane id={step.id} />
            </div>
          </StaffWindow>
        </div>
        <div
          className={cn(
            'grid place-items-center bg-background p-4 sm:p-6 lg:border-l',
            shown === 'staff' && 'hidden lg:grid',
          )}
        >
          <Phone>
            <div
              key={step.id}
              className="h-full animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
            >
              <ClientPane id={step.id} />
            </div>
          </Phone>
        </div>
      </div>
    </div>
  );
}

/* ---------- Frames ---------- */

function StaffWindow({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border bg-card shadow-sm sm:h-[460px]"
    >
      <div className="flex items-center gap-3 border-b px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-input" />
          <span className="size-2.5 rounded-full bg-input" />
          <span className="size-2.5 rounded-full bg-input" />
        </span>
        <span className="truncate rounded-md bg-background px-3 py-0.5 text-[11px] text-muted-foreground">
          docs.cranbrooklettings.co.uk
        </span>
      </div>
      <div className="min-h-0 flex-1 p-4 sm:overflow-hidden sm:p-5">{children}</div>
    </div>
  );
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className="w-[272px] rounded-[2.2rem] bg-ink p-[7px] shadow-md">
      <div className="relative h-[520px] overflow-hidden rounded-[1.8rem] bg-card">
        <div className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
        <div className="h-full pt-9">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Shared bits ---------- */

const appear = (ms: number): React.CSSProperties => ({
  animationDelay: `${ms}ms`,
  animationFillMode: 'both',
});

function Pill({
  tone,
  children,
}: {
  tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  children: React.ReactNode;
}) {
  const tones = {
    info: 'bg-info-soft text-info',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-muted text-muted-foreground',
  };
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function RequestHeader({
  status,
  tone,
}: {
  status: string;
  tone: 'info' | 'success' | 'warning' | 'neutral';
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] text-muted-foreground">Requests / New tenant</p>
        <p className="font-display text-lg font-semibold text-ink">Amara Okafor</p>
      </div>
      <Pill tone={tone}>{status}</Pill>
    </div>
  );
}

function Progress({
  done,
  total,
  animateFrom,
}: {
  done: number;
  total: number;
  animateFrom?: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-ink tabular-nums">
          {done} of {total} documents
        </span>
        <span className="text-muted-foreground">Due Fri 13 Nov</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-1000',
            done === total ? 'bg-success' : 'bg-brand',
          )}
          style={{
            width: `${(done / total) * 100}%`,
            ...(animateFrom !== undefined
              ? {
                  animation: 'tour-grow 1.2s ease-out both',
                  ['--from' as string]: `${(animateFrom / total) * 100}%`,
                }
              : {}),
          }}
        />
      </div>
    </div>
  );
}

/* ---------- Staff views ---------- */

function StaffPane({ id }: { id: StepId }) {
  switch (id) {
    case 'send':
      return (
        <div className="grid gap-3.5">
          <p className="font-display text-lg font-semibold text-ink">New request</p>
          <div className="grid grid-cols-2 gap-3">
            <FakeField label="Client name" value="Amara Okafor" />
            <FakeField label="Email" value="amara.okafor@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FakeField label="Checklist" value="New tenant, 5 documents" />
            <FakeField label="Due date" value="Fri 13 Nov 2026" />
          </div>
          <FakeField
            label="Message"
            value="Hi Amara, here's everything we need for 14 Cranbrook Road."
            tall
          />
          <div className="mt-1 flex items-center justify-between">
            <span
              className="flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success animate-in fade-in zoom-in-95"
              style={appear(900)}
            >
              <MailCheck className="size-3.5" /> Link sent to Amara
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground">
              <Send className="size-3.5" /> Send request
            </span>
          </div>
        </div>
      );
    case 'verify':
      return (
        <div className="grid gap-4">
          <RequestHeader status="Opened" tone="info" />
          <Progress done={0} total={5} />
          <Activity
            items={[
              ['09:02', 'Request sent to a•••@example.com', Send],
              ['09:14', 'Amara opened the link', Mail],
              ['09:14', 'Sign-in code sent to her inbox', LockKeyhole],
              ['09:15', 'Code confirmed. Session open for this request only', CheckCircle2],
            ]}
          />
        </div>
      );
    case 'upload':
      return (
        <div className="grid gap-4">
          <RequestHeader status="In progress" tone="info" />
          <Progress done={3} total={5} animateFrom={0} />
          <Activity
            items={[
              ['09:16', 'Passport uploaded', Upload],
              ['09:17', 'Proof of address uploaded', Upload],
              ['09:19', 'Last 3 payslips uploaded', Upload],
              ['09:19', 'All 3 files scanned: clean', CheckCircle2],
            ]}
          />
        </div>
      );
    case 'review':
      return (
        <div className="grid h-full gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
          <ul className="hidden content-start gap-1 text-xs sm:grid">
            {[
              ['Passport', 'success', 'Accepted'],
              ['Proof of address', 'success', 'Accepted'],
              ['Last 3 payslips', 'success', 'Accepted'],
              ['Bank statement', 'warning', 'To review'],
              ['Employer reference', 'neutral', 'Missing'],
            ].map(([name, tone, label]) => (
              <li
                key={name}
                className={cn(
                  'rounded-md px-2.5 py-2',
                  name === 'Bank statement'
                    ? 'bg-brand-soft font-semibold text-ink'
                    : 'text-muted-foreground',
                )}
              >
                <span className="block truncate">{name}</span>
                <span
                  className={cn(
                    'text-[10.5px]',
                    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : '',
                  )}
                >
                  {label}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative grid min-h-[180px] flex-1 place-items-center overflow-hidden rounded-lg border bg-muted">
              <div className="w-[70%] -rotate-2 rounded bg-card p-3 shadow-sm blur-[1.5px]">
                <div className="h-2 w-1/3 rounded bg-ink/70" />
                <div className="mt-2 h-1.5 w-1/2 rounded bg-muted" />
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} className="mt-1.5 flex justify-between gap-4">
                    <div className="h-1.5 flex-1 rounded bg-muted" />
                    <div className="h-1.5 w-8 rounded bg-muted" />
                  </div>
                ))}
              </div>
              <span className="absolute top-2 left-2 rounded bg-card/90 px-2 py-0.5 text-[10.5px] text-muted-foreground">
                bank-statement.jpg, clean
              </span>
            </div>
            <div
              className="rounded-lg border p-3 animate-in fade-in slide-in-from-bottom-1"
              style={appear(600)}
            >
              <p className="text-[11px] font-medium text-muted-foreground">Reason for the client</p>
              <p className="mt-1 text-xs text-ink">
                The photo is blurry. Could you take it again in good light?
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <span className="rounded-md border px-3 py-1.5 text-xs font-semibold text-ink">
                Accept
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white">
                <RotateCcw className="size-3.5" /> Ask for a retake
              </span>
            </div>
          </div>
        </div>
      );
    case 'remind':
      return (
        <div className="grid gap-4">
          <RequestHeader status="In progress" tone="info" />
          <p className="text-xs font-semibold text-ink">Reminder schedule</p>
          <ol className="relative grid gap-3 pl-6 before:absolute before:top-1 before:bottom-1 before:left-[7px] before:w-px before:bg-border">
            {[
              ['Mon 2 Nov', 'Request sent', 'done'],
              ['Wed 4 Nov', 'Day 2 reminder', 'done'],
              ['Sat 7 Nov', 'Day 5 reminder: 2 documents missing', 'now'],
              ['Mon 9 Nov', 'Day 7 reminder', 'later'],
              ['Thu 12 Nov', 'Due tomorrow reminder', 'later'],
            ].map(([date, label, state], i) => (
              <li
                key={date}
                className="relative animate-in fade-in slide-in-from-left-1"
                style={appear(i * 120)}
              >
                <span
                  className={cn(
                    'absolute top-1 -left-6 grid size-[15px] place-items-center rounded-full border-2',
                    state === 'done' && 'border-success bg-success',
                    state === 'now' && 'border-brand bg-card',
                    state === 'later' && 'border-input bg-card',
                  )}
                >
                  {state === 'done' && <Check className="size-2.5 text-white" strokeWidth={4} />}
                  {state === 'now' && <span className="size-1.5 rounded-full bg-brand" />}
                </span>
                <p
                  className={cn(
                    'text-xs',
                    state === 'later' ? 'text-muted-foreground' : 'font-medium text-ink',
                  )}
                >
                  {label}
                </p>
                <p className="text-[11px] text-muted-foreground">{date}</p>
              </li>
            ))}
          </ol>
          <p className="flex items-center gap-2 rounded-md bg-background px-3 py-2 text-[11px] text-muted-foreground">
            <AlarmClock className="size-3.5 text-brand" /> Reminders stop as soon as every document
            is accepted.
          </p>
        </div>
      );
    case 'download':
      return (
        <div className="grid gap-4">
          <RequestHeader status="Complete" tone="success" />
          <Progress done={5} total={5} />
          <div className="rounded-lg border">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink">
                <FileArchive className="size-4 shrink-0 text-brand" />
                <span className="truncate">okafor-amara_new-tenant.zip</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground">
                <Download className="size-3.5" /> Download
              </span>
            </div>
            <ul className="grid gap-1.5 px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
              {[
                'okafor-amara_passport.pdf',
                'okafor-amara_proof-of-address.pdf',
                'okafor-amara_payslips.pdf',
                'okafor-amara_bank-statement.jpg',
                'okafor-amara_employer-reference.pdf',
              ].map((f, i) => (
                <li
                  key={f}
                  className="flex items-center gap-2 animate-in fade-in"
                  style={appear(150 + i * 110)}
                >
                  <FileText className="size-3.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Files delete automatically on Sun 13 Dec 2026.
          </p>
        </div>
      );
  }
}

function FakeField({ label, value, tall }: { label: string; value: string; tall?: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          'truncate rounded-md border px-2.5 text-xs text-ink',
          tall ? 'py-2.5' : 'py-2',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Activity({
  items,
}: {
  items: [string, string, React.ComponentType<{ className?: string }>][];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink">Activity</p>
      <ul className="mt-2 grid gap-2">
        {items.map(([time, text, Icon], i) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-lg border px-3 py-2.5 animate-in fade-in slide-in-from-bottom-1"
            style={appear(i * 260)}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-background text-ink">
              <Icon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-ink">{text}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Client views ---------- */

function ClientHeader() {
  return (
    <div className="flex items-center gap-2 border-b px-4 pb-3">
      <span className="grid size-7 place-items-center rounded-md bg-ink text-[10px] font-bold text-white">
        CL
      </span>
      <p className="text-xs font-semibold text-ink">Cranbrook Lettings</p>
    </div>
  );
}

function ClientPane({ id }: { id: StepId }) {
  switch (id) {
    case 'send':
      return (
        <div className="px-4">
          <p className="text-[11px] font-semibold text-muted-foreground">Inbox</p>
          <div className="mt-2 rounded-xl border p-3.5 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">
                CL
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">Cranbrook Lettings</p>
                <p className="text-[10.5px] text-muted-foreground">via DocRequest, 09:02</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] font-semibold text-ink">
              5 documents needed for 14 Cranbrook Road
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              Hi Amara, here&apos;s everything we need for 14 Cranbrook Road. Please upload them by
              Fri 13 Nov.
            </p>
            <span className="mt-3 flex h-9 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              Open secure link
            </span>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              This link is only for you.
            </p>
          </div>
        </div>
      );
    case 'verify':
      return (
        <div className="flex h-full flex-col">
          <ClientHeader />
          <div className="px-4 pt-6">
            <p className="font-display text-lg font-semibold text-ink">Check your email</p>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              We sent a 6-digit code to a•••@example.com. It works for 10 minutes.
            </p>
            <div className="mt-5 grid grid-cols-6 gap-1.5">
              {['4', '8', '1', '0', '2', '7'].map((d, i) => (
                <span
                  key={i}
                  className="grid h-11 place-items-center rounded-lg border-2 border-input font-display text-lg font-semibold text-ink"
                >
                  <span className="animate-in fade-in zoom-in-50" style={appear(300 + i * 220)}>
                    {d}
                  </span>
                </span>
              ))}
            </div>
            <span
              className="mt-5 flex h-10 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground animate-in fade-in"
              style={appear(1700)}
            >
              Continue
            </span>
          </div>
        </div>
      );
    case 'upload':
    case 'review':
      return (
        <div className="flex h-full flex-col">
          <ClientHeader />
          <div className="px-4 pt-3">
            <p className="text-sm font-semibold text-ink">Hi Amara</p>
            <div className="mt-2 flex justify-between text-[11px]">
              <span className="font-semibold text-ink">3 of 5 sent</span>
              <span className="text-muted-foreground">Due Fri 13 Nov</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-3/5 rounded-full bg-brand" />
            </div>
            <ul className="mt-3 grid gap-1.5">
              <ClientItem
                title="Passport"
                state={id === 'review' ? 'accepted' : 'uploaded'}
                delay={0}
              />
              <ClientItem
                title="Proof of address"
                state={id === 'review' ? 'accepted' : 'uploaded'}
                delay={250}
              />
              <ClientItem
                title="Last 3 payslips"
                state={id === 'review' ? 'accepted' : 'uploading'}
                delay={500}
              />
              {id === 'review' ? (
                <li
                  className="rounded-lg border border-danger/25 bg-danger-soft/50 p-2.5 animate-in fade-in"
                  style={appear(500)}
                >
                  <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
                    <RotateCcw className="size-3.5 text-danger" /> Bank statement
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    The photo is blurry. Could you take it again in good light?
                  </p>
                  <span className="mt-2 flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
                    <Camera className="size-3.5" /> Upload again
                  </span>
                </li>
              ) : (
                <ClientItem title="Bank statement" state="todo" delay={0} />
              )}
              <ClientItem title="Employer reference" state="todo" delay={0} />
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-snug text-success">
              <LockKeyhole className="mt-px size-3 shrink-0" /> Your files are encrypted. Only
              Cranbrook Lettings can see them.
            </p>
          </div>
        </div>
      );
    case 'remind':
      return (
        <div className="px-4">
          <p className="text-[11px] font-semibold text-muted-foreground">Inbox</p>
          <div className="mt-2 rounded-xl border p-3.5 shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-brand">
                <AlarmClock className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">Cranbrook Lettings</p>
                <p className="text-[10.5px] text-muted-foreground">Sat 7 Nov, 10:00</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] font-semibold text-ink">2 documents still needed</p>
            <ul className="mt-2 grid gap-1.5 text-[11.5px] text-ink">
              <li className="flex items-center gap-2">
                <RotateCcw className="size-3.5 text-danger" /> Bank statement (please retake)
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-3.5 text-muted-foreground" /> Employer reference
              </li>
            </ul>
            <span className="mt-3 flex h-9 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              Continue uploading
            </span>
          </div>
          <p className="mt-3 text-center text-[10.5px] text-muted-foreground">
            Documents already accepted are never asked for again.
          </p>
        </div>
      );
    case 'download':
      return (
        <div className="flex h-full flex-col">
          <ClientHeader />
          <div className="grid flex-1 place-items-center px-6 pb-10 text-center">
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success animate-in zoom-in-50 duration-500">
                <Check className="size-8" strokeWidth={3} />
              </span>
              <p className="mt-5 font-display text-xl font-semibold text-ink">All done, Amara</p>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                Cranbrook Lettings has everything they need. You can close this page.
              </p>
            </div>
          </div>
        </div>
      );
  }
}

function ClientItem({
  title,
  state,
  delay,
}: {
  title: string;
  state: 'accepted' | 'uploaded' | 'uploading' | 'todo';
  delay: number;
}) {
  return (
    <li
      className="flex items-center gap-2 rounded-lg border px-2.5 py-2 animate-in fade-in"
      style={appear(delay)}
    >
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full',
          state === 'accepted' && 'bg-success-soft text-success',
          state === 'uploaded' && 'bg-info-soft text-info',
          state === 'uploading' && 'bg-brand-soft text-brand',
          state === 'todo' && 'border-2 border-dashed border-input',
        )}
      >
        {state === 'accepted' && <Check className="size-3" strokeWidth={3} />}
        {state === 'uploaded' && <Check className="size-3" strokeWidth={3} />}
        {state === 'uploading' && <Upload className="size-3" strokeWidth={2.5} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-ink">{title}</span>
      {state === 'uploading' ? (
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-brand"
            style={{ animation: 'tour-fill 1.6s ease-out both' }}
          />
        </span>
      ) : (
        <span className="text-[10.5px] text-muted-foreground">
          {state === 'accepted' ? 'Accepted' : state === 'uploaded' ? 'Sent' : 'Add'}
        </span>
      )}
    </li>
  );
}
