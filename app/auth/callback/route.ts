import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function destino(req: NextRequest, caminho: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  return NextResponse.redirect(`${base || new URL(req.url).origin}${caminho}`)
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const erroOAuth = req.nextUrl.searchParams.get('error')

  if (erroOAuth || !code) {
    console.error('[auth/callback] OAuth falhou:', erroOAuth ?? 'sem código')
    return destino(req, '/login?erro=google')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('[auth/callback] Troca de código falhou:', error?.message)
    return destino(req, '/login?erro=google')
  }

  // Quem entra pela primeira vez ainda não tem perfil: o Google não fornece
  // o telefone, que é indispensável para pagar o prémio.
  const admin = createAdminClient()
  const { data: perfil } = await admin
    .from('usuarios')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle()

  return destino(req, perfil ? '/dashboard' : '/completar-perfil')
}
