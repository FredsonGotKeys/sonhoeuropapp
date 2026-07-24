import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // Session cookie (no maxAge/expires) — cleared when browser closes
        name: 'sb-session',
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      auth: {
        flowType: 'pkce',
        storage: {
          // Use sessionStorage instead of localStorage — dies with tab
          getItem: (key: string) => {
            if (typeof window === 'undefined') return null
            return window.sessionStorage.getItem(key)
          },
          setItem: (key: string, value: string) => {
            if (typeof window === 'undefined') return
            window.sessionStorage.setItem(key, value)
          },
          removeItem: (key: string) => {
            if (typeof window === 'undefined') return
            window.sessionStorage.removeItem(key)
          },
        },
      },
    }
  )
