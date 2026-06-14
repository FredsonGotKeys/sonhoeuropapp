import { Suspense } from 'react'
import RegisterForm from './RegisterForm'

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #003399 0%, #1D9E75 100%)' }}
        >
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
