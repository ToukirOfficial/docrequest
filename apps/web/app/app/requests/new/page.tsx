'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, FilePlus2, Send } from 'lucide-react';
import type { RequestDetail, Template } from '@docrequest/shared';
import { PageHeader } from '@/components/page-header';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import {
  ItemsEditor,
  newItem,
  toItemInput,
  type EditorItem,
} from '@/components/requests/items-editor';
import { useWorkspace } from '@/components/workspace-provider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const BLANK = 'blank';

export default function NewRequestPage() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const base = `/w/${workspace.workspaceId}`;
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [items, setItems] = useState<EditorItem[]>([newItem()]);
  const [checklistName, setChecklistName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'send' | 'draft' | null>(null);

  useEffect(() => {
    api<Template[]>(`${base}/templates`)
      .then(setTemplates)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load templates'));
  }, [base]);

  function choose(id: string) {
    setChosen(id);
    const t = templates?.find((x) => x.id === id);
    setChecklistName(t?.name ?? '');
    setItems(t ? t.items.map((i) => newItem(i)) : [newItem()]);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>, send: boolean) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (items.some((i) => !i.title.trim())) {
      setError('Give every document a name, or remove the empty ones.');
      return;
    }
    setBusy(send ? 'send' : 'draft');
    setError(null);
    try {
      const r = await api<RequestDetail>(`${base}/requests`, {
        method: 'POST',
        body: {
          clientName: f.get('clientName'),
          clientEmail: f.get('clientEmail'),
          dueDate: (f.get('dueDate') as string) || null,
          message: f.get('message'),
          checklistName,
          items: items.map(toItemInput),
          send,
        },
      });
      router.push(`/app/requests/${r.id}${send ? '?sent=1' : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      className="grid gap-8 pb-24"
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        void submit(e, submitter?.value !== 'draft');
      }}
    >
      <div>
        <Link
          href="/app"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Requests
        </Link>
        <PageHeader
          title="New request"
          description="Ask a client for documents. They get one secure link and upload from their phone."
        />
      </div>

      <Section
        n={1}
        title="Choose a checklist"
        description="Start from a template. You can change anything below."
      >
        {!templates ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            role="radiogroup"
            aria-label="Checklist template"
          >
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                on={chosen === t.id}
                onClick={() => choose(t.id)}
                title={t.name}
                meta={`${t.items.length} documents${t.usedBy ? `, for ${t.usedBy.toLowerCase()}` : ''}`}
              />
            ))}
            <TemplateCard
              on={chosen === BLANK}
              onClick={() => choose(BLANK)}
              title="Start blank"
              meta="Write your own list"
              icon
            />
          </div>
        )}
      </Section>

      <Section n={2} title="Client" description="Who should upload the documents?">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="clientName"
            label="Client's full name"
            autoComplete="off"
            required
            maxLength={120}
          />
          <Field
            id="clientEmail"
            label="Client's email"
            type="email"
            autoComplete="off"
            required
            hint="The secure link and sign-in code go here."
          />
          <Field
            id="dueDate"
            label="Due date (optional)"
            type="date"
            min={today}
            hint="Clients get a reminder the day before."
          />
        </div>
        <div className="mt-5 grid gap-2">
          <Label htmlFor="message">Message to the client (optional)</Label>
          <textarea
            id="message"
            name="message"
            rows={3}
            maxLength={1000}
            placeholder="For example: Hi Amara, here's everything we need for 14 Cranbrook Road."
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 md:text-sm"
          />
        </div>
      </Section>

      <Section
        n={3}
        title="Documents"
        description="Each one gets its own upload button on the client's phone."
      >
        <ItemsEditor items={items} onChange={setItems} />
      </Section>

      <FormError message={error} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-ink tabular-nums">{items.length}</span> document
            {items.length === 1 ? '' : 's'}
            {checklistName ? ` from ${checklistName}` : ''}
          </p>
          <div className="flex gap-2">
            <Button type="submit" value="draft" variant="outline" disabled={busy !== null}>
              {busy === 'draft' ? 'Saving…' : 'Save as draft'}
            </Button>
            <Button type="submit" value="send" disabled={busy !== null}>
              <Send /> {busy === 'send' ? 'Sending…' : 'Send request'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Section({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-xs sm:p-6">
      <div className="mb-5 flex gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white tabular-nums">
          {n}
        </span>
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function TemplateCard({
  on,
  onClick,
  title,
  meta,
  icon,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  meta: string;
  icon?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'relative rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        on ? 'border-brand bg-brand-soft/60' : 'hover:border-input hover:bg-background',
      )}
    >
      <span className="flex items-center gap-2 pr-6 font-medium text-ink">
        {icon && <FilePlus2 className="size-4 text-muted-foreground" aria-hidden="true" />}
        {title}
      </span>
      <span className="mt-0.5 block text-sm text-muted-foreground">{meta}</span>
      {on && (
        <span className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-brand text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
