import crypto from 'crypto'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Rate Limiting (in-memory, per-IP) ──────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const RATE_LIMIT_MAX = 60 // requests per window
const RATE_LIMIT_AUTH_MAX = 10 // login/register attempts per window

let lastCleanup = Date.now()

function isRateLimited(ip: string, max: number): boolean {
  const now = Date.now()

  if (now - lastCleanup > 300_000) {
    lastCleanup = now
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key)
    }
  }

  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }
  entry.count++
  return entry.count > max
}

// ─── Allowed origins for CORS ───────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://sonhoeuropapp.vercel.app',
  'https://sonhoeuropa.co.mz',
  'https://www.sonhoeuropa.co.mz',
])

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true
  if (process.env.NODE_ENV !== 'production') return true
  return ALLOWED_ORIGINS.has(origin)
}

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? '127.0.0.1'
  const origin = request.headers.get('origin')

  // ── Block source map access in production ──
  if (path.endsWith('.map') && process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  // ── Block direct access to _next/static internals ──
  if (path.includes('/_next/') && path.includes('.js.map')) {
    return new NextResponse(null, { status: 404 })
  }

  // ── CORS: reject disallowed origins ──
  if (!isAllowedOrigin(origin)) {
    return new NextResponse(null, { status: 403, headers: { 'Content-Type': 'text/plain' } })
  }

  // ── Handle preflight (OPTIONS) ──
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin ?? '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-signature, x-timestamp',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // ── Rate limiting ──
  const isAuthRoute = path === '/login' || path === '/register' || path === '/admin/login'
  const limit = isAuthRoute ? RATE_LIMIT_AUTH_MAX : RATE_LIMIT_MAX

  if (isRateLimited(ip, limit)) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Tenta novamente em breve.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(limit),
        },
      }
    )
  }

  // ── Supabase auth ──
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── Protected routes ──
  if (!user && (path.startsWith('/dashboard') || path.startsWith('/completar-perfil'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (path.startsWith('/admin') && path !== '/admin/login') {
    const token = request.cookies.get('admin-session')?.value ?? ''
    const parts = token.split(':')
    let valid = false
    if (parts.length === 3 && parts[0] === 'admin') {
      const expires = parseInt(parts[1], 10)
      if (expires && Date.now() <= expires) {
        const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.ADMIN_PASSWORD ?? ''
        const key = crypto.createHash('sha256').update('admin-session:' + secret).digest()
        const expected = crypto.createHmac('sha256', key).update(`admin:${parts[1]}`).digest('hex')
        try { valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts[2], 'hex')) } catch {}
      }
    }
    if (!valid) return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  // ── Security headers on response ──
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // CORS headers
  if (origin && isAllowedOrigin(origin)) {
    supabaseResponse.headers.set('Access-Control-Allow-Origin', origin)
    supabaseResponse.headers.set('Access-Control-Allow-Credentials', 'true')
    supabaseResponse.headers.set('Vary', 'Origin')
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|icon-.*\\.png|manifest\\.json|sw\\.js).*)',
  ],
}
