'use client';

import { AppShell } from '@/components/app-shell';
import { WorkspaceProvider } from '@/components/workspace-provider';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider
      fallback={({ error, retry }) => (
        <div className="mx-auto grid max-w-5xl gap-4 px-4 py-10 sm:px-8 lg:pl-72">
          {error ? (
            <>
              <FormError message={error} />
              <Button variant="outline" className="w-fit" onClick={retry}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-80 max-w-full" />
              <Skeleton className="mt-4 h-56 w-full rounded-lg" />
            </>
          )}
        </div>
      )}
    >
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
