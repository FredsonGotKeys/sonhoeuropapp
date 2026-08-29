'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react'
import { login } from '@/app/actions/auth'
import GoogleButton from '@/components/GoogleButton'
import { EuropaWatermark } from '@/components/EuropaWatermark'

function LoginConteudo() {
  const searchParams = useSearchParams()
  const erroGoogle = searchParams.get('erro') === 'google'

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [mostrarEmail, setMostrarEmail] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-5 py-12" style={{ background: 'var(--bg)' }}>
      <EuropaWatermark
        size={520}
        color="var(--cobalt)"
        opacity={0.05}
        className="absolute -top-32 left-1/2 -translate-x-1/2"
      />

      {/* Logo */}
      <Link href="/" className="relative z-10 flex items-center gap-2.5 mb-10 animate-enter-down">
        <Image src="/images/logo.avif" alt="SonhoEuropa" width={36} height={36} className="rounded-lg" />
        <span className="font-extrabold text-lg tracking-tight" style={{ color: 'var(--fg)' }}>
          Sonho<span style={{ color: 'var(--cobalt)' }}>Europa</span>
        </span>
      </Link>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[380px] animate-enter-up delay-1">
        <div className="card p-6">
          <h2 className="t-heading text-xl mb-1" style={{ color: 'var(--fg)' }}>Entrar na conta</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>Rápido e sem senhas para memorizar</p>

          {erroGoogle && (
            <div className="p-3 rounded-md text-sm font-medium mb-4"
              style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>
              Não foi possível entrar com o Google. Tenta novamente.
            </div>
          )}

          <GoogleButton label="Entrar com Google" />

          {!mostrarEmail && (
            <button type="button" onClick={() => setMostrarEmail(true)}
              className="w-full mt-4 text-xs hover:underline"
              style={{ color: 'var(--fg-subtle)' }}>
              Entrar com email e senha
            </button>
          )}

          {mostrarEmail && (
          <>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="t-label block mb-1.5">Email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="exemplo@email.com"
                className="input"
              />
            </div>

            <div>
              <label className="t-label block mb-1.5">Senha</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="A tua senha"
                  className="input"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: 'var(--fg-subtle)' }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-md text-sm font-medium animate-enter-scale" style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full" style={{ padding: '11px 20px' }}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  A entrar...
                </span>
              ) : (
                <>Entrar <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
          </>
          )}

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <Link href="/register" className="btn btn-outline w-full" style={{ padding: '11px 20px' }}>
            Criar conta nova
          </Link>
        </div>
      </div>

      <Link href="/" className="relative z-10 mt-8 text-xs flex items-center gap-1 group" style={{ color: 'var(--fg-subtle)' }}>
        <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /> Voltar ao início
      </Link>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--cobalt)' }} />
      </div>
    }>
      <LoginConteudo />
    </Suspense>
  )
}
