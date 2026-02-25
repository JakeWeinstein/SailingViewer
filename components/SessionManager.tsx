'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, Link, FileSpreadsheet, Check } from 'lucide-react'
import { extractDriveFileId, type SessionVideo } from '@/lib/types'

interface SessionManagerProps {
  onSessionCreated: () => void
}

interface VideoEntry {
  key: string
  url: string
  name: string
  error: string
}

type VideoMode = 'manual' | 'sheet'

function makeVideoEntry(): VideoEntry {
  return { key: Math.random().toString(36).slice(2), url: '', name: '', error: '' }
}

export default function SessionManager({ onSessionCreated }: SessionManagerProps) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [videoMode, setVideoMode] = useState<VideoMode>('sheet')
  const [videoEntries, setVideoEntries] = useState<VideoEntry[]>([makeVideoEntry()])
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const [sheetPreview, setSheetPreview] = useState<SessionVideo[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateEntry(key: string, patch: Partial<VideoEntry>) {
    setVideoEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }

  function removeEntry(key: string) {
    setVideoEntries((prev) => (prev.length > 1 ? prev.filter((e) => e.key !== key) : prev))
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

  function getVideos(): SessionVideo[] | null {
    if (videoMode === 'sheet') {
      return sheetPreview ?? []
    }
    let valid = true
    const videos: SessionVideo[] = []
    const updated = videoEntries.map((entry) => {
      if (!entry.url.trim() && !entry.name.trim()) return { ...entry, error: '' }
      if (!entry.url.trim()) { valid = false; return { ...entry, error: 'Paste a Drive link or file ID' } }
      const id = extractDriveFileId(entry.url)
      if (!id) { valid = false; return { ...entry, error: 'Could not find a file ID in this URL' } }
      if (!entry.name.trim()) { valid = false; return { ...entry, error: 'Enter a display name' } }
      videos.push({ id, name: entry.name.trim() })
      return { ...entry, error: '' }
    })
    setVideoEntries(updated)
    return valid ? videos : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const videos = getVideos()
    if (videos === null) return
    setLoading(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, videos }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create session')
      }
      setLabel('')
      setVideoEntries([makeVideoEntry()])
      setSheetUrl('')
      setSheetPreview(null)
      setOpen(false)
      onSessionCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New session
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 px-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New Session</p>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Week of Feb 24, 2026"
              required
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Video mode toggle */}
          <div className="space-y-2">
            <label className="text-xs text-gray-600">Videos</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setVideoMode('sheet')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 transition-colors ${
                  videoMode === 'sheet' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <FileSpreadsheet className="h-3 w-3" />
                Import from sheet
              </button>
              <button
                type="button"
                onClick={() => setVideoMode('manual')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 transition-colors ${
                  videoMode === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Link className="h-3 w-3" />
                Manual
              </button>
            </div>

            {/* Sheet import */}
            {videoMode === 'sheet' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">
                  Share the sheet as <strong>Anyone with the link can view</strong>, then paste the link.
                </p>
                {!sheetPreview ? (
                  <>
                    <input
                      type="text"
                      value={sheetUrl}
                      onChange={(e) => { setSheetUrl(e.target.value); setSheetError('') }}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    {sheetError && <p className="text-xs text-red-500">{sheetError}</p>}
                    <button
                      type="button"
                      onClick={handleSheetFetch}
                      disabled={sheetLoading || !sheetUrl.trim()}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {sheetLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />}
                      {sheetLoading ? 'Fetching…' : 'Fetch videos'}
                    </button>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <div className="bg-white border border-green-100 rounded p-2 space-y-1 max-h-32 overflow-y-auto">
                      {sheetPreview.map((v) => (
                        <div key={v.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                          <Check className="h-3 w-3 text-green-500 shrink-0" />
                          <span className="truncate">{v.name}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-green-700 font-medium">{sheetPreview.length} video{sheetPreview.length !== 1 ? 's' : ''} ready</p>
                    <button
                      type="button"
                      onClick={() => { setSheetPreview(null); setSheetUrl('') }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Use a different sheet
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Manual entry */}
            {videoMode === 'manual' && (
              <div className="space-y-2">
                {videoEntries.map((entry, idx) => (
                  <div key={entry.key} className="space-y-1 bg-gray-50 rounded-lg p-2">
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                      <Link className="h-3 w-3" />
                      Video {idx + 1}
                      {videoEntries.length > 1 && (
                        <button type="button" onClick={() => removeEntry(entry.key)} className="ml-auto text-gray-300 hover:text-red-400">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={entry.url}
                      onChange={(e) => updateEntry(entry.key, { url: e.target.value, error: '' })}
                      placeholder="Drive share link or file ID"
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(e) => updateEntry(entry.key, { name: e.target.value, error: '' })}
                      placeholder="Display name"
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    {entry.error && <p className="text-xs text-red-500">{entry.error}</p>}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setVideoEntries((prev) => [...prev, makeVideoEntry()])}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-500 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add video
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !label.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Create &amp; activate
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError('') }}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
