'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { caminhoNoBucket } from '@/lib/comprovativos'

// ─── PaySuite e ZumboPay estão INACTIVOS ────────────────────────────────────
// Ambos tiveram problemas de fiabilidade (PaySuite exige conta empresarial;
// ZumboPay teve falhas na base de dados deles). Em vez de tentar um fornecedor
// automático e cair para transferência manual em caso de erro — o que criava
// ramificações, atrasos e confusão — o fluxo é agora sempre e só manual:
// a pessoa transfere directamente por E-Mola e envia o comprovativo.
//
// O código de lib/paysuite.ts, lib/zumbopay.ts e os webhooks respectivos
// continuam no repositório, prontos a religar (não foram apagados), mas
// nada nesta acção os chama.

// Tempo de vida do FICHEIRO de comprovativo (não do registo do pagamento).
// Passado este prazo, a imagem é apagada do armazenamento para não encher
// o plano gratuito do Supabase — data, valor, texto e estado do pagamento
// continuam guardados normalmente, só a imagem desaparece.
const COMPROVATIVO_IMG_TTL_MS = 24 * 60 * 60 * 1000

export async function limparComprovativosExpirados() {
  const admin = createAdminClient()
  const limite = new Date(Date.now() - COMPROVATIVO_IMG_TTL_MS).toISOString()

  const { data: expirados } = await admin
    .from('pagamentos')
    .select('id, comprovativo_imagem_url')
    .not('comprovativo_imagem_url', 'is', null)
    .lt('comprovativo_enviado_at', limite)

  if (!expirados?.length) return

  const caminhos = expirados.map((p) => caminhoNoBucket(p.comprovativo_imagem_url)).filter((c): c is string => !!c)
  if (caminhos.length) await admin.storage.from('comprovativos').remove(caminhos)

  await admin.from('pagamentos').update({ comprovativo_imagem_url: null }).in('id', expirados.map((p) => p.id))
}

// Mantido só para o dashboard saber que está em modo manual (esconde campos
// de telefone/escolha de método que já não se aplicam a nada).
export async function getActiveProvider() {
  return 'manual' as const
}

export async function criarPedidoPagamento(params: {
  valor: number
  tipo: 'inscricao' | 'deposito'
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  if (!['inscricao', 'deposito'].includes(params.tipo)) return { error: 'Tipo inválido' }

  const valorNum = Math.floor(Number(params.valor))
  if (!Number.isFinite(valorNum) || valorNum <= 0) return { error: 'Valor inválido' }
  if (valorNum > 100000) return { error: 'Valor excede o limite permitido' }
  if (params.tipo === 'deposito' && valorNum < 250) return { error: 'Valor mínimo é 250 MT' }

  const valor = params.tipo === 'inscricao' ? 149 : valorNum

  const { data: ciclo } = await supabase
    .from('ciclos')
    .select('id')
    .neq('estado', 'concluido')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!ciclo) return { error: 'Nenhum ciclo activo encontrado' }

  if (params.tipo === 'inscricao') {
    const { data: jaInscrito } = await supabase
      .from('inscricoes').select('id')
      .eq('usuario_id', user.id).eq('ciclo_id', ciclo.id).maybeSingle()
    if (jaInscrito) return { error: 'Já estás inscrito neste ciclo' }
  }

  // Evita duplicados de um clique a mais (ligação lenta, dois toques): se já
  // existe um pedido do mesmo tipo por confirmar, devolve-o em vez de criar outro.
  const { data: pedidoExistente } = await supabase
    .from('pagamentos')
    .select('referencia')
    .eq('usuario_id', user.id)
    .eq('tipo', params.tipo)
    .in('status', ['aguardando_comprovativo', 'pendente_confirmacao'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pedidoExistente) {
    return { success: true, reference: pedidoExistente.referencia }
  }

  const uid8 = user.id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const tipoCode = params.tipo === 'inscricao' ? 'INS' : 'DEP'
  const reference = `SE${uid8}${tipoCode}${Date.now()}`

  const admin = createAdminClient()

  // Sempre manual, sempre E-Mola — sem chamada a nenhum fornecedor externo,
  // o pedido fica logo pronto para transferência e envio de comprovativo.
  const { error } = await admin.from('pagamentos').insert({
    usuario_id: user.id,
    ciclo_id: ciclo.id,
    tipo: params.tipo,
    referencia: reference,
    status: 'aguardando_comprovativo',
    valor,
    metodo: 'emola',
  })

  if (error) return { error: error.message }

  return { success: true, reference }
}

export async function enviarComprovativo(referencia: string, comprovativo: string, imagemUrl?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Validate referencia format
  if (!/^SE[A-Z0-9]{8}(INS|DEP)\d+$/.test(referencia)) return { error: 'Referência inválida' }

  // Sanitize text: strip HTML/script tags
  const textoLimpo = comprovativo.trim().replace(/<[^>]*>/g, '').slice(0, 2000)

  const temTexto = textoLimpo.length >= 10
  const temImagem = !!imagemUrl

  if (!temTexto && !temImagem) {
    return { error: 'Envia o texto do comprovativo ou uma imagem/screenshot.' }
  }

  // Validate image URL if provided — tem de ser um objecto dentro do bucket
  // 'comprovativos', não apenas qualquer URL do mesmo projecto Supabase.
  if (imagemUrl) {
    try {
      const url = new URL(imagemUrl)
      const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
      const dentroDoBucket = url.pathname.includes('/object/public/comprovativos/')
      if (url.hostname !== supabaseHost || !dentroDoBucket) return { error: 'URL de imagem inválida' }
    } catch {
      return { error: 'URL de imagem inválida' }
    }
  }

  const admin = createAdminClient()

  const { data: pag } = await admin.from('pagamentos')
    .select('id, usuario_id, status')
    .eq('referencia', referencia)
    .maybeSingle()

  if (!pag) return { error: 'Pagamento não encontrado' }
  if (pag.usuario_id !== user.id) return { error: 'Sem permissão' }
  if (pag.status === 'confirmado') return { error: 'Já confirmado' }

  const { error } = await admin.from('pagamentos').update({
    comprovativo: textoLimpo || null,
    comprovativo_imagem_url: imagemUrl || null,
    comprovativo_enviado_at: new Date().toISOString(),
    status: 'pendente_confirmacao',
  }).eq('id', pag.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getMeusPagamentosPendentes() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Limpeza de rotina — não bloqueia a resposta ao utilizador, que está à
  // espera de ver o estado do pagamento, não da arrumação da casa.
  limparComprovativosExpirados().catch((e) => console.error('[pendentes] Falha ao limpar comprovativos:', e))

  const { data } = await supabase
    .from('pagamentos')
    .select('id, referencia, tipo, valor, metodo, status, comprovativo, comprovativo_imagem_url, created_at')
    .eq('usuario_id', user.id)
    .in('status', ['aguardando_comprovativo', 'pendente_confirmacao'])
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function cancelarPagamentoPendente(referencia: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data: pag } = await admin.from('pagamentos')
    .select('id, usuario_id, status')
    .eq('referencia', referencia)
    .maybeSingle()

  if (!pag) return { error: 'Pagamento não encontrado' }
  if (pag.usuario_id !== user.id) return { error: 'Sem permissão' }
  if (pag.status === 'confirmado') return { error: 'Este pagamento já foi confirmado' }

  const { error } = await admin.from('pagamentos').update({ status: 'falhado' }).eq('id', pag.id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function getMeuHistoricoPagamentos() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('pagamentos')
    .select('id, referencia, tipo, valor, metodo, status, created_at, confirmado_at')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return data ?? []
}
