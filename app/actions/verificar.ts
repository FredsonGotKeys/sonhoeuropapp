'use server'

/**
 * Processamento imediato após retorno do PaySuite.
 *
 * Estratégia:
 *  - O PaySuite só redireciona para return_url quando o utilizador completou
 *    o fluxo de pagamento. Confiamos neste sinal e criamos o registo imediatamente.
 *  - O webhook confirma depois (assíncrono) e marca pagamentos.status = 'confirmado'.
 *  - O admin vê tudo na tabela pagamentos (pendente_confirmacao vs confirmado).
 *  - Se o webhook nunca chegar (falha), o admin pode confirmar manualmente.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export async function processarRetornoPaysuite(referencia: string): Promise<{
  ok: boolean
  tipo?: 'inscricao' | 'deposito'
  mensagem?: string
}> {
  if (!referencia) return { ok: false, mensagem: 'Referência em falta' }

  const admin = createAdminClient()

  // Buscar registo do pagamento iniciado (criado antes do redirect)
  const { data: pag } = await admin
    .from('pagamentos')
    .select('*')
    .eq('referencia', referencia)
    .maybeSingle()

  if (!pag) {
    return { ok: false, mensagem: 'Pagamento não encontrado. Contacta o suporte.' }
  }

  // Se já confirmado → retornar sucesso imediatamente (idempotente)
  if (pag.status === 'confirmado' || pag.status === 'pendente_confirmacao') {
    return { ok: true, tipo: pag.tipo }
  }

  const usuarioId = pag.usuario_id
  const cicloId = pag.ciclo_id
  const valor = Number(pag.valor)
  const tipo: 'inscricao' | 'deposito' = pag.tipo

  if (tipo === 'inscricao') {
    // Verificar se inscrição já existe (webhook pode ter chegado primeiro)
    const { data: exists } = await admin
      .from('inscricoes').select('id')
      .eq('usuario_id', usuarioId).eq('ciclo_id', cicloId).maybeSingle()

    if (!exists) {
      await admin.from('inscricoes').insert({
        usuario_id: usuarioId,
        ciclo_id: cicloId,
        taxa_paga: valor,
      })

      const { data: ciclo } = await admin
        .from('ciclos').select('participantes_count, minimo_participantes').eq('id', cicloId).single()
      if (ciclo) {
        const novoCount = (ciclo.participantes_count ?? 0) + 1
        await admin.from('ciclos').update({
          participantes_count: novoCount,
          ...(novoCount >= ciclo.minimo_participantes && { estado: 'activo' }),
        }).eq('id', cicloId)
      }
    }
  } else {
    // Depósito — verificar idempotência
    const { data: dupDep } = await admin
      .from('depositos').select('id').eq('referencia_paysuite', referencia).maybeSingle()

    if (!dupDep) {
      const pontosGerados = Math.max(Math.floor(valor / 10), 1)
      await admin.from('depositos').insert({
        usuario_id: usuarioId, ciclo_id: cicloId,
        valor, pontos_gerados: pontosGerados, referencia_paysuite: referencia,
      })
      const { data: u } = await admin
        .from('usuarios').select('pontos_total, pontos_ciclo_actual, streak_dias').eq('id', usuarioId).single()
      await admin.from('usuarios').update({
        pontos_total: (u?.pontos_total ?? 0) + pontosGerados,
        pontos_ciclo_actual: (u?.pontos_ciclo_actual ?? 0) + pontosGerados,
        streak_dias: (u?.streak_dias ?? 0) + 1,
      }).eq('id', usuarioId)
      await admin.from('ciclos').update({
        total_acumulado: Number((await admin.from('ciclos').select('total_acumulado').eq('id', cicloId).single()).data?.total_acumulado ?? 0) + valor,
      }).eq('id', cicloId)
    }
  }

  // Marcar como pendente_confirmacao — aguarda webhook para 'confirmado'
  await admin.from('pagamentos').update({
    status: 'pendente_confirmacao',
  }).eq('id', pag.id)

  return { ok: true, tipo }
}
