import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

// ─── Geração do PDF do contrato ─────────────────────────────────────────────
// Documento construído "à mão" com pdf-lib (sem motor de layout automático),
// por isso este módulo implementa o próprio fluxo de texto, justificação e
// paginação. Gera primeiro o conteúdo, só no fim escreve "Página X de N" em
// todas as páginas (o total só é conhecido depois de tudo desenhado).

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
const MARGIN = 54
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_H = 34
const CONTENT_BOTTOM = FOOTER_H + 22

const AZUL = rgb(0, 0.2, 0.6)
const AZUL_CLARO = rgb(0.91, 0.94, 0.98)
const CINZA = rgb(0.4, 0.4, 0.42)
const CINZA_CLARO = rgb(0.58, 0.58, 0.6)
const CINZA_LINHA = rgb(0.82, 0.82, 0.84)
const VERMELHO = rgb(0.72, 0.14, 0.1)
const VERDE = rgb(0.11, 0.5, 0.35)
const PRETO = rgb(0.09, 0.09, 0.11)
const BRANCO = rgb(1, 1, 1)

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

// Numeração formal das cláusulas por extenso ("CLÁUSULA PRIMEIRA", ...),
// como é convenção em contratos de língua portuguesa. Acima de 20 cláusulas
// (improvável nesta minuta) cai-se para o numeral ordinal.
const ORDINAIS_FEM = [
  '', 'PRIMEIRA', 'SEGUNDA', 'TERCEIRA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA', 'OITAVA', 'NONA', 'DÉCIMA',
  'DÉCIMA PRIMEIRA', 'DÉCIMA SEGUNDA', 'DÉCIMA TERCEIRA', 'DÉCIMA QUARTA', 'DÉCIMA QUINTA',
  'DÉCIMA SEXTA', 'DÉCIMA SÉTIMA', 'DÉCIMA OITAVA', 'DÉCIMA NONA', 'VIGÉSIMA',
]

function ordinalClausula(n: number): string {
  return ORDINAIS_FEM[n] ?? `N.º ${n}`
}

// pdf-lib's PDFFont.widthOfTextAtSize() subtracts AFM kerning-pair adjustments
// between adjacent letters, but drawText() only ever emits a plain Tj (no
// per-glyph TJ offsets), which never applies that kerning. For words with
// kerning pairs (e.g. "PARTICIPANTE") this makes widthOfTextAtSize() report a
// width narrower than what's actually drawn, so any positioning derived from
// it (right/centre alignment, justification, next-word x) lands short — in
// the worst case overlapping the next run entirely. Summing single-character
// widths sidesteps this, since a lone character can never form a kerning pair.
function largura(fonte: PDFFont, texto: string, tamanho: number): number {
  let total = 0
  for (const ch of texto) total += fonte.widthOfTextAtSize(ch, tamanho)
  return total
}

/** Uma linha já quebrada, como lista de palavras — unidade mínima de desenho. */
type LinhaPalavras = string[]

class Fluxo {
  doc: PDFDocument
  serif: PDFFont
  serifNegrito: PDFFont
  serifItalico: PDFFont
  page!: PDFPage
  y = 0
  paginas: PDFPage[] = []

  constructor(doc: PDFDocument, serif: PDFFont, serifNegrito: PDFFont, serifItalico: PDFFont) {
    this.doc = doc
    this.serif = serif
    this.serifNegrito = serifNegrito
    this.serifItalico = serifItalico
  }

