'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCharge, WALLETS } from '@/lib/zumbopay'

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

  // Tentar STK push via ZumboPay se telefone fornecido
  let stkStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
  let stkError = ''

  if (params.telefone) {
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
      console.error('[ZumboPay] STK push failed:', res.status, stkError)
    }
  }

  const { error } = await admin.from('pagamentos').insert({
    usuario_id: user.id,
    ciclo_id: ciclo.id,
    tipo: params.tipo,
    referencia: reference,
    status: stkStatus === 'sent' ? 'pendente' : 'aguardando_comprovativo',
    valor,
    metodo: params.method,
  })

  if (error) return { error: error.message }

  return {
    success: true,
    reference,
    stkStatus,
    stkError: stkStatus === 'failed' ? stkError : undefined,
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

  // Validate image URL if provided
  if (imagemUrl) {
    try {
      const url = new URL(imagemUrl)
      const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
      if (url.hostname !== supabaseHost) return { error: 'URL de imagem inválida' }
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

  const { data } = await supabase
    .from('pagamentos')
    .select('id, referencia, tipo, valor, metodo, status, comprovativo, comprovativo_imagem_url, created_at')
    .eq('usuario_id', user.id)
    .in('status', ['aguardando_comprovativo', 'pendente_confirmacao', 'pendente'])
    .order('created_at', { ascending: false })

  return data ?? []
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
