import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

function verificarAssinatura(rawBody: string, signature: string): boolean {
  const fullSecret = process.env.PAYSUITE_WEBHOOK_SECRET ?? ''
  if (!fullSecret) return true // skip in dev if not configured

  const secret = fullSecret.startsWith('whsec_') ? fullSecret.slice(6) : fullSecret
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signature.padStart(computed.length, '0'), 'hex')
    )
  } catch {
    return computed === signature
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-webhook-signature') ?? ''

  if (!verificarAssinatura(rawBody, signature)) {
    console.error('[Paysuite] Assinatura inválida')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event: string = payload.event ?? ''
  const data = payload.data ?? {}
  const requestId: string = payload.request_id ?? ''

  console.log(`[Paysuite] ${event} | request_id=${requestId}`)

  if (event !== 'payment.success') {
    return NextResponse.json({ received: true, event })
  }

  // ── Extrair dados do payload ─────────────────────────────────
  const reference: string = data.reference ?? ''
  const valor = Number(data.amount ?? 0)

  if (!valor || !reference) {
    return NextResponse.json({ error: 'Missing amount or reference' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Idempotência via tabela pagamentos (fonte de verdade) ────
  const { data: pagamentoReg } = await admin
    .from('pagamentos')
    .select('id, status, tipo, usuario_id, ciclo_id, valor')
    .eq('referencia', reference)
    .maybeSingle()

  if (pagamentoReg?.status === 'confirmado') {
    // Já processado (por verificação activa ou webhook anterior)
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (pagamentoReg?.status === 'pendente_confirmacao') {
    // Registo já criado pelo processarRetornoPaysuite — só actualizar status
    await admin.from('pagamentos').update({
      status: 'confirmado',
      confirmado_at: new Date().toISOString(),
    }).eq('id', pagamentoReg.id)
    return NextResponse.json({ received: true, webhook_confirmou: true })
  }

  // Idempotência legacy: verificar depósitos pela referência
  if (requestId) {
    const { data: dup } = await admin
      .from('depositos').select('id').eq('referencia_paysuite', requestId).maybeSingle()
    if (dup) return NextResponse.json({ received: true, duplicate: true })
  }

  // ── Decode referência: SE{UID8}{TIPO3}{TIMESTAMP} ────────────
  const uid8 = reference.slice(2, 10).toLowerCase()
  const tipoCode = reference.slice(10, 13)
  const tipo = tipoCode === 'INS' ? 'inscricao' : 'deposito'

  // ── Encontrar utilizador pelo prefixo do UUID ────────────────
  const { data: usuarios } = await admin
    .from('usuarios').select('id').ilike('id', `${uid8}%`).limit(1)
  const usuarioId: string | null = usuarios?.[0]?.id ?? null

  if (!usuarioId) {
    console.error('[Paysuite] Utilizador não encontrado:', reference)
    return NextResponse.json({ error: 'User not found', reference }, { status: 404 })
  }

  // ── Ciclo activo ─────────────────────────────────────────────
  const { data: ciclo } = await admin
    .from('ciclos')
    .select('id, total_acumulado, participantes_count, minimo_participantes, estado')
    .neq('estado', 'concluido')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!ciclo) {
    return NextResponse.json({ error: 'No active ciclo' }, { status: 400 })
  }

  // ── INSCRIÇÃO ────────────────────────────────────────────────
  if (tipo === 'inscricao') {
    const { data: exists } = await admin
      .from('inscricoes').select('id')
      .eq('usuario_id', usuarioId).eq('ciclo_id', ciclo.id).maybeSingle()

    if (!exists) {
      await admin.from('inscricoes').insert({
        usuario_id: usuarioId,
        ciclo_id: ciclo.id,
        taxa_paga: valor,
      })
      const novoCount = (ciclo.participantes_count ?? 0) + 1
      await admin.from('ciclos').update({
        participantes_count: novoCount,
        ...(novoCount >= ciclo.minimo_participantes && { estado: 'activo' }),
      }).eq('id', ciclo.id)
    }

    if (pagamentoReg) {
      await admin.from('pagamentos').update({
        status: 'confirmado', confirmado_at: new Date().toISOString(),
      }).eq('id', pagamentoReg.id)
    }
    return NextResponse.json({ received: true, tipo: 'inscricao' })
  }

  // ── DEPÓSITO ─────────────────────────────────────────────────
  const pontosGerados = Math.max(Math.floor(valor / 10), 1)

  await admin.from('depositos').insert({
    usuario_id: usuarioId,
    ciclo_id: ciclo.id,
    valor,
    pontos_gerados: pontosGerados,
    referencia_paysuite: requestId || reference,
  })

  const { data: usuario } = await admin
    .from('usuarios').select('pontos_total, pontos_ciclo_actual, streak_dias').eq('id', usuarioId).single()

  await admin.from('usuarios').update({
    pontos_total: (usuario?.pontos_total ?? 0) + pontosGerados,
    pontos_ciclo_actual: (usuario?.pontos_ciclo_actual ?? 0) + pontosGerados,
    streak_dias: (usuario?.streak_dias ?? 0) + 1,
  }).eq('id', usuarioId)

  await admin.from('ciclos').update({
    total_acumulado: Number(ciclo.total_acumulado) + valor,
  }).eq('id', ciclo.id)

  await admin.from('pontos_bonus').insert({
    usuario_id: usuarioId, tipo: 'referencia', pontos: pontosGerados,
  })

  if (pagamentoReg) {
    await admin.from('pagamentos').update({
      status: 'confirmado', confirmado_at: new Date().toISOString(),
    }).eq('id', pagamentoReg.id)
  }

  return NextResponse.json({ received: true, tipo: 'deposito', pontos: pontosGerados })
}
