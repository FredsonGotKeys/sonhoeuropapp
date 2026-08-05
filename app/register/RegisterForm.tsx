'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, Check, Mail, ArrowRight, ArrowLeft } from 'lucide-react'
import { register } from '@/app/actions/auth'
import GoogleButton from '@/components/GoogleButton'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 6,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
  ]
  const strength = checks.filter(Boolean).length
  const colors = ['var(--slate-200)', 'var(--red)', 'var(--amber)', 'var(--emerald)']
  const labels = ['', 'Fraca', 'Média', 'Forte']

  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: i < strength ? colors[strength] : 'var(--slate-200)' }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: colors[strength] }}>
        {labels[strength]}
        {strength < 3 && <span style={{ color: 'var(--fg-subtle)' }}> · maiúsculas e números</span>}
      </p>
    </div>
  )
}

export default function RegisterForm() {
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('ref') ?? ''

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [aceitaTermos, setAceitaTermos] = useState(false)
  const [mostrarEmail, setMostrarEmail] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    nome: '',
    telefone: '',
    codigoConvite: inviteCode,
  })

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await register(form)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.needsConfirmation) {
      setConfirmed(true)
      setLoading(false)
    }
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
        <div className="card p-8 max-w-sm w-full text-center animate-enter-scale">
          <div
            className="w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--emerald-muted)', color: 'var(--emerald)' }}
          >
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="t-heading text-xl mb-2" style={{ color: 'var(--fg)' }}>Confirma o teu email</h2>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
            Enviámos um link para <strong style={{ color: 'var(--fg)' }}>{form.email}</strong>.
            Clica para activar a conta.
          </p>
          <Link href="/login" className="btn btn-primary w-full" style={{ padding: '11px 20px' }}>
            Ir para o Login <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12" style={{ background: 'var(--bg)' }}>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-10 animate-enter-down">
        <Image src="/images/logo.avif" alt="SonhoEuropa" width={36} height={36} className="rounded-lg" />
        <span className="font-extrabold text-lg tracking-tight" style={{ color: 'var(--fg)' }}>
          Sonho<span style={{ color: 'var(--cobalt)' }}>Europa</span>
        </span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-[400px] animate-enter-up delay-1">
        <div className="card p-6">
          <h2 className="t-heading text-xl mb-1" style={{ color: 'var(--fg)' }}>Criar conta</h2>
          <p className="text-sm mb-5" style={{ color: 'var(--fg-muted)' }}>Demora menos de 1 minuto</p>

          {inviteCode && (
            <div className="flex items-center gap-3 p-3 rounded-md mb-5" style={{ background: 'var(--emerald-muted)', border: '1px solid var(--emerald)' }}>
              <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--emerald)' }} />
              <div>
                <p className="text-xs font-bold" style={{ color: 'var(--emerald-dark)' }}>Convite detectado</p>
                <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Foste convidado por um participante</p>
              </div>
            </div>
          )}

          <GoogleButton codigoConvite={form.codigoConvite} label="Criar conta com Google" />

          {!mostrarEmail && (
            <button type="button" onClick={() => setMostrarEmail(true)}
              className="w-full mt-4 text-xs hover:underline"
              style={{ color: 'var(--fg-subtle)' }}>
              Prefiro usar email e senha
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
              <label className="t-label block mb-1.5">Nome completo</label>
              <input type="text" required value={form.nome} onChange={set('nome')} placeholder="Ex: João Silva" className="input" />
            </div>

            <div>
              <label className="t-label block mb-1.5">Email</label>
              <input type="email" required value={form.email} onChange={set('email')} autoComplete="email" placeholder="exemplo@email.com" className="input" />
            </div>

            <div>
              <label className="t-label block mb-1.5">Número de telefone</label>
              <input
                type="tel"
                required
                inputMode="numeric"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                autoComplete="tel"
                placeholder="84xxxxxxx"
                className="input t-mono"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
                Usado para te pagarmos o prémio se ganhares
              </p>
            </div>

            <div>
              <label className="t-label block mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
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
              <PasswordStrength password={form.password} />
            </div>

            <div>
              <label className="t-label block mb-1.5">
                Código de convite
                {!inviteCode && <span className="font-normal normal-case tracking-normal ml-1" style={{ color: 'var(--fg-subtle)' }}>(opcional)</span>}
              </label>
              <input
                type="text"
                value={form.codigoConvite}
                onChange={(e) => setForm((f) => ({ ...f, codigoConvite: e.target.value.toUpperCase() }))}
                placeholder="Ex: ABCD1234"
                className="input t-mono uppercase"
                style={form.codigoConvite ? { borderColor: 'var(--emerald)', background: 'var(--emerald-muted)' } : {}}
              />
              {form.codigoConvite && (
                <p className="text-xs mt-1 flex items-center gap-1 font-medium" style={{ color: 'var(--emerald)' }}>
                  <Check className="w-3 h-3" /> Código de convite válido
                </p>
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aceitaTermos}
                onChange={e => setAceitaTermos(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[var(--cobalt)]"
              />
              <span className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                Li e aceito os{' '}
                <Link href="/termos" target="_blank" className="font-bold underline" style={{ color: 'var(--cobalt)' }}>
                  Termos e Condições
                </Link>{' '}
                do SonhoEuropa
              </span>
            </label>

            {error && (
              <div className="p-3 rounded-md text-sm font-medium animate-enter-scale" style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !aceitaTermos} className="btn btn-primary w-full" style={{ padding: '11px 20px', opacity: aceitaTermos ? 1 : 0.5 }}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  A criar conta...
                </span>
              ) : (
                <>Criar conta <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

          </form>
          </>
          )}

          <p className="text-center text-xs mt-5" style={{ color: 'var(--fg-muted)' }}>
            Já tens conta?{' '}
            <Link href="/login" className="font-bold hover:underline" style={{ color: 'var(--cobalt)' }}>Entrar</Link>
          </p>
        </div>
      </div>

      <Link href="/" className="mt-8 text-xs flex items-center gap-1 group" style={{ color: 'var(--fg-subtle)' }}>
        <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /> Voltar ao início
      </Link>
    </div>
  )
}
