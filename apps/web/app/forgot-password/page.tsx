'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/password/forgot', {
        method: 'POST',
        body: { email: new FormData(e.currentTarget).get('email') },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email" description="If an account exists for that address, we've sent a link to reset the password. It works for 1 hour.">
        <Link href="/login" className="text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" description="We'll email you a link to choose a new one.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError message={error} />
        <Field id="email" label="Email" type="email" autoComplete="email" required />
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link href="/login" className="text-center text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </form>
    </AuthCard>
  );
}
