import { createAdminClient } from '@/lib/supabase/admin'

// Registo de auditoria "fire-and-forget": nunca deve bloquear nem derrubar o
// fluxo principal por causa de uma falha ao gravar o registo — por isso os
// erros só vão para a consola, nunca são propagados ao chamador.
export async function registarAuditoria(params: {
  usuarioId: string | null
  contratoId?: string | null
  evento: string
  detalhes?: Record<string, unknown>
}) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('auditoria').insert({
      usuario_id: params.usuarioId,
      contrato_id: params.contratoId ?? null,
      evento: params.evento,
      detalhes: params.detalhes ?? null,
    })
    if (error) console.error('[auditoria] Falha ao registar', params.evento, error.message)
  } catch (e) {
    console.error('[auditoria] Excepção ao registar', params.evento, e)
  }
}
