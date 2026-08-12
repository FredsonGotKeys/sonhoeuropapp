import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

// ─── Geração do PDF do contrato ─────────────────────────────────────────────
// Documento construído "à mão" com pdf-lib (sem motor de layout automático),
// por isso este módulo implementa o próprio fluxo de texto/paginação. Gera
// primeiro o conteúdo, só no fim escreve "Página X de N" em todas as páginas
// (o total só é conhecido depois de tudo desenhado).

export interface ClausulaTemplate {
  id: string
  titulo: string
  corpo: string
  requires_legal_review: boolean
}

export interface DadosContrato {
  nome: string
  nascimento: string // YYYY-MM-DD
  nacionalidade: string
  biNumero: string
  biValidade: string // YYYY-MM-DD
  nuit: string | null
  telefone: string
  email: string
  morada: string
}

export interface GerarContratoParams {
  numero: string
  versaoTemplate: number
  versaoPdf: number
  templateNome: string
  clausulas: ClausulaTemplate[]
  dados: DadosContrato
  criadoEm: Date
  assinadoEm: Date | null
  consentimentoDadosEm: Date | null
  declaracaoVeracidadeEm: Date | null
  aceitacaoTermosEm: Date | null
  selfieBytes: Uint8Array | null
  selfieTipo: 'image/jpeg' | 'image/png' | null
  conteudoHash: string
  urlVerificacao: string
}

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 52
const FOOTER_H = 34
const CONTENT_BOTTOM = FOOTER_H + 24

const AZUL = rgb(0, 0.2, 0.6)
const CINZA = rgb(0.42, 0.42, 0.42)
const CINZA_CLARO = rgb(0.6, 0.6, 0.6)
const VERMELHO = rgb(0.75, 0.15, 0.1)
const PRETO = rgb(0.08, 0.08, 0.1)

const TZ = 'Africa/Maputo'

function formatarDataHora(d: Date): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d) + ' (Maputo)'
}

function formatarData(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

class Fluxo {
  doc: PDFDocument
  fonte: PDFFont
  fonteNegrito: PDFFont
  page!: PDFPage
  y = 0
  paginas: PDFPage[] = []

  constructor(doc: PDFDocument, fonte: PDFFont, fonteNegrito: PDFFont) {
    this.doc = doc
    this.fonte = fonte
    this.fonteNegrito = fonteNegrito
  }

  novaPagina() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.paginas.push(this.page)
    this.y = PAGE_H - MARGIN
  }

  garantirEspaco(altura: number) {
    if (this.y - altura < CONTENT_BOTTOM) this.novaPagina()
  }

  private quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, larguraMax: number): string[] {
    const linhas: string[] = []
    for (const paragrafo of texto.split('\n')) {
      if (paragrafo.trim() === '') { linhas.push(''); continue }
      const palavras = paragrafo.split(' ')
      let atual = ''
      for (const palavra of palavras) {
        const teste = atual ? `${atual} ${palavra}` : palavra
        if (fonte.widthOfTextAtSize(teste, tamanho) > larguraMax && atual) {
          linhas.push(atual)
          atual = palavra
        } else {
          atual = teste
        }
      }
      if (atual) linhas.push(atual)
    }
    return linhas
  }

  paragrafo(texto: string, opts: { tamanho?: number; negrito?: boolean; cor?: ReturnType<typeof rgb>; espacoDepois?: number; larguraMax?: number } = {}) {
    const tamanho = opts.tamanho ?? 9.5
    const fonte = opts.negrito ? this.fonteNegrito : this.fonte
    const cor = opts.cor ?? PRETO
    const larguraMax = opts.larguraMax ?? (PAGE_W - MARGIN * 2)
    const altLinha = tamanho * 1.4

    for (const linha of this.quebrarLinhas(texto, fonte, tamanho, larguraMax)) {
      this.garantirEspaco(altLinha)
      this.page.drawText(linha, { x: MARGIN, y: this.y - tamanho, size: tamanho, font: fonte, color: cor })
      this.y -= altLinha
    }
    this.y -= opts.espacoDepois ?? 4
  }

  titulo(texto: string, tamanho = 13) {
    this.garantirEspaco(tamanho * 1.6 + 6)
    this.paragrafo(texto, { tamanho, negrito: true, cor: AZUL, espacoDepois: 8 })
  }

  espaco(altura: number) {
    this.y -= altura
  }

  linhaHorizontal(cor = rgb(0.85, 0.85, 0.85)) {
    this.garantirEspaco(10)
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.75, color: cor })
    this.y -= 12
  }
}

