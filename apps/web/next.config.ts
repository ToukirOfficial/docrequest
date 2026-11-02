import type { NextConfig } from 'next';

// The browser only talks to this origin; /api/* is proxied to NestJS so
// auth cookies stay first-party. Set API_URL at build time (e.g. http://api:8120 in Docker).
const apiUrl = process.env.API_URL ?? 'http://localhost:8120';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // We don't use next/image; turning the optimiser off shrinks the attack surface.
  images: { unoptimized: true },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
