'use client';

import Link from 'next/link';
import { FileStack, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/components/workspace-provider';

export default function RequestsPage() {
  const { workspace, canManage } = useWorkspace();
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Requests"
        description={`Everything ${workspace.workspaceName} has asked clients for, and what's still missing.`}
      />
      <section className="flex flex-col items-center rounded-lg border bg-card px-6 py-16 text-center shadow-xs">
        <span
          className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand"
          aria-hidden="true"
        >
          <FileStack className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-ink">No requests yet</h2>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          When you ask a client for documents, the request shows up here with what&apos;s arrived
          and what&apos;s still missing.
        </p>
        {canManage && (
          <Button asChild variant="outline" className="mt-6">
            <Link href="/app/team">
              <UserPlus /> Invite your team
            </Link>
          </Button>
        )}
      </section>
    </div>
  );
}
