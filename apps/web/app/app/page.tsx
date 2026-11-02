'use client';

import { FileText } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';

export default function RequestsPage() {
  const { workspace } = useWorkspace();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <p className="text-sm text-muted-foreground">{workspace.workspaceName}</p>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
        <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">No requests yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Document requests you send to clients will appear here.
        </p>
      </div>
    </div>
  );
}
