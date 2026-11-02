import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Check,
  EyeOff,
  Hash,
  History,
  KeyRound,
  Minus,
  Plus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { FileJourney } from '@/components/landing/file-journey';
import { InstallTerminal } from '@/components/landing/install-terminal';
import { ProductTour } from '@/components/landing/product-tour';
import { TemplateExplorer } from '@/components/landing/template-explorer';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEMO_URL = 'https://docrequest.toukirahmedrony.com';
const GITHUB_URL = 'https://github.com/toukirofficial/docrequest';

export const metadata: Metadata = {
  title: { absolute: 'DocRequest: collect documents from clients securely' },
  description:
    'A free, open-source client portal you host yourself. Send one secure link, get every document back encrypted, scanned and on your own server.',
  robots: { index: true, follow: true },
};

const wrap = 'mx-auto max-w-6xl px-5 sm:px-8';
const h2 =
  'font-display text-[32px] leading-[1.08] font-semibold tracking-[-0.025em] sm:text-[44px]';
const lead = 'mt-4 max-w-2xl text-lg leading-relaxed';

export default function LandingPage() {
  return (
    <div className="bg-card text-ink">
      <SiteHeader />
      <main>
        <Hero />
        <Comparison />
        <Security />
        <Templates />
        <SelfHost />
        <Faq />
        <FinalCta />
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

function SiteHeader() {
  const nav = [
    ['Tour', '#tour'],
    ['Security', '#security'],
    ['Templates', '#templates'],
    ['Self-host', '#self-host'],
    ['FAQ', '#faq'],
  ];
  return (
    <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur-md">
      <div className={`${wrap} flex h-16 items-center gap-8`}>
        <Link
          href="/"
          aria-label="DocRequest home"
          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-6 lg:flex">
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
        <div className="ml-auto flex items-center gap-1.5">
          <a
            href={GITHUB_URL}
            aria-label="DocRequest on GitHub"
            className="hidden size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-ink sm:grid"
          >
            <GitHubMark className="size-[18px]" />
          </a>
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
    <section className="relative overflow-hidden border-b bg-background">
      {/* Faint document grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_55%)]"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div className={`${wrap} relative pt-16 pb-20 sm:pt-24 lg:pb-28`}>
        <a
          href={GITHUB_URL}
          className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-[13px] text-muted-foreground transition-colors hover:text-ink"
        >
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand">
            Open source
          </span>
          Free to self-host under AGPL-3.0
        </a>
        <div className="mt-6 grid gap-x-16 gap-y-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end">
          <h1 className="font-display text-[44px] leading-[0.98] font-bold tracking-[-0.04em] sm:text-[64px] lg:text-[80px]">
            Stop chasing clients for documents
          </h1>
          <div className="lg:pb-3">
            <p className="text-lg leading-relaxed text-muted-foreground">
              DocRequest is a client portal you run on your own server. Send a secure link with a
              checklist, your client uploads from their phone, and you review, accept and download.
              Every file is scanned, encrypted and deleted on schedule.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChild size="lg">
                <a href={DEMO_URL}>Try the live demo</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#tour">See how it works</a>
              </Button>
            </div>
          </div>
        </div>

        <div id="tour" className="mt-16 scroll-mt-24 lg:mt-20">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-lg font-semibold">
              Follow one request from start to finish
            </p>
            <p className="text-sm text-muted-foreground">
              Click any step. Your view on the left, your client&apos;s phone on the right.
            </p>
          </div>
          <ProductTour />
        </div>
      </div>
    </section>
  );
}

type Cell = boolean | string;
function Comparison() {
  const rows: [string, Cell, Cell, Cell][] = [
    ['Documents kept out of inboxes and chats', false, true, true],
    ['A checklist that shows what is missing', false, true, true],
    ['Reminders sent for you', false, true, true],
    ['Files stay on your own server', false, false, true],
    ['Photo location data removed', false, 'Varies', true],
    ['Source code you can check', false, false, true],
    ['Cost', 'Free', 'Monthly, per user', 'Free'],
  ];
  const cols = ['Email and WhatsApp', 'Hosted portals', 'DocRequest'];
  return (
    <section className="py-24 sm:py-32">
      <div className={wrap}>
        <h2 className={h2}>Why not just use email?</h2>
        <p className={cn(lead, 'text-muted-foreground')}>
          Because passports end up sitting in inboxes, files arrive as IMG_4021.jpg, and someone on
          your team spends their week writing &ldquo;just following up&rdquo;. Paid portals fix
          that, but your clients&apos; documents then live on someone else&apos;s servers.
        </p>
        <div className="mt-12 overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b">
                <th className="w-[40%] px-5 py-4" scope="col">
                  <span className="sr-only">Feature</span>
                </th>
                {cols.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      'px-5 py-4 font-semibold',
                      c === 'DocRequest' ? 'bg-brand-soft text-brand' : 'text-ink',
                    )}
                  >
                    {c === 'DocRequest' ? (
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="size-4" aria-hidden="true" /> {c}
                      </span>
                    ) : (
                      c
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, ...cells]) => (
                <tr key={label} className="border-b last:border-0">
                  <th scope="row" className="px-5 py-4 font-medium text-ink">
                    {label}
                  </th>
                  {cells.map((c, i) => (
                    <td key={i} className={cn('px-5 py-4', i === 2 && 'bg-brand-soft/50')}>
                      <CellValue value={c} strong={i === 2} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CellValue({ value, strong }: { value: Cell; strong: boolean }) {
  if (typeof value === 'string') {
    return (
      <span className={strong ? 'font-semibold text-ink' : 'text-muted-foreground'}>{value}</span>
    );
  }
  return value ? (
    <span
      className={cn(
        'inline-grid size-6 place-items-center rounded-full',
        strong ? 'bg-brand text-white' : 'bg-muted text-ink',
      )}
    >
      <Check className="size-3.5" strokeWidth={3} aria-label="Yes" />
    </span>
  ) : (
    <span className="inline-grid size-6 place-items-center rounded-full text-muted-foreground/60">
      <X className="size-4" aria-label="No" />
    </span>
  );
}

function Security() {
  const guarantees = [
    {
      icon: KeyRound,
      title: 'Links stored only as hashes',
      body: 'Even with the database, nobody can rebuild a client link.',
    },
    {
      icon: Hash,
      title: 'Codes are rate-limited',
      body: '6-digit codes expire in 10 minutes and lock after 5 wrong tries.',
    },
    {
      icon: Users,
      title: 'Workspaces never mix',
      body: 'Every query is scoped to one business, with Owner, Admin and Staff roles.',
    },
    {
      icon: History,
      title: 'Append-only audit log',
      body: 'Views, downloads, decisions and deletions are recorded and cannot be edited.',
    },
    {
      icon: EyeOff,
      title: 'No client details in logs',
      body: 'The audit log records actions, never names, emails or file names.',
    },
  ];
  return (
    <section id="security" className="scroll-mt-16 bg-ink py-24 text-white sm:py-32">
      <div className={wrap}>
        <h2 className={h2}>Follow one file through DocRequest</h2>
        <p className={cn(lead, 'text-white/70')}>
          Security you can see, not a badge in the footer. Step through what happens to a photo of a
          passport from the moment it is uploaded.
        </p>
        <div className="mt-14">
          <FileJourney />
        </div>
        <ul className="mt-20 grid gap-x-8 gap-y-8 border-t border-white/15 pt-10 sm:grid-cols-2 lg:grid-cols-5">
          {guarantees.map((g) => (
            <li key={g.title}>
              <g.icon className="size-5 text-brand-bright" aria-hidden="true" />
              <h3 className="mt-3 text-[15px] font-semibold">{g.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">{g.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Templates() {
  return (
    <section id="templates" className="scroll-mt-16 border-b bg-background py-24 sm:py-32">
      <div className={wrap}>
        <h2 className={h2}>Checklists written for your clients</h2>
        <p className={cn(lead, 'text-muted-foreground')}>
          Five ready-made templates, each with plain help text and the file types it accepts. Copy
          one, change it, or build your own.
        </p>
        <div className="mt-12">
          <TemplateExplorer />
        </div>
      </div>
    </section>
  );
}

function SelfHost() {
  const services = [
    ['Web app', 'Next.js, port 8020'],
    ['API and worker', 'NestJS with BullMQ queues'],
    ['Database', 'PostgreSQL 18'],
    ['Queue and cache', 'Redis'],
    ['Virus scanner', 'ClamAV, optional'],
    ['File storage', 'Local disk or S3-compatible'],
  ];
  return (
    <section id="self-host" className="scroll-mt-16 py-24 sm:py-32">
      <div
        className={`${wrap} grid items-start gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16`}
      >
        <div>
          <h2 className={h2}>Running in minutes, on your own server</h2>
          <p className={cn(lead, 'text-muted-foreground')}>
            One command starts everything. A small VPS is enough, and there is a Terraform guide if
            you would rather use AWS.
          </p>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5">
            {services.map(([k, v]) => (
              <div key={k} className="border-l-2 border-brand/30 pl-4">
                <dt className="text-sm font-semibold text-ink">{k}</dt>
                <dd className="text-sm text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="min-w-0 lg:pt-2">
          <InstallTerminal />
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    [
      'Is it really free?',
      'Yes. DocRequest is open source under the AGPL-3.0 licence. You only pay for the server you run it on.',
    ],
    [
      'Do my clients need an account?',
      'No. They get a link that only works for their request, and confirm it is them with a 6-digit code sent to their email.',
    ],
    [
      'Where are the files stored?',
      "On your own server's disk, or in any S3-compatible storage you choose. Every file is encrypted before it is saved, whichever you pick.",
    ],
    [
      'What if someone uploads a virus?',
      'ClamAV scans every upload. An infected file is deleted before anyone can open it, and the client is asked to upload it again.',
    ],
    [
      'How long are files kept?',
      'You decide, per workspace. By default files are deleted 30 days after a request is complete or expires, and client details are anonymised.',
    ],
    [
      'Can my whole team use it?',
      'Yes. Invite colleagues as Admins or Staff. Admins manage the team, templates and settings. Staff create and review requests.',
    ],
    [
      'What do I need to run it?',
      'Docker on a small Linux server. Or run it directly with Node.js 24, PostgreSQL 18 and Redis.',
    ],
  ];
  return (
    <section id="faq" className="scroll-mt-16 border-t bg-background py-24 sm:py-32">
      <div className={`${wrap} grid gap-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]`}>
        <div>
          <h2 className={h2}>Questions</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Something else?{' '}
            <a
              href={`${GITHUB_URL}/issues`}
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Ask on GitHub
            </a>
            .
          </p>
        </div>
        <div className="divide-y border-y">
          {faqs.map(([q, a]) => (
            <details key={q} className="group py-1 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-[17px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-ring">
                {q}
                <span className="grid size-7 shrink-0 place-items-center rounded-full border text-muted-foreground transition-colors group-open:bg-ink group-open:text-white">
                  <Plus className="size-4 group-open:hidden" aria-hidden="true" />
                  <Minus className="hidden size-4 group-open:block" aria-hidden="true" />
                </span>
              </summary>
              <p className="max-w-2xl pb-5 text-[15px] leading-relaxed text-muted-foreground">
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-ink py-24 text-white sm:py-28">
      <div className={`${wrap} grid items-end gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]`}>
        <h2 className="font-display text-[36px] leading-[1.04] font-bold tracking-[-0.03em] sm:text-[56px]">
          Your next client request could be the last one you chase
        </h2>
        <div>
          <p className="text-lg leading-relaxed text-white/70">
            Try the demo with made-up clients, or install it on your own server today.
          </p>
          <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
            <Button asChild size="lg">
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
    <footer className="bg-ink text-white">
      <div
        className={`${wrap} flex flex-col gap-6 border-t border-white/10 py-10 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="grid gap-2">
          <Logo inverse />
          <p className="text-sm text-white/55">
            Built by{' '}
            <a
              href="https://toukirahmedrony.com"
              className="font-medium text-white/85 hover:text-white hover:underline"
            >
              Toukir Ahmed Rony
            </a>
            . Open source under AGPL-3.0.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-white/60"
        >
          <a href={DEMO_URL} className="hover:text-white">
            Live demo
          </a>
          <a href={GITHUB_URL} className="hover:text-white">
            GitHub
          </a>
          <a href={`${GITHUB_URL}/blob/main/LICENSE`} className="hover:text-white">
            Licence
          </a>
          <Link href="/login" className="hover:text-white">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
