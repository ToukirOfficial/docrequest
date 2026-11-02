'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Link2, Pencil, Send, Trash2, XCircle } from 'lucide-react';
import type { RequestDetail } from '@docrequest/shared';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import {
  ItemsEditor,
  newItem,
  toItemInput,
  type EditorItem,
} from '@/components/requests/items-editor';
import { RequestProgress, RequestStatusBadge } from '@/components/requests/status';
import { ReviewPanel } from '@/components/requests/review-panel';
import { DownloadZip } from '@/components/requests/download-zip';
import { useWorkspace } from '@/components/workspace-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDateTime, formatDay } from '@/lib/format';

const EDITABLE = ['DRAFT', 'SENT', 'IN_PROGRESS'];

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const url = `/w/${workspace.workspaceId}/requests/${id}`;
  const [r, setR] = useState<RequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    search.get('sent') ? 'Request sent. Your client has the link.' : null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<'details' | 'items' | null>(null);
  const [items, setItems] = useState<EditorItem[]>([]);

  const load = useCallback(
    () =>
      api<RequestDetail>(url)
        .then(setR)
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Could not load this request'),
        ),
    [url],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function act(name: string, fn: () => Promise<RequestDetail | void>, done?: string) {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      const next = await fn();
      if (next) setR(next);
      if (done) setNotice(done);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  if (!r) {
    return error ? (
      <div className="grid gap-4">
        <FormError message={error} />
        <Button asChild variant="outline" className="w-fit">
          <Link href="/app">Back to requests</Link>
        </Button>
      </div>
    ) : (
      <div className="grid gap-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const editable = EDITABLE.includes(r.status);

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/app"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Requests
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
                {r.clientName}
              </h1>
              <RequestStatusBadge r={r} />
            </div>
            <p className="mt-1 text-[15px] text-muted-foreground">
              {r.checklistName || 'Custom checklist'}, {r.clientEmail}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {r.acceptedCount > 0 && <DownloadZip requestId={r.id} onError={setError} />}
            {r.status === 'DRAFT' && (
              <>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => {
                    if (confirm('Delete this draft? This can’t be undone.')) {
                      void act('delete', async () => {
                        await api(url, { method: 'DELETE' });
                        router.replace('/app');
                      });
                    }
                  }}
                >
                  <Trash2 /> Delete draft
                </Button>
                <Button
                  disabled={!!busy}
                  onClick={() =>
                    void act(
                      'send',
                      () => api<RequestDetail>(`${url}/send`, { method: 'POST' }),
                      'Request sent. Your client has the link.',
                    )
                  }
                >
                  <Send /> {busy === 'send' ? 'Sending…' : 'Send request'}
                </Button>
              </>
            )}
            {(r.status === 'SENT' || r.status === 'IN_PROGRESS') && (
              <>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => {
                    if (
                      confirm(
                        'Cancel this request? The client’s link stops working, and files are deleted on your retention schedule.',
                      )
                    ) {
                      void act(
                        'cancel',
                        () => api<RequestDetail>(`${url}/cancel`, { method: 'POST' }),
                        'Request cancelled. The link no longer works.',
                      );
                    }
                  }}
                >
                  <XCircle /> Cancel request
                </Button>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    void act(
                      'send',
                      () => api<RequestDetail>(`${url}/send`, { method: 'POST' }),
                      'New link sent. The old link no longer works.',
                    )
                  }
                >
                  <Link2 /> {busy === 'send' ? 'Sending…' : 'Send a new link'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {notice && (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <FormError message={error} />

      <section className="grid gap-5 rounded-lg border bg-card p-5 shadow-xs sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] sm:p-6">
        <div>
          <p className="font-display text-3xl font-semibold text-ink tabular-nums">
            {r.receivedCount}
            <span className="text-lg text-muted-foreground"> / {r.itemCount}</span>
          </p>
          <RequestProgress r={r} className="mt-2 max-w-60" />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Detail label="Due">{r.dueDate ? formatDay(r.dueDate) : 'No due date'}</Detail>
          <Detail label="Sent">{r.sentAt ? formatDateTime(r.sentAt) : 'Not sent yet'}</Detail>
          <Detail label="Link works until">
            {r.linkExpiresAt ? formatDateTime(r.linkExpiresAt) : '—'}
          </Detail>
          <Detail label="Created by">{r.createdByName ?? 'A former member'}</Detail>
        </dl>
        {r.message && (
          <p className="rounded-md bg-background px-4 py-3 text-sm text-muted-foreground sm:col-span-2">
            <span className="font-medium text-ink">Message: </span>
            {r.message}
          </p>
        )}
        {editable && editing !== 'details' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-fit sm:col-span-2"
            onClick={() => setEditing('details')}
          >
            <Pencil /> Edit client details
          </Button>
        )}
        {editing === 'details' && (
          <form
            className="grid gap-4 border-t pt-5 sm:col-span-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act(
                'details',
                () =>
                  api<RequestDetail>(url, {
                    method: 'PATCH',
                    body: {
                      clientName: f.get('clientName'),
                      clientEmail: f.get('clientEmail'),
                      dueDate: (f.get('dueDate') as string) || null,
                      message: f.get('message'),
                    },
                  }),
                'Details saved.',
              );
            }}
          >
            <Field
              id="clientName"
              label="Client's full name"
              defaultValue={r.clientName}
              required
            />
            <Field
              id="clientEmail"
              label="Client's email"
              type="email"
              defaultValue={r.clientEmail}
              required
              hint="If you change it, send a new link."
            />
            <Field id="dueDate" label="Due date" type="date" defaultValue={r.dueDate ?? ''} />
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                name="message"
                rows={3}
                maxLength={1000}
                defaultValue={r.message}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 md:text-sm"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={!!busy}>
                {busy === 'details' ? 'Saving…' : 'Save details'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-lg border bg-card shadow-xs" aria-labelledby="documents">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id="documents" className="font-semibold text-ink">
            Documents
          </h2>
          {editable && editing !== 'items' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setItems(r.items.map((i) => newItem({ ...i, key: i.id })));
                setEditing('items');
              }}
            >
              <Pencil /> Edit checklist
            </Button>
          )}
        </div>
        {editing === 'items' ? (
          <div className="grid gap-4 p-5">
            <ItemsEditor items={items} onChange={setItems} />
            <div className="flex gap-2">
              <Button
                disabled={!!busy}
                onClick={() => {
                  if (items.some((i) => !i.title.trim())) {
                    setError('Give every document a name, or remove the empty ones.');
                    return;
                  }
                  void act(
                    'items',
                    () =>
                      api<RequestDetail>(`${url}/items`, {
                        method: 'PUT',
                        body: { items: items.map(toItemInput) },
                      }),
                    'Checklist saved.',
                  );
                }}
              >
                {busy === 'items' ? 'Saving…' : 'Save checklist'}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <ReviewPanel request={r} onChange={setR} />
        )}
      </section>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}
