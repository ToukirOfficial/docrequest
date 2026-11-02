/**
 * Browser-side API client. All requests go to /api on the same origin
 * (proxied to NestJS), so httpOnly cookies are sent automatically.
 * The API makes every decision; this file only transports requests.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'message' in body) {
      const m = body.message;
      if (Array.isArray(m)) return m.map(String).join('. ');
      if (typeof m === 'string') return m;
    }
  } catch {
    // fall through
  }
  if (res.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  return 'Something went wrong. Please try again.';
}

export async function api<T = void>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const doFetch = () =>
    fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res = await doFetch();
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshOnce()) res = await doFetch();
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
