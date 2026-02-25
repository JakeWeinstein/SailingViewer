'use client'

import { useState } from 'react'
import { Upload, Loader2, Link, FileSpreadsheet, Check, X, ChevronDown } from 'lucide-react'
import { extractDriveFileId, type SessionVideo } from '@/lib/types'
import type { Session } from '@/lib/supabase'
import clsx from 'clsx'

type AddMode = 'manual' | 'sheet'

interface Props {
  sessions: Session[]
  onUploaded: () => void
}

export default function VideoUploader({ sessions, onUploaded }: Props) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    sessions.find((s) => s.is_active)?.id ?? sessions[0]?.id ?? ''
  )
  const [addMode, setAddMode] = useState<AddMode>('sheet')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  // Manual state
  const [manualUrl, setManualUrl] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualError, setManualError] = useState('')

  // Sheet state
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetError, setSheetError] = useState('')
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetPreview, setSheetPreview] = useState<SessionVideo[] | null>(null)

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
        setManualUrl(''); setManualName(''); setManualError('')
        setSheetUrl(''); setSheetPreview(null); setSheetError('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleManualAdd() {
    const id = extractDriveFileId(manualUrl)
    if (!id) { setManualError('Could not find a Drive file ID in this URL'); return }
    if (!manualName.trim()) { setManualError('Enter a display name'); return }
    await appendVideos([{ id, name: manualName.trim() }])
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
        <h2 className="text-lg font-bold text-gray-800">Upload Videos</h2>
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

      {/* Mode tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'sheet' as AddMode, label: 'Import from sheet', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
          { key: 'manual' as AddMode, label: 'Add manually', icon: <Link className="h-3.5 w-3.5" /> },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setAddMode(tab.key); setSuccess('') }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors',
              addMode === tab.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
          <Check className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Sheet import */}
      {addMode === 'sheet' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Share the Apps Script output sheet as <strong>Anyone with the link can view</strong>, then paste the link.
          </p>
          {!sheetPreview ? (
            <>
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => { setSheetUrl(e.target.value); setSheetError('') }}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {sheetError && <p className="text-sm text-red-500">{sheetError}</p>}
              <button
                onClick={handleSheetFetch}
                disabled={sheetLoading || !sheetUrl.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {sheetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                {sheetLoading ? 'Fetching…' : 'Fetch videos'}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 max-h-48 overflow-y-auto">
                {sheetPreview.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="truncate">{v.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 font-medium">{sheetPreview.length} video{sheetPreview.length !== 1 ? 's' : ''} ready to add</p>
              <div className="flex gap-3">
                <button
                  onClick={() => appendVideos(sheetPreview)}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {saving ? 'Saving…' : `Add ${sheetPreview.length} videos`}
                </button>
                <button
                  onClick={() => { setSheetPreview(null); setSheetUrl('') }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual add */}
      {addMode === 'manual' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Google Drive link or file ID</label>
            <input
              type="text"
              value={manualUrl}
              onChange={(e) => { setManualUrl(e.target.value); setManualError('') }}
              placeholder="https://drive.google.com/file/d/... or file ID"
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
