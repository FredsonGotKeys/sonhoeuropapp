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
