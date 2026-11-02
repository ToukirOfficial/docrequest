'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { MeResponse, MembershipSummary } from '@docrequest/shared';
import { api, ApiError } from '@/lib/api';

interface WorkspaceContextValue {
  me: MeResponse;
  workspace: MembershipSummary;
  selectWorkspace: (id: string) => void;
  reload: () => void;
  /** UI hint only: the API enforces roles on every request. */
  canManage: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const STORAGE_KEY = 'dr_workspace';

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}

export function WorkspaceProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: (state: { error: string | null; retry: () => void }) => React.ReactNode;
}) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const data = await api<MeResponse>('/auth/me');
        if (!cancelled) {
          setError(null);
          setMe(data);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          // Access token may have expired: try one refresh, else sign in again.
          const ok = await fetch('/api/auth/refresh', { method: 'POST' })
            .then((r) => r.ok)
            .catch(() => false);
          if (ok && !cancelled) {
            const data = await api<MeResponse>('/auth/me').catch(() => null);
            if (data && !cancelled) {
              setMe(data);
              return;
            }
          }
          router.replace('/login');
          return;
        }
        setError(e instanceof Error ? e.message : 'Could not load your account');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const selectWorkspace = useCallback((id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const workspace = me?.memberships.find((m) => m.workspaceId === selectedId) ?? me?.memberships[0];

  if (!me || !workspace) {
    return (
      <>
        {fallback({
          error:
            me && !workspace
              ? 'You are not a member of any workspace yet. Ask for an invite.'
              : error,
          retry: reload,
        })}
      </>
    );
  }

  return (
    <WorkspaceContext.Provider
      value={{
        me,
        workspace,
        selectWorkspace,
        reload,
        canManage: workspace.role === 'OWNER' || workspace.role === 'ADMIN',
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
