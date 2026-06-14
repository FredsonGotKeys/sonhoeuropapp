'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  redirect('/dashboard')
}

export async function register(data: {
  email: string
  password: string
  nome: string
  codigoConvite?: string
}) {
  const supabase = await createClient()
  const admin = createAdminClient()

  let convidadoPor: string | null = null

  if (data.codigoConvite) {
    const { data: inviter } = await admin
      .from('usuarios')
      .select('id')
      .eq('codigo_convite', data.codigoConvite.toUpperCase())
      .maybeSingle()
    convidadoPor = inviter?.id ?? null
  }

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  })

  if (error) {
    console.error('Supabase signUp error:', JSON.stringify(error, null, 2))
    return { error: error.message || error.code || JSON.stringify(error) }
  }
  if (!authData.user) return { error: 'Erro ao criar conta' }

  const { error: dbError } = await admin.from('usuarios').insert({
    id: authData.user.id,
    email: data.email,
    nome: data.nome,
    convidado_por: convidadoPor,
  })

  if (dbError) {
    if (dbError.code === '23505') return { error: 'Este email ja esta registado' }
    return { error: dbError.message || JSON.stringify(dbError) }
  }

  if (convidadoPor) {
    const { data: inviterData } = await admin
      .from('usuarios')
      .select('pontos_total')
      .eq('id', convidadoPor)
      .single()

    await Promise.all([
      admin.from('pontos_bonus').insert({
        usuario_id: convidadoPor,
        tipo: 'convite',
        pontos: 50,
      }),
      admin.from('usuarios').update({
        pontos_total: (inviterData?.pontos_total ?? 0) + 50,
      }).eq('id', convidadoPor),
    ])
  }

  if (!authData.session) {
    return { needsConfirmation: true }
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
