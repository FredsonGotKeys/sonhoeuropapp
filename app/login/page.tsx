'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
        <p className="text-white/50 text-sm mt-1">Bem-vindo de volta!</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Card header */}
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: '#F5F5F0' }}>
          <h2 className="font-black text-xl" style={{ color: '#003399' }}>Entrar na conta</h2>
          <p className="text-xs text-gray-400 mt-0.5">Insere o teu email e senha para continuar</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="exemplo@email.com"
              className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
              style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}
              onFocus={(e) => {
                e.target.style.borderColor = '#003399'
                e.target.style.backgroundColor = 'white'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.backgroundColor = '#fafafa'
              }}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="A tua senha"
                className="w-full px-4 py-3 pr-12 rounded-xl border-2 text-sm outline-none transition-all"
                style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#003399'
                  e.target.style.backgroundColor = 'white'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb'
                  e.target.style.backgroundColor = '#fafafa'
                }}
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
                A entrar...
              </span>
            ) : 'Entrar →'}
          </button>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px" style={{ backgroundColor: '#e5e7eb' }} />
            <span className="text-xs text-gray-400">ou</span>
            <div className="flex-1 h-px" style={{ backgroundColor: '#e5e7eb' }} />
          </div>

          <Link
            href="/register"
            className="block w-full py-3 rounded-xl font-semibold text-sm text-center border-2 transition-all hover:bg-gray-50 active:scale-95"
            style={{ borderColor: '#003399', color: '#003399' }}
          >
            Criar conta nova
          </Link>
        </form>
      </div>

      <Link href="/" className="mt-6 text-white/30 text-xs hover:text-white/60 transition-colors">
        ← Voltar ao início
      </Link>
    </div>
  )
}