  novaPagina() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.paginas.push(this.page)
    this.y = PAGE_H - MARGIN
  }

  garantirEspaco(altura: number) {
    if (this.y - altura < CONTENT_BOTTOM) this.novaPagina()
  }

  // ── Quebra de linha por largura, preservando as palavras de cada linha ──
  private quebrarEmLinhas(texto: string, fonte: PDFFont, tamanho: number, larguraMax: number): LinhaPalavras[] {
    const linhas: LinhaPalavras[] = []
    const palavras = texto.split(/\s+/).filter(Boolean)
    let atual: string[] = []
    for (const palavra of palavras) {
      const teste = [...atual, palavra].join(' ')
      if (largura(fonte, teste, tamanho) > larguraMax && atual.length) {
        linhas.push(atual)
        atual = [palavra]
      } else {
        atual.push(palavra)
      }
    }
    if (atual.length) linhas.push(atual)
    return linhas
  }

  // ── Desenha uma única linha de palavras, opcionalmente justificada ──
  private desenharLinha(palavras: LinhaPalavras, opts: {
    x: number; y: number; fonte: PDFFont; tamanho: number; cor: ReturnType<typeof rgb>
    larguraAlvo: number; justificar: boolean
  }) {
    const { x, y, fonte, tamanho, cor, larguraAlvo, justificar } = opts
    const texto = palavras.join(' ')

    if (!justificar || palavras.length === 1) {
      this.page.drawText(texto, { x, y, size: tamanho, font: fonte, color: cor })
      return
    }

    const larguraPalavras = palavras.reduce((s, p) => s + largura(fonte, p, tamanho), 0)
    const espacoNormal = largura(fonte, ' ', tamanho)
    const espacoEntre = (larguraAlvo - larguraPalavras) / (palavras.length - 1)

    // Se a justificação exigir espaços demasiado esticados ou negativos
    // (linha quase a encher a largura), cai-se para alinhamento simples.
    if (espacoEntre < espacoNormal * 0.5 || espacoEntre > espacoNormal * 3.5) {
      this.page.drawText(texto, { x, y, size: tamanho, font: fonte, color: cor })
      return
    }

    let cx = x
    palavras.forEach((palavra) => {
      this.page.drawText(palavra, { x: cx, y, size: tamanho, font: fonte, color: cor })
      cx += largura(fonte, palavra, tamanho) + espacoEntre
    })
  }

  /** Texto de corpo — um ou mais parágrafos (separados por \n), justificados, a última linha de cada alinhada à esquerda. */
  corpo(texto: string, opts: {
    tamanho?: number; cor?: ReturnType<typeof rgb>; espacoDepois?: number
    larguraMax?: number; x?: number; justificar?: boolean; entrelinha?: number
  } = {}) {
    const tamanho = opts.tamanho ?? 10
    const cor = opts.cor ?? PRETO
    const x = opts.x ?? MARGIN
    const larguraMax = opts.larguraMax ?? CONTENT_W
    const justificar = opts.justificar ?? true
    const altLinha = tamanho * (opts.entrelinha ?? 1.5)

    const paragrafos = texto.split('\n')
    paragrafos.forEach((paragrafoTexto, i) => {
      if (paragrafoTexto.trim() === '') {
        this.garantirEspaco(altLinha * 0.6)
        this.y -= altLinha * 0.6
        return
      }
      const linhas = this.quebrarEmLinhas(paragrafoTexto, this.serif, tamanho, larguraMax)
      linhas.forEach((linha, j) => {
        this.garantirEspaco(altLinha)
        const ehUltima = j === linhas.length - 1
        this.desenharLinha(linha, {
          x, y: this.y - tamanho, fonte: this.serif, tamanho, cor,
          larguraAlvo: larguraMax, justificar: justificar && !ehUltima,
        })
        this.y -= altLinha
      })
      if (i < paragrafos.length - 1) this.y -= altLinha * 0.25
    })
    this.y -= opts.espacoDepois ?? 4
  }

  /** Linha curta simples (rótulos, metadados) — nunca justificada. */
  linha(texto: string, opts: {
    tamanho?: number; negrito?: boolean; italico?: boolean; cor?: ReturnType<typeof rgb>
    espacoDepois?: number; larguraMax?: number; x?: number
  } = {}) {
    const tamanho = opts.tamanho ?? 9.5
    const fonte = opts.italico ? this.serifItalico : opts.negrito ? this.serifNegrito : this.serif
    const cor = opts.cor ?? PRETO
    const x = opts.x ?? MARGIN
    const larguraMax = opts.larguraMax ?? CONTENT_W
    const altLinha = tamanho * 1.4

    for (const linha of this.quebrarEmLinhas(texto, fonte, tamanho, larguraMax)) {
      this.garantirEspaco(altLinha)
      this.page.drawText(linha.join(' '), { x, y: this.y - tamanho, size: tamanho, font: fonte, color: cor })
      this.y -= altLinha
    }
    this.y -= opts.espacoDepois ?? 4
  }

  tituloSeccao(texto: string) {
    this.garantirEspaco(34)
    this.page.drawText(texto.toUpperCase(), { x: MARGIN, y: this.y - 11.3, size: 11.5, font: this.serifNegrito, color: AZUL })
    this.y -= 17
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 1, color: AZUL })
    this.y -= 12
  }

  /** Assegura que um título de cláusula nunca fica sozinho no fundo da página, sem corpo a seguir. */
  garantirEspacoParaCabecalho(linhasSeguintes: number, tamanhoCorpo: number) {
    this.garantirEspaco(40 + linhasSeguintes * tamanhoCorpo * 1.5)
  }

  espaco(altura: number) {
    this.y -= altura
  }

  linhaHorizontal(cor = CINZA_LINHA) {
    this.garantirEspaco(10)
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.75, color: cor })
    this.y -= 12
  }

  /** Contagem de linhas que um texto vai ocupar, sem desenhar — para dimensionar caixas antecipadamente. */
  contarLinhas(texto: string, fonte: PDFFont, tamanho: number, larguraMax: number): number {
    return texto.split('\n').reduce((total, p) => total + Math.max(1, this.quebrarEmLinhas(p, fonte, tamanho, larguraMax).length), 0)
  }

  checklistItem(texto: string, marcado: boolean, quando: Date | null) {
    const tamanho = 9.3
    const altLinha = tamanho * 1.5
    const caixa = 9
    const larguraTexto = CONTENT_W - caixa - 8
    const linhas = this.quebrarEmLinhas(texto, this.serif, tamanho, larguraTexto)

    this.garantirEspaco(altLinha * linhas.length + 3)
    const yCaixa = this.y - caixa - 1
    this.page.drawRectangle({
      x: MARGIN, y: yCaixa, width: caixa, height: caixa,
      color: marcado ? VERDE : BRANCO, borderColor: marcado ? VERDE : CINZA_LINHA, borderWidth: 1,
    })
    if (marcado) {
      this.page.drawLine({ start: { x: MARGIN + 2, y: yCaixa + 4.5 }, end: { x: MARGIN + 3.8, y: yCaixa + 2.3 }, thickness: 1.2, color: BRANCO })
      this.page.drawLine({ start: { x: MARGIN + 3.8, y: yCaixa + 2.3 }, end: { x: MARGIN + 7.2, y: yCaixa + 7 }, thickness: 1.2, color: BRANCO })
    }

    linhas.forEach((linha) => {
      this.page.drawText(linha.join(' '), { x: MARGIN + caixa + 8, y: this.y - tamanho, size: tamanho, font: this.serif, color: PRETO })
      this.y -= altLinha
    })
    if (quando) {
      this.page.drawText(`Confirmado em ${formatarDataHora(quando)}`, {
        x: MARGIN + caixa + 8, y: this.y - 8, size: 7.8, font: this.serifItalico, color: CINZA_CLARO,
      })
      this.y -= 12
    } else {
      this.y -= 3
    }
  }
}

