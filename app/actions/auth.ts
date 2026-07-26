'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NOME_MAX = 120
const PASSWORD_MIN = 6
const INVITE_RE = /^[A-Z0-9]{4,16}$/
const TELEFONE_RE = /^8[2-7]\d{7}$/

function sanitize(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

export async function login(formData: FormData) {
  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  const password = formData.get('password') as string ?? ''

  if (!EMAIL_RE.test(email)) return { error: 'Email inválido' }
  if (password.length < PASSWORD_MIN) return { error: 'Senha demasiado curta' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Email ou senha incorrectos' }

  redirect('/dashboard')
}

export async function register(data: {
  email: string
  password: string
  nome: string
  telefone: string
  codigoConvite?: string
}) {
  const email = (data.email ?? '').trim().toLowerCase()
  const password = data.password ?? ''
  const nome = sanitize(data.nome ?? '').slice(0, NOME_MAX)
  const telefone = (data.telefone ?? '').replace(/[\s\-+]/g, '').replace(/^258/, '')
  const codigoConvite = (data.codigoConvite ?? '').trim().toUpperCase()

  if (!EMAIL_RE.test(email)) return { error: 'Email inválido' }
  if (password.length < PASSWORD_MIN) return { error: 'Senha deve ter pelo menos 6 caracteres' }
  if (nome.length < 2) return { error: 'Nome é obrigatório' }
  if (!TELEFONE_RE.test(telefone)) return { error: 'Número de telefone inválido (ex: 84xxxxxxx)' }
  if (codigoConvite && !INVITE_RE.test(codigoConvite)) return { error: 'Código de convite inválido' }

  const supabase = await createClient()
  const admin = createAdminClient()

  let convidadoPor: string | null = null

  if (codigoConvite) {
    const { data: inviter } = await admin
      .from('usuarios')
      .select('id')
      .eq('codigo_convite', codigoConvite)
      .maybeSingle()
    convidadoPor = inviter?.id ?? null
  }

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    if (error.message?.includes('already registered')) return { error: 'Este email já está registado' }
    return { error: 'Erro ao criar conta. Tenta novamente.' }
  }
  if (!authData.user) return { error: 'Erro ao criar conta' }

  const { error: dbError } = await admin.from('usuarios').insert({
    id: authData.user.id,
    email,
    nome,
    telefone,
    convidado_por: convidadoPor,
    total_depositado: 0,
    termos_aceites_at: new Date().toISOString(),
  })

  if (dbError) {
    if (dbError.code === '23505') return { error: 'Este email já está registado' }
    return { error: 'Erro ao criar conta. Tenta novamente.' }
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
