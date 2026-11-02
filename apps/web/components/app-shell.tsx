'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Inbox, LogOut, Menu, Settings, Users, X } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { useWorkspace } from '@/components/workspace-provider';
import { api } from '@/lib/api';
import { roleLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card lg:flex">
        <SidebarContent />
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
        <Link href="/app" aria-label="DocRequest, requests">
          <Logo />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
      </header>

      {/* Phone menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div
            className="absolute inset-0 bg-ink/40 animate-in fade-in"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] bg-card shadow-md animate-in slide-in-from-left duration-200 motion-reduce:animate-none">
            <SidebarContent
              onNavigate={() => setMenuOpen(false)}
              closeButton={
                <Button
                  ref={closeRef}
                  variant="ghost"
                  size="icon"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              }
            />
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}

function SidebarContent({
  closeButton,
  onNavigate,
}: {
  closeButton?: React.ReactNode;
  onNavigate?: () => void;
}) {
  const { me, workspace, selectWorkspace, canManage } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/app', label: 'Requests', icon: Inbox, show: true },
    { href: '/app/team', label: 'Team', icon: Users, show: canManage },
    { href: '/app/settings', label: 'Settings', icon: Settings, show: canManage },
  ].filter((l) => l.show);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  return (
    <div className="flex w-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link
          href="/app"
          aria-label="DocRequest, requests"
          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Logo />
        </Link>
        {closeButton}
      </div>

      <div className="px-3 pb-4">
        <div className="rounded-lg border bg-background px-3 py-2.5">
          {me.memberships.length > 1 ? (
            <NativeSelect
              aria-label="Switch workspace"
              value={workspace.workspaceId}
              onChange={(e) => selectWorkspace(e.target.value)}
              className="h-8 border-0 bg-transparent px-0 font-semibold shadow-none"
            >
              {me.memberships.map((m) => (
                <option key={m.workspaceId} value={m.workspaceId}>
                  {m.workspaceName}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <p className="truncate text-sm font-semibold text-ink">{workspace.workspaceName}</p>
          )}
          <p className="text-xs text-muted-foreground">{roleLabel[workspace.role]}</p>
        </div>
      </div>

      <nav aria-label="Main" className="grid gap-0.5 px-3">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              onClick={onNavigate}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-ink',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active &&
                  'bg-brand-soft text-brand-strong hover:bg-brand-soft hover:text-brand-strong',
              )}
            >
              {active && (
                <span
                  className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand"
                  aria-hidden="true"
                />
              )}
              <l.icon className="size-[18px]" aria-hidden="true" />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 border-t px-5 py-4">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white"
        >
          {initials(me.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{me.name}</p>
          <p className="truncate text-xs text-muted-foreground">{me.email}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => void logout()}
        >
          <LogOut className="size-[18px]" />
        </Button>
      </div>
    </div>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase() ||
    '?'
  );
}
