import type { NextConfig } from "next";

let supabaseOrigin = '';
try {
  supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').origin;
} catch {
  // A missing backend URL is already handled by the application.
}

// Observe violations in staging before enforcing a nonce-based policy.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${supabaseOrigin} https://nominatim.openstreetmap.org`,
  `img-src 'self' data: blob: ${supabaseOrigin} https://*.tile.openstreetmap.org https://firebasestorage.googleapis.com`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
].join('; ');

const securityHeaders = [
  {
    key: 'Content-Security-Policy-Report-Only',
    value: cspReportOnly,
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), browsing-topics=()',
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@ojt/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
