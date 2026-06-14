'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, Check, Mail } from 'lucide-react'
import { register } from '@/app/actions/auth'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 6,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
  ]
  const strength = checks.filter(Boolean).length
  const colors = ['#e5e7eb', '#ef4444', '#EF9F27', '#1D9E75']
  const labels = ['', 'Fraca', 'Média', 'Forte']

  if (!password) return null

  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: i < strength ? colors[strength] : '#e5e7eb' }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: colors[strength] }}>
        {labels[strength]}
        {strength < 3 && <span className="text-gray-400"> · adiciona maiúsculas e números</span>}
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
  const [form, setForm] = useState({
    email: '',
    password: '',
    nome: '',
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
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(160deg, #001f6b 0%, #003399 50%, #1D9E75 100%)' }}
      >
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: '#1D9E7515', border: '2px solid #1D9E7530' }}
          >
            <Mail className="w-7 h-7" style={{ color: '#1D9E75' }} />
          </div>
          <h2 className="font-black text-xl mb-2" style={{ color: '#003399' }}>Confirma o teu email</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Enviámos um link de confirmação para{' '}
            <strong className="text-gray-600">{form.email}</strong>.
            Clica no link para activar a conta.
          </p>
          <Link
            href="/login"
            className="block w-full py-3 rounded-xl font-bold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#003399' }}
          >
            Ir para o Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(160deg, #001f6b 0%, #003399 50%, #1D9E75 100%)' }}
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex flex-col items-center gap-2 group">
          <Image
            src="/images/logo.avif"
            alt="SonhoEuropa"
            width={64}
            height={64}
            className="rounded-2xl shadow-lg group-hover:scale-105 transition-transform"
          />
          <h1 className="text-white font-black text-2xl tracking-tight">SonhoEuropa</h1>
        </Link>
        <p className="text-white/50 text-sm mt-1">Cria a tua conta e começa a sonhar</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Card header */}
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: '#F5F5F0' }}>
          <h2 className="font-black text-xl" style={{ color: '#003399' }}>Criar conta</h2>
          <p className="text-xs text-gray-400 mt-0.5">Demora menos de 1 minuto</p>
        </div>

        {/* Invite banner */}
        {inviteCode && (
          <div
            className="mx-6 mt-4 px-4 py-3 rounded-xl flex items-center gap-2.5"
            style={{ backgroundColor: '#1D9E7510', border: '1.5px solid #1D9E7530' }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1D9E75' }}>
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: '#1D9E75' }}>Convite detectado!</p>
              <p className="text-xs text-gray-400">Ganhas 50 pontos bónus ao registares-te</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
              Nome completo
            </label>
            <input
              type="text"
              required
              value={form.nome}
              onChange={set('nome')}
              placeholder="Ex: João Silva"
              className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
              style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}
              onFocus={(e) => { e.target.style.borderColor = '#003399'; e.target.style.backgroundColor = 'white' }}
              onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = '#fafafa' }}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              placeholder="exemplo@email.com"
              className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
              style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}
              onFocus={(e) => { e.target.style.borderColor = '#003399'; e.target.style.backgroundColor = 'white' }}
              onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = '#fafafa' }}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={form.password}
                onChange={set('password')}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-3 pr-12 rounded-xl border-2 text-sm outline-none transition-all"
                style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}
                onFocus={(e) => { e.target.style.borderColor = '#003399'; e.target.style.backgroundColor = 'white' }}
                onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = '#fafafa' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrength password={form.password} />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
              Código de convite
              {!inviteCode && <span className="text-gray-300 font-normal normal-case tracking-normal ml-1">(opcional)</span>}
            </label>
            <input
              type="text"
              value={form.codigoConvite}
              onChange={(e) => setForm((f) => ({ ...f, codigoConvite: e.target.value.toUpperCase() }))}
              placeholder="Ex: ABCD1234"
              className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all font-mono uppercase tracking-widest"
              style={{
                borderColor: form.codigoConvite ? '#1D9E75' : '#e5e7eb',
                backgroundColor: form.codigoConvite ? '#1D9E7508' : '#fafafa',
              }}
            />
            {form.codigoConvite && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#1D9E75' }}>
                <Check className="w-3 h-3" /> +50 pontos de bónus ao activar
              </p>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-xl text-sm text-red-600 bg-red-50 border border-red-100 flex items-start gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-black text-white transition-all active:scale-95 disabled:opacity-60 shadow-md"
            style={{ backgroundColor: '#003399', boxShadow: '0 4px 16px rgba(0,51,153,0.3)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                A criar conta...
              </span>
            ) : 'Criar conta →'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Já tens conta?{' '}
            <Link href="/login" className="font-semibold" style={{ color: '#003399' }}>
              Entrar
            </Link>
          </p>
        </form>
      </div>

      <Link href="/" className="mt-6 text-white/30 text-xs hover:text-white/60 transition-colors">
        ← Voltar ao início
      </Link>
    </div>
  )
}
