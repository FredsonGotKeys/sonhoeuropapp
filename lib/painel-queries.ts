import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Consultas do painel, separadas das server actions que as expõem.
 *
 * Cada action em app/actions/* valida a sessão por si — o que está certo
 * quando é chamada isoladamente, mas o arranque do painel chamava cinco de
 * uma vez e pagava cinco validações de sessão (cada uma uma ida à rede ao
 * Supabase) além dos cinco POSTs. Com as consultas aqui, getDadosPainel()
 * valida uma vez e corre tudo em paralelo, e as actions individuais
 * continuam a existir sem alteração de comportamento para quem as usa.
 *
 * Ficam fora de um módulo 'use server' de propósito: lá, todo o export tem
 * de ser uma action com argumentos serializáveis, e estas recebem o cliente
 * Supabase já autenticado.
 */

export interface EstatisticasConvite {
  registados: number
  participantes: number
}

export interface RankingEmbaixador {
  nome: string
  participantes: number
  souEu: boolean
}

export async function pagamentosPendentesDe(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('pagamentos')
    .select('id, referencia, tipo, valor, metodo, status, comprovativo, comprovativo_imagem_url, created_at')
    .eq('usuario_id', userId)
    .in('status', ['aguardando_comprovativo', 'pendente_confirmacao'])
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function historicoPagamentosDe(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('pagamentos')
    .select('id, referencia, tipo, valor, metodo, status, created_at, confirmado_at')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  return data ?? []
}

export async function contratoDe(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('contratos')
    .select('id, numero, estado, dados, pdf_paginas, pdf_versao, consentimento_dados_at, declaracao_veracidade_at, aceitacao_termos_at, assinado_at, rejeitado_motivo, created_at')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function estatisticasConviteDe(userId: string): Promise<EstatisticasConvite> {
  const admin = createAdminClient()

  const { data: convidados } = await admin
    .from('usuarios')
    .select('id')
    .eq('convidado_por', userId)

  const ids = (convidados ?? []).map((u) => u.id)
  if (!ids.length) return { registados: 0, participantes: 0 }

  const { count } = await admin
    .from('inscricoes')
    .select('id', { count: 'exact', head: true })
    .in('usuario_id', ids)

  return { registados: ids.length, participantes: count ?? 0 }
}

export async function rankingEmbaixadores(userId: string | null): Promise<RankingEmbaixador[]> {
  const admin = createAdminClient()

  const [{ data: convidados }, { data: inscricoes }] = await Promise.all([
    admin.from('usuarios').select('id, convidado_por').not('convidado_por', 'is', null),
    admin.from('inscricoes').select('usuario_id'),
  ])

  const participanteIds = new Set((inscricoes ?? []).map((i) => i.usuario_id))
  const contagem = new Map<string, number>()
  for (const c of convidados ?? []) {
    if (!c.convidado_por || !participanteIds.has(c.id)) continue
    contagem.set(c.convidado_por, (contagem.get(c.convidado_por) ?? 0) + 1)
  }

  const topIds = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  if (!topIds.length) return []

  const { data: usuarios } = await admin.from('usuarios').select('id, nome').in('id', topIds)
  const nomes = new Map((usuarios ?? []).map((u) => [u.id, u.nome]))

  return topIds.map((id) => ({
    nome: (nomes.get(id) ?? 'Participante').trim().split(/\s+/)[0],
    participantes: contagem.get(id) ?? 0,
    souEu: id === userId,
  }))
}
