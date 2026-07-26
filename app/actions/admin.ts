'use server'

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// Valor real (interno) que o fundo precisa de atingir para ser considerado completo.
// Independente da "meta" configurada por ciclo, que é o valor/prémio mostrado ao utilizador.
const ALVO_REAL = 300000

// ─── AUTH (stateless HMAC tokens — works across serverless instances) ────────

const adminAttempts = new Map<string, { count: number; lockedUntil: number }>()
const ADMIN_MAX_ATTEMPTS = 5
const ADMIN_LOCKOUT = 15 * 60 * 1000
const ADMIN_TOKEN_TTL = 4 * 60 * 60 * 1000

function getSigningKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.ADMIN_PASSWORD ?? ''
  return crypto.createHash('sha256').update('admin-session:' + secret).digest()
}

function createAdminToken(): string {
  const expires = Date.now() + ADMIN_TOKEN_TTL
  const payload = `admin:${expires}`
  const sig = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('hex')
  return `${payload}:${sig}`
}

function verifyAdminToken(token: string): boolean {
  if (!token) return false
  const parts = token.split(':')
  if (parts.length !== 3) return false
  const [prefix, expiresStr, sig] = parts
  if (prefix !== 'admin') return false
  const expires = parseInt(expiresStr, 10)
  if (!expires || Date.now() > expires) return false
  const expected = crypto.createHmac('sha256', getSigningKey()).update(`${prefix}:${expiresStr}`).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch {
    return false
  }
}

async function requireAdmin(): Promise<{ error?: string }> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin-session')?.value ?? ''
  if (!verifyAdminToken(token)) return { error: 'Não autorizado' }
  return {}
}

export async function verifyAdminPassword(password: string) {
  const key = 'admin-login'
  const now = Date.now()
  const attempt = adminAttempts.get(key)

  if (attempt && now < attempt.lockedUntil) {
    const mins = Math.ceil((attempt.lockedUntil - now) / 60000)
    return { error: `Demasiadas tentativas. Tenta em ${mins} minutos.` }
  }

  if (password.trim() !== (process.env.ADMIN_PASSWORD ?? '').trim()) {
    const entry = attempt && now < attempt.lockedUntil + ADMIN_LOCKOUT
      ? { count: attempt.count + 1, lockedUntil: attempt.lockedUntil }
      : { count: (attempt?.count ?? 0) + 1, lockedUntil: 0 }

    if (entry.count >= ADMIN_MAX_ATTEMPTS) {
      entry.lockedUntil = now + ADMIN_LOCKOUT
      entry.count = 0
    }
    adminAttempts.set(key, entry)
    return { error: 'Senha incorrecta' }
  }

  adminAttempts.delete(key)
  const token = createAdminToken()
  const cookieStore = await cookies()
  cookieStore.set('admin-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 4,
    path: '/',
  })
  return { success: true }
}

export async function isValidAdminToken(token: string): Promise<boolean> {
  return verifyAdminToken(token)
}

