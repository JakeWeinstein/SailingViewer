'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'

interface Props {
  onSessionCreated: () => void
}

export default function SessionManager({ onSessionCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, videos: [] }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create session')
      }
      setLabel('')
      setOpen(false)
      onSessionCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-3 pb-1 px-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New session
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">New Session</p>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Week of Mar 3, 2026"
            required
            autoFocus
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !label.trim()}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Create
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError('') }}
              className="px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
