'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  ImageIcon,
  Link2Off,
  LockKeyhole,
  Mail,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { ClientItem, ClientLinkInfo, ClientView, FileType } from '@docrequest/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { clientApi, uploadFile } from '@/lib/client-api';
import { formatDay } from '@/lib/format';
import { cn } from '@/lib/utils';

type Stage =
  | { kind: 'loading' }
  | { kind: 'error'; title: string; body: string }
  | { kind: 'welcome'; info: ClientLinkInfo }
  | { kind: 'code'; info: ClientLinkInfo }
  | { kind: 'list'; info: ClientLinkInfo; view: ClientView };

const ACCEPT: Record<FileType, string> = {
  PDF: 'application/pdf,.pdf',
  JPEG: 'image/jpeg,.jpg,.jpeg',
  PNG: 'image/png,.png',
  HEIC: 'image/heic,image/heif,.heic,.heif',
};

export default function ClientUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });

  const loadView = useCallback(async (info: ClientLinkInfo) => {
    try {
      setStage({ kind: 'list', info, view: await clientApi<ClientView>('/request') });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setStage({ kind: 'welcome', info });
      else setStage(errorStage(e));
    }
  }, []);

  useEffect(() => {
    clientApi<ClientLinkInfo>('/open', { token })
      .then((info) => {
        if (info.complete)
          setStage({
            kind: 'error',
            title: `All done, ${info.clientFirstName}`,
            body: `${info.workspaceName} has everything they need. You can close this page.`,
          });
        else if (info.signedIn) void loadView(info);
        else setStage({ kind: 'welcome', info });
      })
      .catch((e: unknown) => setStage(errorStage(e)));
  }, [token, loadView]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-6 pb-16 sm:pt-10">
      {stage.kind === 'loading' && (
        <div className="grid gap-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}
      {stage.kind === 'error' && (
        <Message title={stage.title} body={stage.body} done={stage.title.startsWith('All done')} />
      )}
      {stage.kind === 'welcome' && (
        <Welcome
          token={token}
          info={stage.info}
          onSent={() => setStage({ kind: 'code', info: stage.info })}
        />
      )}
      {stage.kind === 'code' && (
        <CodeStep token={token} info={stage.info} onVerified={() => void loadView(stage.info)} />
      )}
      {stage.kind === 'list' && (
        <Checklist
          info={stage.info}
          view={stage.view}
          onView={(view) => setStage({ kind: 'list', info: stage.info, view })}
          onSignedOut={() => setStage({ kind: 'welcome', info: stage.info })}
        />
      )}
    </main>
  );
}

function errorStage(e: unknown): Stage {
  if (e instanceof ApiError && (e.status === 404 || e.status === 410)) {
    return {
      kind: 'error',
      title: e.status === 410 ? 'This link has ended' : 'This link isn’t working',
      body: e.message,
    };
  }
  return {
    kind: 'error',
    title: 'Something went wrong',
    body: e instanceof Error ? e.message : 'Please try again in a moment.',
  };
}

/* ---------------- Shared bits ---------------- */

function Business({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <header className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink text-sm font-bold text-white"
      >
        {initials || '•'}
      </span>
      <p className="font-display text-lg leading-tight font-semibold text-ink">{name}</p>
    </header>
  );
}

function SecureNote() {
  return (
    <p className="flex items-start gap-2 text-sm leading-relaxed text-success">
      <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      Your files are encrypted as soon as they arrive. Only the people you’re sending them to can
      open them.
    </p>
  );
}

function Message({ title, body, done }: { title: string; body: string; done?: boolean }) {
  return (
    <section className="mt-10 rounded-2xl border bg-card px-6 py-12 text-center shadow-xs">
      <span
        className={cn(
          'mx-auto grid size-16 place-items-center rounded-full',
          done ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {done ? <Check className="size-8" strokeWidth={3} /> : <Link2Off className="size-7" />}
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold text-ink">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </section>
  );
}

/* ---------------- Welcome and code ---------------- */

function Welcome({
  token,
  info,
  onSent,
}: {
  token: string;
  info: ClientLinkInfo;
  onSent: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-8">
      <Business name={info.workspaceName} />
      <section className="rounded-2xl border bg-card p-6 shadow-xs sm:p-8">
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.01em] text-ink">
          Hi {info.clientFirstName}
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">
          {info.workspaceName} has asked you for {info.itemCount} document
          {info.itemCount === 1 ? '' : 's'}. You can upload them here from your phone or computer.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          To keep them safe, we’ll email a 6-digit code to{' '}
          <span className="font-medium text-ink">{info.maskedEmail}</span>.
        </p>
        {error && (
          <p role="alert" className="mt-4 flex gap-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button
          size="lg"
          className="mt-6 h-12 w-full text-base"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            clientApi('/code', { token })
              .then(onSent)
              .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Something went wrong');
                setBusy(false);
              });
          }}
        >
          <Mail /> {busy ? 'Sending…' : 'Email me a code'}
        </Button>
      </section>
      <SecureNote />
    </div>
  );
}

