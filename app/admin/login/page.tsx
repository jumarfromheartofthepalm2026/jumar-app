'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_PASSWORD = 'jumar2026'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  function login() {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('jumar_admin', 'true')
      router.push('/admin')
    } else {
      setError(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-jumar-cream p-6">
      <div className="bg-white rounded-2xl p-8 shadow-lg w-full max-w-sm text-center">
        <div className="text-4xl mb-4">🌿</div>
        <h1 className="text-2xl font-bold text-jumar-brown mb-6">لوحة تحكم جُمار</h1>
        <input type="password" placeholder="كلمة السر" value={password}
          onChange={e => { setPassword(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && login()}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center mb-3 focus:outline-none focus:border-jumar-gold" />
        {error && <p className="text-red-500 text-sm mb-3">كلمة السر غلط</p>}
        <button onClick={login}
          className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90">
          دخول
        </button>
      </div>
    </div>
  )
}
