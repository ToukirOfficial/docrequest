'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, Trash2 } from 'lucide-react';
import type { Member, PendingInvite } from '@docrequest/shared';
import { useWorkspace } from '@/components/workspace-provider';
import { initials } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { FormError } from '@/components/form-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDate, roleLabel } from '@/lib/format';

export default function TeamPage() {
  const { me, workspace, canManage } = useWorkspace();
  const base = `/w/${workspace.workspaceId}`;
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([api<Member[]>(`${base}/members`), api<PendingInvite[]>(`${base}/invites`)])
        .then(([m, i]) => {
          setError(null);
          setMembers(m);
          setInvites(i);
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Could not load the team'),
        ),
    [base],
  );

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  async function run(action: () => Promise<unknown>) {
    try {
      setError(null);
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setInviteError(null);
    try {
      await api(`${base}/invites`, {
        method: 'POST',
        body: { email: f.get('email'), role: f.get('role') },
      });
      form.reset();
      await load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return <FormError message="Only owners and admins can manage the team." />;
  }

  const myRole = workspace.role;
  const canEdit = (m: Member) =>
    m.userId !== me.id && m.role !== 'OWNER' && (myRole === 'OWNER' || m.role === 'STAFF');

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Team"
        description="Admins manage the team, templates and settings. Staff create and review requests."
      />
      <FormError message={error} />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Invite a colleague</h2>
          </CardTitle>
          <CardDescription>
            They&apos;ll get an email with a link to join. The link works for 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={invite} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="off"
                placeholder="name@yourbusiness.co.uk"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <NativeSelect id="role" name="role" defaultValue="STAFF">
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </NativeSelect>
            </div>
            <Button type="submit" disabled={busy}>
              <Mail /> {busy ? 'Sending…' : 'Send invite'}
            </Button>
          </form>
          <div className="mt-4">
            <FormError message={inviteError} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Members{members ? ` (${members.length})` : ''}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!members ? (
            <div className="grid gap-4 py-1">
              {[0, 1].map((n) => (
                <div key={n} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="grid flex-1 gap-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-ink"
                  >
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">
                      {m.name}{' '}
                      {m.userId === me.id && (
                        <span className="font-normal text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                  </div>
                  {canEdit(m) ? (
                    <>
                      <NativeSelect
                        aria-label={`Role for ${m.name}`}
                        value={m.role}
                        onChange={(e) =>
                          void run(() =>
                            api(`${base}/members/${m.id}`, {
                              method: 'PATCH',
                              body: { role: e.target.value },
                            }),
                          )
                        }
                      >
                        <option value="STAFF">Staff</option>
                        <option value="ADMIN">Admin</option>
                      </NativeSelect>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${m.name}`}
                        onClick={() => {
                          if (confirm(`Remove ${m.name} from the team?`)) {
                            void run(() => api(`${base}/members/${m.id}`, { method: 'DELETE' }));
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  ) : (
                    <Badge variant={m.role === 'OWNER' ? 'success' : 'neutral'}>
                      {roleLabel[m.role]}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Waiting to join</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {invites.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-dashed border-input text-muted-foreground"
                  >
                    <Mail className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{i.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited as {roleLabel[i.role]}. Link works until {formatDate(i.expiresAt)}.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void run(() => api(`${base}/invites/${i.id}`, { method: 'DELETE' }))
                    }
                  >
                    Cancel invite
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
