'use server'

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { caminhoVerificacao } from '@/lib/verificacoes'

// Tempo de vida dos FICHEIROS de verificação (foto do BI, selfie, contrato em
// PDF) — não do registo em si. Passado este prazo, os ficheiros são apagados
// do armazenamento para não encher o plano gratuito do Supabase, mas o estado
// 'aprovado'/'rejeitado', o número do BI e o veredicto do admin continuam
// guardados, e usuarios.verificado (escrito só quando o admin aprova)
// sobrevive à limpeza — a pessoa nunca é obrigada a repetir o processo.
const VERIFICACAO_TTL_MS = 72 * 60 * 60 * 1000

const BI_RE = /^[A-Z0-9]{6,20}$/

function sanitizeBi(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim().toUpperCase().replace(/\s/g, '')
}

export async function limparVerificacoesExpiradas() {
  const admin = createAdminClient()
  const limite = new Date(Date.now() - VERIFICACAO_TTL_MS).toISOString()

  const { data: expiradas } = await admin
    .from('verificacoes')
    .select('id, usuario_id, bi_imagem_path, selfie_imagem_path, contrato_pdf_path')
    .lt('criado_em', limite)
    .or('bi_imagem_path.not.is.null,selfie_imagem_path.not.is.null,contrato_pdf_path.not.is.null')

  if (!expiradas?.length) return

  const caminhos = expiradas
    .flatMap((v) => [v.bi_imagem_path, v.selfie_imagem_path, v.contrato_pdf_path])
    .filter((c): c is string => !!c)

  if (caminhos.length) await admin.storage.from('verificacoes').remove(caminhos)

  await admin.from('verificacoes')
    .update({ bi_imagem_path: null, selfie_imagem_path: null, contrato_pdf_path: null })
    .in('id', expiradas.map((v) => v.id))
}

/**
 * Gera o PDF do "contrato": nome, número do BI, a foto da selfie e a data,
 * com referência aos Termos e Condições. Corre no runtime Node (não Edge) —
 * pdf-lib manipula bytes directamente, sem Chrome headless.
 */
