import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature, getPayment, emolaePinConfirmed } from '@/lib/zumbopay'

const TAXA_ANTES_COBERTURA = 0.10
const TAXA_APOS_COBERTURA = 0.20
const ALVO_REAL = 300000

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-signature') ?? ''
  const ts = req.headers.get('x-timestamp') ?? ''

  if (!verifyWebhookSignature(rawBody, sig, ts)) {
    console.error('[ZumboPay] Assinatura inválida')
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const event = String(payload.event ?? payload.type ?? '').toLowerCase()
  const data = payload.data ?? payload
  const reference = String(data.reference ?? data.payment_reference ?? '')
  const sourceId = String(data.source_id ?? data.metadata?.source_id ?? '')
  const eventId = String(payload.id ?? payload.event_id ?? `${event}:${reference}`)

  if (!reference) {
    return NextResponse.json({ ok: false, error: 'missing_reference' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: pag } = await admin
    .from('pagamentos')
    .select('id, status, tipo, usuario_id, ciclo_id, valor, metodo')
    .eq('referencia', reference)
    .maybeSingle()

  if (!pag) {
    console.error('[ZumboPay] Pagamento não encontrado:', reference)
    return NextResponse.json({ ok: false, error: 'payment_not_found' }, { status: 404 })
  }

  if (pag.status === 'confirmado') {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // Re-verificação autoritativa
  const check = await getPayment(reference)
  const auth = check.data?.data ?? check.data?.payment ?? check.data
  if (!auth || typeof auth !== 'object') {
    return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 502 })
  }

  const authStatus = String(auth.status ?? '').toLowerCase()

  if (['failed', 'cancelled', 'expired'].includes(authStatus)) {
    await admin.from('pagamentos').update({ status: 'falhado' }).eq('id', pag.id)
    return NextResponse.json({ ok: true, status: authStatus })
  }

  if (!['success', 'completed', 'paid'].includes(authStatus)) {
    return NextResponse.json({ ok: true, status: authStatus, pending: true })
  }

  // e-Mola PIN guard
  const channel = String(auth.channel ?? auth.method ?? pag.metodo ?? '').toLowerCase()
  if (channel === 'emola' && !emolaePinConfirmed(auth)) {
    await admin.from('pagamentos').update({ status: 'pendente_confirmacao' }).eq('id', pag.id)
    return NextResponse.json({ ok: true, pending: true, reason: 'emola_pin_not_confirmed' }, { status: 202 })
  }

  // Amount cross-check
  const authAmount = Number(auth.amount ?? 0)
  if (authAmount > 0 && Math.abs(authAmount - pag.valor) > 0.01) {
    console.error('[ZumboPay] Amount mismatch:', authAmount, 'vs', pag.valor)
    return NextResponse.json({ ok: false, error: 'amount_mismatch' }, { status: 409 })
  }

  // ── Processar pagamento confirmado ──
  const cicloId = pag.ciclo_id
  const usuarioId = pag.usuario_id
  const valorBruto = Number(pag.valor)

  const { data: cicloInfo } = await admin.from('ciclos').select('total_acumulado, meta, participantes_count, minimo_participantes, estado').eq('id', cicloId).single()
  const acumulado = Number(cicloInfo?.total_acumulado ?? 0)
  const meta = Number(cicloInfo?.meta ?? 200000)
  const coberturaAtingida = acumulado >= meta

  if (pag.tipo === 'inscricao') {
    const { data: exists } = await admin.from('inscricoes').select('id')
      .eq('usuario_id', usuarioId).eq('ciclo_id', cicloId).maybeSingle()
    if (!exists) {
      await admin.from('inscricoes').insert({ usuario_id: usuarioId, ciclo_id: cicloId, taxa_paga: valorBruto })
      const minPart = cicloInfo?.minimo_participantes ?? 150
      await admin.rpc('increment_participantes', { p_ciclo_id: cicloId, p_min: minPart })
    }
  } else {
    const { data: dup } = await admin.from('depositos').select('id').eq('referencia_paysuite', reference).maybeSingle()
    if (!dup) {
      const taxa = coberturaAtingida ? TAXA_APOS_COBERTURA : TAXA_ANTES_COBERTURA
      const comissao = Math.round(valorBruto * taxa)
      const valorLiquido = valorBruto - comissao

      await admin.from('depositos').insert({
        usuario_id: usuarioId, ciclo_id: cicloId, valor: valorBruto,
        pontos_gerados: 0, referencia_paysuite: reference,
      })

      await admin.rpc('increment_user_deposito', { p_user_id: usuarioId, p_amount: valorBruto })

      if (acumulado < ALVO_REAL) {
        const adicaoFundo = Math.min(valorLiquido, ALVO_REAL - acumulado)
        await admin.rpc('increment_fundo', { p_ciclo_id: cicloId, p_amount: adicaoFundo, p_max: ALVO_REAL })
      }
    }
  }

  await admin.from('pagamentos').update({
    status: 'confirmado', confirmado_at: new Date().toISOString(),
  }).eq('id', pag.id)

  return NextResponse.json({ ok: true, tipo: pag.tipo })
}
