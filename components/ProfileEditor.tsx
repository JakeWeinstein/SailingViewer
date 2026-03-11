'use client'

import { useState, useEffect } from 'react'
import { User, Lock, Check, AlertCircle, Bookmark, Trash2, Loader2 } from 'lucide-react'
import { formatTime } from '@/lib/types'
import { timeAgo } from '@/lib/comment-utils'
import clsx from 'clsx'

interface Props {
  user: {
    id: string
    username: string
    displayName: string
    role: 'captain' | 'contributor' | 'viewer'
  }
}

interface SavedBookmark {
  id: string
  video_id: string
  session_id: string | null
  timestamp_seconds: number
  video_title: string | null
  created_at: string
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

export default function ProfileEditor({ user }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<SavedBookmark[]>([])
  const [loadingBookmarks, setLoadingBookmarks] = useState(true)

  useEffect(() => {
    fetch('/api/bookmarks')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (Array.isArray(data)) setBookmarks(data) })
      .catch(() => {})
      .finally(() => setLoadingBookmarks(false))
  }, [])

  async function handleDeleteBookmark(bookmarkId: string) {
    try {
      const res = await fetch(`/api/bookmarks/${bookmarkId}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
      }
    } catch { /* silent */ }
  }

  function handleBookmarkClick(bookmark: SavedBookmark) {
    const params = new URLSearchParams()
    params.set('video', bookmark.video_id)
    if (bookmark.session_id) params.set('session', bookmark.session_id)
    window.location.href = `/?${params.toString()}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setSuccess(false)

    // Client-side validation
    if (newPassword && newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: ['Passwords do not match'] })
      return
    }

    const body: Record<string, string> = {}
    if (displayName !== user.displayName) body.displayName = displayName
    if (newPassword) {
      body.currentPassword = currentPassword
      body.newPassword = newPassword
    }

    if (Object.keys(body).length === 0) {
      setError('No changes to save.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.details) setFieldErrors(data.details)
        else setError(data.error ?? 'Failed to save profile')
        return
      }
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Profile</h2>
        <p className="text-xs text-gray-400 mt-0.5">Update your display name and password</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Identity */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-700">Identity</h3>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {fieldErrors.displayName && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.displayName[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Username</label>
            <input
              type="text"
              value={user.username}
              readOnly
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">Username cannot be changed.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
            <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', ROLE_BADGE[user.role])}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-700">Change Password</h3>
          </div>
          <p className="text-xs text-gray-400 -mt-2">Leave blank to keep your current password.</p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {fieldErrors.currentPassword && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.currentPassword[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {fieldErrors.newPassword && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.newPassword[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmPassword[0]}</p>
            )}
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <Check className="h-4 w-4 shrink-0" />
            Profile updated successfully.
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Saved Bookmarks */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bookmark className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-700">Saved Bookmarks</h3>
        </div>

        {loadingBookmarks && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bookmarks…
          </div>
        )}

        {!loadingBookmarks && bookmarks.length === 0 && (
          <p className="text-xs text-gray-400 italic py-4">
            No bookmarks yet. Use the bookmark icon while watching a video to save a timestamp.
          </p>
        )}

        {!loadingBookmarks && bookmarks.length > 0 && (
          <div className="space-y-2">
            {bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="flex items-center gap-3 group hover:bg-gray-50 rounded-lg px-3 py-2.5 -mx-3 transition-colors"
              >
                <button
                  onClick={() => handleBookmarkClick(bookmark)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {bookmark.video_title ?? 'Untitled'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="font-mono text-blue-600">{formatTime(bookmark.timestamp_seconds)}</span>
                    {' · '}
                    {timeAgo(bookmark.created_at)}
                  </p>
                </button>
                <button
                  onClick={() => handleDeleteBookmark(bookmark.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all rounded"
                  title="Delete bookmark"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
