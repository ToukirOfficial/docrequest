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
      await api('/auth/password/reset', {
        method: 'POST',
        body: { token, password: f.get('password') },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthCard
        title="Password changed"
        description="You've been signed out on every device. Sign in with your new password."
      >
        <Button asChild size="lg" className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Once it's changed, you'll be signed out on every device."
    >
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormError
          message={
            token
              ? error
              : 'This reset link is incomplete. Request a new one from the sign-in page.'
          }
        />
        <Field
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          hint="At least 12 characters."
        />
        <Field
          id="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
        <Button type="submit" size="lg" className="w-full" disabled={busy || !token}>
          {busy ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </AuthCard>
  );
}
