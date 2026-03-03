'use client'

import { useState } from 'react'
import { X, Plus, Trash2, ClipboardList, List, Save, AlertCircle } from 'lucide-react'
import { parseTimestamp, formatTime, type ReferenceVideo, type ReferenceFolder } from '@/lib/types'
import clsx from 'clsx'

interface ChapterRow {
  timestamp: string
  title: string
}

interface ParsedChapter {
  title: string
  start_seconds: number
}

interface ChapterEditorProps {
  sourceVideo: ReferenceVideo
  folders: ReferenceFolder[]
  onChaptersCreated: (chapters: ReferenceVideo[]) => void
  onClose: () => void
}

function parseBulkText(text: string): ParsedChapter[] {
  const lines = text.split('\n').filter((l) => l.trim())
  const results: ParsedChapter[] = []

  for (const line of lines) {
    // Try to match timestamp at the start: "H:MM:SS" or "M:SS" or "MM:SS"
    // Followed by separator: dash, tab, multiple spaces, or single space
    const match = line.match(/^\s*(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\s*[-\t]\s*(.+)/)
      || line.match(/^\s*(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\s{2,}(.+)/)
      || line.match(/^\s*(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\s+(.+)/)
    if (match) {
      const seconds = parseTimestamp(match[1])
      if (seconds !== null) {
        results.push({ title: match[2].trim(), start_seconds: seconds })
      }
    }
  }

  return results.sort((a, b) => a.start_seconds - b.start_seconds)
}

export default function ChapterEditor({ sourceVideo, folders, onChaptersCreated, onClose }: ChapterEditorProps) {
  const [mode, setMode] = useState<'rows' | 'bulk'>('rows')
  const [rows, setRows] = useState<ChapterRow[]>([{ timestamp: '0:00:00', title: '' }])
  const [bulkText, setBulkText] = useState('')
  const [bulkParsed, setBulkParsed] = useState<ParsedChapter[]>([])
  const [folderId, setFolderId] = useState<string>(sourceVideo.folder_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateRow(index: number, field: 'timestamp' | 'title', value: string) {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRows((prev) => [...prev, { timestamp: '', title: '' }])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function handleBulkChange(text: string) {
    setBulkText(text)
    setBulkParsed(parseBulkText(text))
  }

  function getRowChapters(): ParsedChapter[] {
    return rows
      .filter((r) => r.title.trim() && r.timestamp.trim())
      .map((r) => {
        const seconds = parseTimestamp(r.timestamp)
        return seconds !== null ? { title: r.title.trim(), start_seconds: seconds } : null
      })
      .filter((c): c is ParsedChapter => c !== null)
      .sort((a, b) => a.start_seconds - b.start_seconds)
  }

  const chapters = mode === 'rows' ? getRowChapters() : bulkParsed
  const hasValidChapters = chapters.length > 0

  async function handleSave() {
    if (!hasValidChapters) return
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/reference-videos/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_video_id: sourceVideo.id,
          chapters,
          folder_id: folderId || null,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        onChaptersCreated(created)
      } else {
        const err = await res.json()
        setError(err.error ?? 'Failed to create chapters.')
      }
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  // Row validation helpers
  function isTimestampValid(ts: string): boolean {
    if (!ts.trim()) return true // empty is ok (just not included)
    return parseTimestamp(ts) !== null
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-800">Create Chapters</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
              Source: {sourceVideo.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-5 pt-4 shrink-0">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setMode('rows')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                mode === 'rows' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <List className="h-3.5 w-3.5" />
              Row by row
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                mode === 'bulk' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Bulk paste
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {mode === 'rows' ? (
            <>
              <div className="space-y-2">
                {rows.map((row, i) => {
                  const tsValid = isTimestampValid(row.timestamp)
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.timestamp}
                        onChange={(e) => updateRow(i, 'timestamp', e.target.value)}
                        placeholder="H:MM:SS"
                        className={clsx(
                          'w-28 px-2.5 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500',
                          !tsValid ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        )}
                      />
                      <input
                        type="text"
                        value={row.title}
                        onChange={(e) => updateRow(i, 'title', e.target.value)}
                        placeholder="Chapter title"
                        className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => removeRow(i)}
                        disabled={rows.length <= 1}
                        className="p-1.5 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add row
              </button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">
                  Paste timestamps — one per line (e.g. &quot;0:00:00 Opening ceremony&quot;)
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => handleBulkChange(e.target.value)}
                  rows={8}
                  placeholder={`0:00:00 Opening ceremony\n0:12:30 Race 1 start\n1:45:00 Race 2 start`}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Parsed preview */}
              {bulkParsed.length > 0 && (
                <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Preview ({bulkParsed.length} chapter{bulkParsed.length !== 1 ? 's' : ''})
                  </p>
                  {bulkParsed.map((ch, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {formatTime(ch.start_seconds)}
                      </span>
                      <span className="text-gray-700">{ch.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {bulkText.trim() && bulkParsed.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  No valid timestamps found. Use format: &quot;H:MM:SS Title&quot; or &quot;M:SS Title&quot;
                </div>
              )}
            </>
          )}

          {/* Folder selector */}
          {folders.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Place chapters in folder</label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Same as source video</option>
                {folders.filter((f) => !f.parent_id).map((f) => (
                  <optgroup key={f.id} label={f.name}>
                    <option value={f.id}>{f.name}</option>
                    {folders.filter((sf) => sf.parent_id === f.id).map((sf) => (
                      <option key={sf.id} value={sf.id}>{'  '}{sf.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-400">
            {hasValidChapters
              ? `${chapters.length} chapter${chapters.length !== 1 ? 's' : ''} ready`
              : 'Add at least one chapter with a timestamp and title'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasValidChapters}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Creating...' : 'Create chapters'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
