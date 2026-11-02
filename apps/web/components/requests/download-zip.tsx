'use client';

import { useState } from 'react';
import { FileArchive } from 'lucide-react';
import type { ExportInfo } from '@docrequest/shared';
import { useWorkspace } from '@/components/workspace-provider';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

/** Builds an encrypted zip of the accepted documents on the server, then downloads it. */
export function DownloadZip({
  requestId,
  onError,
}: {
  requestId: string;
  onError: (m: string) => void;
}) {
  const { workspace } = useWorkspace();
  const base = `/w/${workspace.workspaceId}`;
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      let ex = await api<ExportInfo>(`${base}/requests/${requestId}/export`, { method: 'POST' });
      for (let i = 0; i < 120 && ex.status === 'PENDING'; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        ex = await api<ExportInfo>(`${base}/exports/${ex.id}`);
      }
      if (ex.status !== 'READY') throw new Error('The zip couldn’t be made. Please try again.');
      // A file download, not page navigation: the API answers with Content-Disposition: attachment.
      const a = document.createElement('a');
      a.href = `/api${base}/exports/${ex.id}/download`;
      a.download = ex.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={() => void run()} disabled={busy}>
      <FileArchive /> {busy ? 'Preparing zip…' : 'Download zip'}
    </Button>
  );
}
