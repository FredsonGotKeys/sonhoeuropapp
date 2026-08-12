'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LogOut, Copy, Share2, TrendingUp, Star,
  Trophy, Clock, Check, Home, Wallet, Users, Gift,
  AlertCircle, ChevronRight, ShieldCheck, Smartphone, Banknote,
  Mail, Info, Send, ClipboardPaste, CheckCircle2, ImagePlus, X, FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logout } from '@/app/actions/auth'
import { criarPedidoPagamento, enviarComprovativo, getMeusPagamentosPendentes, getMeuHistoricoPagamentos } from '@/app/actions/deposito'
import { getMinhasEstatisticasConvite, getRankingEmbaixadores, type EstatisticasConvite, type RankingEmbaixador } from '@/app/actions/convite'
import { enviarVerificacaoBi, limparVerificacoesExpiradas } from '@/app/actions/verificacao'
import { getMeuContrato } from '@/app/actions/contrato'
import { Suspense, Component, type ReactNode } from 'react'

// Se algo rebentar a desenhar o dashboard (ex: um dado inesperado vindo da
// base de dados), mostra o erro em vez de deixar o ecrã silenciosamente
// parado sem nenhum botão a responder.
class DashboardErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[dashboard] Erro ao desenhar a página:', error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: 'var(--background)' }}>
          <div className="max-w-sm w-full bg-white rounded-2xl p-6 shadow-sm text-center">
            <p className="font-black text-lg mb-2" style={{ color: '#e74c3c' }}>Algo correu mal</p>
            <p className="text-sm text-gray-500 mb-4">
              Encontrámos um erro ao carregar esta página. Actualiza (F5) para tentar de novo.
            </p>
            <p className="text-xs font-mono text-gray-400 break-all bg-gray-50 rounded-lg p-2.5">
              {this.state.error.message}
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

interface Usuario {
  id: string
  nome: string
  email: string
  codigo_convite: string
  pontos_total: number
  pontos_ciclo_actual: number
  streak_dias: number
  verificado: boolean
}

interface VerificacaoEstado {
  status: 'pendente' | 'aprovado' | 'rejeitado'
  motivo_rejeicao: string | null
}

interface Ciclo {
  id: string
  total_acumulado: number
  meta: number
  participantes_count: number
  minimo_participantes: number
  estado: string
}

interface Deposito {
  id: string
  valor: number
  pontos_gerados: number
  data_deposito: string
  referencia_paysuite: string | null
}

interface PagamentoPendente {
  id: string
  referencia: string
  tipo: string
  valor: number
  metodo: string
  status: string
  comprovativo: string | null
  created_at: string
}

type PayMethod = 'mpesa' | 'emola'

type Tab = 'home' | 'depositar' | 'convite' | 'historico' | 'pagamentos'

interface PagamentoHistorico {
  id: string
  referencia: string
  tipo: string
  valor: number
  metodo: string
  status: string
  created_at: string
  confirmado_at: string | null
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  aguardando_comprovativo: { label: 'Aguardando comprovativo', bg: '#7c3aed12', color: '#7c3aed' },
  pendente_confirmacao:    { label: 'Em analise',             bg: '#EF9F2712', color: '#EF9F27' },
  pendente:                { label: 'A aguardar pagamento',   bg: '#3b82f612', color: '#3b82f6' },
  confirmado:              { label: 'Confirmado',             bg: '#1D9E7512', color: '#1D9E75' },
  falhado:                 { label: 'Recusado',               bg: '#fee2e2',   color: '#dc2626' },
}

const CONTRATO_STATUS_LABEL: Record<string, string> = {
  pendente: 'Dados em análise pelo administrador',
  em_analise: 'Dados em análise pelo administrador',
  rejeitado: 'Correcção pedida — toca para ver o motivo',
  a_aguardar_assinatura: 'Aprovado — falta a tua assinatura',
  assinado: 'Assinado — toca para descarregar',
  finalizado: 'Assinado — toca para descarregar',
}

const PAYMENT_INFO = {
  mpesa: { numero: '846283051', operadora: 'M-Pesa (Vodacom)', nome: 'Fredson Bernardo Muianga' },
  emola: { numero: '876252006', operadora: 'E-Mola (Movitel)', nome: 'Fredson Bernardo Muianga' },
}

