'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type FieldErrors = Record<string, string[] | undefined>

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setFieldErrors({})

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.details) {
          setFieldErrors(data.details)
        } else {
          setError(data.error ?? 'Login failed.')
        }
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Login failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Sign in</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {fieldErrors.username && (
            <p className="text-xs text-red-600">{fieldErrors.username[0]}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {fieldErrors.password && (
            <p className="text-xs text-red-600">{fieldErrors.password[0]}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        New to the team?{' '}
        <Link href="/register" className="text-blue-600 hover:underline font-medium">
          Create an account
        </Link>
      </p>
    </div>
  )
}
