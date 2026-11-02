'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field } from '@/components/field';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api('/auth/signup', {
        method: 'POST',
        body: {
          name: f.get('name'),
          email: f.get('email'),
          password: f.get('password'),
          workspaceName: f.get('workspaceName'),
        },
      });
      router.push('/login/code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Create your workspace" description="Set up DocRequest for your business.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError message={error} />
        <Field id="workspaceName" label="Business name" autoComplete="organization" required />
        <Field id="name" label="Your name" autoComplete="name" required />
        <Field id="email" label="Email" type="email" autoComplete="email" required />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          hint="At least 12 characters. A short phrase works well."
        />
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create workspace'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
