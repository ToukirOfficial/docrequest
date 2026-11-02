'use client';

import { useState } from 'react';
import { Bug, FileLock2, HardDrive, ImageOff, Timer, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

/* What happens to one uploaded photo, stage by stage. All data is made up. */

type Row = { k: string; v: string; state?: 'new' | 'gone' | 'warn' | 'ok' };
interface Stage {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  rows: Row[];
  cipher?: boolean;
}

const CIPHER =
  '8f3a c91e 07b2 d4e6 5a19 ff20 3c7d 91a8 e605 2bb4 7d13 c0fe 46a9 0e5d b8c2 71f4 ' +
  'a2d9 3e60 5f1b 9c47 d03a 6e82 b915 0cf7 4a6d e2b0 18c3 f95e 7b24 06da c1e8 93f5';

const UPLOAD: Stage = {
  id: 'upload',
  label: 'Uploaded',
  icon: Upload,
  title: 'A photo of a passport arrives',
  body: "Amara takes a photo on her phone. Before anything is saved, DocRequest checks the file's real type from its content, not its name, and its size.",
  rows: [
    { k: 'Name', v: 'IMG_4021.HEIC' },
    { k: 'Type', v: 'HEIC image, checked by content', state: 'ok' },
    { k: 'Size', v: '3.4 MB of 20 MB allowed' },
    { k: 'Camera', v: 'iPhone 15', state: 'warn' },
    { k: 'Location', v: '51.4613° N, 0.1156° W', state: 'warn' },
    { k: 'Taken', v: '2 Nov 2026, 09:14', state: 'warn' },
  ],
};

const STAGES: Stage[] = [
  UPLOAD,
  {
    id: 'scan',
    label: 'Virus scan',
    icon: Bug,
    title: 'Scanned before anyone opens it',
    body: "ClamAV scans the bytes. Your team can't preview a file until it's marked clean. An infected file is deleted and the client is asked to upload it again.",
    rows: [
      { k: 'Scanner', v: 'ClamAV' },
      { k: 'Result', v: 'Clean', state: 'ok' },
      { k: 'Preview', v: 'Allowed', state: 'ok' },
    ],
  },
  {
    id: 'clean',
    label: 'Metadata removed',
    icon: ImageOff,
    title: 'Hidden location data is stripped',
    body: 'Photos are converted to JPEG, resized if they are huge, and re-encoded. That removes the EXIF data phones hide inside photos, including where it was taken.',
    rows: [
      { k: 'Type', v: 'JPEG', state: 'new' },
      { k: 'Size', v: '1.1 MB', state: 'new' },
      { k: 'Camera', v: 'iPhone 15', state: 'gone' },
      { k: 'Location', v: '51.4613° N, 0.1156° W', state: 'gone' },
      { k: 'Taken', v: '2 Nov 2026, 09:14', state: 'gone' },
    ],
  },
  {
    id: 'encrypt',
    label: 'Encrypted',
    icon: FileLock2,
    title: 'Encrypted with its own key',
    body: 'Every file gets a fresh AES-256-GCM key. That key is wrapped by a master key held in your environment or AWS KMS, so the stored bytes are useless on their own.',
    rows: [
      { k: 'Cipher', v: 'AES-256-GCM' },
      { k: 'File key', v: 'Random, used for this file only', state: 'ok' },
      { k: 'Key stored', v: 'Wrapped by your master key', state: 'ok' },
    ],
    cipher: true,
  },
  {
    id: 'store',
    label: 'Stored',
    icon: HardDrive,
    title: 'Saved where nobody can link to it',
    body: 'Files sit under a random name on your own disk or S3-compatible storage, outside any public folder. Every view goes through a permission check and is written to the audit log.',
    rows: [
      { k: 'Stored as', v: 'files/7c/1e9a0fd3b2c84e.bin', state: 'new' },
      { k: 'Public URL', v: 'None', state: 'ok' },
      { k: 'Audit log', v: 'Priya Shah viewed it, 2 Nov 10:02' },
    ],
  },
  {
    id: 'delete',
    label: 'Deleted on schedule',
    icon: Timer,
    title: 'Gone when you no longer need it',
    body: "30 days after the request completes (you choose the number), the file is deleted and the client's name and email are anonymised. Only a count remains.",
    rows: [
      { k: 'File', v: 'Deleted on 13 Dec 2026', state: 'gone' },
      { k: 'Client', v: 'Anonymised', state: 'ok' },
      { k: 'Audit log', v: 'System deleted 5 files' },
    ],
  },
];

export function FileJourney() {
  const [active, setActive] = useState(0);
  const stage = STAGES[active] ?? UPLOAD;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
      <div
        role="tablist"
        aria-label="Stages of a file"
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
      >
        {STAGES.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={on}
              aria-controls="journey-panel"
              onClick={() => setActive(i)}
              className={cn(
                'group flex shrink-0 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors lg:px-4 lg:py-3.5',
                'focus-visible:ring-2 focus-visible:ring-brand-bright focus-visible:outline-none',
                on ? 'border-white/25 bg-white/10' : 'border-transparent hover:bg-white/5',
              )}
            >
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-lg transition-colors',
                  on ? 'bg-brand text-white' : 'bg-white/10 text-white/70',
                )}
              >
                <s.icon className="size-4" />
              </span>
              <span className="grid">
                <span className="text-[11px] text-white/50 tabular-nums">Stage {i + 1}</span>
                <span
                  className={cn(
                    'text-sm font-semibold whitespace-nowrap',
                    on ? 'text-white' : 'text-white/75',
                  )}
                >
                  {s.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div id="journey-panel" role="tabpanel" className="min-w-0">
        <div
          key={stage.id}
          className="animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
        >
          <h3 className="font-display text-2xl font-semibold tracking-[-0.015em] text-white">
            {stage.title}
          </h3>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/70">{stage.body}</p>

          <div className="mt-6 overflow-hidden rounded-xl border border-white/15 bg-white/[0.04]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="font-mono text-xs text-white/60">file inspector</span>
              <span className="text-xs text-white/50 tabular-nums">
                {active + 1} / {STAGES.length}
              </span>
            </div>
            <dl className="divide-y divide-white/10">
              {stage.rows.map((r, i) => (
                <div
                  key={r.k}
                  className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 px-4 py-2.5 text-[13px] animate-in fade-in"
                  style={{ animationDelay: `${i * 70}ms`, animationFillMode: 'both' }}
                >
                  <dt className="text-white/50">{r.k}</dt>
                  <dd
                    className={cn(
                      'min-w-0 truncate font-mono',
                      r.state === 'gone' && 'text-white/35',
                      r.state === 'warn' && 'text-brand-bright',
                      r.state === 'ok' && 'text-success-bright',
                      r.state === 'new' && 'text-white',
                      !r.state && 'text-white/85',
                    )}
                  >
                    <span
                      className={cn(
                        r.state === 'gone' && 'line-through decoration-brand-bright decoration-2',
                      )}
                    >
                      {r.v}
                    </span>
                    {r.state === 'warn' && (
                      <span className="ml-2 font-sans text-[11px] text-white/45">
                        hidden in the photo
                      </span>
                    )}
                    {r.state === 'gone' && r.k !== 'File' && (
                      <span className="ml-2 font-sans text-[11px] text-white/45">removed</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {stage.cipher && (
              <div className="border-t border-white/10 px-4 py-3">
                <p className="text-[11px] text-white/50">What is actually stored</p>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed break-all text-white/60">
                  {CIPHER}…
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setActive((a) => Math.max(0, a - 1))}
              disabled={active === 0}
              className="rounded-lg border border-white/20 px-3.5 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setActive((a) => Math.min(STAGES.length - 1, a + 1))}
              disabled={active === STAGES.length - 1}
              className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-40"
            >
              Next stage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
