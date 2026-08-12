'use server'

import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registarAuditoria } from '@/lib/auditoria'
import { gerarContratoPdf, type ClausulaTemplate, type DadosContrato } from '@/lib/contrato-pdf'
import { calcularConteudoHash, calcularHashBytes } from '@/lib/contrato-hash'

const NASCIMENTO_RE = /^\d{4}-\d{2}-\d{2}$/
const NUIT_RE = /^\d{9}$/

function sanitize(s: string): string {
  return (s ?? '').replace(/<[^>]*>/g, '').trim()
}

function idadeEmAnos(nascimentoIso: string): number {
  const nascimento = new Date(nascimentoIso + 'T00:00:00Z')
  const hoje = new Date()
  let idade = hoje.getUTCFullYear() - nascimento.getUTCFullYear()
  const aindaNaoFezAnos = (hoje.getUTCMonth() < nascimento.getUTCMonth()) ||
    (hoje.getUTCMonth() === nascimento.getUTCMonth() && hoje.getUTCDate() < nascimento.getUTCDate())
  if (aindaNaoFezAnos) idade--
  return idade
}

function gerarNumeroContrato(): string {
  const ano = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Maputo', year: 'numeric' }).format(new Date())
  const sufixo = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `CT${ano}${sufixo}`
}

// ─── Utilizador: submissão dos dados do contrato ────────────────────────────

export async function getMeuContrato() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('contratos')
    .select('id, numero, estado, dados, pdf_paginas, pdf_versao, consentimento_dados_at, declaracao_veracidade_at, aceitacao_termos_at, assinado_at, rejeitado_motivo, created_at')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

// Conteúdo completo para o utilizador ler antes de assinar — só acessível
// enquanto o contrato está a aguardar assinatura e pertence ao próprio.
export async function getContratoParaAssinatura(contratoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const carregado = await carregarContratoDoUtilizador(contratoId, user.id)
  if ('error' in carregado) return null
  const { contrato } = carregado
  if (contrato.estado !== 'a_aguardar_assinatura') return null

  const admin = createAdminClient()
  const { data: template } = await admin.from('contrato_templates')
    .select('nome, versao, clausulas').eq('id', contrato.template_id).single()
  if (!template) return null

  return {
    id: contrato.id,
    numero: contrato.numero,
    dados: contrato.dados as DadosContrato,
    consentimentoDadosAt: contrato.consentimento_dados_at as string | null,
    declaracaoVeracidadeAt: contrato.declaracao_veracidade_at as string | null,
    aceitacaoTermosAt: contrato.aceitacao_termos_at as string | null,
    templateNome: template.nome as string,
    templateVersao: template.versao as number,
    clausulas: template.clausulas as ClausulaTemplate[],
  }
}

export async function submeterDadosContrato(dados: {
  nascimento: string
  nacionalidade: string
  biValidade: string
  nuit?: string
  morada: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data: usuario } = await admin.from('usuarios')
    .select('nome, email, telefone, bi_numero, verificado')
    .eq('id', user.id).single()
  if (!usuario) return { error: 'Perfil não encontrado' }
  if (!usuario.verificado) return { error: 'A tua identidade ainda não foi verificada' }
  if (!usuario.bi_numero) return { error: 'O número do teu BI ainda não foi confirmado pelo administrador' }

  const nascimento = (dados.nascimento ?? '').trim()
  const nacionalidade = sanitize(dados.nacionalidade).slice(0, 60)
  const biValidade = (dados.biValidade ?? '').trim()
  const nuit = sanitize(dados.nuit ?? '')
  const morada = sanitize(dados.morada).slice(0, 200)

  if (!NASCIMENTO_RE.test(nascimento)) return { error: 'Data de nascimento inválida' }
  const idade = idadeEmAnos(nascimento)
  if (idade < 18) return { error: 'É necessário ter pelo menos 18 anos para participar' }
  if (idade > 110) return { error: 'Data de nascimento inválida' }
  if (nacionalidade.length < 2) return { error: 'Nacionalidade é obrigatória' }
  if (!NASCIMENTO_RE.test(biValidade)) return { error: 'Data de validade do BI inválida' }
  if (new Date(biValidade + 'T00:00:00Z').getTime() < Date.now()) return { error: 'O teu BI está caducado — actualiza o documento antes de continuar' }
  if (nuit && !NUIT_RE.test(nuit)) return { error: 'NUIT inválido (deve ter 9 dígitos)' }
  if (morada.length < 5) return { error: 'Morada é obrigatória' }

  // Só pode haver um contrato "em curso" de cada vez — um rejeitado pode ser
  // corrigido e reenviado, mas um pendente/aprovado/assinado não é substituído.
  const { data: existente } = await admin.from('contratos')
    .select('estado').eq('usuario_id', user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existente && existente.estado !== 'rejeitado') {
    return { error: 'Já tens um contrato em curso' }
  }

  const { data: template } = await admin.from('contrato_templates')
    .select('id, versao').eq('codigo', 'participacao_fundo_v1').eq('activo', true).maybeSingle()
  if (!template) return { error: 'Modelo de contrato indisponível. Contacta o suporte.' }

  const dadosSnapshot: DadosContrato = {
    nome: usuario.nome,
    nascimento,
    nacionalidade,
    biNumero: usuario.bi_numero,
    biValidade,
    nuit: nuit || null,
    telefone: usuario.telefone,
    email: usuario.email,
    morada,
  }

  let numero = gerarNumeroContrato()
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { data: colisao } = await admin.from('contratos').select('id').eq('numero', numero).maybeSingle()
    if (!colisao) break
    numero = gerarNumeroContrato()
  }

  const { data: novo, error } = await admin.from('contratos').insert({
    numero,
    usuario_id: user.id,
    template_id: template.id,
    template_versao: template.versao,
    dados: dadosSnapshot,
    estado: 'pendente',
  }).select('id, numero').single()

  if (error) return { error: error.message }

  registarAuditoria({ usuarioId: user.id, contratoId: novo.id, evento: 'contrato_dados_submetidos', detalhes: { numero: novo.numero } })
  return { success: true, numero: novo.numero }
}

