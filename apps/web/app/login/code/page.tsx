'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function LoginCodePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('code') ?? '').replace(/\s/g, '');
    setBusy(true);
    setError(null);
    try {
      await api('/auth/login/verify', { method: 'POST', body: { code } });
      router.replace('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Check your email" description="Enter the 6-digit code we sent you. It expires in 10 minutes.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError message={error} />
        <Field
          id="code"
          label="Sign-in code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="text-center text-lg tracking-[0.5em]"
        />
        <Button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No email?{' '}
          <Link href="/login" className="underline underline-offset-4">
            Start again
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
