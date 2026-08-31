'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, FileText, Check, Send, Clock, ShieldCheck, Download,
  RefreshCw, Mail,
} from 'lucide-react'
import {
  getMeuContrato, submeterDadosContrato, getContratoParaAssinatura,
  registarConsentimento, enviarCodigoAssinatura, confirmarAssinatura,
  getMeuContratoDownload,
} from '@/app/actions/contrato'

interface Contrato {
  id: string
  numero: string
  estado: string
  dados: Record<string, string | null>
  pdf_paginas: number | null
  pdf_versao: number
  rejeitado_motivo: string | null
  created_at: string
}

// ─── Passo 1: formulário de dados ───────────────────────────────────────────
function FormularioDados({ motivoRejeicao, onSubmetido }: { motivoRejeicao?: string | null; onSubmetido: () => void }) {
  const [nascimento, setNascimento] = useState('')
  const [nacionalidade, setNacionalidade] = useState('Moçambicana')
  const [biValidade, setBiValidade] = useState('')
  const [nuit, setNuit] = useState('')
  const [morada, setMorada] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const enviar = async () => {
    setLoading(true)
    setErro('')
    const res = await submeterDadosContrato({ nascimento, nacionalidade, biValidade, nuit, morada })
    if (res.error) { setErro(res.error); setLoading(false); return }
    onSubmetido()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      {motivoRejeicao && (
        <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
          <p className="font-bold mb-0.5">O administrador pediu uma correcção</p>
          <p>{motivoRejeicao}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5">Data de nascimento</p>
        <input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none" style={{ borderColor: 'var(--border)' }} />
      </div>

      <div>
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5">Nacionalidade</p>
        <input type="text" value={nacionalidade} onChange={(e) => setNacionalidade(e.target.value)}
          placeholder="Ex: Moçambicana"
          className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none" style={{ borderColor: 'var(--border)' }} />
      </div>

      <div>
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5">Validade do BI</p>
        <input type="date" value={biValidade} onChange={(e) => setBiValidade(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none" style={{ borderColor: 'var(--border)' }} />
      </div>

      <div>
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5">
          NUIT <span className="font-normal normal-case text-muted">(opcional)</span>
        </p>
        <input type="text" inputMode="numeric" value={nuit} onChange={(e) => setNuit(e.target.value.replace(/\D/g, '').slice(0, 9))}
          placeholder="9 dígitos"
          className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none" style={{ borderColor: 'var(--border)' }} />
      </div>

      <div>
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1.5">Morada</p>
        <textarea value={morada} onChange={(e) => setMorada(e.target.value)} rows={2}
          placeholder="Bairro, cidade, província"
          className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none resize-none" style={{ borderColor: 'var(--border)' }} />
      </div>

      {erro && (
        <div className="p-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{erro}</div>
      )}

      <button onClick={enviar} disabled={loading || !nascimento || !nacionalidade || !biValidade || !morada}
        className="w-full py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 shadow-md"
        style={{ backgroundColor: 'var(--brand)', color: 'white' }}>
        {loading
          ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> A enviar...</>
          : <><Send className="w-4 h-4" /> Enviar para revisão</>}
      </button>
    </div>
  )
}

// ─── Passo 2: aguarda revisão do administrador ──────────────────────────────
function AguardaRevisao({ numero }: { numero: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'var(--money-tint)' }}>
        <Clock className="w-7 h-7" style={{ color: 'var(--money)' }} />
      </div>
      <h2 className="font-black" style={{ color: 'var(--brand)' }}>Dados em análise</h2>
      <p className="text-sm text-muted mt-1 leading-relaxed">
        Contrato N.º {numero}. O administrador vai rever os teus dados antes de gerar o contrato final para assinares.
      </p>
    </div>
  )
}

// ─── Passo 3: ler, consentir e assinar ──────────────────────────────────────
function FluxoAssinatura({ contratoId, onAssinado }: { contratoId: string; onAssinado: () => void }) {
  const [dados, setDados] = useState<Awaited<ReturnType<typeof getContratoParaAssinatura>>>(null)
  const [loading, setLoading] = useState(true)
  const [acao, setAcao] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [otpEnviado, setOtpEnviado] = useState(false)
  const [codigo, setCodigo] = useState('')

  const carregar = async () => {
    const r = await getContratoParaAssinatura(contratoId)
    setDados(r)
    setLoading(false)
  }

  useEffect(() => {
    const load = async () => {
      try {
        await carregar()
      } catch (e) {
        console.error('[contrato] Falha ao carregar dados de assinatura:', e)
      }
    }
    load()
  }, [contratoId])

  const confirmar = async (tipo: 'dados' | 'veracidade' | 'termos') => {
    setAcao(tipo)
    setErro('')
    const res = await registarConsentimento(contratoId, tipo)
    if (res.error) setErro(res.error)
    else await carregar()
    setAcao(null)
  }

  const pedirCodigo = async () => {
    setAcao('otp')
    setErro('')
    const res = await enviarCodigoAssinatura(contratoId)
    if (res.error) setErro(res.error)
    else setOtpEnviado(true)
    setAcao(null)
  }

  const assinar = async () => {
    setAcao('assinar')
    setErro('')
    const res = await confirmarAssinatura(contratoId, codigo)
    if (res.error) { setErro(res.error); setAcao(null); return }
    onAssinado()
  }

  if (loading) {
    return <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-muted" /></div>
  }
  if (!dados) {
    return <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-sm text-muted">Não foi possível carregar o contrato.</div>
  }

  const passos: { tipo: 'dados' | 'veracidade' | 'termos'; label: string; feito: string | null }[] = [
    { tipo: 'dados', label: 'Consinto o tratamento dos meus dados pessoais para os fins deste contrato', feito: dados.consentimentoDadosAt },
    { tipo: 'veracidade', label: 'Declaro que todos os dados fornecidos são verdadeiros e correspondem à minha identidade real', feito: dados.declaracaoVeracidadeAt },
    { tipo: 'termos', label: 'Li e aceito todos os termos e cláusulas do contrato abaixo', feito: dados.aceitacaoTermosAt },
  ]
  const todosConfirmados = passos.every((p) => p.feito)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-black text-base mb-1" style={{ color: 'var(--brand)' }}>Contrato N.º {dados.numero}</h2>
        <p className="text-xs text-muted mb-4">{dados.templateNome} · versão {dados.templateVersao}</p>
        <div className="rounded-xl p-4 space-y-4 max-h-72 overflow-y-auto" style={{ backgroundColor: 'var(--background)' }}>
          {dados.clausulas.map((c) => (
            <div key={c.id}>
              <p className="font-bold text-xs mb-1" style={{ color: 'var(--brand)' }}>{c.titulo}</p>
              <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{c.corpo}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <h3 className="font-black text-sm mb-1" style={{ color: 'var(--brand)' }}>Consentimento e Declarações</h3>
        {passos.map((p, i) => {
          const anteriorFeito = i === 0 || passos[i - 1].feito
          return (
            <button key={p.tipo} onClick={() => confirmar(p.tipo)}
              disabled={!!p.feito || !anteriorFeito || acao === p.tipo}
              className="w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all disabled:opacity-50"
              style={{ borderColor: p.feito ? 'var(--success)' : 'var(--border)', backgroundColor: p.feito ? 'var(--success-tint)' : 'white' }}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: p.feito ? 'var(--success)' : 'var(--slate-100)' }}>
                {p.feito ? <Check className="w-3.5 h-3.5 text-white" /> : acao === p.tipo ? <RefreshCw className="w-3 h-3 animate-spin text-muted" /> : null}
              </div>
              <span className="text-sm" style={{ color: p.feito ? 'var(--success)' : '#374151' }}>{p.label}</span>
            </button>
          )
        })}
      </div>

      {todosConfirmados && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-black text-sm mb-1 flex items-center gap-1.5" style={{ color: 'var(--brand)' }}>
            <ShieldCheck className="w-4 h-4" /> Assinatura Electrónica
          </h3>
          <p className="text-xs text-muted mb-4 leading-relaxed">
            Vamos enviar um código de 6 dígitos para o teu email. Introduzi-lo confirma a tua assinatura electrónica deste contrato. Não é uma assinatura digital certificada pelo INTIC, mas sim um mecanismo de autenticação forte.
          </p>

          {!otpEnviado ? (
            <button onClick={pedirCodigo} disabled={acao === 'otp'}
              className="w-full py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: 'var(--brand)', color: 'white' }}>
              {acao === 'otp'
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> A enviar...</>
                : <><Mail className="w-4 h-4" /> Enviar código por email</>}
            </button>
          ) : (
            <div className="space-y-3">
              <input type="text" inputMode="numeric" maxLength={6} value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 rounded-xl border-2 text-center text-2xl tracking-[0.5em] font-black outline-none"
                style={{ borderColor: 'var(--brand)' }} />
              <button onClick={assinar} disabled={acao === 'assinar' || codigo.length !== 6}
                className="w-full py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 shadow-md"
                style={{ backgroundColor: 'var(--success)', color: 'white' }}>
                {acao === 'assinar'
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> A confirmar...</>
                  : <><Check className="w-4 h-4" /> Confirmar assinatura</>}
              </button>
              <button onClick={pedirCodigo} disabled={acao === 'otp'} className="w-full text-xs text-muted hover:text-gray-600">
                Não recebeste? Reenviar código
              </button>
            </div>
          )}
        </div>
      )}

      {erro && (
        <div className="p-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">{erro}</div>
      )}
    </div>
  )
}

// ─── Passo 4: assinado — download ───────────────────────────────────────────
function ContratoFinalizado({ contrato }: { contrato: Contrato }) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const descarregar = async () => {
    setLoading(true)
    setErro('')
    const res = await getMeuContratoDownload(contrato.id)
    if (!('url' in res) || !res.url) { setErro(('error' in res && res.error) || 'Erro desconhecido'); setLoading(false); return }
    window.location.href = res.url
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'var(--success-tint)' }}>
        <Check className="w-7 h-7" style={{ color: 'var(--success)' }} />
      </div>
      <h2 className="font-black" style={{ color: 'var(--brand)' }}>Contrato assinado</h2>
      <p className="text-sm text-muted mt-1 mb-5 leading-relaxed">
        Contrato N.º {contrato.numero} · {contrato.pdf_paginas ?? '—'} páginas · versão {contrato.pdf_versao}
      </p>
      {erro && (
        <div className="p-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100 mb-4 text-left">{erro}</div>
      )}
      <button onClick={descarregar} disabled={loading}
        className="w-full py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 shadow-md"
        style={{ backgroundColor: 'var(--brand)', color: 'white' }}>
        {loading
          ? <><RefreshCw className="w-4 h-4 animate-spin" /> A preparar...</>
          : <><Download className="w-4 h-4" /> Descarregar PDF</>}
      </button>
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────
export default function ContratoPage() {
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = async () => {
    const r = await getMeuContrato()
    setContrato(r as Contrato | null)
    setLoading(false)
  }

  useEffect(() => {
    const load = async () => {
      try {
        await carregar()
      } catch (e) {
        console.error('[contrato] Falha ao carregar contrato:', e)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: 'var(--background)' }}>
      <header className="sticky top-0 z-40 border-b"
        style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px) saturate(180%)', borderColor: 'var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-gray-100 text-muted hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            <p className="font-black text-sm" style={{ color: 'var(--brand)' }}>Contrato de Participação</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-muted" /></div>
        ) : !contrato || contrato.estado === 'rejeitado' ? (
          <FormularioDados motivoRejeicao={contrato?.rejeitado_motivo} onSubmetido={carregar} />
        ) : contrato.estado === 'pendente' || contrato.estado === 'em_analise' ? (
          <AguardaRevisao numero={contrato.numero} />
        ) : contrato.estado === 'a_aguardar_assinatura' ? (
          <FluxoAssinatura contratoId={contrato.id} onAssinado={carregar} />
        ) : (
          <ContratoFinalizado contrato={contrato} />
        )}
      </div>
    </div>
  )
}
