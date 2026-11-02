'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AuditPage } from '@docrequest/shared';
import { PageHeader } from '@/components/page-header';
import { FormError } from '@/components/form-error';
import { useWorkspace } from '@/components/workspace-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { activityText } from '@/lib/activity';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const extra: Record<string, string> = {
  'auth.signup': 'Created the workspace',
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.refresh_reuse': 'A stolen session was detected and every session was signed out',
  'auth.password_reset': 'Reset their password',
  'workspace.settings_updated': 'Changed workspace settings',
  'member.invited': 'Invited a team member',
  'member.invite_revoked': 'Cancelled an invite',
  'member.joined': 'Joined the workspace',
  'member.role_changed': 'Changed a team member’s role',
  'member.removed': 'Removed a team member',
  'template.created': 'Created a template',
  'template.updated': 'Edited a template',
  'template.deleted': 'Deleted a template',
  'file.downloaded': 'Downloaded a document',
  'export.downloaded': 'Downloaded a zip',
};

/** Append-only record of who did what. Owners and admins only (the API enforces it). */
export default function AuditPageView() {
  const { workspace, canManage } = useWorkspace();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    api<AuditPage>(`/w/${workspace.workspaceId}/audit?page=${page}`)
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not load the audit log'),
      );
  }, [workspace.workspaceId, page, canManage]);

  if (!canManage) return <FormError message="Only owners and admins can see the audit log." />;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Audit log"
        description="Every sign-in, view, download, decision and deletion in this workspace. It can’t be edited or deleted."
      />
      <FormError message={error} />
      <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
        {!data ? (
          <div className="grid gap-3 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : data.entries.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            Nothing has happened in this workspace yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-background text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    When
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Who
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    What happened
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDateTime(e.at)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          e.actorType === 'USER'
                            ? 'bg-secondary text-ink'
                            : e.actorType === 'CLIENT'
                              ? 'bg-brand-soft text-brand-strong'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {e.actorType === 'USER'
                          ? (e.actorName ?? 'Former member')
                          : e.actorType === 'CLIENT'
                            ? 'Client'
                            : 'System'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink">
                      {e.requestId ? (
                        <Link href={`/app/requests/${e.requestId}`} className="hover:underline">
                          {extra[e.action] ?? activityText({ ...e, actorName: e.actorName })}
                        </Link>
                      ) : (
                        (extra[e.action] ?? activityText({ ...e, actorName: e.actorName }))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (page > 1 || data.hasMore) && (
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Newer
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Older
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
