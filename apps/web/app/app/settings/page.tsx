'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { WorkspaceSettings } from '@docrequest/shared';
import { useWorkspace } from '@/components/workspace-provider';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Workspace</h2>
          </CardTitle>
          <CardDescription>These apply to every request in this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {!settings || settings.id !== workspace.workspaceId ? (
            error ? <FormError message={error} /> : <Skeleton className="h-64" />
          ) : (
            <form key={settings.id} onSubmit={onSubmit} className="grid max-w-md gap-4">
              <FormError message={error} />
              {saved && (
                <Alert>
                  <CheckCircle2 />
                  <AlertDescription>Settings saved.</AlertDescription>
                </Alert>
              )}
              <Field id="name" label="Business name" defaultValue={settings.name} required />
              <Field
                id="reminderDays"
                label="Reminder schedule (days after sending)"
                defaultValue={settings.reminderDays.join(', ')}
                hint="Clients get a reminder for missing items on these days. Example: 2, 5, 7"
              />
              <Field
                id="dueReminderDays"
                label="Reminder before due date (days)"
                type="number"
                min={0}
                max={30}
                defaultValue={settings.dueReminderDays}
                hint="0 turns it off."
              />
              <Field
                id="linkExpiryDays"
                label="Client link expiry (days)"
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
              <Button type="submit" className="w-fit" disabled={busy}>
                {busy ? 'Saving…' : 'Save settings'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
