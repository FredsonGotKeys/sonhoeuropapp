'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { verifyAdminPassword } from '@/app/actions/admin'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#003399' }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg mx-auto mb-3"
            style={{ backgroundColor: '#003399' }}
          >
            SE
          </div>
          <h1 className="font-black text-xl" style={{ color: '#003399' }}>
            Admin · SonhoEuropa
          </h1>
          <p className="text-gray-400 text-sm mt-1">Acesso restrito</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Senha de administrador"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-colors"
            style={{ borderColor: '#e5e7eb' }}
            onFocus={(e) => (e.target.style.borderColor = '#003399')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
            required
          />

          {error && (
            <div className="p-3 rounded-xl text-sm text-red-600 bg-red-50 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#003399' }}
          >
            {loading ? 'A verificar...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