// ─── Dados de pagamento (mostrar número, nome) ───────────────────────────
function DadosPagamento({ method, valor }: { method: PayMethod; valor: number }) {
  const info = PAYMENT_INFO[method]
  const [copiado, setCopiado] = useState(false)

  const copiarNumero = async () => {
    await navigator.clipboard.writeText(info.numero)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid #003399' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: '#003399' }}>
        {method === 'mpesa' ? <Smartphone className="w-4 h-4 text-white" /> : <Banknote className="w-4 h-4 text-white" />}
        <span className="text-white font-bold text-sm">Enviar {valor} MT via {info.operadora}</span>
      </div>
      <div className="p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Enviar para</p>
            <p className="text-2xl font-black tracking-wider mt-1" style={{ color: '#003399' }}>{info.numero}</p>
          </div>
          <button onClick={copiarNumero}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              backgroundColor: copiado ? '#1D9E75' : '#00339910',
              color: copiado ? 'white' : '#003399',
            }}>
            {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <div className="h-px" style={{ backgroundColor: 'var(--background)' }} />
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Nome</span>
          <span className="font-bold text-gray-700">{info.nome}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Valor</span>
          <span className="font-black" style={{ color: '#EF9F27' }}>{valor} MT</span>
        </div>
        <div className="p-3 rounded-xl flex items-start gap-2.5" style={{ backgroundColor: '#EF9F2710', border: '1px solid #EF9F2730' }}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#EF9F27' }} />
          <p className="text-xs text-gray-600 leading-relaxed">
            Depois de enviar o dinheiro, <strong>cola a mensagem de confirmacao</strong> ou <strong>tira um screenshot</strong> e envia abaixo.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Campo de comprovativo (texto + imagem) ──────────────────────────────
function CampoComprovativo({
  referencia,
  onSucesso,
}: {
  referencia: string
  onSucesso: () => void
}) {
  const [texto, setTexto] = useState('')
  const [imagem, setImagem] = useState<File | null>(null)
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)

  const processarImagem = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { setErro('Imagem muito grande. Maximo 2 MB — um screenshot normal chega perfeitamente.'); return }
    if (!file.type.startsWith('image/')) { setErro('Ficheiro invalido. Envia uma imagem.'); return }
    setImagem(file)
    setErro('')
    const reader = new FileReader()
    reader.onload = (ev) => setImagemPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processarImagem(file)
  }

  // Colar directamente do telemóvel: tira-se o screenshot, faz-se
  // "colar" (Ctrl+V ou o toque de colar do teclado), sem passar pela
  // galeria de ficheiros.
  const handlePasteImagem = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (file) { e.preventDefault(); processarImagem(file) }
  }

  const colarImagemDaAreaTransferencia = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const tipo = item.types.find((t) => t.startsWith('image/'))
        if (!tipo) continue
        const blob = await item.getType(tipo)
        processarImagem(new File([blob], `comprovativo.${tipo.split('/')[1] ?? 'png'}`, { type: tipo }))
        return
      }
      setErro('Não há nenhuma imagem copiada. Tira o screenshot e copia-o primeiro.')
    } catch {
      setErro('Não foi possível aceder à área de transferência. Cola com Ctrl+V ou escolhe o ficheiro.')
    }
  }

  const removerImagem = () => {
    setImagem(null)
    setImagemPreview(null)
  }

  const enviar = async () => {
    const temTexto = texto.trim().length >= 10
    const temImagem = !!imagem
    if (!temTexto && !temImagem) {
      setErro('Envia o texto do comprovativo ou uma imagem/screenshot.')
      return
    }

    setLoading(true)
    setErro('')
    let imagemUrl: string | undefined

    if (imagem) {
      setUploadProgress('A enviar imagem...')
      const supabase = createClient()
      const ext = imagem.name.split('.').pop() ?? 'jpg'
      const path = `${referencia}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('comprovativos')
        .upload(path, imagem, { contentType: imagem.type })
      if (upErr) { setErro('Erro ao enviar imagem: ' + upErr.message); setLoading(false); setUploadProgress(''); return }
      const { data: urlData } = supabase.storage.from('comprovativos').getPublicUrl(path)
      imagemUrl = urlData.publicUrl
    }

    setUploadProgress('A guardar comprovativo...')
    const res = await enviarComprovativo(referencia, texto, imagemUrl)
    if (res.error) { setErro(res.error); setLoading(false); setUploadProgress(''); return }
    setEnviado(true)
    setLoading(false)
    setUploadProgress('')
    setTimeout(onSucesso, 1500)
  }

  const colar = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setTexto(text)
    } catch { /* clipboard denied */ }
  }

  // O texto tem de ser exactamente o que o E-Mola enviou — sem espaço para
  // digitar ou alterar à mão. Só entra por colar (botão ou gesto nativo).
  const handlePasteTexto = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    if (text) setTexto(text)
  }

  const limparTexto = () => setTexto('')

  if (enviado) {
    return (
      <div className="p-5 rounded-2xl text-center" style={{ backgroundColor: '#1D9E7510', border: '2px solid #1D9E7530' }}>
        <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: '#1D9E75' }} />
        <p className="font-black" style={{ color: '#1D9E75' }}>Comprovativo enviado!</p>
        <p className="text-xs text-gray-400 mt-1">O administrador ira verificar e confirmar o teu pagamento.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3" onPaste={handlePasteImagem}>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Comprovativo de pagamento</p>

      {/* Texto */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-gray-400 flex items-center gap-1"><FileText className="w-3 h-3" /> Mensagem de confirmacao</p>
          {texto ? (
            <button onClick={limparTexto}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition-all"
              style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
              <X className="w-3 h-3" /> Limpar
            </button>
          ) : (
            <button onClick={colar}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition-all"
              style={{ backgroundColor: '#00339910', color: '#003399' }}>
              <ClipboardPaste className="w-3 h-3" /> Colar
            </button>
          )}
        </div>
        <textarea
          value={texto}
          readOnly
          onPaste={handlePasteTexto}
          onKeyDown={(e) => { if (!(e.ctrlKey || e.metaKey)) e.preventDefault() }}
          placeholder="Usa o botão Colar, ou cola aqui (Ctrl+V) a mensagem SMS que recebeste"
          rows={3}
          className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none resize-none transition-all cursor-default"
          style={{ borderColor: texto ? '#003399' : '#e5e7eb', backgroundColor: texto ? 'white' : '#fafafa' }}
        />
      </div>

      {/* Separador OU */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ backgroundColor: '#e5e7eb' }} />
        <span className="text-xs text-gray-300 font-bold">OU</span>
        <div className="flex-1 h-px" style={{ backgroundColor: '#e5e7eb' }} />
      </div>

      {/* Upload imagem */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-gray-400 flex items-center gap-1"><ImagePlus className="w-3 h-3" /> Screenshot / Foto do comprovativo</p>
          {!imagemPreview && (
            <button onClick={colarImagemDaAreaTransferencia}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition-all"
              style={{ backgroundColor: '#00339910', color: '#003399' }}>
              <ClipboardPaste className="w-3 h-3" /> Colar
            </button>
          )}
        </div>
        {imagemPreview ? (
          <div className="relative rounded-xl overflow-hidden border-2" style={{ borderColor: '#003399' }}>
            <img src={imagemPreview} alt="Comprovativo" className="w-full max-h-48 object-contain bg-gray-50" />
            <button onClick={removerImagem}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600">
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs text-white font-bold"
              style={{ backgroundColor: 'rgba(0,51,153,0.8)' }}>
              {imagem?.name} · {((imagem?.size ?? 0) / 1024).toFixed(0)} KB
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-blue-300 hover:bg-blue-50/30"
            style={{ borderColor: '#d1d5db' }}>
            <ImagePlus className="w-8 h-8 text-gray-300" />
            <span className="text-sm text-gray-400 font-semibold">Toca para escolher imagem</span>
            <span className="text-xs text-gray-300">JPG, PNG ou GIF · Max 5 MB</span>
            <input type="file" accept="image/*" capture="environment" onChange={handleImagem} className="hidden" />
          </label>
        )}
      </div>

      {erro && (
        <div className="p-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">
          {erro}
        </div>
      )}

      <button
        onClick={enviar}
        disabled={loading || (texto.trim().length < 10 && !imagem)}
        className="w-full py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 shadow-md"
        style={{ backgroundColor: '#1D9E75', color: 'white', boxShadow: '0 4px 14px rgba(29,158,117,0.3)' }}
      >
        {loading
          ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {uploadProgress}</>
          : <><Send className="w-4 h-4" /> Enviar Comprovativo</>}
      </button>

      <p className="text-xs text-center text-gray-300">Podes enviar texto, imagem ou ambos</p>
    </div>
  )
}

// ─── Verificação de identidade (BI) ───────────────────────────────────────
function CampoFotoBi({ label, preview, onFile, onRemover, capture = 'environment' }: {
  label: string
  preview: string | null
  onFile: (file: File) => void
  onRemover: () => void
  capture?: 'environment' | 'user'
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1"><ImagePlus className="w-3 h-3" /> {label}</p>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border-2" style={{ borderColor: '#003399' }}>
          <img src={preview} alt={label} className="w-full max-h-40 object-contain bg-gray-50" />
          <button type="button" onClick={onRemover}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-blue-300 hover:bg-blue-50/30"
          style={{ borderColor: '#d1d5db' }}>
          <ImagePlus className="w-7 h-7 text-gray-300" />
          <span className="text-sm text-gray-400 font-semibold">Toca para tirar/escolher foto</span>
          <span className="text-xs text-gray-300">JPG ou PNG · Max 5 MB</span>
          <input type="file" accept="image/*" capture={capture} onChange={handleChange} className="hidden" />
        </label>
      )}
    </div>
  )
}

function VerificacaoBiObrigatoria({ estado, onEnviado }: {
  estado: VerificacaoEstado | null
  onEnviado: () => void
}) {
  const [frenteFile, setFrenteFile] = useState<File | null>(null)
  const [frentePreview, setFrentePreview] = useState<string | null>(null)
  const [versoFile, setVersoFile] = useState<File | null>(null)
  const [versoPreview, setVersoPreview] = useState<string | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const processar = (file: File, setFile: (f: File) => void, setPreview: (p: string) => void) => {
    if (file.size > 5 * 1024 * 1024) { setErro('Imagem muito grande. Máximo 5 MB.'); return }
    if (!file.type.startsWith('image/')) { setErro('Ficheiro inválido. Envia uma imagem.'); return }
    setErro('')
    setFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const enviar = async () => {
    if (!frenteFile || !versoFile || !selfieFile) { setErro('Envia as três fotos: frente e verso do BI, e uma selfie.'); return }
    setLoading(true)
    setErro('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErro('Sessão expirada. Recarrega a página.'); setLoading(false); return }

    const ts = Date.now()
    const pathFrente = `${user.id}/bi-frente-${ts}.${frenteFile.name.split('.').pop() ?? 'jpg'}`
    const pathVerso = `${user.id}/bi-verso-${ts}.${versoFile.name.split('.').pop() ?? 'jpg'}`
    const pathSelfie = `${user.id}/selfie-${ts}.${selfieFile.name.split('.').pop() ?? 'jpg'}`

    const [upFrente, upVerso, upSelfie] = await Promise.all([
      supabase.storage.from('verificacoes').upload(pathFrente, frenteFile, { contentType: frenteFile.type }),
      supabase.storage.from('verificacoes').upload(pathVerso, versoFile, { contentType: versoFile.type }),
      supabase.storage.from('verificacoes').upload(pathSelfie, selfieFile, { contentType: selfieFile.type }),
    ])
    if (upFrente.error || upVerso.error || upSelfie.error) {
      setErro('Erro ao enviar imagens: ' + (upFrente.error?.message || upVerso.error?.message || upSelfie.error?.message))
      setLoading(false)
      return
    }

    const res = await enviarVerificacaoBi(pathFrente, pathVerso, pathSelfie)
    if (res.error) { setErro(res.error); setLoading(false); return }
    setLoading(false)
    onEnviado()
  }

  if (estado?.status === 'pendente') {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#EF9F2715' }}>
          <Clock className="w-7 h-7" style={{ color: '#EF9F27' }} />
        </div>
        <h2 className="font-black" style={{ color: '#003399' }}>BI em análise</h2>
        <p className="text-sm text-gray-400 mt-1 leading-relaxed">
          Recebemos as tuas fotos. Assim que confirmarmos a tua identidade, vais ter acesso completo ao app.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#00339915' }}>
        <ShieldCheck className="w-7 h-7" style={{ color: '#003399' }} />
      </div>
      <h2 className="font-black text-base text-center" style={{ color: '#003399' }}>Confirma a tua identidade</h2>
      <p className="text-xs text-gray-400 text-center mt-1 mb-5 leading-relaxed">
        Para tua segurança, precisamos de uma foto da frente e do verso do teu Bilhete de Identidade, e de uma selfie tua, antes de continuares.
      </p>

      {estado?.status === 'rejeitado' && (
        <div className="p-3 rounded-xl text-sm mb-4" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
          <p className="font-bold mb-0.5">O envio anterior não foi aceite</p>
          <p>{estado.motivo_rejeicao || 'Tenta enviar fotos mais nítidas.'}</p>
        </div>
      )}

      <div className="space-y-4">
        <CampoFotoBi label="Frente do BI" preview={frentePreview}
          onFile={(f) => processar(f, setFrenteFile, setFrentePreview)}
          onRemover={() => { setFrenteFile(null); setFrentePreview(null) }} />
        <CampoFotoBi label="Verso do BI" preview={versoPreview}
          onFile={(f) => processar(f, setVersoFile, setVersoPreview)}
          onRemover={() => { setVersoFile(null); setVersoPreview(null) }} />
        <CampoFotoBi label="Selfie (tira uma foto tua agora)" preview={selfiePreview} capture="user"
          onFile={(f) => processar(f, setSelfieFile, setSelfiePreview)}
          onRemover={() => { setSelfieFile(null); setSelfiePreview(null) }} />
      </div>

      {erro && (
        <div className="p-3 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100 mt-4">{erro}</div>
      )}

      <button
        onClick={enviar}
        disabled={loading || !frenteFile || !versoFile || !selfieFile}
        className="w-full py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 shadow-md mt-4"
        style={{ backgroundColor: '#003399', color: 'white', boxShadow: '0 4px 14px rgba(0,51,153,0.3)' }}
      >
        {loading
          ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> A enviar...</>
          : <><Send className="w-4 h-4" /> Enviar para verificação</>}
      </button>
      <p className="text-xs text-center text-gray-300 mt-3">
        As fotos servem só para confirmar a tua identidade e são apagadas do nosso sistema pouco depois da verificação.
      </p>
    </div>
  )
}

// ─── Dashboard principal ───────────────────────────────────────────────────
function DashboardContent() {
  const [user, setUser] = useState<Usuario | null>(null)
  const [ciclo, setCiclo] = useState<Ciclo | null>(null)
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('home')

  const [valor, setValor] = useState('')
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')

  // Fluxo de pagamento manual
  const [pagamentoPendente, setPagamentoPendente] = useState<PagamentoPendente | null>(null)
  const [pedidoCriado, setPedidoCriado] = useState<{ referencia: string; method: PayMethod; valor: number } | null>(null)
  const [historicoPagamentos, setHistoricoPagamentos] = useState<PagamentoHistorico[]>([])
  const [convites, setConvites] = useState<EstatisticasConvite>({ registados: 0, participantes: 0 })
  const [ranking, setRanking] = useState<RankingEmbaixador[]>([])
  const [verificacao, setVerificacao] = useState<VerificacaoEstado | null>(null)
  const [contrato, setContrato] = useState<{ id: string; numero: string; estado: string } | null>(null)

  const router = useRouter()

  const recarregarDados = async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    const [userData, cicloData, depositosData, verificacaoData] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', authUser.id).single(),
      supabase.from('ciclos').select('*').neq('estado', 'concluido')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('depositos').select('*').eq('usuario_id', authUser.id)
        .order('data_deposito', { ascending: false }).limit(20),
      supabase.from('verificacoes').select('status, motivo_rejeicao').eq('usuario_id', authUser.id)
        .order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    ])

    // Entrou pelo Google mas ainda não criou o perfil (falta o telefone).
    if (!userData.data) {
      router.replace('/completar-perfil')
      return
    }

    setUser(userData.data)
    setVerificacao(verificacaoData.data)
    limparVerificacoesExpiradas().catch((e) => console.error('[dashboard] Falha ao limpar verificações:', e))

    if (cicloData.data) setCiclo(cicloData.data)

    if (depositosData.data) setDepositos(depositosData.data)

    // Verificar pagamentos pendentes + histórico — em paralelo, é o caminho
    // crítico logo a seguir a criar/confirmar um pagamento, tem de ser rápido.
    const [pendentes, historico] = await Promise.all([
      getMeusPagamentosPendentes(),
      getMeuHistoricoPagamentos(),
    ])
    setPagamentoPendente(pendentes.length > 0 ? pendentes[0] : null)
    setHistoricoPagamentos(historico)

    getMeuContrato().then(setContrato).catch((e) => console.error('[dashboard] Falha ao carregar contrato:', e))
  }

  useEffect(() => {
    const load = async () => {
      try {
        await recarregarDados()
      } catch (e) {
        console.error('[dashboard] Falha ao carregar dados:', e)
      } finally {
        setLoading(false)
      }
    }
    load()

    // Estatísticas de convite/ranking: não fazem parte do fluxo de pagamento,
    // por isso correm à parte, sem atrasar recarregarDados().
    Promise.all([getMinhasEstatisticasConvite(), getRankingEmbaixadores()])
      .then(([stats, rankingData]) => { setConvites(stats); setRanking(rankingData) })

    const supabase = createClient()
    const channel = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ciclos' }, (p) => {
        if (p.eventType !== 'DELETE') setCiclo(p.new as Ciclo)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pagamentos' }, () => {
        recarregarDados().catch((e) => console.error('[dashboard] Falha ao actualizar após webhook:', e))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'verificacoes' }, () => {
        recarregarDados().catch((e) => console.error('[dashboard] Falha ao actualizar verificação:', e))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  // try/catch/finally: aconteça o que acontecer (erro de rede, excepção,
  // resposta inesperada), o botão TEM de sair do estado "a carregar" e
  // mostrar algo à pessoa — nunca ficar preso a girar para sempre.
  const handleDepositar = async () => {
    setPayError('')
    const valorNum = Number(valor)
    if (valorNum < 100) { setPayError('Valor minimo e 100 MT'); return }
    setPayLoading(true)
    try {
      const result = await criarPedidoPagamento({ valor: valorNum, tipo: 'deposito' })
      if (result.error) { setPayError(result.error); return }
      setPedidoCriado({ referencia: result.reference!, method: 'emola', valor: valorNum })
      await recarregarDados()
    } catch (e) {
      console.error('[handleDepositar]', e)
      setPayError('Não foi possível processar o pedido. Verifica a tua ligação e tenta novamente.')
    } finally {
      setPayLoading(false)
    }
  }

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/register?ref=${user?.codigo_convite ?? ''}`
      : ''

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const primeiroNome = user?.nome?.trim().split(/\s+/)[0] ?? ''
  const mensagemConvite = `${primeiroNome ? `${primeiroNome} convida-te para o` : 'Junta-te ao'} *SonhoEuropa*!\n\nDepositamos em conjunto e concorremos a *200 000 MT* para a Europa. Quanto mais gente entrar, mais rápido o fundo enche e mais cedo há sorteio.\n\nRegista-te aqui: ${inviteUrl}`

  const NIVEIS_EMBAIXADOR = [
    { min: 25, nome: 'Embaixador Ouro', emoji: '🏆', cor: '#EF9F27' },
    { min: 10, nome: 'Embaixador Prata', emoji: '🥈', cor: '#94a3b8' },
    { min: 3, nome: 'Embaixador Bronze', emoji: '🥉', cor: '#c2703d' },
    { min: 1, nome: 'Divulgador', emoji: '🌱', cor: '#1D9E75' },
  ]
  const nivelActual = NIVEIS_EMBAIXADOR.find((n) => convites.participantes >= n.min)
  const proximoNivel = [...NIVEIS_EMBAIXADOR].reverse().find((n) => convites.participantes < n.min)

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagemConvite)}`, '_blank')
  }

  // Abre o menu de partilha do próprio telemóvel (WhatsApp, SMS, Facebook,
  // Messenger, email...). Se o browser não suportar, cai no WhatsApp.
  const sharePartilhaNativa = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'SonhoEuropa', text: mensagemConvite, url: inviteUrl })
        return
      } catch {
        return // utilizador cancelou
      }
    }
    shareWhatsApp()
  }

  const metaReal = 300000
  const metaUtilizador = ciclo?.meta ?? 200000
  const progress = ciclo ? Math.min((ciclo.total_acumulado / metaReal) * 100, 100) : 0
  const valorVisivel = ciclo ? Math.round(ciclo.total_acumulado * ((ciclo.meta ?? 200000) / 300000)) : 0
  const formatMT = (v: number) => `${v.toLocaleString('pt-PT')} MT`
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })

  const estadoLabel: Record<string, { label: string; color: string }> = {
    aguardando_minimo: { label: 'A aguardar participantes', color: '#EF9F27' },
    activo: { label: 'Ciclo activo', color: '#1D9E75' },
    concluido: { label: 'Concluido', color: '#666' },
  }
  const estadoInfo = estadoLabel[ciclo?.estado ?? ''] ?? { label: ciclo?.estado ?? '—', color: '#666' }

  const quickAmounts = [50, 100, 200, 500]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-3"
            style={{ borderColor: '#003399', borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-400">A carregar...</p>
        </div>
      </div>
    )
  }

  // ── Se ainda não confirmámos a identidade (BI) ──
  if (!user?.verificado) {
    return (
      <div className="min-h-screen pb-6" style={{ backgroundColor: 'var(--background)' }}>
        <header className="sticky top-0 z-40 border-b"
          style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px) saturate(180%)', borderColor: 'var(--border)' }}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-xl object-cover" />
              <p className="font-black text-sm" style={{ color: '#003399' }}>
                Olá, {primeiroNome}
              </p>
            </div>
            <form action={logout}>
              <button type="submit" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            </form>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <VerificacaoBiObrigatoria estado={verificacao} onEnviado={recarregarDados} />
        </div>
      </div>
    )
  }

  // ── Dashboard completo ──
  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b"
        style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px) saturate(180%)', borderColor: 'var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-xl object-cover" />
            <p className="font-black text-sm" style={{ color: '#003399' }}>
              Olá, {primeiroNome}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form action={logout}>
              <button type="submit" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* ── HOME ── */}
        {activeTab === 'home' && (
          <>
            {/* Contrato de participação */}
            <Link href="/dashboard/contrato" className="block bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#00339915' }}>
                    <FileText className="w-4 h-4" style={{ color: '#003399' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm" style={{ color: '#003399' }}>Contrato de Participação</p>
                    <p className="text-xs text-gray-400 truncate">{CONTRATO_STATUS_LABEL[contrato?.estado ?? ''] ?? 'Ainda não iniciado — toca para começar'}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            </Link>

            {/* Stats */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2" style={{ color: '#003399' }}>
                  <Trophy className="w-4 h-4" />
                  <span className="text-xs font-semibold">A tua participação</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: '#1D9E7515', color: '#1D9E75' }}>Este ciclo</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-xl" style={{ backgroundColor: '#00339908' }}>
                  <p className="text-2xl font-black" style={{ color: '#003399' }}>{depositos.length}</p>
                  <p className="text-xs text-gray-400">Depósitos feitos</p>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ backgroundColor: '#EF9F2708' }}>
                  <p className="text-2xl font-black" style={{ color: '#EF9F27' }}>{formatMT(depositos.reduce((s, d) => s + d.valor, 0))}</p>
                  <p className="text-xs text-gray-400">Total depositado</p>
                </div>
              </div>
            </div>

            {/* Fund Progress */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-black" style={{ color: '#003399' }}>Fundo em Tempo Real</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                    <span className="text-xs" style={{ color: estadoInfo.color }}>{estadoInfo.label}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black" style={{ color: '#EF9F27' }}>{formatMT(valorVisivel)}</p>
                  <p className="text-xs text-gray-400">de {formatMT(metaUtilizador)}</p>
                </div>
              </div>
              <div className="h-4 rounded-full overflow-hidden mb-1" style={{ backgroundColor: 'var(--background)' }}>
                <div className="h-full rounded-full transition-all duration-700 relative"
                  style={{ width: `${progress || 1}%`, background: 'linear-gradient(90deg, #EF9F27, #f5c056)' }}>
                  <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg, transparent 60%, rgba(255,255,255,0.3))' }} />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1 mb-3">
                <span>0 MT</span>
                <span className="font-semibold" style={{ color: '#EF9F27' }}>{progress.toFixed(1)}%</span>
                <span>{metaUtilizador.toLocaleString('pt-PT')} MT</span>
              </div>
            </div>

            {/* Pagamento pendente de comprovativo */}
            {pagamentoPendente && pagamentoPendente.status === 'aguardando_comprovativo' && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b flex items-center gap-2" style={{ borderColor: '#F5F5F0' }}>
                  <AlertCircle className="w-4 h-4" style={{ color: '#EF9F27' }} />
                  <p className="font-bold text-sm" style={{ color: '#EF9F27' }}>Tens um pagamento pendente</p>
                </div>
                <div className="p-5 space-y-4">
                  <DadosPagamento method={pagamentoPendente.metodo as PayMethod} valor={pagamentoPendente.valor} />
                  <CampoComprovativo referencia={pagamentoPendente.referencia} onSucesso={recarregarDados} />
                </div>
              </div>
            )}

            {pagamentoPendente && pagamentoPendente.status === 'pendente_confirmacao' && (
              <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3"
                style={{ border: '1.5px solid #EF9F2730' }}>
                <Clock className="w-5 h-5 flex-shrink-0" style={{ color: '#EF9F27' }} />
                <div>
                  <p className="font-bold text-sm" style={{ color: '#003399' }}>Comprovativo enviado</p>
                  <p className="text-xs text-gray-400">A aguardar confirmacao do administrador.</p>
                </div>
              </div>
            )}


            <button
              onClick={() => setActiveTab('depositar')}
              className="w-full py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
              style={{ backgroundColor: '#003399', color: 'white', boxShadow: '0 4px 16px rgba(0,51,153,0.25)' }}>
              <Wallet className="w-5 h-5" /> Fazer Deposito
            </button>
          </>
        )}

        {/* ── DEPOSITAR ── */}
        {activeTab === 'depositar' && (
          <div className="space-y-4">
            {/* Se já criou um pedido, mostrar dados de transferência */}
            {pedidoCriado ? (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: '#F5F5F0' }}>
                  <h2 className="font-black text-lg" style={{ color: '#003399' }}>Enviar Deposito</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Faz a transferencia e cola o comprovativo</p>
                </div>
                <div className="p-5 space-y-4">
                  <DadosPagamento method={pedidoCriado.method} valor={pedidoCriado.valor} />
                  <CampoComprovativo
                    referencia={pedidoCriado.referencia}
                    onSucesso={() => { setPedidoCriado(null); setValor(''); recarregarDados() }}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#F5F5F0' }}>
                  <h2 className="font-black text-lg" style={{ color: '#003399' }}>Fazer Deposito</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Transferencia directa · Minimo 100 MT</p>
                </div>

                <div className="p-5 space-y-5">
                  {/* Amount */}
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Valor (MT)</p>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {quickAmounts.map((a) => (
                        <button key={a} onClick={() => setValor(String(a))}
                          className="py-2 rounded-xl text-sm font-bold border-2 transition-all"
                          style={{
                            borderColor: valor === String(a) ? '#003399' : '#e5e7eb',
                            backgroundColor: valor === String(a) ? '#00339910' : 'white',
                            color: valor === String(a) ? '#003399' : '#666',
                          }}>
                          {a}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="number" min={100} placeholder="Outro valor (min. 100)"
                        value={valor} onChange={(e) => setValor(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all pr-14"
                        style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}
                        onFocus={(e) => { e.target.style.borderColor = '#003399'; e.target.style.backgroundColor = 'white' }}
                        onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = '#fafafa' }}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">MT</span>
                    </div>
                    {valor && Number(valor) >= 100 && (
                      <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg" style={{ backgroundColor: '#1D9E7510' }}>
                        <TrendingUp className="w-3.5 h-3.5" style={{ color: '#1D9E75' }} />
                        <p className="text-xs font-semibold" style={{ color: '#1D9E75' }}>
                          <strong>{Number(valor)} MT</strong> vão para o fundo comunitário
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl text-sm" style={{ backgroundColor: '#00339910', color: '#003399' }}>
                    Pagamento por <strong>E-Mola</strong> — vais ver o número e enviar o comprovativo no passo seguinte.
                  </div>

                  {payError && (
                    <div className="p-3.5 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100">
                      {payError}
                    </div>
                  )}

                  <button
                    onClick={handleDepositar}
                    disabled={payLoading || !valor || Number(valor) < 100}
                    className="w-full py-4 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 shadow-md"
                    style={{ backgroundColor: '#EF9F27', color: '#001f6b', boxShadow: '0 4px 16px rgba(239,159,39,0.3)' }}>
                    {payLoading
                      ? <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : `Depositar ${valor ? valor + ' MT' : '...'} via E-Mola`}
                  </button>
                  <p className="text-xs text-center text-gray-400">
                    Transferência directa · Confirmação manual pelo admin
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONVITE ── */}
        {activeTab === 'convite' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg, #003399, #0055cc)' }}>
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <h2 className="font-black text-lg" style={{ color: '#003399' }}>Convida amigos</h2>
                <p className="text-xs text-gray-400 mt-1">Quanto mais participantes, mais rápido o fundo cresce</p>
              </div>

              {nivelActual && (
                <div className="flex items-center justify-center gap-2 mb-4 py-2.5 px-4 rounded-2xl"
                  style={{ backgroundColor: `${nivelActual.cor}15`, border: `1.5px solid ${nivelActual.cor}40` }}>
                  <span className="text-xl">{nivelActual.emoji}</span>
                  <span className="font-black text-sm" style={{ color: nivelActual.cor }}>{nivelActual.nome}</span>
                </div>
              )}

              {/* Progresso de quem divulga */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="text-center py-3 rounded-2xl" style={{ backgroundColor: '#00339910' }}>
                  <p className="text-3xl font-black" style={{ color: '#003399' }}>{convites.registados}</p>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">
                    {convites.registados === 1 ? 'registou-se' : 'registaram-se'}
                  </p>
                </div>
                <div className="text-center py-3 rounded-2xl" style={{ backgroundColor: '#1D9E7510' }}>
                  <p className="text-3xl font-black" style={{ color: '#1D9E75' }}>{convites.participantes}</p>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">
                    {convites.participantes === 1 ? 'já participa' : 'já participam'}
                  </p>
                </div>
              </div>

              {proximoNivel ? (
                <p className="text-xs text-center text-gray-400 mb-4 leading-relaxed">
                  Falta{proximoNivel.min - convites.participantes === 1 ? '' : 'm'} <strong style={{ color: proximoNivel.cor }}>{proximoNivel.min - convites.participantes}</strong> {proximoNivel.min - convites.participantes === 1 ? 'pessoa' : 'pessoas'} para chegares a <strong>{proximoNivel.emoji} {proximoNivel.nome}</strong>
                </p>
              ) : convites.registados > 0 ? (
                <p className="text-xs text-center text-gray-400 mb-4 leading-relaxed">
                  Graças a ti, o fundo cresce mais depressa. Continua a partilhar!
                </p>
              ) : (
                <p className="text-xs text-center text-gray-400 mb-4 leading-relaxed">
                  Sê o primeiro a partilhar e torna-te 🌱 Divulgador
                </p>
              )}
              <div className="flex items-center justify-center gap-2 p-4 rounded-2xl mb-4"
                style={{ backgroundColor: 'var(--background)' }}>
                <span className="text-2xl font-black font-mono tracking-widest" style={{ color: '#003399', letterSpacing: '0.2em' }}>
                  {user?.codigo_convite}
                </span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl mb-3" style={{ backgroundColor: 'var(--background)' }}>
                <span className="text-xs text-gray-500 flex-1 truncate font-mono">{inviteUrl}</span>
                <button onClick={copyInvite}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ backgroundColor: copied ? '#1D9E75' : '#003399' }}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <div className="space-y-2">
                <button onClick={shareWhatsApp}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white active:scale-95 transition-all"
                  style={{ backgroundColor: '#25D366' }}>
                  <Share2 className="w-4 h-4" /> Partilhar no WhatsApp
                </button>
                <button onClick={sharePartilhaNativa}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold active:scale-95 transition-all"
                  style={{ backgroundColor: 'var(--background)', color: '#003399' }}>
                  <Send className="w-4 h-4" /> Partilhar noutra app
                </button>
              </div>
            </div>

            {ranking.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-sm mb-1" style={{ color: '#003399' }}>🏅 Top Embaixadores</h3>
                <p className="text-xs text-gray-400 mb-3">Quem já trouxe mais participantes à comunidade</p>
                <div className="space-y-2">
                  {ranking.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl"
                      style={{ backgroundColor: r.souEu ? '#00339910' : 'var(--background)' }}>
                      <span className="w-6 text-center font-black text-sm text-gray-400">{i + 1}º</span>
                      <span className="flex-1 font-bold text-sm truncate" style={{ color: r.souEu ? '#003399' : '#1A1A2E' }}>
                        {r.nome}{r.souEu && ' (tu)'}
                      </span>
                      <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: '#1D9E7515', color: '#1D9E75' }}>
                        {r.participantes} {r.participantes === 1 ? 'convidado' : 'convidados'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-sm mb-3" style={{ color: '#003399' }}>Como funciona?</h3>
              <div className="space-y-3">
                {[
                  'Partilha o teu link com amigos',
                  'O amigo regista-se com o teu código',
                  'Ele inscreve-se e começa a depositar',
                  'O fundo cresce mais rápido para todos',
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                      style={{ backgroundColor: '#003399' }}>{i + 1}</div>
                    <p className="text-sm text-gray-500">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PAGAMENTOS (status) ── */}
        {activeTab === 'pagamentos' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b flex items-center justify-between" style={{ borderColor: '#F5F5F0' }}>
              <h2 className="font-black" style={{ color: '#003399' }}>Meus Pagamentos</h2>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ backgroundColor: '#00339912', color: '#003399' }}>
                {historicoPagamentos.length} registos
              </span>
            </div>
            {historicoPagamentos.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="font-semibold text-gray-400">Sem pagamentos ainda</p>
                <p className="text-xs text-gray-300 mt-1 mb-4">Os teus pagamentos aparecerao aqui com o estado actualizado.</p>
                <button onClick={() => setActiveTab('depositar')}
                  className="px-5 py-2.5 rounded-xl font-bold text-white text-sm"
                  style={{ backgroundColor: '#003399' }}>
                  Fazer primeiro deposito
                </button>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#F5F5F0' }}>
                {historicoPagamentos.map((p) => {
                  const st = STATUS_MAP[p.status] ?? { label: p.status, bg: '#F5F5F0', color: '#888' }
                  return (
                    <div key={p.id} className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: st.bg }}>
                          {p.status === 'confirmado'
                            ? <Check className="w-4 h-4" style={{ color: st.color }} />
                            : p.status === 'falhado'
                            ? <X className="w-4 h-4" style={{ color: st.color }} />
                            : <Clock className="w-4 h-4" style={{ color: st.color }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm" style={{ color: '#1A1A2E' }}>{formatMT(p.valor)}</p>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg capitalize"
                              style={{ backgroundColor: p.tipo === 'inscricao' ? '#7c3aed12' : '#00339912', color: p.tipo === 'inscricao' ? '#7c3aed' : '#003399' }}>
                              {p.tipo}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {p.metodo?.toUpperCase()} · {new Date(p.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0"
                          style={{ backgroundColor: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </div>
                      {p.status === 'confirmado' && p.confirmado_at && (
                        <p className="text-xs text-gray-300 mt-1.5 ml-12">
                          Confirmado em {new Date(p.confirmado_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {p.status === 'falhado' && (
                        <p className="text-xs mt-1.5 ml-12" style={{ color: '#dc2626' }}>
                          Pagamento recusado pelo administrador.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── HISTÓRICO DEPÓSITOS ── */}
        {activeTab === 'historico' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b flex items-center justify-between" style={{ borderColor: '#F5F5F0' }}>
              <h2 className="font-black" style={{ color: '#003399' }}>Depositos Confirmados</h2>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ backgroundColor: '#1D9E7512', color: '#1D9E75' }}>
                {depositos.length} registos
              </span>
            </div>
            {depositos.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="font-semibold text-gray-400">Sem depositos confirmados</p>
                <p className="text-xs text-gray-300 mt-1">Aparecerao aqui apos confirmacao do admin.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#F5F5F0' }}>
                {depositos.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#1D9E7512' }}>
                      <TrendingUp className="w-4 h-4" style={{ color: '#1D9E75' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: '#1A1A2E' }}>{formatMT(d.valor)}</p>
                      <p className="text-xs text-gray-400">{formatDate(d.data_deposito)}</p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: '#1D9E7518', color: '#1D9E75' }}>
                      Confirmado
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px) saturate(180%)', borderColor: 'var(--border)' }}>
        <div className="max-w-2xl mx-auto px-2 py-2 grid grid-cols-5 gap-1">
          {[
            { id: 'home' as Tab, icon: <Home className="w-5 h-5" />, label: 'Inicio' },
            { id: 'depositar' as Tab, icon: <Wallet className="w-5 h-5" />, label: 'Depositar' },
            { id: 'pagamentos' as Tab, icon: <FileText className="w-5 h-5" />, label: 'Status' },
            { id: 'convite' as Tab, icon: <Gift className="w-5 h-5" />, label: 'Convite' },
            { id: 'historico' as Tab, icon: <Clock className="w-5 h-5" />, label: 'Depósitos' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all"
              style={{
                color: activeTab === tab.id ? '#003399' : '#aaa',
                backgroundColor: activeTab === tab.id ? '#00339910' : 'transparent',
              }}>
              {tab.icon}
              <span className="text-xs font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
          <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: '#003399', borderTopColor: 'transparent' }} />
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </DashboardErrorBoundary>
  )
}
