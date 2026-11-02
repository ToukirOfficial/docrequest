'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { InvitePreview } from '@docrequest/shared';
import { AuthCard } from '@/components/auth-card';
import { Field, linkClass } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { roleLabel } from '@/lib/format';

export function InviteView({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    api<InvitePreview>(`/invites/${encodeURIComponent(token)}`)
      .then(setInvite)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Invite not found'));
  }, [token]);

  async function accept(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await api(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST', body });
      if (invite?.existingUser) router.replace('/app');
      else setJoined(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? `Please sign in as ${invite?.email ?? 'the invited email'} first, then open this link again.`
          : e instanceof Error
            ? e.message
            : 'Something went wrong',
      );
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <AuthCard title="Invite not available" description={loadError}>
        <Link href="/login" className={`text-sm ${linkClass}`}>
          Go to sign in
        </Link>
      </AuthCard>
    );
  }
  if (!invite) {
    return (
      <AuthCard title="Opening your invite">
        <div className="grid gap-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthCard>
    );
  }
  if (joined) {
    return (
      <AuthCard
        title="You're in"
        description={`Your account is ready. Sign in to start using ${invite.workspaceName}.`}
      >
        <Button asChild size="lg" className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  const description = `You've been invited to join ${invite.workspaceName} as ${roleLabel[invite.role] ?? invite.role}.`;

  if (invite.existingUser) {
    return (
      <AuthCard title={`Join ${invite.workspaceName}`} description={description}>
        <div className="grid gap-5">
          <FormError message={error} />
          <p className="text-sm text-muted-foreground">
            You already have an account as {invite.email}.
          </p>
          <Button size="lg" className="w-full" onClick={() => void accept({})} disabled={busy}>
            {busy ? 'Joining…' : 'Accept invite'}
          </Button>
          <Link href="/login" className={`text-center text-sm ${linkClass}`}>
            Sign in first
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={`Join ${invite.workspaceName}`} description={description}>
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void accept({ name: f.get('name'), password: f.get('password') });
        }}
      >
        <FormError message={error} />
        <Field id="email" label="Email" value={invite.email} readOnly disabled />
        <Field id="name" label="Your name" autoComplete="name" required />
        <Field
          id="password"
          label="Choose a password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          hint="At least 12 characters."
        />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account and join'}
        </Button>
      </form>
    </AuthCard>
  );
}