export async function gerarContratoPdf(params: GerarContratoParams): Promise<{ bytes: Uint8Array; paginas: number }> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Contrato ${params.numero} — SonhoEuropa`)
  doc.setProducer('SonhoEuropa — Sistema de Contratos')
  doc.setAuthor('SonhoEuropa')
  doc.setCreationDate(params.criadoEm)

  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const serifNegrito = await doc.embedFont(StandardFonts.TimesRomanBold)
  const serifItalico = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const marca = await doc.embedFont(StandardFonts.HelveticaBold)
  const mono = await doc.embedFont(StandardFonts.Courier)
  const fluxo = new Fluxo(doc, serif, serifNegrito, serifItalico)
  fluxo.novaPagina()
  const d = params.dados

  // ── Cabeçalho / timbre ──
  const CAB_H = 46
  fluxo.page.drawRectangle({ x: MARGIN, y: fluxo.y - CAB_H, width: CONTENT_W, height: CAB_H, color: AZUL_CLARO, borderColor: AZUL, borderWidth: 1 })
  fluxo.page.drawText('SONHOEUROPA', { x: MARGIN + 14, y: fluxo.y - 20, size: 14, font: marca, color: AZUL })
  fluxo.page.drawText('Sistema de Contratos Digitais', { x: MARGIN + 14, y: fluxo.y - 33, size: 7.5, font: serif, color: CINZA })
  const numeroTxt = `Contrato N.º ${params.numero}`
  const numeroW = largura(serifNegrito, numeroTxt, 10.5)
  fluxo.page.drawText(numeroTxt, { x: PAGE_W - MARGIN - 14 - numeroW, y: fluxo.y - 20, size: 10.5, font: serifNegrito, color: AZUL })
  const versaoTxt = `Documento v${params.versaoPdf} · Modelo ${params.templateNome} (v${params.versaoTemplate})`
  const versaoW = largura(serif, versaoTxt, 7.8)
  fluxo.page.drawText(versaoTxt, { x: PAGE_W - MARGIN - 14 - versaoW, y: fluxo.y - 33, size: 7.8, font: serif, color: CINZA })
  fluxo.y -= CAB_H + 20

  const titulo = 'CONTRATO DE PARTICIPAÇÃO NO FUNDO COMUNITÁRIO'
  const tituloW = largura(serifNegrito, titulo, 15.5)
  fluxo.page.drawText(titulo, { x: (PAGE_W - tituloW) / 2, y: fluxo.y - 15.5, size: 15.5, font: serifNegrito, color: AZUL })
  fluxo.y -= 22
  const emitido = `Emitido em ${formatarDataHora(params.criadoEm)}`
  const emitidoW = largura(serif, emitido, 8.5)
  fluxo.page.drawText(emitido, { x: (PAGE_W - emitidoW) / 2, y: fluxo.y - 8.5, size: 8.5, font: serifItalico, color: CINZA })
  fluxo.y -= 22

  // ── Aviso de revisão jurídica ──
  fluxo.garantirEspaco(26)
  fluxo.page.drawRectangle({ x: MARGIN, y: fluxo.y - 22, width: CONTENT_W, height: 22, color: rgb(0.99, 0.95, 0.9), borderColor: rgb(0.85, 0.6, 0.2), borderWidth: 0.75 })
  fluxo.page.drawText('AVISO', { x: MARGIN + 8, y: fluxo.y - 14.5, size: 7.5, font: serifNegrito, color: VERMELHO })
  fluxo.linha('Este documento contém cláusulas geradas a partir de uma minuta genérica que aguardam validação por advogado licenciado em Moçambique. As cláusulas assinaladas estão sujeitas a revisão jurídica.', {
    tamanho: 7.8, cor: VERMELHO, x: MARGIN + 42, larguraMax: CONTENT_W - 50, espacoDepois: 0,
  })
  fluxo.y -= 18

  // ── Identificação das partes ──
  fluxo.tituloSeccao('Identificação das Partes')

  // Primeiro outorgante
  fluxo.linha('PRIMEIRO OUTORGANTE  ·  O GESTOR DO FUNDO', { tamanho: 8.3, negrito: true, cor: AZUL, espacoDepois: 3 })
  fluxo.corpo('Fredson Bernardo Muianga, responsável pela gestão da plataforma SonhoEuropa. [REQUIRES LEGAL REVIEW: confirmar a forma jurídica exacta do GESTOR — pessoa singular ou entidade colectiva a constituir — e os respectivos dados de identificação fiscal.]', {
    tamanho: 9, cor: CINZA, espacoDepois: 10,
  })

  // Segundo outorgante — grelha de dois campos por linha
  fluxo.linha('SEGUNDO OUTORGANTE  ·  O PARTICIPANTE', { tamanho: 8.3, negrito: true, cor: AZUL, espacoDepois: 6 })

  const campos: [string, string][] = [
    ['Nome completo', d.nome],
    ['Data de nascimento', formatarData(d.nascimento)],
    ['Nacionalidade', d.nacionalidade],
    ['Bilhete de Identidade n.º', d.biNumero],
    ['Validade do BI', formatarData(d.biValidade)],
    ['NUIT', d.nuit || '— não fornecido —'],
    ['Telefone', d.telefone],
    ['Email', d.email],
  ]
  const COL_W = CONTENT_W / 2
  const LINHA_CAMPO_H = 27
  const linhasGrelha = Math.ceil(campos.length / 2)
  fluxo.garantirEspaco(linhasGrelha * LINHA_CAMPO_H + 10)
  const grelhaTopo = fluxo.y
  fluxo.page.drawRectangle({ x: MARGIN, y: grelhaTopo - linhasGrelha * LINHA_CAMPO_H, width: CONTENT_W, height: linhasGrelha * LINHA_CAMPO_H, borderColor: CINZA_LINHA, borderWidth: 0.75 })
  for (let i = 1; i < linhasGrelha; i++) {
    fluxo.page.drawLine({ start: { x: MARGIN, y: grelhaTopo - i * LINHA_CAMPO_H }, end: { x: PAGE_W - MARGIN, y: grelhaTopo - i * LINHA_CAMPO_H }, thickness: 0.5, color: CINZA_LINHA })
  }
  fluxo.page.drawLine({ start: { x: MARGIN + COL_W, y: grelhaTopo }, end: { x: MARGIN + COL_W, y: grelhaTopo - linhasGrelha * LINHA_CAMPO_H }, thickness: 0.5, color: CINZA_LINHA })
  campos.forEach(([label, valor], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = MARGIN + col * COL_W + 10
    const yTopo = grelhaTopo - row * LINHA_CAMPO_H
    fluxo.page.drawText(label.toUpperCase(), { x, y: yTopo - 10, size: 6.8, font: serifNegrito, color: CINZA_CLARO })
    fluxo.page.drawText(valor, { x, y: yTopo - 21, size: 9.5, font: serif, color: PRETO, maxWidth: COL_W - 20 })
  })
  fluxo.y = grelhaTopo - linhasGrelha * LINHA_CAMPO_H - 6
  fluxo.linha('Morada', { tamanho: 6.8, negrito: true, cor: CINZA_CLARO, espacoDepois: 1 })
  fluxo.linha(d.morada, { tamanho: 9.5, cor: PRETO, espacoDepois: 10 })

  // Fotografia do participante, junto à identificação
  if (params.selfieBytes && params.selfieTipo) {
    try {
      const img = params.selfieTipo === 'image/png'
        ? await doc.embedPng(params.selfieBytes)
        : await doc.embedJpg(params.selfieBytes)
      const alturaFoto = 86
      const larguraFoto = (img.width / img.height) * alturaFoto
      fluxo.garantirEspaco(alturaFoto + 16)
      fluxo.page.drawRectangle({ x: MARGIN - 2, y: fluxo.y - alturaFoto - 2, width: larguraFoto + 4, height: alturaFoto + 4, borderColor: CINZA_LINHA, borderWidth: 1 })
      fluxo.page.drawImage(img, { x: MARGIN, y: fluxo.y - alturaFoto, width: larguraFoto, height: alturaFoto })
      fluxo.y -= alturaFoto + 8
      fluxo.linha('Fotografia do participante (selfie submetida no processo de verificação de identidade)', { tamanho: 7.3, italico: true, cor: CINZA_CLARO, espacoDepois: 10 })
    } catch {
      fluxo.linha('[Fotografia do participante indisponível]', { tamanho: 8, cor: CINZA, espacoDepois: 10 })
    }
  }

  // ── Cláusulas ──
  params.clausulas.forEach((clausula, i) => {
    const numero = i + 1
    const corpoLinhas = fluxo.contarLinhas(clausula.corpo, serif, 9.8, CONTENT_W)
    fluxo.garantirEspacoParaCabecalho(Math.min(corpoLinhas, 3), 9.8)

    const cabecalho = `CLÁUSULA ${ordinalClausula(numero)}`
    fluxo.page.drawText(cabecalho, { x: MARGIN, y: fluxo.y - 12, size: 11.5, font: serifNegrito, color: AZUL })
    if (clausula.requires_legal_review) {
      const tagTxt = 'REQUER REVISÃO JURÍDICA'
      const tagW = largura(serifNegrito, tagTxt, 7)
      fluxo.page.drawRectangle({ x: PAGE_W - MARGIN - tagW - 10, y: fluxo.y - 14.5, width: tagW + 10, height: 13, color: rgb(0.99, 0.93, 0.92), borderColor: VERMELHO, borderWidth: 0.6 })
      fluxo.page.drawText(tagTxt, { x: PAGE_W - MARGIN - tagW - 5, y: fluxo.y - 11.5, size: 7, font: serifNegrito, color: VERMELHO })
    }
    fluxo.y -= 16
    if (clausula.titulo) {
      fluxo.page.drawText(`(${clausula.titulo})`, { x: MARGIN, y: fluxo.y - 10.5, size: 9.7, font: serifItalico, color: CINZA })
      fluxo.y -= 16
    }
    fluxo.corpo(clausula.corpo, { tamanho: 9.8, espacoDepois: 14 })
  })

  fluxo.linhaHorizontal()

  // ── Consentimento e assinatura ──
  fluxo.tituloSeccao('Consentimento e Assinatura Electrónica')
  fluxo.checklistItem('Consentimento para o tratamento de dados pessoais para os fins deste contrato', !!params.consentimentoDadosEm, params.consentimentoDadosEm)
  fluxo.checklistItem('Declaração de veracidade de todas as informações fornecidas', !!params.declaracaoVeracidadeEm, params.declaracaoVeracidadeEm)
  fluxo.checklistItem('Aceitação integral dos termos e cláusulas deste contrato', !!params.aceitacaoTermosEm, params.aceitacaoTermosEm)
  fluxo.checklistItem('Assinatura electrónica, com autenticação forte por código único enviado por email', !!params.assinadoEm, params.assinadoEm)
  fluxo.espaco(4)
  fluxo.corpo('A assinatura acima constitui uma assinatura electrónica com autenticação forte (código de uso único enviado ao email registado do PARTICIPANTE). Não se trata de uma assinatura digital certificada por entidade certificadora reconhecida em Moçambique, nomeadamente pelo INTIC. [REQUIRES LEGAL REVIEW]', {
    tamanho: 8.3, cor: CINZA, espacoDepois: 14,
  })

  // ── Bloco de assinaturas ──
  const ASSIN_H = 64
  const ASSIN_GAP = 16
  const ASSIN_W = (CONTENT_W - ASSIN_GAP) / 2
  fluxo.garantirEspaco(ASSIN_H + 10)
  const assinTopo = fluxo.y
  const blocos: { titulo: string; nome: string; status: string; ok: boolean }[] = [
    { titulo: 'O GESTOR DO FUNDO', nome: 'Fredson Bernardo Muianga', status: 'Vinculado pelos Termos e Condições da plataforma SonhoEuropa', ok: true },
    {
      titulo: 'O PARTICIPANTE', nome: d.nome,
      status: params.assinadoEm ? `Assinado electronicamente em ${formatarDataHora(params.assinadoEm)}` : 'Assinatura pendente',
      ok: !!params.assinadoEm,
    },
  ]
  blocos.forEach((bloco, i) => {
    const x = MARGIN + i * (ASSIN_W + ASSIN_GAP)
    fluxo.page.drawRectangle({ x, y: assinTopo - ASSIN_H, width: ASSIN_W, height: ASSIN_H, borderColor: CINZA_LINHA, borderWidth: 0.75 })
    fluxo.page.drawRectangle({ x, y: assinTopo - 16, width: ASSIN_W, height: 16, color: AZUL_CLARO })
    fluxo.page.drawText(bloco.titulo, { x: x + 8, y: assinTopo - 11.5, size: 7.8, font: serifNegrito, color: AZUL })
    fluxo.page.drawText(bloco.nome, { x: x + 8, y: assinTopo - 32, size: 10.5, font: serifNegrito, color: PRETO, maxWidth: ASSIN_W - 16 })
    fluxo.page.drawText(bloco.status, { x: x + 8, y: assinTopo - 48, size: 7.3, font: serifItalico, color: bloco.ok ? VERDE : CINZA_CLARO, maxWidth: ASSIN_W - 16 })
  })
  fluxo.y = assinTopo - ASSIN_H - 16

  // ── Verificação (QR + hash) ──
  fluxo.tituloSeccao('Verificação de Autenticidade')
  fluxo.garantirEspaco(96)
  const qrDataUrl = await QRCode.toDataURL(params.urlVerificacao, { margin: 1, width: 220 })
  const qrPng = await doc.embedPng(Buffer.from(qrDataUrl.split(',')[1], 'base64'))
  const qrTam = 78
  const boxTopo = fluxo.y
  fluxo.page.drawRectangle({ x: MARGIN, y: boxTopo - qrTam - 12, width: CONTENT_W, height: qrTam + 12, borderColor: CINZA_LINHA, borderWidth: 0.75 })
  fluxo.page.drawImage(qrPng, { x: MARGIN + 10, y: boxTopo - qrTam - 6, width: qrTam, height: qrTam })
  const textoX = MARGIN + qrTam + 26
  const textoW = PAGE_W - MARGIN - textoX - 10
  fluxo.page.drawText('Este documento pode ser verificado em:', { x: textoX, y: boxTopo - 18, size: 8.5, font: serif, color: CINZA })
  fluxo.page.drawText(params.urlVerificacao, { x: textoX, y: boxTopo - 31, size: 8.5, font: serifNegrito, color: AZUL, maxWidth: textoW })
  fluxo.page.drawText('Hash de integridade do conteúdo (SHA-256):', { x: textoX, y: boxTopo - 50, size: 8.5, font: serif, color: CINZA })
  fluxo.page.drawText(params.conteudoHash, { x: textoX, y: boxTopo - 63, size: 6.6, font: mono, color: PRETO, maxWidth: textoW })
  fluxo.y = boxTopo - qrTam - 12 - 10

  // ── Rodapé em todas as páginas (número de páginas só se sabe no fim) ──
  const total = fluxo.paginas.length
  fluxo.paginas.forEach((pg, i) => {
    pg.drawLine({ start: { x: MARGIN, y: FOOTER_H + 12 }, end: { x: PAGE_W - MARGIN, y: FOOTER_H + 12 }, thickness: 1, color: AZUL })
    pg.drawText(`SonhoEuropa  ·  Contrato ${params.numero}  ·  Versão ${params.versaoPdf}`, { x: MARGIN, y: FOOTER_H, size: 7.3, font: serif, color: CINZA_CLARO })
    const paginaTxt = `Página ${i + 1} de ${total}`
    const paginaW = largura(serif, paginaTxt, 7.3)
    pg.drawText(paginaTxt, { x: PAGE_W - MARGIN - paginaW, y: FOOTER_H, size: 7.3, font: serif, color: CINZA_CLARO })
  })

  const bytes = await doc.save()
  return { bytes, paginas: total }
}
