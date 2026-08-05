'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCharge, WALLETS } from '@/lib/zumbopay'
import { createPayment as createPaysuitePayment } from '@/lib/paysuite'
import { caminhoNoBucket } from '@/lib/comprovativos'

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

function activeProvider(): 'paysuite' | 'zumbopay' | 'manual' {
  const v = (process.env.PAYMENT_PROVIDER ?? 'manual').trim().toLowerCase()
  if (v === 'zumbopay') return 'zumbopay'
  if (v === 'paysuite') return 'paysuite'
  return 'manual'
}

export async function getActiveProvider() {
  return activeProvider()
}

export async function criarPedidoPagamento(params: {
  valor: number
  tipo: 'inscricao' | 'deposito'
  method: 'mpesa' | 'emola'
  telefone?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Input validation
  if (!['inscricao', 'deposito'].includes(params.tipo)) return { error: 'Tipo inválido' }
  if (!['mpesa', 'emola'].includes(params.method)) return { error: 'Método inválido' }

  const valorNum = Math.floor(Number(params.valor))
  if (!Number.isFinite(valorNum) || valorNum <= 0) return { error: 'Valor inválido' }
  if (valorNum > 100000) return { error: 'Valor excede o limite permitido' }
  if (params.tipo === 'deposito' && valorNum < 100) return { error: 'Valor mínimo é 100 MT' }

  if (params.telefone) {
    const telClean = params.telefone.replace(/[\s\-+]/g, '')
    if (!/^\d{9,15}$/.test(telClean)) return { error: 'Número de telefone inválido' }
  }

  const valor = params.tipo === 'inscricao' ? 200 : valorNum

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

  const uid8 = user.id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const tipoCode = params.tipo === 'inscricao' ? 'INS' : 'DEP'
  const reference = `SE${uid8}${tipoCode}${Date.now()}`

  const admin = createAdminClient()

  // Buscar nome do utilizador
  const { data: userData } = await admin.from('usuarios').select('nome').eq('id', user.id).single()
  const nome = userData?.nome ?? 'Participante'

  const provider = activeProvider()
  // Único método disponível enquanto os pagamentos automáticos estão desligados.
  const metodo: 'mpesa' | 'emola' = provider === 'manual' ? 'emola' : params.method
  let stkStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
  let stkError = ''
  let checkoutUrl: string | undefined

  if (provider === 'manual') {
    // Nenhuma chamada externa — o pedido fica logo pronto para transferência
    // manual e envio de comprovativo.
  } else if (provider === 'paysuite') {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
    const res = await createPaysuitePayment({
      amount: valor,
      reference,
      method: params.method,
      description: params.tipo === 'inscricao' ? 'Inscrição SonhoEuropa' : 'Depósito SonhoEuropa',
      ...(siteUrl && { return_url: `${siteUrl}/dashboard`, callback_url: `${siteUrl}/api/webhooks/paysuite` }),
    })

    if (res.status >= 200 && res.status < 300 && res.data?.data?.checkout_url) {
      checkoutUrl = res.data.data.checkout_url
      stkStatus = 'sent'
    } else {
      stkStatus = 'failed'
      stkError = res.data?.message ?? 'Erro ao iniciar pagamento'
      console.error('[PaySuite] Payment creation failed:', params.method, res.status, JSON.stringify(res.data))
    }
  } else if (params.telefone) {
    // Tentar STK push via ZumboPay
    const msisdn = params.telefone.replace(/\s+/g, '').replace(/^(\+?258)/, '')
    const walletId = params.method === 'mpesa' ? WALLETS.mpesa : WALLETS.emola

    const res = await createCharge({
      wallet_id: walletId,
      amount: valor,
      msisdn,
      customer_name: nome,
      source_id: reference,
    })

    if (res.status >= 200 && res.status < 300 && res.data?.data?.reference) {
      stkStatus = 'sent'
    } else {
      stkStatus = 'failed'
      stkError = res.data?.error ?? res.data?.message ?? 'Erro ao enviar STK push'
      console.error('[ZumboPay] STK push failed:', params.method, res.status, JSON.stringify(res.data))
    }
  }

  const { error } = await admin.from('pagamentos').insert({
    usuario_id: user.id,
    ciclo_id: ciclo.id,
    tipo: params.tipo,
    referencia: reference,
    status: stkStatus === 'sent' ? 'pendente' : 'aguardando_comprovativo',
    valor,
    metodo,
  })

  if (error) return { error: error.message }

  return {
    success: true,
    reference,
    stkStatus,
    stkError: stkStatus === 'failed' ? stkError : undefined,
    checkoutUrl,
  }
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

// Tempo após o qual um pedido deixado a meio no checkout do fornecedor é
// dado como abandonado. Se o pagamento acabar por entrar mais tarde, o
// webhook confirma-o na mesma — só ignora quem já está 'confirmado'.
const PENDENTE_TTL_MS = 30 * 60 * 1000

export async function getMeusPagamentosPendentes() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  await limparComprovativosExpirados()

  const { error: erroExpiracao } = await createAdminClient()
    .from('pagamentos')
    .update({ status: 'falhado' })
    .eq('usuario_id', user.id)
    .eq('status', 'pendente')
    .lt('created_at', new Date(Date.now() - PENDENTE_TTL_MS).toISOString())

  if (erroExpiracao) {
    console.error('[pendentes] Falha ao expirar abandonados:', erroExpiracao.code, erroExpiracao.message)
  }

  const { data } = await supabase
    .from('pagamentos')
    .select('id, referencia, tipo, valor, metodo, status, comprovativo, comprovativo_imagem_url, created_at')
    .eq('usuario_id', user.id)
    .in('status', ['aguardando_comprovativo', 'pendente_confirmacao', 'pendente'])
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
