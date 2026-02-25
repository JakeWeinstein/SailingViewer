'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, Link, FileSpreadsheet, Check, X } from 'lucide-react'
import { extractDriveFileId, thumbnailUrl, type SessionVideo } from '@/lib/types'

interface VideoManagerProps {
  sessionId: string
  videos: SessionVideo[]
  onUpdated: (videos: SessionVideo[]) => void
}

type AddMode = 'none' | 'manual' | 'sheet'

export default function VideoManager({ sessionId, videos, onUpdated }: VideoManagerProps) {
  const [addMode, setAddMode] = useState<AddMode>('none')
  const [saving, setSaving] = useState(false)

  // Manual add state
  const [manualUrl, setManualUrl] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualError, setManualError] = useState('')

  // Sheet import state
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetError, setSheetError] = useState('')
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetPreview, setSheetPreview] = useState<SessionVideo[] | null>(null)

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
    const id = extractDriveFileId(manualUrl)
    if (!id) { setManualError('Could not find a file ID in this URL'); return }
    if (!manualName.trim()) { setManualError('Enter a display name'); return }
    await saveVideos([...videos, { id, name: manualName.trim() }])
    setManualUrl('')
    setManualName('')
    setManualError('')
    setAddMode('none')
  }

  async function handleSheetFetch() {
    setSheetLoading(true)
    setSheetError('')
    setSheetPreview(null)
    try {
      const res = await fetch('/api/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSheetPreview(data)
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setSheetLoading(false)
    }
  }

  async function handleSheetConfirm() {
    if (!sheetPreview) return
    // Replace all videos (or append — using replace so each import is a fresh list)
    await saveVideos(sheetPreview)
    setSheetUrl('')
    setSheetPreview(null)
    setSheetError('')
    setAddMode('none')
  }

  function cancelAdd() {
    setAddMode('none')
    setManualUrl(''); setManualName(''); setManualError('')
    setSheetUrl(''); setSheetPreview(null); setSheetError('')
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
            src={thumbnailUrl(v.id)}
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
      {addMode === 'none' && (
        <div className="flex gap-2">
          <button
            onClick={() => setAddMode('sheet')}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-green-300 hover:text-green-600 transition-colors"
          >
            <FileSpreadsheet className="h-3 w-3" />
            Import from sheet
          </button>
          <button
            onClick={() => setAddMode('manual')}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-500 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add manually
          </button>
        </div>
      )}

      {/* Manual add form */}
      {addMode === 'manual' && (
        <div className="space-y-2 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <div className="flex items-center gap-1"><Link className="h-3 w-3" />Add video</div>
            <button onClick={cancelAdd}><X className="h-3 w-3 hover:text-gray-600" /></button>
          </div>
          <input
            type="text"
            value={manualUrl}
            onChange={(e) => { setManualUrl(e.target.value); setManualError('') }}
            placeholder="Drive share link or file ID"
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

      {/* Sheet import form */}
      {addMode === 'sheet' && (
        <div className="space-y-2 bg-green-50 border border-green-100 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <div className="flex items-center gap-1 font-medium">
              <FileSpreadsheet className="h-3 w-3 text-green-600" />
              Import from Google Sheet
            </div>
            <button onClick={cancelAdd}><X className="h-3 w-3 hover:text-gray-600" /></button>
          </div>
          <p className="text-xs text-gray-400">
            Paste the link to your Apps Script output sheet. It must be shared as <strong>Anyone with the link can view</strong>.
          </p>

          {!sheetPreview ? (
            <>
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => { setSheetUrl(e.target.value); setSheetError('') }}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-2 py-1.5 text-xs border border-green-200 rounded font-mono bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              {sheetError && <p className="text-xs text-red-500">{sheetError}</p>}
              <button
                onClick={handleSheetFetch}
                disabled={sheetLoading || !sheetUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {sheetLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />}
                {sheetLoading ? 'Fetching…' : 'Fetch videos'}
              </button>
            </>
          ) : (
            <>
              <div className="bg-white border border-green-100 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
                {sheetPreview.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 text-xs text-gray-700">
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                    <span className="truncate">{v.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Found <strong>{sheetPreview.length}</strong> video{sheetPreview.length !== 1 ? 's' : ''}.
                {videos.length > 0 && ' This will replace the current video list.'}
              </p>
              {sheetError && <p className="text-xs text-red-500">{sheetError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSheetConfirm}
                  disabled={saving}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  {saving ? 'Saving…' : `Add ${sheetPreview.length} videos`}
                </button>
                <button
                  onClick={() => setSheetPreview(null)}
                  className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
