'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, RotateCcw, Shield, Trash2, KeyRound, Check, X } from 'lucide-react'
import clsx from 'clsx'

type TeamUser = {
  id: string
  username: string
  display_name: string
  role: 'captain' | 'contributor' | 'viewer'
  is_active: boolean
  is_seed: boolean
  last_login_at: string | null
  created_at: string
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ROLE_LABELS: Record<string, string> = {
  captain: 'Captain',
  contributor: 'Contributor',
  viewer: 'Viewer',
}

const ROLE_BADGE: Record<string, string> = {
  captain: 'bg-blue-100 text-blue-700',
  contributor: 'bg-green-100 text-green-700',
  viewer: 'bg-gray-100 text-gray-500',
}

export default function TeamManager() {
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Failed to load users')
      setUsers(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchInviteCode = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/invite-code')
      if (!res.ok) return
      const data = await res.json()
      setInviteCode(data.inviteCode)
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchInviteCode()
  }, [fetchUsers, fetchInviteCode])

  async function handleRoleChange(userId: string, newRole: string) {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to update role')
      return
    }
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole as TeamUser['role'] } : u))
  }

  async function handleToggleActive(user: TeamUser) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to update status')
      return
    }
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
  }

  async function handleDelete(userId: string) {
    if (!confirm('Are you sure? This will permanently delete this user and all their content.')) return
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to delete user')
      return
    }
    setUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  async function handleResetPassword(userId: string) {
    if (resetPassword.length < 8) {
      setResetError('Password must be at least 8 characters')
      return
    }
    setResetLoading(true)
    setResetError(null)
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temporaryPassword: resetPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        setResetError(data.error ?? 'Failed to reset password')
        return
      }
      setResetTarget(null)
      setResetPassword('')
    } finally {
      setResetLoading(false)
    }
  }

  async function handleRotateInviteCode() {
    if (!confirm('Rotate the invite code? The old code will stop working immediately.')) return
    const res = await fetch('/api/settings/invite-code', { method: 'POST' })
    if (!res.ok) return
    const data = await res.json()
    setInviteCode(data.inviteCode)
  }

  async function handleCopyInviteCode() {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Team</h2>
        <p className="text-xs text-gray-400 mt-0.5">Manage team members and invite code</p>
      </div>

      {/* Invite Code */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-700">Invite Code</h3>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 truncate">
            {inviteCode ?? 'Loading…'}
          </code>
          <button
            onClick={handleCopyInviteCode}
            disabled={!inviteCode}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleRotateInviteCode}
            disabled={!inviteCode}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Rotate
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* User Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last login</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => (
                  <>
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800">{user.display_name}</p>
                        <p className="text-xs text-gray-400">@{user.username}</p>
                        {user.is_seed && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium mt-0.5">
                            <Shield className="h-3 w-3" />
                            Seed captain
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={user.is_seed}
                          className={clsx(
                            'text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500',
                            ROLE_BADGE[user.role],
                            user.is_seed && 'opacity-70 cursor-not-allowed'
                          )}
                        >
                          <option value="captain">Captain</option>
                          <option value="contributor">Contributor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <span className={clsx(
                          'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                          user.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        )}>
                          <span className={clsx('h-1.5 w-1.5 rounded-full', user.is_active ? 'bg-green-500' : 'bg-gray-400')} />
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-500">{formatDate(user.created_at)}</td>
                      <td className="px-4 py-4 text-xs text-gray-500">{timeAgo(user.last_login_at)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handleToggleActive(user)}
                            disabled={user.is_seed}
                            className={clsx(
                              'px-2.5 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                              user.is_active
                                ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                : 'text-green-600 bg-green-50 hover:bg-green-100'
                            )}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => {
                              setResetTarget(user.id === resetTarget ? null : user.id)
                              setResetPassword('')
                              setResetError(null)
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Reset password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={user.is_seed}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {resetTarget === user.id && (
                      <tr key={`${user.id}-reset`} className="bg-blue-50">
                        <td colSpan={6} className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-blue-700 shrink-0">Temporary password for @{user.username}:</span>
                            <input
                              type="text"
                              value={resetPassword}
                              onChange={(e) => setResetPassword(e.target.value)}
                              placeholder="Min 8 characters"
                              className="flex-1 text-sm border border-blue-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              disabled={resetLoading}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                            >
                              {resetLoading ? 'Setting…' : 'Set password'}
                            </button>
                            <button
                              onClick={() => { setResetTarget(null); setResetPassword(''); setResetError(null) }}
                              className="p-1.5 text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {resetError && (
                            <p className="text-xs text-red-600 mt-1.5">{resetError}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
