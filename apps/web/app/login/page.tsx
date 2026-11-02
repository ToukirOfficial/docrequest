'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field } from '@/components/field';
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
    <AuthCard title="Sign in" description="We'll email you a 6-digit code to finish signing in.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError message={error} />
        <Field id="email" label="Email" type="email" autoComplete="email" required />
        <Field id="password" label="Password" type="password" autoComplete="current-password" required />
        <Button type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Continue'}
        </Button>
        <div className="flex justify-between text-sm">
          <Link href="/forgot-password" className="underline underline-offset-4">
            Forgot password?
          </Link>
          <Link href="/signup" className="underline underline-offset-4">
            Create an account
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
