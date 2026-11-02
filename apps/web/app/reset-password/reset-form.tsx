'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export function ResetForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) {
      setError('The two passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/auth/password/reset', { method: 'POST', body: { token, password: f.get('password') } });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthCard title="Password changed" description="You've been signed out everywhere. Sign in with your new password.">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError message={token ? error : 'This reset link is incomplete. Please request a new one.'} />
        <Field id="password" label="New password" type="password" autoComplete="new-password" minLength={12} required hint="At least 12 characters." />
        <Field id="confirm" label="Confirm new password" type="password" autoComplete="new-password" minLength={12} required />
        <Button type="submit" disabled={busy || !token}>
          {busy ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </AuthCard>
  );
}
