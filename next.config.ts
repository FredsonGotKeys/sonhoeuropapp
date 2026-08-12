import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
const SUPABASE_DOMAIN = new URL(SUPABASE_URL).hostname

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_URL}`,
  `connect-src 'self' ${SUPABASE_URL} wss://${SUPABASE_DOMAIN}`,
  "font-src 'self' data:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      // Block source maps in production
      {
        source: '/_next/static/:path*.map',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
    ]
  },

  // Disable source maps in production builds
  productionBrowserSourceMaps: false,
}

export default nextConfig
