'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { completarPerfil, getEstadoPerfil } from '@/app/actions/auth'

export default function CompletarPerfilPage() {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [aceitaTermos, setAceitaTermos] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '' })

  useEffect(() => {
    getEstadoPerfil().then((estado) => {
      if (!estado.autenticado) { router.replace('/login'); return }
      if (estado.temPerfil) { router.replace('/dashboard'); return }
      setForm((f) => ({ ...f, nome: estado.nomeSugerido }))
      setCarregando(false)
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const res = await completarPerfil(form)
    if (res?.error) { setErro(res.error); setLoading(false) }
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

      <div className="w-full max-w-[400px] animate-enter-up delay-1">
        <div className="card p-6">
          <h2 className="t-heading text-xl mb-1" style={{ color: 'var(--fg)' }}>Quase lá</h2>
          <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>
            Falta só confirmar os teus dados
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="t-label block mb-1.5">Nome completo</label>
              <input
                type="text" required value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: João Silva" className="input"
              />
            </div>

            <div>
              <label className="t-label block mb-1.5">Número de telefone</label>
              <input
                type="tel" required inputMode="numeric" autoComplete="tel"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                placeholder="84xxxxxxx" className="input t-mono"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
                É para aqui que enviamos o prémio se ganhares
              </p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox" checked={aceitaTermos}
                onChange={(e) => setAceitaTermos(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[var(--cobalt)]"
              />
              <span className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                Li e aceito os{' '}
                <Link href="/dashboard#termos" target="_blank" className="font-bold underline" style={{ color: 'var(--cobalt)' }}>
                  Termos e Condições
                </Link>{' '}
                do SonhoEuropa
              </span>
            </label>

            {erro && (
              <div className="p-3 rounded-md text-sm font-medium animate-enter-scale"
                style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>
                {erro}
              </div>
            )}

            <button type="submit" disabled={loading || !aceitaTermos}
              className="btn btn-primary w-full"
              style={{ padding: '11px 20px', opacity: aceitaTermos ? 1 : 0.5 }}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  A guardar...
                </span>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Concluir <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
