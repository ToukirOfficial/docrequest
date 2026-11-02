'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/* Self-hosting commands with the output Docker Compose prints. Replays once when scrolled into view. */

const COMMANDS = [
  'git clone https://github.com/toukirofficial/docrequest.git',
  'cd docrequest && ./scripts/init-env.sh',
  'docker compose up -d',
];
const SERVICES = ['postgres', 'redis', 'clamav', 'api', 'worker', 'web'];
const LINES: { kind: 'cmd' | 'out'; text: string }[] = [
  { kind: 'cmd', text: COMMANDS[0] ?? '' },
  { kind: 'cmd', text: COMMANDS[1] ?? '' },
  { kind: 'cmd', text: COMMANDS[2] ?? '' },
  ...SERVICES.map((s) => ({
    kind: 'out' as const,
    text: `docrequest-${s}`.padEnd(22) + 'Started',
  })),
  { kind: 'out', text: 'Ready on http://localhost:8020' },
];

export function InstallTerminal() {
  const [shown, setShown] = useState(LINES.length);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        setShown(0);
        timer = setInterval(() => {
          setShown((n) => {
            if (n >= LINES.length) {
              clearInterval(timer);
              return n;
            }
            return n + 1;
          });
        }, 320);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(COMMANDS.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the commands stay selectable.
    }
  }

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl bg-ink shadow-md">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-bright focus-visible:outline-none"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy commands'}</span>
        </button>
      </div>
      <pre className="min-h-[19rem] overflow-x-auto px-5 py-5 font-mono text-[13px] leading-7 text-white">
        {LINES.map((l, i) => (
          <div key={i} className={i < shown ? 'animate-in fade-in duration-200' : 'invisible'}>
            {l.kind === 'cmd' ? (
              <>
                <span className="text-brand-bright select-none">$ </span>
                {l.text}
              </>
            ) : (
              <span className="text-white/60">
                <span className="text-success-bright"> ✔ </span>
                {l.text}
              </span>
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}