async function gerarContratoPdf(params: { nome: string; email: string; biNumero: string; selfieBytes: Uint8Array; selfieContentType: string }) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const selfieImg = params.selfieContentType.includes('png')
    ? await pdfDoc.embedPng(params.selfieBytes)
    : await pdfDoc.embedJpg(params.selfieBytes)

  let y = 780
  page.drawText('SonhoEuropa — Contrato de Participação', { x: 50, y, size: 18, font: fontBold, color: rgb(0.02, 0.2, 0.6) })
  y -= 40

  const linha = (label: string, valor: string) => {
    page.drawText(label, { x: 50, y, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(valor, { x: 200, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
    y -= 24
  }

  linha('Nome completo:', params.nome)
  linha('Email:', params.email)
  linha('Número do BI:', params.biNumero)
  linha('Data de geração:', new Date().toLocaleString('pt-PT', { timeZone: 'Africa/Maputo' }))

  y -= 20
  const maxImgWidth = 200
  const scale = Math.min(1, maxImgWidth / selfieImg.width)
  const imgDims = selfieImg.scale(scale)
  page.drawImage(selfieImg, { x: 50, y: y - imgDims.height, width: imgDims.width, height: imgDims.height })
  y -= imgDims.height + 30

  const termosTexto = [
    'Ao assinar este contrato, o participante confirma que a identidade acima',
    'foi verificada através de fotografia do Bilhete de Identidade e de uma',
    'selfie, e que aceita os Termos e Condições da plataforma SonhoEuropa,',
    'disponíveis em sonhoeuropa.co.mz/termos.',
  ]
  for (const l of termosTexto) {
    page.drawText(l, { x: 50, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) })
    y -= 16
  }

  return pdfDoc.save()
}

export async function submeterVerificacao(params: {
  verificacaoId: string
  biNumero: string
  biImagemPath: string
  selfieImagemPath: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const biNumero = sanitizeBi(params.biNumero ?? '')
  if (!BI_RE.test(biNumero)) return { error: 'Número de BI inválido' }

  if (!/^[0-9a-f-]{36}$/i.test(params.verificacaoId)) return { error: 'Pedido inválido' }

  const prefixoEsperado = `${user.id}/${params.verificacaoId}/`
  if (!params.biImagemPath.startsWith(prefixoEsperado) || !params.selfieImagemPath.startsWith(prefixoEsperado)) {
    return { error: 'Ficheiros inválidos' }
  }

  const admin = createAdminClient()

  const { data: jaExiste } = await admin.from('verificacoes').select('id').eq('id', params.verificacaoId).maybeSingle()
  if (jaExiste) return { error: 'Este pedido já foi submetido' }

  const { data: usuario } = await admin.from('usuarios').select('nome, email, verificado').eq('id', user.id).single()
  if (!usuario) return { error: 'Perfil não encontrado' }
  if (usuario.verificado) return { success: true }

  const { data: selfieFile, error: downloadErr } = await admin.storage.from('verificacoes').download(params.selfieImagemPath)
  if (downloadErr || !selfieFile) return { error: 'Não foi possível ler a selfie enviada' }

  const selfieBytes = new Uint8Array(await selfieFile.arrayBuffer())

  let contratoBytes: Uint8Array
  try {
    contratoBytes = await gerarContratoPdf({
      nome: usuario.nome,
      email: usuario.email,
      biNumero,
      selfieBytes,
      selfieContentType: selfieFile.type || 'image/jpeg',
    })
  } catch (e) {
    console.error('[submeterVerificacao] Falha ao gerar contrato:', e)
    return { error: 'Não foi possível gerar o contrato' }
  }

  const contratoPath = caminhoVerificacao(user.id, params.verificacaoId, 'contrato')
  const { error: upErr } = await admin.storage.from('verificacoes')
    .upload(contratoPath, contratoBytes, { contentType: 'application/pdf' })
  if (upErr) return { error: 'Não foi possível guardar o contrato' }

  const { error: insErr } = await admin.from('verificacoes').insert({
    id: params.verificacaoId,
    usuario_id: user.id,
    bi_numero: biNumero,
    bi_imagem_path: params.biImagemPath,
    selfie_imagem_path: params.selfieImagemPath,
    contrato_pdf_path: contratoPath,
    status: 'pendente',
  })
  if (insErr) return { error: insErr.message }

  return { success: true }
}

export async function getEstadoVerificacao() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { autenticado: false as const }

  limparVerificacoesExpiradas().catch((e) => console.error('[verificacao] Falha ao limpar expiradas:', e))

  const admin = createAdminClient()
  const [usuarioRes, verificacaoRes] = await Promise.all([
    admin.from('usuarios').select('verificado').eq('id', user.id).maybeSingle(),
    admin.from('verificacoes').select('id, status, motivo_rejeicao, contrato_pdf_path')
      .eq('usuario_id', user.id).order('criado_em', { ascending: false }).limit(1).maybeSingle(),
  ])

  const verificado = !!usuarioRes.data?.verificado
  const ultima = verificacaoRes.data

  return {
    autenticado: true as const,
    verificado,
    status: verificado ? 'aprovado' as const : (ultima?.status ?? 'nao_iniciado') as 'pendente' | 'rejeitado' | 'nao_iniciado',
    verificacaoId: ultima?.id ?? null,
    motivoRejeicao: ultima?.motivo_rejeicao ?? null,
    temContrato: !!ultima?.contrato_pdf_path,
  }
}

export async function getMeuContratoUrl(verificacaoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data: v } = await admin.from('verificacoes').select('usuario_id, contrato_pdf_path').eq('id', verificacaoId).maybeSingle()
  if (!v || v.usuario_id !== user.id) return { error: 'Não encontrado' }
  if (!v.contrato_pdf_path) return { error: 'O contrato já expirou. Contacta o suporte se precisares de outra via.' }

  const { data, error } = await admin.storage.from('verificacoes').createSignedUrl(v.contrato_pdf_path, 60 * 5)
  if (error || !data) return { error: 'Não foi possível gerar o link' }
  return { success: true, url: data.signedUrl }
}
