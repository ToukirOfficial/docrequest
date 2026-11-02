'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Download, ExternalLink, FileText, Loader2, RotateCcw, X } from 'lucide-react';
import {
  RETAKE_REASONS,
  type RequestDetail,
  type RequestItem,
  type StaffFile,
} from '@docrequest/shared';
import { ItemStatusBadge } from '@/components/requests/status';
import { useWorkspace } from '@/components/workspace-provider';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const OPEN = ['SENT', 'IN_PROGRESS'];

/** The request's documents: previews, accept, ask for a retake. */
export function ReviewPanel({
  request,
  onChange,
}: {
  request: RequestDetail;
  onChange: (r: RequestDetail) => void;
}) {
  const { workspace } = useWorkspace();
  const base = `/w/${workspace.workspaceId}`;
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);
  const checking = request.items.some((i) => i.files.some((f) => !f.ready));
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  // Files are scanned and converted in the background; refresh until they're ready.
  useEffect(() => {
    if (!checking) return;
    const t = setInterval(() => {
      api<RequestDetail>(`${base}/requests/${request.id}`)
        .then((r) => changeRef.current(r))
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [checking, base, request.id]);

  return (
    <>
      <ol className="divide-y">
        {request.items.map((item, i) => (
          <ItemRow
            key={item.id}
            n={i + 1}
            item={item}
            base={base}
            requestId={request.id}
            open={OPEN.includes(request.status)}
            onChange={onChange}
            onPreview={setLightbox}
          />
        ))}
      </ol>
      {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

function ItemRow({
  n,
  item,
  base,
  requestId,
  open,
  onChange,
  onPreview,
}: {
  n: number;
  item: RequestItem;
  base: string;
  requestId: string;
  open: boolean;
  onChange: (r: RequestDetail) => void;
  onPreview: (p: { src: string; title: string }) => void;
}) {
  const [retake, setRetake] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const url = `${base}/requests/${requestId}/items/${item.id}`;
  const allReady = item.files.length > 0 && item.files.every((f) => f.ready);

  async function act(kind: 'accept' | 'reject') {
    setBusy(kind);
    setError(null);
    try {
      onChange(
        await api<RequestDetail>(`${url}/${kind}`, {
          method: 'POST',
          body: kind === 'reject' ? { reason } : undefined,
        }),
      );
      setRetake(false);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="px-5 py-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">
            {item.title}
            {!item.required && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
            )}
          </p>
          {item.helpText && <p className="text-sm text-muted-foreground">{item.helpText}</p>}
        </div>
        <ItemStatusBadge status={item.status} />
      </div>

      <div className="mt-3 pl-10">
        {item.status === 'REJECTED' && item.rejectReason && (
          <p className="rounded-md bg-danger-soft/60 px-3 py-2 text-sm text-ink">
            <span className="font-medium">Waiting for a new upload. </span>
            <span className="text-muted-foreground">You asked: “{item.rejectReason}”</span>
          </p>
        )}
        {item.status === 'PENDING' && item.rejectReason && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">
            A file was removed: {item.rejectReason}
          </p>
        )}
        {item.status === 'PENDING' && !item.rejectReason && (
          <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
        )}

        {item.files.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {item.files.map((f) => (
              <FileTile
                key={f.id}
                f={f}
                src={`/api${base}/files/${f.id}`}
                title={item.title}
                onPreview={onPreview}
              />
            ))}
          </ul>
        )}

        {open && (item.status === 'SUBMITTED' || item.status === 'ACCEPTED') && !retake && (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.status === 'SUBMITTED' && (
              <Button
                size="sm"
                disabled={!!busy || !allReady}
                onClick={() => void act('accept')}
                title={allReady ? undefined : 'Wait until the files are checked'}
              >
                <Check /> {busy === 'accept' ? 'Accepting…' : 'Accept'}
              </Button>
            )}
            <Button
              size="sm"
              variant={item.status === 'ACCEPTED' ? 'ghost' : 'outline'}
              disabled={!!busy}
              onClick={() => setRetake(true)}
            >
              <RotateCcw /> Ask for a retake
            </Button>
          </div>
        )}

        {retake && (
          <form
            className="mt-4 grid max-w-xl gap-3 rounded-lg border bg-background p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void act('reject');
            }}
          >
            <p className="text-sm font-medium text-ink">
              What should {item.title.toLowerCase()} look like?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RETAKE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    reason === r
                      ? 'border-brand/40 bg-brand-soft text-brand-strong'
                      : 'bg-card text-muted-foreground hover:text-ink',
                  )}
                >
                  {r.split('.')[0]}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor={`reason-${item.id}`}>
              Reason for the client
            </label>
            <textarea
              id={`reason-${item.id}`}
              rows={2}
              required
              minLength={3}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell the client what to fix. They'll see this exactly as written."
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 md:text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The current file is deleted and the client gets an email with a new link.
            </p>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                variant="ink"
                disabled={!!busy || reason.trim().length < 3}
              >
                {busy === 'reject' ? 'Sending…' : 'Send to client'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRetake(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
        {error && (
          <div className="mt-3">
            <FormError message={error} />
          </div>
        )}
      </div>
    </li>
  );
}

function FileTile({
  f,
  src,
  title,
  onPreview,
}: {
  f: StaffFile;
  src: string;
  title: string;
  onPreview: (p: { src: string; title: string }) => void;
}) {
  const size =
    f.size < 1048576
      ? `${Math.max(1, Math.round(f.size / 1024))} KB`
      : `${(f.size / 1048576).toFixed(1)} MB`;
  if (!f.ready) {
    return (
      <li className="grid size-28 place-items-center rounded-lg border border-dashed bg-background text-center text-xs text-muted-foreground">
        <span>
          <Loader2
            className="mx-auto mb-1.5 size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          Checking for viruses
        </span>
      </li>
    );
  }
  const isPdf = f.mimeType === 'application/pdf';
  return (
    <li className="group relative w-28">
      {isPdf ? (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="grid size-28 place-items-center rounded-lg border bg-background text-muted-foreground transition-colors hover:border-input hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`Open ${title} PDF in a new tab`}
        >
          <span className="text-center text-xs">
            <FileText className="mx-auto mb-1 size-7" aria-hidden="true" />
            Open PDF
            <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
          </span>
        </a>
      ) : (
        <button
          type="button"
          onClick={() => onPreview({ src, title })}
          className="block size-28 overflow-hidden rounded-lg border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`Preview ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- served by our API after a permission check */}
          <img
            src={src}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-[1.03]"
          />
        </button>
      )}
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {isPdf ? 'PDF' : 'Photo'}, {size}
        </span>
        <a
          href={`${src}?download=1`}
          aria-label={`Download ${title}`}
          className="rounded p-0.5 hover:text-ink"
        >
          <Download className="size-3.5" />
        </a>
      </div>
    </li>
  );
}

function Lightbox({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 animate-in fade-in"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- served by our API after a permission check */}
      <img
        src={src}
        alt={title}
        className="max-h-[85dvh] max-w-full rounded-lg bg-card object-contain shadow-md"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-4 py-1.5 text-sm text-white">
        {title}
      </p>
    </div>
  );
}
