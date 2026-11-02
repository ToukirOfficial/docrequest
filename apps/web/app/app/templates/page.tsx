'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Copy, FileText, Plus } from 'lucide-react';
import type { Template } from '@docrequest/shared';
import { PageHeader } from '@/components/page-header';
import { FormError } from '@/components/form-error';
import { useWorkspace } from '@/components/workspace-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

export default function TemplatesPage() {
  const { workspace, canManage } = useWorkspace();
  const router = useRouter();
  const base = `/w/${workspace.workspaceId}/templates`;
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);

  useEffect(() => {
    api<Template[]>(base)
      .then(setTemplates)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load templates'));
  }, [base]);

  async function copy(t: Template) {
    setCopying(t.id);
    try {
      const created = await api<Template>(base, {
        method: 'POST',
        body: { name: `${t.name} (copy)`, items: t.items },
      });
      router.push(`/app/templates/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not copy the template');
      setCopying(null);
    }
  }

  const builtIn = templates?.filter((t) => t.builtIn) ?? [];
  const own = templates?.filter((t) => !t.builtIn) ?? [];

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Templates"
        description="Checklists you can start a request from. Every request can still be changed before you send it."
        action={
          canManage && (
            <Button asChild>
              <Link href="/app/templates/new">
                <Plus /> New template
              </Link>
            </Button>
          )
        }
      />
      <FormError message={error} />

      <section aria-labelledby="own" className="grid gap-3">
        <h2 id="own" className="font-semibold text-ink">
          Your templates
        </h2>
        {!templates ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : own.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card px-6 py-8 text-center">
            <p className="font-medium text-ink">No templates of your own yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canManage
                ? 'Copy a ready-made one below and change it, or start from scratch.'
                : 'Owners and admins can add templates here.'}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {own.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/app/templates/${t.id}`}
                  className="block h-full rounded-lg border bg-card p-4 shadow-xs transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <p className="font-medium text-ink">{t.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t.items.length} documents
                    {t.updatedAt ? `, updated ${formatDate(t.updatedAt)}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ready" className="grid gap-3">
        <h2 id="ready" className="font-semibold text-ink">
          Ready-made
        </h2>
        {!templates ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {builtIn.map((t) => (
              <li key={t.id} className="flex flex-col rounded-lg border bg-card p-4 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">{t.name}</p>
                  <Badge variant="neutral">Built-in</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t.items.length} documents, for {t.usedBy?.toLowerCase()}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/templates/${t.id}`}>
                      <FileText /> View
                    </Link>
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={copying !== null}
                      onClick={() => void copy(t)}
                    >
                      <Copy /> {copying === t.id ? 'Copying…' : 'Make a copy'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
