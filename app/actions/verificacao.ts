'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registarAuditoria } from '@/lib/auditoria'

// Tempo de vida das FOTOS do BI/selfie (não do registo de verificação).
// Passado este prazo, as imagens são apagadas do armazenamento para não
// encher o plano gratuito do Supabase — o estado (aprovado/rejeitado) e o
// número do BI, uma vez confirmados pelo administrador, continuam guardados.
const VERIFICACAO_IMG_TTL_MS = 24 * 60 * 60 * 1000

export async function limparVerificacoesExpiradas() {
  const admin = createAdminClient()
  const limite = new Date(Date.now() - VERIFICACAO_IMG_TTL_MS).toISOString()

  const { data: expiradas } = await admin
    .from('verificacoes')
    .select('id, bi_imagem_path, bi_imagem_verso_path, selfie_imagem_path')
    .not('bi_imagem_path', 'is', null)
    .lt('criado_em', limite)

  if (!expiradas?.length) return

  const caminhos = expiradas
    .flatMap((v) => [v.bi_imagem_path, v.bi_imagem_verso_path, v.selfie_imagem_path])
    .filter((c): c is string => !!c)
  if (caminhos.length) await admin.storage.from('verificacoes').remove(caminhos)

  await admin.from('verificacoes')
    .update({ bi_imagem_path: null, bi_imagem_verso_path: null, selfie_imagem_path: null })
    .in('id', expiradas.map((v) => v.id))
}

export async function enviarVerificacaoBi(caminhoFrente: string, caminhoVerso: string, caminhoSelfie: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // As fotos têm de estar na pasta do próprio utilizador dentro do bucket
  // privado 'verificacoes' — mesma pasta que a política de storage exige.
  const prefixo = `${user.id}/`
  if (!caminhoFrente.startsWith(prefixo) || !caminhoVerso.startsWith(prefixo) || !caminhoSelfie.startsWith(prefixo)) {
    return { error: 'Caminho de imagem inválido' }
  }

  const { error } = await supabase.from('verificacoes').insert({
    usuario_id: user.id,
    bi_imagem_path: caminhoFrente,
    bi_imagem_verso_path: caminhoVerso,
    selfie_imagem_path: caminhoSelfie,
    status: 'pendente',
  })

  if (error) return { error: error.message }

  registarAuditoria({ usuarioId: user.id, evento: 'bi_e_selfie_enviados' })
  return { success: true }
}
