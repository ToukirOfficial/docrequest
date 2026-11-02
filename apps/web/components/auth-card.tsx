import Link from 'next/link';
import { Check, Clock, LockKeyhole, RotateCcw, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/logo';

/** Split layout for every signed-out screen: form on the left, product preview on the right (desktop only). */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10 sm:py-8">
        <Link
          href="/login"
          className="w-fit rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Logo />
        </Link>
        <main className="flex flex-1 items-start pt-12 pb-10 sm:items-center sm:py-10">
          <div className="mx-auto w-full max-w-[380px]">
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
            <div className="mt-8">{children}</div>
          </div>
        </main>
        <p className="text-xs text-muted-foreground">
          Free and open source under the AGPL-3.0 licence.
        </p>
      </div>
      <ProductPanel />
    </div>
  );
}

const items = [
  { title: 'Passport or driving licence', state: 'accepted' },
  { title: 'Proof of address', state: 'accepted' },
  { title: 'Last 3 payslips', state: 'review' },
  { title: 'Bank statement', state: 'retake' },
  { title: 'Employer reference', state: 'missing' },
] as const;

function ProductPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20">
      <div className="max-w-[460px]">
        <p className="text-[26px] leading-snug font-semibold tracking-[-0.015em] text-white">
          Clients upload. You review.
          <br />
          Nothing sits in an inbox.
        </p>
        <p className="mt-3 max-w-[400px] text-[15px] leading-relaxed text-[#b9c3d6]">
          One secure link per client, a clear checklist, and reminders that go out for you.
        </p>

        {/* Illustrative preview with made-up data. */}
        <div aria-hidden="true" className="mt-10 rounded-xl bg-card p-5 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-ink">Amara Okafor</p>
              <p className="text-sm text-muted-foreground">New tenant, 14 Cranbrook Road</p>
            </div>
            <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info">
              In progress
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="font-medium text-ink">3 of 5 documents</span>
            <span className="text-muted-foreground">Due Fri 14 Nov</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-3/5 rounded-full bg-brand" />
          </div>

          <ul className="mt-4 divide-y divide-border">
            {items.map((i) => (
              <li key={i.title} className="flex items-center gap-3 py-2.5 text-sm">
                <ItemIcon state={i.state} />
                <span className="min-w-0 flex-1 truncate text-ink">{i.title}</span>
                <ItemNote state={i.state} />
              </li>
            ))}
          </ul>

          <p className="mt-3 flex items-center gap-2 rounded-md bg-brand-soft px-3 py-2 text-xs font-medium text-brand-strong">
            <LockKeyhole className="size-3.5" />
            Encrypted with its own key and scanned for viruses
          </p>
        </div>

        <p className="mt-8 flex items-center gap-2 text-sm text-[#b9c3d6]">
          <ShieldCheck className="size-4 text-[#3ddc97]" aria-hidden="true" />
          Self-hosted: files stay on your own server.
        </p>
      </div>
    </aside>
  );
}

function ItemIcon({ state }: { state: (typeof items)[number]['state'] }) {
  const base = 'grid size-6 shrink-0 place-items-center rounded-full';
  if (state === 'accepted')
    return (
      <span className={`${base} bg-success-soft text-success`}>
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  if (state === 'review')
    return (
      <span className={`${base} bg-warning-soft text-warning`}>
        <Clock className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  if (state === 'retake')
    return (
      <span className={`${base} bg-danger-soft text-danger`}>
        <RotateCcw className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  return <span className={`${base} border-2 border-dashed border-input`} />;
}

function ItemNote({ state }: { state: (typeof items)[number]['state'] }) {
  const text = {
    accepted: 'Accepted',
    review: 'To review',
    retake: 'Asked to retake',
    missing: 'Not yet sent',
  }[state];
  return <span className="shrink-0 text-xs text-muted-foreground">{text}</span>;
}
