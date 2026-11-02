'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field, linkClass } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api('/auth/login', {
        method: 'POST',
        body: { email: form.get('email'), password: form.get('password') },
      });
      router.push('/login/code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      description="Enter your email and password. We'll then send a 6‑digit code to your inbox."
    >
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormError message={error} />
        <Field id="email" label="Email" type="email" autoComplete="email" required />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          aside={
            <Link href="/forgot-password" className={`text-sm ${linkClass}`}>
              Forgot password?
            </Link>
          }
        />
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy}>
          {busy ? 'Checking…' : 'Continue'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New to DocRequest?{' '}
          <Link href="/signup" className={linkClass}>
            Create a workspace
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
