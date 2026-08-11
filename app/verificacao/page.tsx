'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ShieldCheck, Camera, IdCard, Clock, XCircle, FileDown, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getEstadoVerificacao, submeterVerificacao, getMeuContratoUrl } from '@/app/actions/verificacao'

type Status = 'nao_iniciado' | 'pendente' | 'rejeitado' | 'aprovado'

export default function VerificacaoPage() {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [status, setStatus] = useState<Status>('nao_iniciado')
  const [motivoRejeicao, setMotivoRejeicao] = useState<string | null>(null)
  const [verificacaoId, setVerificacaoId] = useState<string | null>(null)

  const [biNumero, setBiNumero] = useState('')
  const [biImagem, setBiImagem] = useState<File | null>(null)
  const [selfieImagem, setSelfieImagem] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState('')

  const [contratoLoading, setContratoLoading] = useState(false)

  const biInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)

  const carregarEstado = async () => {
    const estado = await getEstadoVerificacao()
    if (!estado.autenticado) { router.replace('/login'); return }
    if (estado.verificado) { router.replace('/dashboard'); return }
    setStatus(estado.status)
    setMotivoRejeicao(estado.motivoRejeicao)
    setVerificacaoId(estado.verificacaoId)
    setCarregando(false)
  }

  useEffect(() => { carregarEstado() }, [])

  const submeter = async () => {
    setErro('')
    if (!biImagem || !selfieImagem) { setErro('Envia a foto do BI e a selfie.'); return }
    const biLimpo = biNumero.trim().toUpperCase()
    if (biLimpo.length < 6) { setErro('Número de BI inválido.'); return }

    setEnviando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const novoId = crypto.randomUUID()
      const extBi = biImagem.name.split('.').pop() ?? 'jpg'
      const extSelfie = selfieImagem.name.split('.').pop() ?? 'jpg'
      const biPath = `${user.id}/${novoId}/bi.${extBi}`
      const selfiePath = `${user.id}/${novoId}/selfie.${extSelfie}`

      setProgresso('A enviar foto do BI...')
      const upBi = await supabase.storage.from('verificacoes').upload(biPath, biImagem, { contentType: biImagem.type })
      if (upBi.error) { setErro('Erro ao enviar foto do BI: ' + upBi.error.message); setEnviando(false); setProgresso(''); return }

      setProgresso('A enviar selfie...')
      const upSelfie = await supabase.storage.from('verificacoes').upload(selfiePath, selfieImagem, { contentType: selfieImagem.type })
      if (upSelfie.error) { setErro('Erro ao enviar selfie: ' + upSelfie.error.message); setEnviando(false); setProgresso(''); return }

      setProgresso('A gerar o contrato...')
      const res = await submeterVerificacao({
        verificacaoId: novoId,
        biNumero: biLimpo,
        biImagemPath: biPath,
        selfieImagemPath: selfiePath,
      })
      if (res.error) { setErro(res.error); setEnviando(false); setProgresso(''); return }

      setEnviando(false)
      setProgresso('')
      await carregarEstado()
    } catch (e) {
      console.error('[verificacao] Falha ao submeter:', e)
      setErro('Algo correu mal. Tenta novamente.')
      setEnviando(false)
      setProgresso('')
    }
  }

  const descarregarContrato = async () => {
    if (!verificacaoId) return
    setContratoLoading(true)
    const res = await getMeuContratoUrl(verificacaoId)
    setContratoLoading(false)
    if (res.error) { setErro(res.error); return }
    if (res.url) window.open(res.url, '_blank')
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--cobalt)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12" style={{ background: 'var(--bg)' }}>
      <Link href="/" className="flex items-center gap-2.5 mb-10 animate-enter-down">
        <Image src="/images/logo.avif" alt="SonhoEuropa" width={36} height={36} className="rounded-lg" />
        <span className="font-extrabold text-lg tracking-tight" style={{ color: 'var(--fg)' }}>
          Sonho<span style={{ color: 'var(--cobalt)' }}>Europa</span>
        </span>
      </Link>

      <div className="w-full max-w-[440px] animate-enter-up delay-1">
        <div className="card p-6">
          {status === 'pendente' && (
            <div className="text-center">
              <Clock className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--cobalt)' }} />
              <h2 className="t-heading text-xl mb-1" style={{ color: 'var(--fg)' }}>Verificação em análise</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>
                Recebemos o teu BI e selfie. Assim que o admin confirmar, tens acesso ao dashboard.
              </p>
              <button onClick={descarregarContrato} disabled={contratoLoading} className="btn btn-secondary w-full" style={{ padding: '11px 20px' }}>
                <FileDown className="w-4 h-4" /> {contratoLoading ? 'A gerar...' : 'Descarregar contrato'}
              </button>
              {erro && <p className="text-xs mt-3" style={{ color: 'var(--red)' }}>{erro}</p>}
            </div>
          )}

          {status !== 'pendente' && (
            <>
              <h2 className="t-heading text-xl mb-1" style={{ color: 'var(--fg)' }}>Verificação de identidade</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>
                Por segurança, precisamos de confirmar quem és antes de liberares o dashboard.
              </p>

              {status === 'rejeitado' && (
                <div className="p-3 rounded-md text-sm mb-4" style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>
                  <p className="font-bold flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Pedido rejeitado</p>
                  {motivoRejeicao && <p className="mt-1">{motivoRejeicao}</p>}
                  <p className="mt-1">Podes submeter novamente com fotos mais nítidas.</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="t-label block mb-1.5">Número do BI</label>
                  <input
                    type="text" required value={biNumero}
                    onChange={(e) => setBiNumero(e.target.value)}
                    placeholder="Ex: 110100123456A" className="input t-mono"
                  />
                </div>

                <div>
                  <label className="t-label block mb-1.5">Foto do BI (frente)</label>
                  <input ref={biInputRef} type="file" accept="image/*" capture="environment"
                    onChange={(e) => setBiImagem(e.target.files?.[0] ?? null)} className="hidden" />
                  <button type="button" onClick={() => biInputRef.current?.click()}
                    className="btn btn-secondary w-full justify-start" style={{ padding: '11px 16px' }}>
                    <IdCard className="w-4 h-4" /> {biImagem ? biImagem.name : 'Escolher foto do BI'}
                  </button>
                </div>

                <div>
                  <label className="t-label block mb-1.5">Selfie (a tua cara, bem visível)</label>
                  <input ref={selfieInputRef} type="file" accept="image/*" capture="user"
                    onChange={(e) => setSelfieImagem(e.target.files?.[0] ?? null)} className="hidden" />
                  <button type="button" onClick={() => selfieInputRef.current?.click()}
                    className="btn btn-secondary w-full justify-start" style={{ padding: '11px 16px' }}>
                    <Camera className="w-4 h-4" /> {selfieImagem ? selfieImagem.name : 'Tirar/escolher selfie'}
                  </button>
                </div>

                {erro && (
                  <div className="p-3 rounded-md text-sm font-medium animate-enter-scale"
                    style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>
                    {erro}
                  </div>
                )}

                <button onClick={submeter} disabled={enviando} className="btn btn-primary w-full" style={{ padding: '11px 20px' }}>
                  {enviando ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      {progresso || 'A enviar...'}
                    </span>
                  ) : (
                    <><Upload className="w-4 h-4" /> Submeter para revisão <ShieldCheck className="w-4 h-4" /></>
                  )}
                </button>

                <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-subtle)' }}>
                  As fotos e o contrato ficam guardados apenas 72 horas. Depois de aprovado, o teu acesso fica confirmado para sempre.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
