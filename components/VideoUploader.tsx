'use client'

import { useState } from 'react'
import { Upload, Loader2, Link, Check, ChevronDown } from 'lucide-react'
import { extractYouTubeInfo, type SessionVideo } from '@/lib/types'
import type { Session } from '@/lib/types'
import clsx from 'clsx'

interface Props {
  sessions: Session[]
  onUploaded: () => void
}

export default function VideoUploader({ sessions, onUploaded }: Props) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    sessions.find((s) => s.is_active)?.id ?? sessions[0]?.id ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  // Manual state
  const [manualUrl, setManualUrl] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualError, setManualError] = useState('')

  const selectedSession = sessions.find((s) => s.id === selectedSessionId)

  async function appendVideos(newVideos: SessionVideo[]) {
    if (!selectedSessionId) return
    setSaving(true)
    setSuccess('')
    try {
      const existing = selectedSession?.videos ?? []
      const res = await fetch(`/api/sessions/${selectedSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: [...existing, ...newVideos] }),
      })
      if (res.ok) {
        setSuccess(`Added ${newVideos.length} video${newVideos.length !== 1 ? 's' : ''} to "${selectedSession?.label}"`)
        onUploaded()
        setManualUrl('')
        setManualName('')
        setManualError('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleManualAdd() {
    const info = extractYouTubeInfo(manualUrl)
    if (!info) { setManualError('Could not find a YouTube video ID in this URL'); return }
    if (!manualName.trim()) { setManualError('Enter a display name'); return }
    await appendVideos([{ id: info.id, name: manualName.trim() }])
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Upload className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p className="font-medium">No sessions yet</p>
        <p className="text-sm mt-1">Ask the captain to create a session first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Add Videos</h2>
        <p className="text-xs text-gray-400 mt-0.5">Add a YouTube video to any session</p>
      </div>

      {/* Session picker */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Target session</label>
        <div className="relative">
          <select
            value={selectedSessionId}
            onChange={(e) => { setSelectedSessionId(e.target.value); setSuccess('') }}
            className="w-full appearance-none px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}{s.is_active ? ' (active)' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
          <Check className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Manual YouTube URL add */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Link className="h-4 w-4 text-gray-400" />
          Add YouTube video
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">YouTube URL or video ID</label>
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => { setManualUrl(e.target.value); setManualError('') }}
            placeholder="https://youtu.be/... or video ID"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Display name</label>
          <input
            type="text"
            value={manualName}
            onChange={(e) => { setManualName(e.target.value); setManualError('') }}
            placeholder="e.g. Upwind drill - boat 3"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {manualError && <p className="text-sm text-red-500">{manualError}</p>}
        <button
          onClick={handleManualAdd}
          disabled={saving || !manualUrl.trim() || !manualName.trim()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Add video'}
        </button>
      </div>
    </div>
  )
}
