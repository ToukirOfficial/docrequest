'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Terminal-style block with a copy button for the self-hosting commands. */
export function CopyCommand({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text stays selectable.
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-ink">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="text-xs text-white/60">Terminal</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-bright focus-visible:outline-none"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-7 text-white">
        {lines.map((l) => (
          <div key={l}>
            <span className="text-brand-bright select-none">$ </span>
            {l}
          </div>
        ))}
      </pre>
    </div>
  );
}