function CodeStep({
  token,
  info,
  onVerified,
}: {
  token: string;
  info: ClientLinkInfo;
  onVerified: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  return (
    <div className="grid gap-8">
      <Business name={info.workspaceName} />
      <form
        className="rounded-2xl border bg-card p-6 shadow-xs sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          const code = String(new FormData(e.currentTarget).get('code') ?? '').replace(/\D/g, '');
          setBusy(true);
          setError(null);
          clientApi('/verify', { token, code })
            .then(onVerified)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Something went wrong');
              setBusy(false);
            });
        }}
      >
        <h1 className="font-display text-[26px] leading-tight font-semibold text-ink">
          Check your email
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-ink">{info.maskedEmail}</span>
          . It works for 10 minutes.
        </p>
        <div className="mt-6 grid gap-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            aria-describedby={error ? 'code-error' : undefined}
            className="h-16 pl-[0.45em] text-center font-display text-3xl font-semibold tracking-[0.45em] tabular-nums placeholder:text-input md:text-3xl"
          />
        </div>
        {error && (
          <p id="code-error" role="alert" className="mt-3 flex gap-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-6 h-12 w-full text-base" disabled={busy}>
          {busy ? 'Checking…' : 'Continue'}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground" aria-live="polite">
          {resent ? (
            'A new code is on its way.'
          ) : (
            <>
              No email? Check your spam folder, or{' '}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setResent(true);
                  clientApi('/code', { token }).catch((e: unknown) => {
                    setResent(false);
                    setError(e instanceof Error ? e.message : 'Could not send a new code');
                  });
                }}
              >
                send a new code
              </button>
              .
            </>
          )}
        </p>
      </form>
    </div>
  );
}

/* ---------------- Checklist ---------------- */

function Checklist({
  info,
  view,
  onView,
  onSignedOut,
}: {
  info: ClientLinkInfo;
  view: ClientView;
  onView: (v: ClientView) => void;
  onSignedOut: () => void;
}) {
  const checking = view.items.some((i) => i.files.some((f) => f.state === 'CHECKING'));
  const viewRef = useRef(onView);
  useEffect(() => {
    viewRef.current = onView;
  }, [onView]);

  // While files are being checked, refresh every few seconds so "Checking" turns into "Sent".
  useEffect(() => {
    if (!checking) return;
    const t = setInterval(() => {
      clientApi<ClientView>('/request')
        .then((v) => viewRef.current(v))
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(t);
  }, [checking]);

  if (view.status === 'COMPLETE') {
    return (
      <Message
        title={`All done, ${view.clientFirstName}`}
        body={`${view.workspaceName} has everything they need. You can close this page.`}
        done
      />
    );
  }

  const sent = view.items.filter((i) => i.status === 'SUBMITTED' || i.status === 'ACCEPTED').length;
  const needed = view.items.filter(
    (i) => i.required && (i.status === 'PENDING' || i.status === 'REJECTED'),
  );
  const allIn = needed.length === 0;

  return (
    <div className="grid gap-6">
      <Business name={view.workspaceName} />

      <section className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Hi {view.clientFirstName}</h1>
        {view.message && (
          <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-muted-foreground">
            {view.message}
          </p>
        )}
        <div className="mt-5 flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-ink tabular-nums">
            {sent} of {view.items.length} sent
          </span>
          {view.dueDate && (
            <span className="text-muted-foreground">Due {formatDay(view.dueDate)}</span>
          )}
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={view.items.length}
          aria-valuenow={sent}
          aria-label={`${sent} of ${view.items.length} documents sent`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500',
              allIn ? 'bg-success' : 'bg-brand',
            )}
            style={{ width: `${(sent / Math.max(view.items.length, 1)) * 100}%` }}
          />
        </div>
      </section>

      {allIn && (
        <section
          className="flex gap-3 rounded-2xl border border-success/25 bg-success-soft p-5"
          aria-live="polite"
        >
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-ink">That’s everything for now, thank you</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {view.workspaceName} will check your documents. If anything needs redoing, we’ll email
              you and it will show up here.
            </p>
          </div>
        </section>
      )}

      <ol className="grid gap-3">
        {view.items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            workspaceName={view.workspaceName}
            maxMb={view.maxUploadMb}
            onView={onView}
            onSignedOut={onSignedOut}
          />
        ))}
      </ol>

      <SecureNote />
      <p className="text-center text-xs text-muted-foreground">
        Sent to you by {info.workspaceName} using DocRequest. You can close this page and come back
        to your link any time.
      </p>
    </div>
  );
}

