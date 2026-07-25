import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature, getPayment } from '@/lib/paysuite'

const TAXA_ANTES_COBERTURA = 0.10
const TAXA_APOS_COBERTURA = 0.20

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-webhook-signature') ?? ''

  if (!verifyWebhookSignature(rawBody, sig)) {
    console.error('[PaySuite] Assinatura inválida')
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const event = String(payload.event ?? '').toLowerCase()
  const data = payload.data ?? {}
  const reference = String(data.reference ?? '')

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
    console.error('[PaySuite] Pagamento não encontrado:', reference)
    return NextResponse.json({ ok: false, error: 'payment_not_found' }, { status: 404 })
  }

  if (pag.status === 'confirmado') {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  if (event === 'payment.failed') {
    await admin.from('pagamentos').update({ status: 'falhado' }).eq('id', pag.id)
    return NextResponse.json({ ok: true, status: 'failed' })
  }

  if (event !== 'payment.success') {
    return NextResponse.json({ ok: true, event, ignored: true })
  }

  // Re-verificação autoritativa junto da API do PaySuite
  const paymentId = String(data.id ?? '')
  const check = paymentId ? await getPayment(paymentId) : { status: 0, data: null }
  const auth = (check.data as any)?.data
  if (!auth || String(auth.status ?? '').toLowerCase() !== 'paid') {
    return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 502 })
  }

  // Amount cross-check
  const authAmount = Number(auth.amount ?? data.amount ?? 0)
  if (authAmount > 0 && Math.abs(authAmount - pag.valor) > 0.01) {
    console.error('[PaySuite] Amount mismatch:', authAmount, 'vs', pag.valor)
    return NextResponse.json({ ok: false, error: 'amount_mismatch' }, { status: 409 })
  }

  // ── Processar pagamento confirmado ──
  const cicloId = pag.ciclo_id
  const usuarioId = pag.usuario_id
  const valorBruto = Number(pag.valor)

  const { data: cicloInfo } = await admin.from('ciclos').select('total_acumulado, meta, participantes_count, minimo_participantes, estado').eq('id', cicloId).single()
  const acumulado = Number(cicloInfo?.total_acumulado ?? 0)
  const meta = Number(cicloInfo?.meta ?? 150000)
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

      const metaInterna = meta * 2
      if (acumulado < metaInterna) {
        const adicaoFundo = Math.min(valorLiquido, metaInterna - acumulado)
        await admin.rpc('increment_fundo', { p_ciclo_id: cicloId, p_amount: adicaoFundo, p_max: metaInterna })
      }
    }
  }

  await admin.from('pagamentos').update({
    status: 'confirmado', confirmado_at: new Date().toISOString(),
  }).eq('id', pag.id)

  return NextResponse.json({ ok: true, tipo: pag.tipo })
}