// ─── Utilizador: consentimento e assinatura ─────────────────────────────────

type TipoConsentimento = 'dados' | 'veracidade' | 'termos'

const COLUNA_CONSENTIMENTO: Record<TipoConsentimento, string> = {
  dados: 'consentimento_dados_at',
  veracidade: 'declaracao_veracidade_at',
  termos: 'aceitacao_termos_at',
}

async function carregarContratoDoUtilizador(contratoId: string, userId: string) {
  const admin = createAdminClient()
  const { data: contrato } = await admin.from('contratos').select('*').eq('id', contratoId).maybeSingle()
  if (!contrato) return { error: 'Contrato não encontrado' } as const
  if (contrato.usuario_id !== userId) return { error: 'Sem permissão' } as const
  return { contrato } as const
}

export async function registarConsentimento(contratoId: string, tipo: TipoConsentimento) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const carregado = await carregarContratoDoUtilizador(contratoId, user.id)
  if ('error' in carregado) return carregado
  const { contrato } = carregado
  if (contrato.estado !== 'a_aguardar_assinatura') return { error: 'Este contrato não está a aguardar assinatura' }

  // Ordem obrigatória: dados → veracidade → termos, cada um só depois do anterior.
  const ordem: TipoConsentimento[] = ['dados', 'veracidade', 'termos']
  const indice = ordem.indexOf(tipo)
  for (let i = 0; i < indice; i++) {
    if (!contrato[COLUNA_CONSENTIMENTO[ordem[i]]]) return { error: 'Confirma os passos anteriores primeiro' }
  }

  const admin = createAdminClient()
  const agora = new Date().toISOString()
  const { error } = await admin.from('contratos')
    .update({ [COLUNA_CONSENTIMENTO[tipo]]: agora, updated_at: agora })
    .eq('id', contratoId)
  if (error) return { error: error.message }

  const evento = tipo === 'dados' ? 'consentimento_dados' : tipo === 'veracidade' ? 'declaracao_veracidade' : 'termos_aceites'
  registarAuditoria({ usuarioId: user.id, contratoId, evento })
  return { success: true }
}

export async function enviarCodigoAssinatura(contratoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'Não autenticado' }

  const carregado = await carregarContratoDoUtilizador(contratoId, user.id)
  if ('error' in carregado) return carregado
  const { contrato } = carregado
  if (contrato.estado !== 'a_aguardar_assinatura') return { error: 'Este contrato não está a aguardar assinatura' }
  if (!contrato.consentimento_dados_at || !contrato.declaracao_veracidade_at || !contrato.aceitacao_termos_at) {
    return { error: 'Confirma o consentimento, a veracidade e os termos antes de assinar' }
  }

  // Reaproveita o OTP de email do próprio Supabase Auth como mecanismo de
  // autenticação forte no momento de assinar — sem depender de nenhum
  // serviço de SMS/email adicional. shouldCreateUser:false porque a conta
  // já existe; isto é apenas um passo de reautenticação.
  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  })
  if (error) return { error: 'Não foi possível enviar o código. Tenta novamente.' }
  return { success: true }
}