function ItemCard({
  item,
  workspaceName,
  maxMb,
  onView,
  onSignedOut,
}: {
  item: ClientItem;
  workspaceName: string;
  maxMb: number;
  onView: (v: ClientView) => void;
  onSignedOut: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const hasFiles = item.files.length > 0;
  const accepted = item.status === 'ACCEPTED';
  const rejected = item.status === 'REJECTED';
  const photosAllowed = item.allowedTypes.some((t) => t !== 'PDF');

  function handle(e: unknown) {
    if (e instanceof ApiError && e.status === 401) return onSignedOut();
    if (e instanceof ApiError && e.status === 413)
      return setError(
        `This file is bigger than ${maxMb} MB. Try a smaller file, or take a photo instead.`,
      );
    setError(e instanceof Error ? e.message : 'Something went wrong');
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > maxMb * 1024 * 1024) {
      setError(
        `This file is bigger than ${maxMb} MB. Try a smaller file, or take a photo instead.`,
      );
      return;
    }
    setProgress(0);
    try {
      onView(await uploadFile<ClientView>(`/items/${item.id}/files`, file, setProgress));
    } catch (e) {
      handle(e);
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const titleId = `item-${item.id}`;
  return (
    <li
      aria-labelledby={titleId}
      className={cn(
        'rounded-2xl border bg-card p-5 shadow-xs',
        accepted && 'border-success/30',
        rejected && 'border-danger/30',
      )}
    >
      <div className="flex items-start gap-3">
        <StatusDot status={item.status} hasFiles={hasFiles} />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[17px] font-semibold text-ink">
            {item.title}
            {!item.required && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">Optional</span>
            )}
          </h2>
          {item.helpText && (
            <p className="mt-0.5 text-[15px] leading-relaxed text-muted-foreground">
              {item.helpText}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Accepted: {item.allowedTypes.map((t) => (t === 'JPEG' ? 'JPG' : t)).join(', ')}
          </p>
        </div>
      </div>

      {rejected && item.rejectReason && (
        <div className="mt-4 rounded-xl bg-danger-soft/70 px-4 py-3 text-[15px] leading-relaxed text-ink">
          <p className="font-medium">{workspaceName} asked you to send this again</p>
          <p className="mt-0.5 text-muted-foreground">“{item.rejectReason}”</p>
        </div>
      )}
      {!rejected && item.status === 'PENDING' && item.rejectReason && (
        <p className="mt-4 flex gap-2 rounded-xl bg-warning-soft px-4 py-3 text-[15px] text-ink">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          {item.rejectReason}
        </p>
      )}

      {hasFiles && (
        <ul className="mt-4 grid gap-2" aria-label={`Files for ${item.title}`}>
          {item.files.map((f, i) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5"
            >
              {f.mimeType === 'application/pdf' ? (
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ImageIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium text-ink">
                  {f.mimeType === 'application/pdf' ? 'PDF' : 'Photo'}{' '}
                  {item.files.length > 1 ? i + 1 : ''}
                </span>
                <span className="text-muted-foreground">
                  {formatSize(f.size)},{' '}
                  {f.state === 'CHECKING' ? 'checking…' : accepted ? 'accepted' : 'sent'}
                </span>
              </span>
              {!accepted && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove this file from ${item.title}`}
                  disabled={removing !== null}
                  onClick={() => {
                    setRemoving(f.id);
                    clientApi<ClientView>(`/files/${f.id}`, undefined, 'DELETE')
                      .then(onView)
                      .catch(handle)
                      .finally(() => setRemoving(null));
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!accepted && (
        <div className="mt-4">
          <input
            ref={inputRef}
            id={`file-${item.id}`}
            type="file"
            className="sr-only"
            accept={item.allowedTypes.map((t) => ACCEPT[t]).join(',')}
            onChange={(e) => void pick(e.target.files?.[0])}
            disabled={progress !== null}
          />
          {progress !== null ? (
            <div className="rounded-xl border bg-background p-4" aria-live="polite">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-ink">Uploading…</span>
                <span className="text-muted-foreground tabular-nums">{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <label
              htmlFor={`file-${item.id}`}
              className={cn(
                'flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 has-[:focus-visible]:ring-2',
                hasFiles && !rejected
                  ? 'border border-input bg-card text-ink hover:bg-accent'
                  : 'bg-primary text-primary-foreground hover:bg-brand-strong',
              )}
            >
              {rejected ? (
                <RotateCcw className="size-5" aria-hidden="true" />
              ) : photosAllowed ? (
                <Camera className="size-5" aria-hidden="true" />
              ) : (
                <FileText className="size-5" aria-hidden="true" />
              )}
              {rejected
                ? 'Upload again'
                : hasFiles
                  ? 'Add another file'
                  : photosAllowed
                    ? 'Take a photo or choose a file'
                    : 'Choose a PDF'}
            </label>
          )}
          {error && (
            <p role="alert" className="mt-2 flex gap-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function StatusDot({ status, hasFiles }: { status: ClientItem['status']; hasFiles: boolean }) {
  const base = 'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full';
  if (status === 'ACCEPTED')
    return (
      <span className={cn(base, 'bg-success-soft text-success')} aria-label="Accepted">
        <Check className="size-4" strokeWidth={3} />
      </span>
    );
  if (status === 'REJECTED')
    return (
      <span className={cn(base, 'bg-danger-soft text-danger')} aria-label="Needs sending again">
        <RotateCcw className="size-4" />
      </span>
    );
  if (hasFiles)
    return (
      <span className={cn(base, 'bg-info-soft text-info')} aria-label="Sent, waiting for review">
        <Clock className="size-4" />
      </span>
    );
  return (
    <span className={cn(base, 'border-2 border-dashed border-input')} aria-label="Not sent yet" />
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
