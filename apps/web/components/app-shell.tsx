'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { useWorkspace } from '@/components/workspace-provider';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, workspace, selectWorkspace, canManage } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/app', label: 'Requests', show: true },
    { href: '/app/team', label: 'Team', show: canManage },
    { href: '/app/settings', label: 'Settings', show: canManage },
  ].filter((l) => l.show);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/app" className="font-semibold tracking-tight">
            DocRequest
          </Link>
          <nav aria-label="Main" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={pathname === l.href ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
                  pathname === l.href && 'bg-accent text-foreground font-medium',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {me.memberships.length > 1 && (
              <NativeSelect
                aria-label="Workspace"
                value={workspace.workspaceId}
                onChange={(e) => selectWorkspace(e.target.value)}
                className="max-w-44"
              >
                {me.memberships.map((m) => (
                  <option key={m.workspaceId} value={m.workspaceId}>
                    {m.workspaceName}
                  </option>
                ))}
              </NativeSelect>
            )}
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut /> <span className="sr-only sm:not-sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
