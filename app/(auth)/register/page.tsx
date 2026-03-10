'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type FieldErrors = Record<string, string[] | undefined>

export default function RegisterPage() {
  const router = useRouter()
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, username, displayName, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          setError('Invalid invite code. Please check with your captain.')
        } else if (res.status === 409) {
          setError('That username is already taken. Please choose another.')
        } else if (data.details) {
          setFieldErrors(data.details)
        } else {
          setError(data.error ?? 'Registration failed.')
        }
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Registration failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Create account</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Invite code</label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Team invite code"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {fieldErrors.inviteCode && (
            <p className="text-xs text-red-600">{fieldErrors.inviteCode[0]}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {fieldErrors.displayName && (
            <p className="text-xs text-red-600">{fieldErrors.displayName[0]}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="choose_a_username"
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
            placeholder="At least 8 characters"
            autoComplete="new-password"
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
          disabled={loading || !inviteCode || !username || !displayName || !password}
          className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
