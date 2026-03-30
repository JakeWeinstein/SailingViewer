'use client'

import { useState } from 'react'
import { Upload, Loader2, Link, Check, ChevronDown, FileSpreadsheet } from 'lucide-react'
import { extractYouTubeInfo, type SessionVideo } from '@/lib/types'
import type { Session } from '@/lib/types'
import clsx from 'clsx'

type Tab = 'youtube' | 'sheet'

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
  const [tab, setTab] = useState<Tab>('sheet')

  // Manual YouTube state
  const [manualUrl, setManualUrl] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualError, setManualError] = useState('')

  // Sheet import state
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetError, setSheetError] = useState('')
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetPreview, setSheetPreview] = useState<{ name: string; id: string }[] | null>(null)

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
        setSheetUrl('')
        setSheetPreview(null)
        setSheetError('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleManualAdd() {
    const info = extractYouTubeInfo(manualUrl)
    if (!info) { setManualError('Could not find a YouTube video ID in this URL'); return }
    if (!manualName.trim()) { setManualError('Enter a display name'); return }
    const existingIds = new Set((selectedSession?.videos ?? []).map((v) => v.id))
    if (existingIds.has(info.id)) { setManualError('This video is already in the session'); return }
    await appendVideos([{ id: info.id, name: manualName.trim() }])
  }

  async function handleSheetFetch() {
    if (!sheetUrl.trim()) { setSheetError('Paste a Google Sheet URL'); return }
    setSheetLoading(true)
    setSheetError('')
    setSheetPreview(null)
    try {
      const res = await fetch('/api/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl }),
      })
      const data = await res.json()
      if (!res.ok) { setSheetError(data.error ?? 'Import failed'); return }
      if (!data.videos?.length) { setSheetError('No videos found in spreadsheet'); return }
      setSheetPreview(data.videos)
    } catch {
      setSheetError('Failed to fetch spreadsheet')
    } finally {
      setSheetLoading(false)
    }
  }

  async function handleSheetImport() {
    if (!sheetPreview?.length) return

    // Deduplicate within the sheet itself first
    const seen = new Set<string>()
    const uniqueSheet = sheetPreview.filter((v) => {
      if (seen.has(v.id)) return false
      seen.add(v.id)
      return true
    })

    // Filter out videos already in the session
    const existingIds = new Set((selectedSession?.videos ?? []).map((v) => v.id))
    const newVideos = uniqueSheet.filter((v) => !existingIds.has(v.id))

    if (newVideos.length === 0) {
      setSheetError('All videos from this sheet are already in the session.')
      return
    }
    const skipped = sheetPreview.length - newVideos.length
    const driveVideos: SessionVideo[] = newVideos.map((v) => ({
      id: v.id,
      name: v.name,
      type: 'drive' as const,
    }))
    await appendVideos(driveVideos)
    if (skipped > 0) {
      setSuccess((prev) => `${prev} (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)`)
    }
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
        <p className="text-xs text-gray-400 mt-0.5">Add videos to any session</p>
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

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab('sheet')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors',
            tab === 'sheet' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Google Sheet
        </button>
        <button
          onClick={() => setTab('youtube')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors',
            tab === 'youtube' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Link className="h-3.5 w-3.5" />
          YouTube URL
        </button>
      </div>

      {/* Google Sheet import */}
      {tab === 'sheet' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Import from Google Sheet
          </div>
          <p className="text-xs text-gray-400">
            Paste a link to a Google Sheet with video names and Drive file IDs. The sheet must be shared as &quot;Anyone with the link&quot;.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Spreadsheet URL</label>
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => { setSheetUrl(e.target.value); setSheetError(''); setSheetPreview(null) }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {sheetError && <p className="text-sm text-red-500">{sheetError}</p>}

          {!sheetPreview ? (
            <button
              onClick={handleSheetFetch}
              disabled={sheetLoading || !sheetUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {sheetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {sheetLoading ? 'Fetching…' : 'Fetch videos'}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Found <span className="font-semibold">{sheetPreview.length}</span> video{sheetPreview.length !== 1 ? 's' : ''}:
              </p>
              <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                {sheetPreview.map((v, i) => (
                  <div key={i} className="px-3 py-2 text-sm flex items-center gap-2">
                    <span className="text-gray-400 text-xs w-5 text-right shrink-0">{i + 1}.</span>
                    <span className="text-gray-800 truncate">{v.name}</span>
                    <span className="text-gray-300 text-xs font-mono ml-auto shrink-0">{v.id.slice(0, 12)}…</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSheetImport}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {saving ? 'Adding…' : `Add ${sheetPreview.length} videos`}
                </button>
                <button
                  onClick={() => { setSheetPreview(null); setSheetUrl('') }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual YouTube URL add */}
      {tab === 'youtube' && (
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
      )}
    </div>
  )
}
