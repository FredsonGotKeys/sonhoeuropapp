'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { REF_COOKIE } from '@/lib/auth-cookies'

/**
 * Arranca o login com Google no servidor: o cliente do browser guarda o
 * verificador PKCE em sessionStorage, que o servidor não consegue ler no
 * regresso. Iniciando aqui, o verificador fica num cookie e a troca do
 * código em /auth/callback funciona.
 */
export async function iniciarLoginGoogle(codigoConvite?: string) {
  const supabase = await createClient()

  // O código de convite não sobrevive à ida ao Google — guarda-se num cookie.
  const codigo = (codigoConvite ?? '').trim().toUpperCase()
  if (codigo && INVITE_RE.test(codigo)) {
    const cookieStore = await cookies()
    cookieStore.set(REF_COOKIE, codigo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 30,
      path: '/',
    })
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${siteUrl}/auth/callback` },
  })

  if (error || !data.url) return { error: 'Não foi possível iniciar o login com Google' }
  return { url: data.url }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NOME_MAX = 120
const PASSWORD_MIN = 6
const INVITE_RE = /^[A-Z0-9]{4,16}$/
const TELEFONE_RE = /^8[2-7]\d{7}$/

function sanitize(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

/** Estado do perfil de quem já está autenticado (usado após o login Google). */
export async function getEstadoPerfil() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { autenticado: false, temPerfil: false, nomeSugerido: '' }

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('usuarios').select('id').eq('id', user.id).maybeSingle()

  const meta = user.user_metadata ?? {}
  const nomeSugerido = sanitize(String(meta.full_name ?? meta.name ?? '')).slice(0, NOME_MAX)

  return { autenticado: true, temPerfil: !!perfil, nomeSugerido }
}

/**
 * Cria o perfil de quem entrou por Google. O Google devolve email e nome,
 * mas não o telefone — sem ele não há como pagar o prémio ao vencedor.
 */
export async function completarPerfil(data: { nome: string; telefone: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const email = (user.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { error: 'A tua conta não tem email associado' }

  const nome = sanitize(data.nome ?? '').slice(0, NOME_MAX)
  const telefone = (data.telefone ?? '').replace(/[\s\-+]/g, '').replace(/^258/, '')

  if (nome.length < 2) return { error: 'Nome é obrigatório' }
  if (!TELEFONE_RE.test(telefone)) return { error: 'Número de telefone inválido (ex: 84xxxxxxx)' }

  const admin = createAdminClient()

  const { data: jaExiste } = await admin.from('usuarios').select('id').eq('id', user.id).maybeSingle()
  if (jaExiste) redirect('/dashboard')

  const cookieStore = await cookies()
  const codigo = (cookieStore.get(REF_COOKIE)?.value ?? '').trim().toUpperCase()

  let convidadoPor: string | null = null
  if (codigo && INVITE_RE.test(codigo)) {
    const { data: inviter } = await admin
      .from('usuarios')
      .select('id')
      .eq('codigo_convite', codigo)
      .maybeSingle()
    convidadoPor = inviter?.id ?? null
  }

  const { error: dbError } = await admin.from('usuarios').insert({
    id: user.id,
    email,
    nome,
    telefone,
    convidado_por: convidadoPor,
    total_depositado: 0,
    termos_aceites_at: new Date().toISOString(),
  })

  if (dbError) {
    if (dbError.code === '23505') {
      return dbError.message?.includes('telefone')
        ? { error: 'Este número de telefone já está registado' }
        : { error: 'Esta conta já está registada' }
    }
    console.error('[completarPerfil] Falha:', dbError.code, dbError.message)
    return { error: 'Erro ao criar perfil. Tenta novamente.' }
  }

  cookieStore.delete(REF_COOKIE)
  redirect('/dashboard')
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

  // Quando o email já existe, o Supabase devolve um utilizador sem identities
  // (protecção contra enumeração) em vez de um erro. É preciso distinguir esse
  // caso: o id devolvido é o da conta existente, que nunca pode ser apagada.
  if (authData.user.identities?.length === 0) {
    return { error: 'Este email já está registado' }
  }

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
    // O utilizador de autenticação já existe neste ponto. Sem o perfil,
    // a conta fica inutilizável e o email bloqueado para novo registo —
    // por isso desfaz-se a criação antes de devolver o erro.
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => {})

    if (dbError.code === '23505') {
      return dbError.message?.includes('telefone')
        ? { error: 'Este número de telefone já está registado' }
        : { error: 'Este email já está registado' }
    }
    console.error('[register] Falha ao criar perfil:', dbError.code, dbError.message)
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
