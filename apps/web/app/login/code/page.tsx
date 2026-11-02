'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field, linkClass } from '@/components/field';
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
    <AuthCard
      title="Check your email"
      description="We've sent you a 6‑digit sign-in code. It works for 10 minutes."
    >
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormError message={error} />
        <Field
          id="code"
          label="6‑digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          placeholder="000000"
          className="h-14 text-center text-2xl font-semibold pl-[0.45em] tracking-[0.45em] tabular-nums placeholder:text-input md:text-2xl"
        />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No email? Check your spam folder, or{' '}
          <Link href="/login" className={linkClass}>
            start again
          </Link>
          .
        </p>
      </form>
    </AuthCard>
  );
}
