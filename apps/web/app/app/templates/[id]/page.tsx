'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, Trash2 } from 'lucide-react';
import type { Template } from '@docrequest/shared';
import { PageHeader } from '@/components/page-header';
import { FormError } from '@/components/form-error';
import {
  ItemsEditor,
  newItem,
  toItemInput,
  type EditorItem,
} from '@/components/requests/items-editor';
import { useWorkspace } from '@/components/workspace-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

export default function TemplatePage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { workspace, canManage } = useWorkspace();
  const base = `/w/${workspace.workspaceId}/templates`;
  const [template, setTemplate] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [items, setItems] = useState<EditorItem[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api<Template>(`${base}/${id}`)
      .then((t) => {
        setTemplate(t);
        setName(t.name);
        setItems(t.items.map((i) => newItem(i)));
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not load this template'),
      );
  }, [base, id, isNew]);

  const readOnly = !canManage || !!template?.builtIn;

  async function save() {
    if (items.some((i) => !i.title.trim())) {
      setError('Give every document a name, or remove the empty ones.');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const body = { name, items: items.map(toItemInput) };
      const t = await api<Template>(isNew ? base : `${base}/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        body,
      });
      if (isNew) router.replace(`/app/templates/${t.id}`);
      else {
        setTemplate(t);
        setSaved(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!template) return;
    setBusy(true);
    try {
      const t = await api<Template>(base, {
        method: 'POST',
        body: { name: `${template.name} (copy)`, items: template.items },
      });
      router.push(`/app/templates/${t.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not copy the template');
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this template? Requests already made from it are not affected.')) return;
    setBusy(true);
    try {
      await api(`${base}/${id}`, { method: 'DELETE' });
      router.replace('/app/templates');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the template');
      setBusy(false);
    }
  }

  if (!isNew && !template) {
    return error ? <FormError message={error} /> : <Skeleton className="h-96 rounded-lg" />;
  }

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/app/templates"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Templates
        </Link>
        <PageHeader
          title={isNew ? 'New template' : (template?.name ?? '')}
          description={
            template?.builtIn
              ? `A ready-made checklist for ${template.usedBy?.toLowerCase()}. Make a copy to change it.`
              : 'Requests made from this template start with these documents.'
          }
          action={
            template?.builtIn ? (
              <div className="flex items-center gap-2">
                <Badge variant="neutral">Built-in</Badge>
                {canManage && (
                  <Button onClick={() => void copy()} disabled={busy}>
                    <Copy /> Make a copy
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      </div>
      {saved && (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription>Template saved.</AlertDescription>
        </Alert>
      )}
      <FormError message={error} />

      {readOnly ? (
        <ol className="divide-y rounded-lg border bg-card shadow-xs">
          {(template?.items ?? []).map((it, i) => (
            <li key={i} className="flex gap-3 px-5 py-4">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-ink">
                  {it.title}
                  {!it.required && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{it.helpText}</p>
                <p className="mt-1.5 flex gap-1">
                  {it.allowedTypes.map((t) => (
                    <span
                      key={t}
                      className="rounded border px-1.5 py-px font-mono text-[10.5px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid gap-5">
          <div className="grid max-w-md gap-2">
            <Label htmlFor="name">Template name</Label>
            <Input
              id="name"
              value={name}
              maxLength={120}
              placeholder="For example: Annual accounts"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <ItemsEditor items={items} onChange={setItems} />
          <div className="flex flex-wrap justify-between gap-2 border-t pt-5">
            {!isNew ? (
              <Button variant="ghost" onClick={() => void remove()} disabled={busy}>
                <Trash2 /> Delete template
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => void save()} disabled={busy || !name.trim()}>
              {busy ? 'Saving…' : isNew ? 'Create template' : 'Save template'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
