'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { FlaskConical } from 'lucide-react';
import { usePublicConfig } from '@/lib/config';

/** Shown on every page of the public demo (PRD §3, item 21). */
export function DemoBanner() {
  const config = usePublicConfig();
  const ref = useRef<HTMLDivElement>(null);
  // Fixed elements (the desktop sidebar) start below the banner.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty('--demo-banner', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--demo-banner');
    };
  }, [config?.demo]);
  if (!config?.demo) return null;
  return (
    <div
      ref={ref}
      role="note"
      className="relative z-50 bg-ink px-4 py-2 text-center text-[13px] text-white"
    >
      <FlaskConical
        className="mr-1.5 inline size-3.5 -translate-y-px text-brand-bright"
        aria-hidden="true"
      />
      <span className="font-semibold">Demo:</span> please don’t upload real documents. Uploads are
      deleted every hour and everything resets each night.{' '}
      <Link
        href="/demo/mail"
        className="font-medium text-brand-bright underline-offset-4 hover:underline"
      >
        See the emails the demo sent
      </Link>
    </div>
  );
}