export async function logoutAdmin() {
  const cookieStore = await cookies()
  cookieStore.delete('admin-session')
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

export async function getAdminStats() {
  const auth = await requireAdmin(); if (auth.error) return null
  const admin = createAdminClient()
  const [cicloRes, usuariosCountRes, usuariosTopRes, depositosRes, inscricoesRes, sorteioRes, pagamentosRes] = await Promise.all([
    admin.from('ciclos').select('*').neq('estado', 'concluido').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('usuarios').select('id', { count: 'exact', head: true }),
    admin.from('usuarios').select('id, nome, email, telefone, codigo_convite, total_depositado, ultimo_deposito_at, created_at').order('created_at', { ascending: false }).limit(4000),
    admin.from('depositos').select('valor'),
    admin.from('inscricoes').select('taxa_paga'),
    admin.from('sorteios').select('*, vencedor:vencedor_id(nome, email)').order('realizado_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('pagamentos').select('status'),
  ])

  const depositos = depositosRes.data ?? []
  const inscricoes = inscricoesRes.data ?? []
  const pagamentos = pagamentosRes.data ?? []

  const totalDepositosBruto = depositos.reduce((s, d) => s + Number(d.valor), 0)
  const totalInscricoes = inscricoes.reduce((s, i) => s + Number(i.taxa_paga), 0)

  const participantesComDepositos = (usuariosTopRes.data ?? []).map((u: any) => ({
    ...u,
    total_depositado: Number(u.total_depositado ?? 0),
  }))

  const ciclo = cicloRes.data
  const fundoActual = Number(ciclo?.total_acumulado ?? 0)

  // Pre-coverage: liquid that went into the fund came from gross * 0.9
  // So gross that funded = fundoActual / 0.9
  const brutoPreCobertura = Math.min(totalDepositosBruto, Math.round(fundoActual / (1 - TAXA_ANTES_COBERTURA)))
  const brutoPosCobertura = Math.max(0, totalDepositosBruto - brutoPreCobertura)

  const comissaoPreCobertura = Math.round(brutoPreCobertura * TAXA_ANTES_COBERTURA)
  const comissaoPosCobertura = Math.round(brutoPosCobertura * TAXA_APOS_COBERTURA)
  const comissaoDepositos = comissaoPreCobertura + comissaoPosCobertura
  const receitaTotal = totalInscricoes + comissaoDepositos

  return {
    cicloActivo: ciclo,
    totalParticipantes: usuariosCountRes.count ?? 0,
    totalDepositos: totalDepositosBruto,
    totalInscricoes,
    participantes: participantesComDepositos,
    ultimoSorteio: sorteioRes.data,
    pagamentosPendentes: pagamentos.filter(p => p.status === 'pendente' || p.status === 'pendente_confirmacao' || p.status === 'aguardando_comprovativo').length,
    pagamentosConfirmados: pagamentos.filter(p => p.status === 'confirmado').length,
    financeiro: {
      depositosBruto: totalDepositosBruto,
      comissaoDepositos,
      comissaoPreCobertura,
      comissaoPosCobertura,
      brutoPreCobertura,
      brutoPosCobertura,
      totalInscricoes,
      receitaTotal,
      fundoAcumulado: fundoActual,
      numDepositos: depositos.length,
      numInscricoes: inscricoes.length,
      coberturaAtingida: fundoActual >= ALVO_REAL,
    },
  }
}

// ─── PARTICIPANTES ────────────────────────────────────────────────────────────

export async function eliminarParticipante(userId: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  await admin.from('pagamentos').delete().eq('usuario_id', userId)
  await admin.from('pontos_bonus').delete().eq('usuario_id', userId)
  await admin.from('depositos').delete().eq('usuario_id', userId)
  await admin.from('inscricoes').delete().eq('usuario_id', userId)
  await admin.from('sorteios').update({ vencedor_id: null }).eq('vencedor_id', userId)
  await admin.from('usuarios').delete().eq('id', userId)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function editarParticipante(userId: string, dados: {
  nome?: string
}) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin.from('usuarios').update(dados).eq('id', userId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function getParticipanteDetalhes(userId: string) {
  const auth = await requireAdmin(); if (auth.error) return null
  const admin = createAdminClient()
  const [userRes, depositosRes, inscricoesRes, pagamentosRes] = await Promise.all([
    admin.from('usuarios').select('*').eq('id', userId).single(),
    admin.from('depositos').select('*').eq('usuario_id', userId).order('data_deposito', { ascending: false }),
    admin.from('inscricoes').select('*, ciclos(estado, meta)').eq('usuario_id', userId),
    admin.from('pagamentos').select('*').eq('usuario_id', userId).order('created_at', { ascending: false }),
  ])
  return {
    usuario: userRes.data,
    depositos: depositosRes.data ?? [],
    inscricoes: inscricoesRes.data ?? [],
    pagamentos: pagamentosRes.data ?? [],
  }
}

// ─── PAGAMENTOS ───────────────────────────────────────────────────────────────

export async function getPagamentos(filtroStatus?: string) {
  const auth = await requireAdmin(); if (auth.error) return []
  const admin = createAdminClient()
  let query = admin
    .from('pagamentos')
    .select('*, usuarios(nome, email)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (filtroStatus && filtroStatus !== 'todos') {
    query = query.eq('status', filtroStatus)
  }

  const { data, error } = await query
  if (error) return []
  return data ?? []
}

const TAXA_ANTES_COBERTURA = 0.10
const TAXA_APOS_COBERTURA = 0.20

export async function confirmarPagamentoManual(pagamentoId: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()

  const { data: pag } = await admin.from('pagamentos').select('*').eq('id', pagamentoId).single()
  if (!pag) return { error: 'Pagamento não encontrado' }
  if (pag.status === 'confirmado') return { error: 'Já confirmado' }

  const cicloId = pag.ciclo_id
  const usuarioId = pag.usuario_id
  const valorBruto = Number(pag.valor)

  const { data: cicloInfo } = await admin.from('ciclos').select('total_acumulado, meta, minimo_participantes').eq('id', cicloId).single()
  const acumulado = Number(cicloInfo?.total_acumulado ?? 0)
  const meta = Number(cicloInfo?.meta ?? 200000)
  const coberturaAtingida = acumulado >= meta

  const taxa = coberturaAtingida ? TAXA_APOS_COBERTURA : TAXA_ANTES_COBERTURA
  const comissao = Math.round(valorBruto * taxa)
  const valorLiquido = valorBruto - comissao

  if (pag.tipo === 'inscricao') {
    const { data: exists } = await admin.from('inscricoes').select('id')
      .eq('usuario_id', usuarioId).eq('ciclo_id', cicloId).maybeSingle()
    if (!exists) {
      await admin.from('inscricoes').insert({ usuario_id: usuarioId, ciclo_id: cicloId, taxa_paga: valorBruto })
      const minPart = cicloInfo?.minimo_participantes ?? 150
      await admin.rpc('increment_participantes', { p_ciclo_id: cicloId, p_min: minPart })
    }
  } else {
    const { data: dup } = await admin.from('depositos').select('id').eq('referencia_paysuite', pag.referencia).maybeSingle()
    if (!dup) {
      await admin.from('depositos').insert({ usuario_id: usuarioId, ciclo_id: cicloId, valor: valorBruto, pontos_gerados: 0, referencia_paysuite: pag.referencia })
      await admin.rpc('increment_user_deposito', { p_user_id: usuarioId, p_amount: valorBruto })

      if (acumulado < ALVO_REAL) {
        const adicaoFundo = Math.min(valorLiquido, ALVO_REAL - acumulado)
        await admin.rpc('increment_fundo', { p_ciclo_id: cicloId, p_amount: adicaoFundo, p_max: ALVO_REAL })
      }
    }
  }

  await admin.from('pagamentos').update({ status: 'confirmado', confirmado_at: new Date().toISOString() }).eq('id', pagamentoId)
  return { success: true }
}

export async function rejeitarPagamento(pagamentoId: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin.from('pagamentos').update({ status: 'falhado' }).eq('id', pagamentoId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function eliminarPagamento(pagamentoId: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin.from('pagamentos').delete().eq('id', pagamentoId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function eliminarPagamentosEmMassa(ids: string[]) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  if (!ids.length) return { success: true }
  const admin = createAdminClient()
  const { error } = await admin.from('pagamentos').delete().in('id', ids)
  if (error) return { error: error.message }
  return { success: true, count: ids.length }
}

// ─── CICLOS ───────────────────────────────────────────────────────────────────

export async function getCiclos() {
  const auth = await requireAdmin(); if (auth.error) return []
  const admin = createAdminClient()
  const { data } = await admin.from('ciclos').select('*').order('created_at', { ascending: false })
  return data ?? []
}

export async function alterarEstadoCiclo(cicloId: string, estado: string) {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin.from('ciclos').update({ estado }).eq('id', cicloId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function criarNovoCiclo() {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  // Fechar ciclos activos primeiro
  await admin.from('ciclos').update({ estado: 'concluido', concluido_at: new Date().toISOString() })
    .in('estado', ['activo', 'aguardando_minimo'])
  // Criar novo ciclo
  const { data, error } = await admin.from('ciclos').insert({ estado: 'aguardando_minimo', meta: 200000, minimo_participantes: 150 }).select().single()
  if (error) return { error: error.message }
  return { success: true, ciclo: data }
}

// ─── SORTEIO ─────────────────────────────────────────────────────────────────

export async function realizarSorteio() {
  const auth = await requireAdmin(); if (auth.error) return { error: auth.error }
  const admin = createAdminClient()
  const { data: ciclo } = await admin.from('ciclos').select('*').eq('estado', 'activo').single()
  if (!ciclo) return { error: 'Nenhum ciclo activo' }
  if (Number(ciclo.total_acumulado ?? 0) < ALVO_REAL) {
    return { error: `Cobertura ainda não atingida (${Math.round(Number(ciclo.total_acumulado ?? 0))} / ${ALVO_REAL} MT)` }
  }

  const { data: inscricoes } = await admin.from('inscricoes')
    .select('usuario_id, usuarios!inner(nome, email, telefone)')
    .eq('ciclo_id', ciclo.id)

  if (!inscricoes?.length) return { error: 'Sem participantes inscritos' }

  // Buscar total depositado por cada participante neste ciclo
  const { data: depositos } = await admin.from('depositos')
    .select('usuario_id, valor')
    .eq('ciclo_id', ciclo.id)

  const depositosPorUser = new Map<string, number>()
  for (const d of depositos ?? []) {
    depositosPorUser.set(d.usuario_id, (depositosPorUser.get(d.usuario_id) ?? 0) + Number(d.valor))
  }

  // Cada inscrito tem peso = total depositado (min 1 para quem só se inscreveu)
  const participants = inscricoes.map((i: any) => ({
    userId: i.usuario_id,
    nome: i.usuarios.nome,
    email: i.usuarios.email,
    telefone: i.usuarios.telefone,
    totalDepositado: depositosPorUser.get(i.usuario_id) ?? 0,
  }))

  const pesoTotal = participants.reduce((s, p) => s + Math.max(p.totalDepositado, 1), 0)

  // Selecção ponderada: quem deposita mais tem mais chances
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  let rand = buf[0] % pesoTotal
  let winner = participants[0]
  for (const p of participants) {
    rand -= Math.max(p.totalDepositado, 1)
    if (rand <= 0) { winner = p; break }
  }

  await Promise.all([
    admin.from('sorteios').insert({ ciclo_id: ciclo.id, vencedor_id: winner.userId, total_fundo: ciclo.total_acumulado, premio: 200000 }),
    admin.from('ciclos').update({ estado: 'concluido', concluido_at: new Date().toISOString() }).eq('id', ciclo.id),
  ])

  return { success: true, winnerNome: winner.nome, winnerEmail: winner.email, winnerTelefone: winner.telefone, totalDepositado: winner.totalDepositado }
}

export async function getSorteios() {
  const auth = await requireAdmin(); if (auth.error) return []
  const admin = createAdminClient()
  const { data } = await admin.from('sorteios')
    .select('*, vencedor:vencedor_id(nome, email), ciclo:ciclo_id(total_acumulado)')
    .order('realizado_at', { ascending: false })
  return data ?? []
}
