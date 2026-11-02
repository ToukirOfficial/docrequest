import { ApiError } from '@/lib/api';

/**
 * Client (public upload page) calls. No staff refresh logic: a 401 here means
 * the client's session ended and they confirm their code again.
 */
export async function clientApi<T = void>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const res = await fetch(`/api/client${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await message(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function message(res: Response): Promise<string> {
  try {
    const b: unknown = await res.json();
    if (b && typeof b === 'object' && 'message' in b && typeof b.message === 'string')
      return b.message;
  } catch {
    // ignore
  }
  if (res.status === 429) return 'Too many tries. Please wait a few minutes and try again.';
  return 'Something went wrong. Please try again.';
}

/** Uploads one file with progress. Resolves with the parsed JSON body. */
export function uploadFile<T>(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/client${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () =>
      reject(new ApiError(0, 'The upload didn’t finish. Check your connection and try again.'));
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // ignore
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as T);
      const msg =
        body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
          ? body.message
          : '';
      reject(new ApiError(xhr.status, msg || 'The upload didn’t work. Please try again.'));
    };
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}