export async function confirmarAssinatura(contratoId: string, codigo: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'Não autenticado' }

  const carregado = await carregarContratoDoUtilizador(contratoId, user.id)
  if ('error' in carregado) return carregado
  const { contrato } = carregado
  if (contrato.estado !== 'a_aguardar_assinatura') return { error: 'Este contrato não está a aguardar assinatura' }
  if (!contrato.consentimento_dados_at || !contrato.declaracao_veracidade_at || !contrato.aceitacao_termos_at) {
    return { error: 'Confirma o consentimento, a veracidade e os termos antes de assinar' }
  }

  const codigoLimpo = (codigo ?? '').trim()
  if (!/^\d{6}$/.test(codigoLimpo)) return { error: 'Código inválido — introduz os 6 dígitos recebidos por email' }

  const { error: otpError } = await supabase.auth.verifyOtp({
    email: user.email,
    token: codigoLimpo,
    type: 'email',
  })
  if (otpError) return { error: 'Código incorrecto ou expirado. Pede um novo código.' }

  const admin = createAdminClient()
  const { data: template } = await admin.from('contrato_templates').select('nome, versao, clausulas').eq('id', contrato.template_id).single()
  if (!template) return { error: 'Modelo de contrato indisponível' }

  const agora = new Date()
  const dados = contrato.dados as DadosContrato
  const clausulas = template.clausulas as ClausulaTemplate[]

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  const urlVerificacao = `${siteUrl}/verificar-contrato/${contrato.numero}`

  const conteudoHash = calcularConteudoHash({
    numero: contrato.numero,
    templateVersao: contrato.template_versao,
    dados,
    clausulas: clausulas.map((c) => ({ id: c.id, titulo: c.titulo, corpo: c.corpo })),
    consentimentoDadosAt: contrato.consentimento_dados_at,
    declaracaoVeracidadeAt: contrato.declaracao_veracidade_at,
    aceitacaoTermosAt: contrato.aceitacao_termos_at,
    assinadoAt: agora.toISOString(),
  })

  // Fotografia do participante (selfie) — se já tiver expirado (24h), o
  // contrato é gerado sem foto em vez de falhar a assinatura.
  const { data: verificacao } = await admin.from('verificacoes')
    .select('selfie_imagem_path').eq('usuario_id', user.id).eq('status', 'aprovado')
    .order('criado_em', { ascending: false }).limit(1).maybeSingle()

  let selfieBytes: Uint8Array | null = null
  let selfieTipo: 'image/jpeg' | 'image/png' | null = null
  if (verificacao?.selfie_imagem_path) {
    const { data: ficheiro } = await admin.storage.from('verificacoes').download(verificacao.selfie_imagem_path)
    if (ficheiro) {
      selfieBytes = new Uint8Array(await ficheiro.arrayBuffer())
      selfieTipo = verificacao.selfie_imagem_path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    }
  }

  const { bytes, paginas } = await gerarContratoPdf({
    numero: contrato.numero,
    versaoTemplate: contrato.template_versao,
    versaoPdf: contrato.pdf_versao,
    templateNome: template.nome,
    clausulas,
    dados,
    criadoEm: new Date(contrato.created_at),
    assinadoEm: agora,
    consentimentoDadosEm: new Date(contrato.consentimento_dados_at),
    declaracaoVeracidadeEm: new Date(contrato.declaracao_veracidade_at),
    aceitacaoTermosEm: new Date(contrato.aceitacao_termos_at),
    selfieBytes,
    selfieTipo,
    conteudoHash,
    urlVerificacao,
  })

  const pdfPath = `${user.id}/contrato-${contrato.numero}-v${contrato.pdf_versao}.pdf`
  const { error: upErro } = await admin.storage.from('contratos').upload(pdfPath, bytes, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (upErro) return { error: 'Erro ao guardar o contrato: ' + upErro.message }

  const pdfHash = calcularHashBytes(bytes)

  const { error: updErro } = await admin.from('contratos').update({
    estado: 'assinado',
    assinado_at: agora.toISOString(),
    finalizado_at: agora.toISOString(),
    pdf_path: pdfPath,
    conteudo_hash: conteudoHash,
    pdf_hash: pdfHash,
    pdf_paginas: paginas,
    updated_at: agora.toISOString(),
  }).eq('id', contratoId)
  if (updErro) return { error: updErro.message }

  registarAuditoria({ usuarioId: user.id, contratoId, evento: 'contrato_gerado', detalhes: { paginas, pdf_hash: pdfHash } })
  registarAuditoria({ usuarioId: user.id, contratoId, evento: 'assinado' })
  return { success: true }
}

export async function getMeuContratoDownload(contratoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const carregado = await carregarContratoDoUtilizador(contratoId, user.id)
  if ('error' in carregado) return carregado
  const { contrato } = carregado
  if (!contrato.pdf_path || !['assinado', 'finalizado'].includes(contrato.estado)) {
    return { error: 'O contrato ainda não está disponível para download' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('contratos').createSignedUrl(contrato.pdf_path, 300, { download: true })
  if (error || !data) return { error: 'Não foi possível gerar o link de download' }

  registarAuditoria({ usuarioId: user.id, contratoId, evento: 'pdf_descarregado', detalhes: { por: 'utilizador' } })
  return { success: true, url: data.signedUrl }
}
