'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field, linkClass } from '@/components/field';
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
      <AuthCard
        title="Check your email"
        description="If there's an account for that address, a reset link is on its way. It works for 1 hour."
      >
        <Link href="/login" className={`text-sm ${linkClass}`}>
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to choose a new one."
    >
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormError message={error} />
        <Field id="email" label="Email" type="email" autoComplete="email" required />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link href="/login" className={`text-center text-sm ${linkClass}`}>
          Back to sign in
        </Link>
      </form>
    </AuthCard>
  );
}
