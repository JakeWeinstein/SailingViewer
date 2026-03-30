'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, Link, Check, X } from 'lucide-react'
import { extractYouTubeInfo, videoThumbnailUrl, type SessionVideo } from '@/lib/types'

interface VideoManagerProps {
  sessionId: string
  videos: SessionVideo[]
  onUpdated: (videos: SessionVideo[]) => void
}

export default function VideoManager({ sessionId, videos, onUpdated }: VideoManagerProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  // Manual add state
  const [manualUrl, setManualUrl] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualError, setManualError] = useState('')

  async function saveVideos(next: SessionVideo[]) {
    setSaving(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: next }),
      })
      if (res.ok) onUpdated(next)
    } finally {
      setSaving(false)
    }
  }

  async function handleManualAdd() {
    const info = extractYouTubeInfo(manualUrl)
    if (!info) { setManualError('Could not find a YouTube video ID in this URL'); return }
    if (!manualName.trim()) { setManualError('Enter a display name'); return }
    await saveVideos([...videos, { id: info.id, name: manualName.trim() }])
    setManualUrl('')
    setManualName('')
    setManualError('')
    setShowAdd(false)
  }

  function cancelAdd() {
    setShowAdd(false)
    setManualUrl(''); setManualName(''); setManualError('')
  }

  async function handleRemove(id: string) {
    await saveVideos(videos.filter((v) => v.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Videos</p>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
      </div>

      {videos.length === 0 && (
        <p className="text-xs text-gray-400 italic">No videos yet.</p>
      )}

      {videos.map((v) => (
        <div key={v.id} className="flex items-center gap-2 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={videoThumbnailUrl(v)}
            alt={v.name}
            className="h-8 w-14 object-cover rounded shrink-0 bg-gray-100"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <span className="flex-1 text-xs text-gray-700 truncate">{v.name}</span>
          <button
            onClick={() => handleRemove(v.id)}
            className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 transition-all"
            title="Remove video"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Add controls */}
      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add YouTube video
        </button>
      )}

      {/* Manual add form */}
      {showAdd && (
        <div className="space-y-2 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <div className="flex items-center gap-1"><Link className="h-3 w-3" />Add YouTube video</div>
            <button onClick={cancelAdd}><X className="h-3 w-3 hover:text-gray-600" /></button>
          </div>
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => { setManualUrl(e.target.value); setManualError('') }}
            placeholder="YouTube URL or video ID"
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="text"
            value={manualName}
            onChange={(e) => { setManualName(e.target.value); setManualError('') }}
            placeholder="Display name"
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {manualError && <p className="text-xs text-red-500">{manualError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleManualAdd}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Check className="h-3 w-3" />Add
            </button>
            <button onClick={cancelAdd} className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
