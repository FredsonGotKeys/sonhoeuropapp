'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function criarPedidoPagamento(params: {
  valor: number
  tipo: 'inscricao' | 'deposito'
  method: 'mpesa' | 'emola'
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  if (params.tipo === 'deposito' && params.valor < 20) {
    return { error: 'Valor mínimo é 20 MT' }
  }

  const valor = params.tipo === 'inscricao' ? 200 : params.valor

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
  const { error } = await admin.from('pagamentos').insert({
    usuario_id: user.id,
    ciclo_id: ciclo.id,
    tipo: params.tipo,
    referencia: reference,
    status: 'aguardando_comprovativo',
    valor,
    metodo: params.method,
  })

  if (error) return { error: error.message }

  return { success: true, reference }
}

export async function enviarComprovativo(referencia: string, comprovativo: string, imagemUrl?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const temTexto = comprovativo.trim().length >= 10
  const temImagem = !!imagemUrl

  if (!temTexto && !temImagem) {
    return { error: 'Envia o texto do comprovativo ou uma imagem/screenshot.' }
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
    comprovativo: comprovativo.trim() || null,
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
    .in('status', ['aguardando_comprovativo', 'pendente_confirmacao'])
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
