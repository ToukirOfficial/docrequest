import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Bug,
  Check,
  ClipboardList,
  EyeOff,
  FileCheck2,
  FileLock2,
  History,
  ImageOff,
  KeyRound,
  ScanSearch,
  Smartphone,
  Timer,
  Upload,
  X,
} from 'lucide-react';
import { CopyCommand } from '@/components/landing/copy-command';
import { ProductPreview } from '@/components/landing/product-preview';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

const DEMO_URL = 'https://docrequest.toukirahmedrony.com';
const GITHUB_URL = 'https://github.com/toukirofficial/docrequest';

export const metadata: Metadata = {
  title: { absolute: 'DocRequest: collect documents from clients securely' },
  description:
    'Free, open-source and self-hosted. Send clients one secure link, get every document back encrypted on your own server.',
  robots: { index: true, follow: true },
};

export default function LandingPage() {
  return (
    <div className="bg-card text-ink">
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Security />
        <WhoItsFor />
        <SelfHost />
        <OpenSource />
      </main>
      <SiteFooter />
    </div>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const sectionPad = 'mx-auto max-w-6xl px-5 sm:px-8';

function SiteHeader() {
  const nav = [
    ['How it works', '#how-it-works'],
    ['Security', '#security'],
    ["Who it's for", '#who-its-for'],
    ['Self-host', '#self-host'],
  ];
  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
      <div className={`${sectionPad} flex h-16 items-center gap-8`}>
        <Link
          href="/"
          aria-label="DocRequest home"
          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-6 md:flex">
          {nav.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-ink"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <a href={DEMO_URL}>Try the live demo</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="overflow-hidden border-b bg-background">
      <div className={`${sectionPad} pt-14 pb-20 sm:pt-20 lg:pt-24 lg:pb-28`}>
        <div className="grid gap-x-16 gap-y-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end">
          <h1 className="text-[42px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[60px] lg:text-[72px]">
            Stop chasing clients for documents
          </h1>
          <div className="lg:pb-2">
            <p className="text-lg leading-relaxed text-muted-foreground">
              Send each client one secure link and a clear checklist. They upload from their phone,
              you review everything in one place, and every file is encrypted on your own server.
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChild size="lg">
                <a href={DEMO_URL}>Try the live demo</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={GITHUB_URL}>
                  <GitHubMark className="size-4" /> View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
        <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground lg:mt-12">
          {[
            'Free and open source',
            'No accounts for your clients',
            'Runs on a small server',
            'Files deleted on your schedule',
          ].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-14 lg:mt-16 lg:pb-24">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const before = [
    'Passports and bank statements sit in inboxes and WhatsApp chats',
    'Files arrive as IMG_4021.jpg, and half of them are missing',
    'Your team spends hours writing "just following up" emails',
  ];
  const after = [
    'Every file is encrypted the moment it arrives',
    'A checklist shows what has arrived and what is still missing',
    'Reminders go out by themselves until the request is complete',
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className={sectionPad}>
        <div className="max-w-2xl">
          <h2 className="text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
            Email was never built for passports
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Accountants, solicitors and letting agents collect sensitive documents every day. Doing
            it over email is slow, messy and hard to keep safe.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border bg-background p-6 sm:p-8">
            <h3 className="font-semibold text-muted-foreground">Today</h3>
            <ul className="mt-5 grid gap-4">
              {before.map((t) => (
                <li
                  key={t}
                  className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-muted">
                    <X className="size-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-brand/25 bg-card p-6 shadow-sm sm:p-8">
            <h3 className="font-semibold text-brand">With DocRequest</h3>
            <ul className="mt-5 grid gap-4">
              {after.map((t) => (
                <li key={t} className="flex gap-3 text-[15px] leading-relaxed">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: ClipboardList,
      title: 'Pick a checklist',
      body: 'Start from a ready-made template like New tenant or Self-assessment tax return, or write your own. Add a due date and a short note.',
    },
    {
      icon: Smartphone,
      title: 'Your client uploads from their phone',
      body: 'They open the link, enter a 6-digit code from their email, then take a photo or choose a file for each item. No account, no app.',
    },
    {
      icon: FileCheck2,
      title: 'Review and download',
      body: 'Preview each file, accept it or ask for a retake with a reason. When everything is accepted, download one zip with clean file names.',
    },
  ];
  return (
    <section id="how-it-works" className="scroll-mt-16 border-y bg-background py-20 sm:py-28">
      <div className={sectionPad}>
        <h2 className="text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
          How it works
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Three steps, and the reminders in between happen on their own.
        </p>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border bg-card p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-lg bg-brand-soft text-brand">
                  <s.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-muted-foreground">
          Example file name in the zip:{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] whitespace-nowrap text-ink">
            smith-jane_passport.pdf
          </code>
        </p>
      </div>
    </section>
  );
}

function Security() {
  const path = [
    { icon: Upload, label: 'Uploaded' },
    { icon: Bug, label: 'Virus scan' },
    { icon: ImageOff, label: 'Metadata removed' },
    { icon: FileLock2, label: 'Encrypted' },
    { icon: Timer, label: 'Deleted on schedule' },
  ];
  const features = [
    {
      icon: KeyRound,
      title: 'Encrypted at rest',
      body: 'Every file gets its own AES-256-GCM key, wrapped by a master key from your server or AWS KMS.',
    },
    {
      icon: ScanSearch,
      title: 'Virus scanning',
      body: 'ClamAV checks each upload before anyone on your team can open it. Infected files are removed.',
    },
    {
      icon: ImageOff,
      title: 'Metadata stripped',
      body: 'Photos are re-encoded to remove hidden EXIF data, including the GPS location they were taken at.',
    },
    {
      icon: Timer,
      title: 'Automatic deletion',
      body: 'Files are deleted a set number of days after a request closes. You choose how many.',
    },
    {
      icon: History,
      title: 'Audit log',
      body: 'Every view, download, accept and deletion is recorded. The log is append-only and cannot be edited.',
    },
    {
      icon: EyeOff,
      title: 'No public links',
      body: 'Files are never served from a public folder. Every download goes through a permission check first.',
    },
  ];
  return (
    <section id="security" className="scroll-mt-16 bg-ink py-20 text-white sm:py-28">
      <div className={sectionPad}>
        <div className="max-w-2xl">
          <h2 className="text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
            Built for documents you can&apos;t afford to leak
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            Security isn&apos;t a setting you remember to switch on. Every file takes the same path,
            every time.
          </p>
        </div>

        <ol
          aria-label="What happens to every file"
          className="mt-12 flex flex-wrap items-center gap-x-2 gap-y-3"
        >
          {path.map((p, i) => (
            <li key={p.label} className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium">
                <p.icon className="size-4 text-brand-bright" aria-hidden="true" />
                {p.label}
              </span>
              {i < path.length - 1 && (
                <span aria-hidden="true" className="hidden h-px w-5 bg-white/25 lg:block" />
              )}
            </li>
          ))}
        </ol>

        <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <li key={f.title} className="border-t border-white/15 pt-6">
              <f.icon className="size-5 text-brand-bright" aria-hidden="true" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-white/70">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WhoItsFor() {
  const who = [
    ['Accountants', 'Self-assessment returns, P60s, bank statements, receipts'],
    ['Solicitors', 'ID checks, proof of funds, signed forms'],
    ['Recruiters', 'Right-to-work checks, references, qualifications'],
    ['Letting agents', 'Tenant referencing, payslips, guarantor documents'],
    ['Care agencies', 'DBS checks, training certificates, proof of identity'],
  ];
  return (
    <section id="who-its-for" className="scroll-mt-16 py-20 sm:py-28">
      <div className={`${sectionPad} grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]`}>
        <div>
          <h2 className="text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
            Made for teams who collect documents every week
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Five ready-made checklists to start from: New tenant, New employee (right to work),
            Self-assessment tax return, Immigration case and Mortgage application.
          </p>
        </div>
        <ul className="divide-y border-y">
          {who.map(([name, docs]) => (
            <li key={name} className="grid gap-1 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
              <span className="text-lg font-semibold">{name}</span>
              <span className="text-[15px] leading-relaxed text-muted-foreground sm:pt-0.5">
                {docs}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SelfHost() {
  const points = [
    'One command starts the web app, API, worker, PostgreSQL, Redis and ClamAV',
    'Files stay on your own disk, or in any S3-compatible storage',
    'Comfortable on a small VPS, with an optional AWS guide in Terraform',
    'Virus scanning can be switched off if you can’t run ClamAV',
  ];
  return (
    <section id="self-host" className="scroll-mt-16 border-t bg-background py-20 sm:py-28">
      <div className={`${sectionPad} grid items-center gap-12 lg:grid-cols-2`}>
        <div>
          <h2 className="text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
            Runs on your own server
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Your clients&apos; documents never pass through someone else&apos;s cloud. Install it in
            a few minutes with Docker.
          </p>
          <ul className="mt-8 grid gap-3">
            {points.map((t) => (
              <li key={t} className="flex gap-3 text-[15px] leading-relaxed">
                <Check
                  className="mt-1 size-4 shrink-0 text-brand"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <CopyCommand
            lines={[
              'git clone https://github.com/toukirofficial/docrequest.git',
              'cd docrequest',
              'cp .env.example .env',
              'docker compose up -d',
            ]}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Then open http://localhost:8020 and create your workspace.
          </p>
        </div>
      </div>
    </section>
  );
}

function OpenSource() {
  return (
    <section className="py-20 sm:py-28">
      <div className={sectionPad}>
        <div className="rounded-2xl bg-brand px-6 py-14 text-center text-white sm:px-12 sm:py-20">
          <h2 className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-[40px]">
            Free, open source, and yours to run
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-white/85">
            DocRequest is licensed under AGPL-3.0. Use it for your business, read every line of the
            code, and help make it better.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="ink">
              <a href={DEMO_URL}>Try the live demo</a>
            </Button>
            <Button asChild size="lg" className="bg-white text-ink hover:bg-white/90">
              <a href={GITHUB_URL}>
                <GitHubMark className="size-4" /> View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t">
      <div
        className={`${sectionPad} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="grid gap-2">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Built by{' '}
            <a href="https://toukirahmedrony.com" className="font-medium text-ink hover:underline">
              Toukir Ahmed Rony
            </a>
            . Licensed under AGPL-3.0.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground"
        >
          <a href={DEMO_URL} className="hover:text-ink">
            Live demo
          </a>
          <a href={GITHUB_URL} className="hover:text-ink">
            GitHub
          </a>
          <a href={`${GITHUB_URL}/blob/main/LICENSE`} className="hover:text-ink">
            Licence
          </a>
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
