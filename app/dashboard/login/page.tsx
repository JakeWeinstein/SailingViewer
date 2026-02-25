'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Anchor, Lock, User } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

type LoginMode = 'captain' | 'contributor'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<LoginMode>('contributor')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const body = mode === 'captain'
        ? { password }
        : { username, password }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Login failed.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Login failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-blue-600 rounded-xl shadow-lg mb-3">
            <Anchor className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Telltale</h1>
          <p className="text-sm text-gray-500 mt-1">Team dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
            {(['contributor', 'captain'] as LoginMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError('') }}
                className={clsx(
                  'flex-1 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
                  mode === m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {m === 'captain' ? 'Captain' : 'Contributor'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'contributor' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your username"
                    required
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'captain' ? 'Captain password' : 'Your password'}
                  required
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password || (mode === 'contributor' && !username)}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          {mode === 'contributor' && (
            <p className="mt-4 text-center text-xs text-gray-400">
              New to the team?{' '}
              <Link href="/dashboard/register" className="text-blue-600 hover:underline font-medium">
                Create an account
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
