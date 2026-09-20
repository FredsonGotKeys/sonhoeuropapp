'use server'

import { createClient } from '@/lib/supabase/server'
import { limparComprovativosExpirados } from '@/app/actions/deposito'
import {
  pagamentosPendentesDe,
  historicoPagamentosDe,
  contratoDe,
  estatisticasConviteDe,
  rankingEmbaixadores,
} from '@/lib/painel-queries'

/**
 * Tudo o que o painel precisa no arranque, numa só ida ao servidor.
 *
 * Antes eram cinco server actions distintas (pendentes, histórico, contrato,
 * estatísticas de convite, ranking): cinco POSTs, e cada uma a revalidar a
 * sessão contra o servidor de auth do Supabase antes de fazer a sua consulta.
 * Numa ligação móvel fraca isso são cinco esperas encadeadas só para desenhar
 * o primeiro ecrã. Aqui a sessão é validada uma vez e as consultas correm
 * todas em paralelo.
 *
 * As actions individuais continuam a existir e a ser usadas onde faz sentido
 * pedir só uma coisa (por exemplo depois de confirmar um pagamento).
 */
export async function getDadosPainel() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { autenticado: false as const }
  }

  // Arrumação de rotina, sem prender a resposta a quem está à espera do ecrã.
  limparComprovativosExpirados().catch((e) =>
    console.error('[painel] Falha ao limpar comprovativos:', e)
  )

  const [pendentes, historico, contrato, convites, ranking] = await Promise.all([
    pagamentosPendentesDe(supabase, user.id),
    historicoPagamentosDe(supabase, user.id),
    contratoDe(supabase, user.id),
    estatisticasConviteDe(user.id),
    rankingEmbaixadores(user.id),
  ])

  return { autenticado: true as const, pendentes, historico, contrato, convites, ranking }
}
