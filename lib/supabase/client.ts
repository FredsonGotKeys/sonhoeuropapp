import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // Sem "name" customizado: tem de ficar igual ao que lib/supabase/server.ts
        // e proxy.ts usam (por omissão, derivado do URL do projecto). Com nomes
        // diferentes, o browser nunca encontra a sessão que o login (sempre feito
        // no servidor) escreveu — getUser()/getSession() no cliente falha sempre,
        // por muito válida que a sessão real seja.
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      auth: {
        flowType: 'pkce',
      },
    }
  )
