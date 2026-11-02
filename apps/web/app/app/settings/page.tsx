'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { WorkspaceSettings } from '@docrequest/shared';
import { useWorkspace } from '@/components/workspace-provider';
import { PageHeader } from '@/components/page-header';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const { workspace, canManage, reload } = useWorkspace();
  const base = `/w/${workspace.workspaceId}`;
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    api<WorkspaceSettings>(`${base}/settings`)
      .then(setSettings)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load settings'));
  }, [base, canManage]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const reminderDays = String(f.get('reminderDays') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number);
    if (reminderDays.some((n) => !Number.isInteger(n) || n < 1)) {
      setError('Reminder days must be whole numbers separated by commas, like 2, 5, 7');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api<WorkspaceSettings>(`${base}/settings`, {
        method: 'PATCH',
        body: {
          name: f.get('name'),
          reminderDays,
          dueReminderDays: Number(f.get('dueReminderDays')),
          retentionDays: Number(f.get('retentionDays')),
          linkExpiryDays: Number(f.get('linkExpiryDays')),
        },
      });
      setSettings(updated);
      setSaved(true);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) return <FormError message="Only owners and admins can change settings." />;

  return (
    <div className="grid gap-6">
      <PageHeader title="Settings" description="These apply to every request in this workspace." />
      {!settings || settings.id !== workspace.workspaceId ? (
        error ? (
          <FormError message={error} />
        ) : (
          <div className="grid gap-4">
            <Skeleton className="h-36 rounded-lg" />
            <Skeleton className="h-52 rounded-lg" />
          </div>
        )
      ) : (
        <form key={settings.id} onSubmit={onSubmit} className="grid gap-6">
          <FormError message={error} />
          {saved && (
            <Alert variant="success">
              <CheckCircle2 />
              <AlertDescription>Settings saved.</AlertDescription>
            </Alert>
          )}
          <Section title="Business" description="Clients see this name on every request and email.">
            <Field id="name" label="Business name" defaultValue={settings.name} required />
          </Section>
          <Section
            title="Reminders"
            description="We remind clients about missing or rejected documents, so you don't have to."
          >
            <Field
              id="reminderDays"
              label="Remind clients on these days after sending"
              defaultValue={settings.reminderDays.join(', ')}
              hint="Separate days with commas, for example 2, 5, 7."
            />
            <Field
              id="dueReminderDays"
              label="Days before the due date to send a reminder"
              type="number"
              min={0}
              max={30}
              defaultValue={settings.dueReminderDays}
              hint="Set to 0 to turn it off."
            />
          </Section>
          <Section
            title="Links and file deletion"
            description="Keep client data only as long as you need it."
          >
            <Field
              id="linkExpiryDays"
              label="Client links work for (days)"
              type="number"
              min={1}
              max={365}
              defaultValue={settings.linkExpiryDays}
            />
            <Field
              id="retentionDays"
              label="Delete files after (days)"
              type="number"
              min={1}
              max={365}
              defaultValue={settings.retentionDays}
              hint="Files are deleted this many days after a request is complete or expired."
            />
          </Section>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-lg border bg-card p-5 shadow-xs sm:p-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="grid max-w-md gap-5">{children}</div>
    </section>
  );
}
