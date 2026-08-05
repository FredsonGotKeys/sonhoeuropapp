'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface EstatisticasConvite {
  registados: number
  participantes: number
}

/**
 * Quantas pessoas se registaram com o meu código, e quantas dessas já
 * pagaram a inscrição. Serve só para mostrar progresso a quem divulga —
 * não influencia o sorteio.
 */
export async function getMinhasEstatisticasConvite(): Promise<EstatisticasConvite> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { registados: 0, participantes: 0 }

  const admin = createAdminClient()

  const { data: convidados } = await admin
    .from('usuarios')
    .select('id')
    .eq('convidado_por', user.id)

  const ids = (convidados ?? []).map((u) => u.id)
  if (!ids.length) return { registados: 0, participantes: 0 }

  const { count } = await admin
    .from('inscricoes')
    .select('id', { count: 'exact', head: true })
    .in('usuario_id', ids)

  return { registados: ids.length, participantes: count ?? 0 }
}

export interface RankingEmbaixador {
  nome: string
  participantes: number
  souEu: boolean
}

/**
 * Top convidadores por número de convidados que já pagaram a inscrição.
 * Só nomes próprios (primeiro nome) — nunca email/telefone. Prova social
 * para motivar partilha; não tem qualquer ligação ao sorteio.
 */
export async function getRankingEmbaixadores(): Promise<RankingEmbaixador[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
    souEu: id === user?.id,
  }))
}
