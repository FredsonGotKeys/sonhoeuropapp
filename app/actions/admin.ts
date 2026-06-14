'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// ─── AUTH ────────────────────────────────────────────────────────────────────

export async function verifyAdminPassword(password: string) {
  if (password.trim() !== (process.env.ADMIN_PASSWORD ?? '').trim()) return { error: 'Senha incorrecta' }
  const cookieStore = await cookies()
  cookieStore.set('admin-session', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return { success: true }
}

export async function logoutAdmin() {
  const cookieStore = await cookies()
  cookieStore.delete('admin-session')
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

export async function getAdminStats() {
  const admin = createAdminClient()
  const [cicloRes, usuariosCountRes, usuariosTopRes, depositosRes, inscricoesRes, sorteioRes, pagamentosRes] = await Promise.all([
    admin.from('ciclos').select('*').neq('estado', 'concluido').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('usuarios').select('id', { count: 'exact', head: true }),
    admin.from('usuarios').select('*').order('pontos_total', { ascending: false }).limit(200),
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

  const ciclo = cicloRes.data
  const metaCiclo = Number(ciclo?.meta ?? 150000)
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
    participantes: usuariosTopRes.data ?? [],
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
      coberturaAtingida: fundoActual >= metaCiclo,
    },
  }
}

// ─── PARTICIPANTES ────────────────────────────────────────────────────────────

export async function eliminarParticipante(userId: string) {
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
  pontos_total?: number
  pontos_ciclo_actual?: number
  streak_dias?: number
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('usuarios').update(dados).eq('id', userId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function getParticipanteDetalhes(userId: string) {
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
  const admin = createAdminClient()
  let query = admin
    .from('pagamentos')
    .select('*, usuarios(nome, email)')
    .order('created_at', { ascending: false })
    .limit(100)

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
  const admin = createAdminClient()

  const { data: pag } = await admin.from('pagamentos').select('*').eq('id', pagamentoId).single()
  if (!pag) return { error: 'Pagamento não encontrado' }
  if (pag.status === 'confirmado') return { error: 'Já confirmado' }

  const cicloId = pag.ciclo_id
  const usuarioId = pag.usuario_id
  const valorBruto = Number(pag.valor)

  const { data: cicloInfo } = await admin.from('ciclos').select('total_acumulado, meta').eq('id', cicloId).single()
  const acumulado = Number(cicloInfo?.total_acumulado ?? 0)
  const meta = Number(cicloInfo?.meta ?? 150000)
  const coberturaAtingida = acumulado >= meta

  const taxa = coberturaAtingida ? TAXA_APOS_COBERTURA : TAXA_ANTES_COBERTURA
  const comissao = Math.round(valorBruto * taxa)
  const valorLiquido = valorBruto - comissao

  if (pag.tipo === 'inscricao') {
    const { data: exists } = await admin.from('inscricoes').select('id')
      .eq('usuario_id', usuarioId).eq('ciclo_id', cicloId).maybeSingle()
    if (!exists) {
      await admin.from('inscricoes').insert({ usuario_id: usuarioId, ciclo_id: cicloId, taxa_paga: valorBruto })
      const { data: ciclo } = await admin.from('ciclos').select('participantes_count, minimo_participantes').eq('id', cicloId).single()
      if (ciclo) {
        const novoCount = (ciclo.participantes_count ?? 0) + 1
        await admin.from('ciclos').update({
          participantes_count: novoCount,
          ...(novoCount >= ciclo.minimo_participantes && { estado: 'activo' }),
        }).eq('id', cicloId)
      }
    }
  } else {
    const { data: dup } = await admin.from('depositos').select('id').eq('referencia_paysuite', pag.referencia).maybeSingle()
    if (!dup) {
      const pts = Math.max(Math.floor(valorBruto / 10), 1)
      await admin.from('depositos').insert({ usuario_id: usuarioId, ciclo_id: cicloId, valor: valorBruto, pontos_gerados: pts, referencia_paysuite: pag.referencia })
      const { data: u } = await admin.from('usuarios').select('pontos_total, pontos_ciclo_actual, streak_dias, ultimo_deposito_at').eq('id', usuarioId).single()

      const hoje = new Date().toDateString()
      const ultimoDep = u?.ultimo_deposito_at ? new Date(u.ultimo_deposito_at).toDateString() : null
      const ontem = new Date(Date.now() - 86400000).toDateString()
      let novoStreak = 1
      if (ultimoDep === ontem) novoStreak = (u?.streak_dias ?? 0) + 1
      else if (ultimoDep === hoje) novoStreak = u?.streak_dias ?? 1

      await admin.from('usuarios').update({
        pontos_total: (u?.pontos_total ?? 0) + pts,
        pontos_ciclo_actual: (u?.pontos_ciclo_actual ?? 0) + pts,
        streak_dias: novoStreak,
        ultimo_deposito_at: new Date().toISOString(),
      }).eq('id', usuarioId)

      const metaVisual = Math.round(meta * 1.2)
      if (acumulado < metaVisual) {
        const adicaoFundo = Math.min(valorLiquido, metaVisual - acumulado)
        await admin.from('ciclos').update({ total_acumulado: acumulado + adicaoFundo }).eq('id', cicloId)
      }
    }
  }

  await admin.from('pagamentos').update({ status: 'confirmado', confirmado_at: new Date().toISOString() }).eq('id', pagamentoId)
  return { success: true }
}

export async function rejeitarPagamento(pagamentoId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('pagamentos').update({ status: 'falhado' }).eq('id', pagamentoId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function eliminarPagamento(pagamentoId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('pagamentos').delete().eq('id', pagamentoId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function eliminarPagamentosEmMassa(ids: string[]) {
  if (!ids.length) return { success: true }
  const admin = createAdminClient()
  const { error } = await admin.from('pagamentos').delete().in('id', ids)
  if (error) return { error: error.message }
  return { success: true, count: ids.length }
}

// ─── CICLOS ───────────────────────────────────────────────────────────────────

export async function getCiclos() {
  const admin = createAdminClient()
  const { data } = await admin.from('ciclos').select('*').order('created_at', { ascending: false })
  return data ?? []
}

export async function alterarEstadoCiclo(cicloId: string, estado: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('ciclos').update({ estado }).eq('id', cicloId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function criarNovoCiclo() {
  const admin = createAdminClient()
  // Fechar ciclos activos primeiro
  await admin.from('ciclos').update({ estado: 'concluido', concluido_at: new Date().toISOString() })
    .in('estado', ['activo', 'aguardando_minimo'])
  // Resetar pontos do ciclo
  await admin.from('usuarios').update({ pontos_ciclo_actual: 0 })
  // Criar novo ciclo
  const { data, error } = await admin.from('ciclos').insert({ estado: 'aguardando_minimo', meta: 150000, minimo_participantes: 150 }).select().single()
  if (error) return { error: error.message }
  return { success: true, ciclo: data }
}

// ─── SORTEIO ─────────────────────────────────────────────────────────────────

export async function realizarSorteio() {
  const admin = createAdminClient()
  const { data: ciclo } = await admin.from('ciclos').select('*').eq('estado', 'activo').single()
  if (!ciclo) return { error: 'Nenhum ciclo activo' }
  if (Number(ciclo.total_acumulado ?? 0) < Number(ciclo.meta ?? 150000)) {
    return { error: `Cobertura ainda não atingida (${Math.round(Number(ciclo.total_acumulado ?? 0))} / ${ciclo.meta ?? 150000} MT)` }
  }

  const { data: inscricoes } = await admin.from('inscricoes')
    .select('usuario_id, usuarios!inner(pontos_ciclo_actual, nome, email)')
    .eq('ciclo_id', ciclo.id)

  if (!inscricoes?.length) return { error: 'Sem participantes inscritos' }

  const participants = inscricoes.map((i: any) => ({
    userId: i.usuario_id,
    weight: Math.max(Number(i.usuarios.pontos_ciclo_actual) || 1, 1),
    nome: i.usuarios.nome,
    email: i.usuarios.email,
  }))

  const totalWeight = participants.reduce((s, p) => s + p.weight, 0)
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  let rand = (buf[0] / 0xFFFFFFFF) * totalWeight
  let winner = participants[participants.length - 1]
  for (const p of participants) { rand -= p.weight; if (rand <= 0) { winner = p; break } }

  await Promise.all([
    admin.from('sorteios').insert({ ciclo_id: ciclo.id, vencedor_id: winner.userId, total_fundo: ciclo.total_acumulado, premio: 150000 }),
    admin.from('ciclos').update({ estado: 'concluido', concluido_at: new Date().toISOString() }).eq('id', ciclo.id),
  ])

  return { success: true, winnerNome: winner.nome, winnerEmail: winner.email }
}

export async function getSorteios() {
  const admin = createAdminClient()
  const { data } = await admin.from('sorteios')
    .select('*, vencedor:vencedor_id(nome, email), ciclo:ciclo_id(total_acumulado)')
    .order('realizado_at', { ascending: false })
  return data ?? []
}
