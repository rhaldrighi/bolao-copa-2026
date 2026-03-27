'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError('Erro ao enviar email. Verifique o endereço e tente novamente.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen copa-header flex flex-col items-center justify-center p-4">
      {/* Logo / Title */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">⚽</div>
        <h1 className="text-4xl font-black text-yellow-400 tracking-tight drop-shadow">
          BOLÃO
        </h1>
        <h2 className="text-2xl font-bold text-white">Copa do Mundo 2026</h2>
        <p className="text-green-200 mt-1 text-sm">EUA • Canadá • México</p>
        <p className="text-green-300 text-xs mt-1">11 Jun – 19 Jul 2026</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        {!sent ? (
          <>
            <h3 className="text-xl font-bold text-gray-800 mb-1 text-center">
              Entrar no Bolão
            </h3>
            <p className="text-gray-500 text-sm text-center mb-6">
              Digite seu email e enviaremos um link de acesso
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-300
                           text-white font-bold py-3 rounded-lg transition-colors text-sm"
              >
                {loading ? 'Enviando...' : 'Enviar link de acesso'}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-4">
              Sem senha necessária. Acesso por link no seu email.
            </p>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">📧</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Email enviado!</h3>
            <p className="text-gray-600 text-sm mb-4">
              Acesse <strong>{email}</strong> e clique no link para entrar no bolão.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="text-green-700 text-sm underline"
            >
              Usar outro email
            </button>
          </div>
        )}
      </div>

      <p className="text-green-200 text-xs mt-6">R$50 por participante • 1° R$750 • 2° R$375</p>
    </main>
  )
}
