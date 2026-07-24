'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield, ArrowRight } from 'lucide-react'
import { verifyAdminPassword } from '@/app/actions/admin'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await verifyAdminPassword(password)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/admin')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 grain relative" style={{ background: 'var(--bg-dark)' }}>
      <div className="w-full max-w-[360px] animate-enter-up">
        <div
          className="rounded-xl overflow-hidden p-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="text-center mb-6">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center mx-auto mb-3"
              style={{ background: 'var(--cobalt)', color: 'white' }}
            >
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="t-heading text-lg text-white">Admin · SonhoEuropa</h1>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Acesso restrito</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="t-label block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Senha de administrador"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-md text-sm text-white outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', paddingRight: 44 }}
                  onFocus={e => (e.target.style.borderColor = 'var(--cobalt)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-md text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full" style={{ padding: '11px 20px' }}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  A verificar...
                </span>
              ) : (
                <>Entrar <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
