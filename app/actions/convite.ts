'use server'

import { createClient } from '@/lib/supabase/server'
import { estatisticasConviteDe, rankingEmbaixadores } from '@/lib/painel-queries'
import type { EstatisticasConvite, RankingEmbaixador } from '@/lib/painel-queries'

// Tipos com uma única definição, em lib/painel-queries.ts.
export type { EstatisticasConvite, RankingEmbaixador } from '@/lib/painel-queries'

/**
 * Quantas pessoas se registaram com o meu código, e quantas dessas já
 * pagaram a inscrição. Serve só para mostrar progresso a quem divulga —
 * não influencia o sorteio.
 */
export async function getMinhasEstatisticasConvite(): Promise<EstatisticasConvite> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { registados: 0, participantes: 0 }

  return estatisticasConviteDe(user.id)
}

/**
 * Top convidadores por número de convidados que já pagaram a inscrição.
 * Só nomes próprios (primeiro nome) — nunca email/telefone. Prova social
 * para motivar partilha; não tem qualquer ligação ao sorteio.
 */
export async function getRankingEmbaixadores(): Promise<RankingEmbaixador[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return rankingEmbaixadores(user?.id ?? null)
}
