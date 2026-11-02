'use client';

import { useEffect, useState } from 'react';

export interface PublicConfig {
  demo: boolean;
  signupEnabled: boolean;
  maxUploadMb: number;
}

let cached: Promise<PublicConfig | null> | null = null;

/** Public settings from the API (demo mode, sign-up). Fetched once per page load. */
export function usePublicConfig(): PublicConfig | null {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  useEffect(() => {
    cached ??= fetch('/api/config')
      .then((r) => (r.ok ? (r.json() as Promise<PublicConfig>) : null))
      .catch(() => null);
    let alive = true;
    void cached.then((c) => alive && setConfig(c));
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
