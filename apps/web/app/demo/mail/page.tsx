'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Inbox, RefreshCw } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';

interface DemoMail {
  to: string;
  subject: string;
  text: string;
  at: string;
}

/**
 * The demo's outbox. The demo never sends real email; everything it would have sent
 * shows up here, so visitors can open the client link and type the code themselves.
 */
export default function DemoMailPage() {
  const [mails, setMails] = useState<DemoMail[] | null>(null);
  const [state, setState] = useState<'ok' | 'off' | 'error'>('ok');

  const load = useCallback(() => {
    fetch('/api/demo/mail')
      .then(async (r) => {
        if (r.status === 404) return setState('off');
        if (!r.ok) return setState('error');
        setState('ok');
        setMails((await r.json()) as DemoMail[]);
      })
      .catch(() => setState('error'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <Link href="/">
          <Logo />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app">
            <ArrowLeft /> Back to the app
          </Link>
        </Button>
      </div>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] leading-tight font-semibold text-ink">
            Demo outbox
          </h1>
          <p className="mt-1.5 max-w-xl text-[15px] text-muted-foreground">
            The demo doesn’t send real email. Everything it would have sent is here, so you can open
            a client link and enter the code yourself.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      {state === 'off' ? (
        <p className="mt-8 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          This page only exists in the public demo.
        </p>
      ) : state === 'error' ? (
        <p className="mt-8 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          The outbox couldn’t be loaded. Try again in a moment.
        </p>
      ) : !mails ? (
        <div className="mt-8 grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : mails.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-lg border bg-card px-6 py-14 text-center">
          <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium text-ink">No emails yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Send a request to yourself from the demo (any made-up email works). The client’s email
            will appear here.
          </p>
        </div>
      ) : (
        <ol className="mt-8 grid gap-3">
          {mails.map((m, i) => (
            <li key={`${m.at}-${i}`}>
              <details className="group rounded-lg border bg-card shadow-xs" open={i === 0}>
                <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 font-medium text-ink">{m.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    To {m.to}, {formatDateTime(m.at)}
                  </span>
                </summary>
                <div className="border-t px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  <MailText text={m.text} />
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Plain text with this site's links made clickable. */
function MailText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) && new URL(p).origin === window.location.origin ? (
          <a
            key={i}
            href={new URL(p).pathname}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium break-all text-primary underline-offset-4 hover:underline"
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
