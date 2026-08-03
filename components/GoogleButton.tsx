'use client'

import { useState } from 'react'
import { iniciarLoginGoogle } from '@/app/actions/auth'

export default function GoogleButton({ codigoConvite, label }: {
  codigoConvite?: string
  label?: string
}) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const entrar = async () => {
    setLoading(true)
    setErro('')
    const res = await iniciarLoginGoogle(codigoConvite)
    if (res.url) { window.location.href = res.url; return }
    setErro(res.error ?? 'Não foi possível iniciar o login')
    setLoading(false)
  }

  return (
    <>
      <button type="button" onClick={entrar} disabled={loading}
        className="btn w-full"
        style={{
          padding: '11px 20px',
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border)',
          color: 'var(--fg)',
          fontWeight: 600,
        }}>
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 rounded-full animate-spin inline-block"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--cobalt)' }} />
            A abrir o Google...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            {label ?? 'Continuar com Google'}
          </span>
        )}
      </button>

      {erro && (
        <div className="mt-3 p-3 rounded-md text-sm font-medium"
          style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>
          {erro}
        </div>
      )}
    </>
  )
}