export async function gerarContratoPdf(params: GerarContratoParams): Promise<{ bytes: Uint8Array; paginas: number }> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Contrato ${params.numero}`)
  doc.setProducer('SonhoEuropa — Sistema de Contratos')
  doc.setCreationDate(params.criadoEm)

  const fonte = await doc.embedFont(StandardFonts.Helvetica)
  const fonteNegrito = await doc.embedFont(StandardFonts.HelveticaBold)
  const fluxo = new Fluxo(doc, fonte, fonteNegrito)
  fluxo.novaPagina()

  // ── Cabeçalho ──
  fluxo.paragrafo('SONHOEUROPA', { tamanho: 11, negrito: true, cor: AZUL, espacoDepois: 2 })
  fluxo.titulo('CONTRATO DE PARTICIPAÇÃO NO FUNDO COMUNITÁRIO', 15)
  fluxo.paragrafo(`Contrato N.º ${params.numero}  ·  Versão do documento: ${params.versaoPdf}  ·  Modelo: ${params.templateNome} (v${params.versaoTemplate})`, { tamanho: 9, cor: CINZA, espacoDepois: 2 })
  fluxo.paragrafo(`Emitido em: ${formatarDataHora(params.criadoEm)}`, { tamanho: 9, cor: CINZA, espacoDepois: 10 })

  // ── Aviso de revisão jurídica ──
  fluxo.garantirEspaco(30)
  const avisoY = fluxo.y
  fluxo.page.drawRectangle({ x: MARGIN, y: avisoY - 26, width: PAGE_W - MARGIN * 2, height: 26, color: rgb(0.99, 0.95, 0.9), borderColor: rgb(0.85, 0.6, 0.2), borderWidth: 0.75 })
  fluxo.y -= 6
  fluxo.paragrafo('Este documento contém cláusulas geradas a partir de uma minuta genérica, sinalizadas "[REQUIRES LEGAL REVIEW]", que aguardam validação por advogado licenciado em Moçambique.', { tamanho: 8, negrito: true, cor: VERMELHO, espacoDepois: 4, larguraMax: PAGE_W - MARGIN * 2 - 12 })
  fluxo.y -= 10

  // ── Identificação das partes ──
  fluxo.titulo('Identificação das Partes')
  fluxo.paragrafo('GESTOR DO FUNDO', { tamanho: 9.5, negrito: true, espacoDepois: 1 })
  fluxo.paragrafo('Fredson Bernardo Muianga, responsável pela gestão da plataforma SonhoEuropa. [REQUIRES LEGAL REVIEW: confirmar a forma jurídica exacta do GESTOR — pessoa singular ou entidade colectiva a constituir — e os respectivos dados de identificação fiscal.]', { tamanho: 9, cor: CINZA, espacoDepois: 8 })

  fluxo.paragrafo('PARTICIPANTE', { tamanho: 9.5, negrito: true, espacoDepois: 1 })
  const d = params.dados
  const linhasParticipante = [
    `Nome completo: ${d.nome}`,
    `Data de nascimento: ${formatarData(d.nascimento)}`,
    `Nacionalidade: ${d.nacionalidade}`,
    `Bilhete de Identidade n.º: ${d.biNumero}   ·   Válido até: ${formatarData(d.biValidade)}`,
    `NUIT: ${d.nuit || '— não fornecido —'}`,
    `Telefone: ${d.telefone}`,
    `Email: ${d.email}`,
    `Morada: ${d.morada}`,
  ]
  for (const linha of linhasParticipante) fluxo.paragrafo(linha, { tamanho: 9.5, espacoDepois: 2 })
  fluxo.espaco(6)

  // Fotografia do participante, junto à identificação
  if (params.selfieBytes && params.selfieTipo) {
    try {
      const img = params.selfieTipo === 'image/png'
        ? await doc.embedPng(params.selfieBytes)
        : await doc.embedJpg(params.selfieBytes)
      const alturaFoto = 90
      const larguraFoto = (img.width / img.height) * alturaFoto
      fluxo.garantirEspaco(alturaFoto + 14)
      fluxo.page.drawImage(img, { x: MARGIN, y: fluxo.y - alturaFoto, width: larguraFoto, height: alturaFoto })
      fluxo.page.drawRectangle({ x: MARGIN, y: fluxo.y - alturaFoto, width: larguraFoto, height: alturaFoto, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.75 })
      fluxo.y -= alturaFoto + 6
      fluxo.paragrafo('Fotografia do participante (selfie submetida no processo de verificação de identidade)', { tamanho: 7.5, cor: CINZA_CLARO, espacoDepois: 10 })
    } catch {
      fluxo.paragrafo('[Fotografia do participante indisponível]', { tamanho: 8, cor: CINZA, espacoDepois: 10 })
    }
  }

  fluxo.linhaHorizontal()

  // ── Cláusulas ──
  for (const clausula of params.clausulas) {
    fluxo.titulo(clausula.titulo, 11)
    fluxo.paragrafo(clausula.corpo, { tamanho: 9.3, espacoDepois: 10 })
  }

  fluxo.linhaHorizontal()

  // ── Consentimento e assinatura ──
  fluxo.titulo('Consentimento e Assinatura Electrónica')
  const itens: [string, Date | null][] = [
    ['Consentimento para tratamento de dados pessoais', params.consentimentoDadosEm],
    ['Declaração de veracidade das informações', params.declaracaoVeracidadeEm],
    ['Aceitação dos termos do contrato', params.aceitacaoTermosEm],
    ['Assinatura electrónica (autenticação forte por código OTP enviado por email)', params.assinadoEm],
  ]
  for (const [label, data] of itens) {
    fluxo.paragrafo(`[${data ? 'X' : ' '}] ${label}${data ? '  —  ' + formatarDataHora(data) : ''}`, { tamanho: 9, espacoDepois: 4 })
  }
  fluxo.espaco(4)
  fluxo.paragrafo('A assinatura acima constitui uma assinatura electrónica com autenticação forte (código de uso único enviado ao email registado do PARTICIPANTE). NÃO se trata de uma assinatura digital certificada por entidade certificadora reconhecida em Moçambique (nomeadamente pelo INTIC). [REQUIRES LEGAL REVIEW]', { tamanho: 8, cor: CINZA, espacoDepois: 10 })

  // ── Verificação (QR + hash) ──
  fluxo.linhaHorizontal()
  fluxo.titulo('Verificação de Autenticidade', 11)
  fluxo.garantirEspaco(90)
  const qrDataUrl = await QRCode.toDataURL(params.urlVerificacao, { margin: 1, width: 220 })
  const qrPng = await doc.embedPng(Buffer.from(qrDataUrl.split(',')[1], 'base64'))
  const qrTam = 80
  fluxo.page.drawImage(qrPng, { x: MARGIN, y: fluxo.y - qrTam, width: qrTam, height: qrTam })
  const textoX = MARGIN + qrTam + 14
  const textoW = PAGE_W - MARGIN - textoX
  const yInicial = fluxo.y
  fluxo.page.drawText('Verifica este contrato em:', { x: textoX, y: yInicial - 12, size: 8.5, font: fonte, color: CINZA })
  fluxo.page.drawText(params.urlVerificacao, { x: textoX, y: yInicial - 25, size: 8, font: fonte, color: AZUL, maxWidth: textoW })
  fluxo.page.drawText('Hash de integridade do conteúdo (SHA-256):', { x: textoX, y: yInicial - 42, size: 8.5, font: fonte, color: CINZA })
  fluxo.page.drawText(params.conteudoHash, { x: textoX, y: yInicial - 55, size: 7, font: fonte, color: PRETO, maxWidth: textoW })
  fluxo.y -= qrTam + 10

  // ── Rodapé em todas as páginas (número de páginas só se sabe no fim) ──
  const total = fluxo.paginas.length
  fluxo.paginas.forEach((pg, i) => {
    pg.drawLine({ start: { x: MARGIN, y: FOOTER_H + 12 }, end: { x: PAGE_W - MARGIN, y: FOOTER_H + 12 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
    pg.drawText(`SonhoEuropa · Contrato ${params.numero} · Versão ${params.versaoPdf}`, { x: MARGIN, y: FOOTER_H, size: 7, font: fonte, color: CINZA_CLARO })
    pg.drawText(`Página ${i + 1} de ${total}`, { x: PAGE_W - MARGIN - 70, y: FOOTER_H, size: 7, font: fonte, color: CINZA_CLARO })
  })

  const bytes = await doc.save()
  return { bytes, paginas: total }
}
