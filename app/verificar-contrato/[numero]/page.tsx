import Link from 'next/link'
import { CheckCircle2, XCircle, ArrowLeft, FileText } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularConteudoHash } from '@/lib/contrato-hash'
import type { ClausulaTemplate, DadosContrato } from '@/lib/contrato-pdf'

// Página pública de verificação — acessível via o QR code impresso no PDF.
// Propositadamente NÃO expõe nome, BI, email, telefone ou morada do
// participante: só o suficiente para confirmar autenticidade do documento.

const BADGE: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Dados por rever', color: '#888' },
  em_analise: { label: 'Em análise', color: '#EF9F27' },
  a_aguardar_assinatura: { label: 'Aprovado — aguarda assinatura', color: '#7c3aed' },
  assinado: { label: 'Assinado', color: '#1D9E75' },
  finalizado: { label: 'Finalizado', color: '#1D9E75' },
  rejeitado: { label: 'Rejeitado', color: '#dc2626' },
}

function formatarData(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Africa/Maputo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso)) + ' (Maputo)'
}

async function carregarVerificacao(numero: string) {
  const admin = createAdminClient()
  const { data: contrato } = await admin
    .from('contratos')
    .select('numero, estado, template_id, template_versao, dados, pdf_versao, pdf_paginas, conteudo_hash, consentimento_dados_at, declaracao_veracidade_at, aceitacao_termos_at, assinado_at, created_at')
    .eq('numero', numero)
    .maybeSingle()

  if (!contrato) return null

  let autentico: boolean | null = null
  if (contrato.conteudo_hash) {
    const { data: template } = await admin.from('contrato_templates')
      .select('clausulas').eq('id', contrato.template_id).maybeSingle()
    if (template) {
      const clausulas = template.clausulas as ClausulaTemplate[]
      const recalculado = calcularConteudoHash({
        numero: contrato.numero,
        templateVersao: contrato.template_versao,
        dados: contrato.dados as DadosContrato,
        clausulas: clausulas.map((c) => ({ id: c.id, titulo: c.titulo, corpo: c.corpo })),
        consentimentoDadosAt: contrato.consentimento_dados_at,
        declaracaoVeracidadeAt: contrato.declaracao_veracidade_at,
        aceitacaoTermosAt: contrato.aceitacao_termos_at,
        assinadoAt: contrato.assinado_at,
      })
      autentico = recalculado === contrato.conteudo_hash
    }
  }

  return {
    numero: contrato.numero,
    estado: contrato.estado as string,
    versaoPdf: contrato.pdf_versao as number,
    paginas: contrato.pdf_paginas as number | null,
    criadoEm: contrato.created_at as string,
    assinadoEm: contrato.assinado_at as string | null,
    hash: contrato.conteudo_hash as string | null,
    autentico,
  }
}

export default async function VerificarContratoPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  const resultado = await carregarVerificacao(decodeURIComponent(numero).toUpperCase())

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12" style={{ background: 'linear-gradient(160deg, #003399 0%, #1D9E75 100%)' }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <FileText className="w-5 h-5" style={{ color: '#003399' }} />
            <p className="font-black text-sm" style={{ color: '#003399' }}>Verificação de Contrato · SonhoEuropa</p>
          </div>

          {!resultado ? (
            <div className="text-center py-6">
              <XCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="font-bold text-gray-700">Contrato não encontrado</p>
              <p className="text-sm text-gray-400 mt-1">Verifica se o número está correcto.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-3">
                {resultado.autentico === false ? (
                  <XCircle className="w-12 h-12 mx-auto mb-2 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2" style={{ color: '#1D9E75' }} />
                )}
                <p className="font-black text-lg" style={{ color: '#003399' }}>{resultado.numero}</p>
                <p className="text-sm font-semibold" style={{ color: BADGE[resultado.estado]?.color ?? '#888' }}>
                  {BADGE[resultado.estado]?.label ?? resultado.estado}
                </p>
              </div>

              <div className="rounded-xl p-4 text-sm space-y-2" style={{ backgroundColor: '#F5F5F0' }}>
                <div className="flex justify-between"><span className="text-gray-400">Emitido em</span><span className="font-semibold">{formatarData(resultado.criadoEm)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Assinado em</span><span className="font-semibold">{formatarData(resultado.assinadoEm)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Versão</span><span className="font-semibold">{resultado.versaoPdf}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Páginas</span><span className="font-semibold">{resultado.paginas ?? '—'}</span></div>
                {resultado.hash && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-gray-400 flex-shrink-0">Integridade</span>
                    <span className="font-semibold text-right" style={{ color: resultado.autentico ? '#1D9E75' : '#dc2626' }}>
                      {resultado.autentico ? 'Conteúdo íntegro' : 'Não corresponde ao original'}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-300 text-center leading-relaxed">
                Por privacidade, esta página não mostra dados pessoais do participante.
              </p>
            </div>
          )}
        </div>

        <Link href="/" className="mt-6 text-xs flex items-center justify-center gap-1 text-white/70 hover:text-white">
          <ArrowLeft className="w-3 h-3" /> Voltar ao SonhoEuropa
        </Link>
      </div>
    </div>
  )
}
