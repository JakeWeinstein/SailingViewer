'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Play, BookOpen, Youtube, HardDrive, X } from 'lucide-react'
import VideoWatchView from './VideoWatchView'
import {
  type ReferenceVideo,
  youtubeThumbnailUrl,
  thumbnailUrl,
  extractYouTubeInfo,
  extractDriveFileId,
} from '@/lib/types'
import clsx from 'clsx'

type AddType = 'youtube' | 'drive'

function formatTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

interface Props {
  isCaptain?: boolean
  userName?: string
  activeSessionId?: string
}

export default function ReferenceManager({ isCaptain = false, userName = 'Captain', activeSessionId }: Props) {
  const [videos, setVideos] = useState<ReferenceVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [watchTarget, setWatchTarget] = useState<ReferenceVideo | null>(null)

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState<AddType>('youtube')
  const [addUrl, setAddUrl] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const ytInfo = addType === 'youtube' ? extractYouTubeInfo(addUrl) : null

  useEffect(() => {
    fetch('/api/reference-videos')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setVideos(data) })
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    setAddError('')
    if (!addTitle.trim() || !addUrl.trim()) {
      setAddError('Title and URL are required.')
      return
    }

    let video_ref = ''
    let note_timestamp: number | undefined

    if (addType === 'youtube') {
      const info = extractYouTubeInfo(addUrl)
      if (!info) { setAddError('Could not find a YouTube video ID in that URL.'); return }
      video_ref = info.id
      note_timestamp = info.startSeconds
    } else {
      const id = extractDriveFileId(addUrl)
      if (!id) { setAddError('Could not find a Drive file ID in that URL.'); return }
      video_ref = id
    }

    setAdding(true)
    try {
      const res = await fetch('/api/reference-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addTitle.trim(),
          type: addType,
          video_ref,
          note_timestamp: note_timestamp ?? null,
        }),
      })
      if (res.ok) {
        const newVid = await res.json()
        setVideos((prev) => [...prev, newVid])
        setAddUrl('')
        setAddTitle('')
        setShowAdd(false)
      } else {
        const err = await res.json()
        setAddError(err.error ?? 'Failed to add video.')
      }
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this video from the reference library?')) return
    const res = await fetch(`/api/reference-videos/${id}`, { method: 'DELETE' })
    if (res.ok) setVideos((prev) => prev.filter((v) => v.id !== id))
  }

  function handleNoteUpdated(dbId: string, note: string, noteTimestamp?: number) {
    setVideos((prev) => prev.map((v) =>
      v.id === dbId ? { ...v, note, note_timestamp: noteTimestamp } : v
    ))
    setWatchTarget((prev) =>
      prev && prev.id === dbId ? { ...prev, note, note_timestamp: noteTimestamp } : prev
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Reference Library</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {videos.length} video{videos.length !== 1 ? 's' : ''} — always available to all teammates
          </p>
        </div>
        {isCaptain && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAdd ? 'Cancel' : 'Add video'}
          </button>
        )}
      </div>

      {/* Add form (captain only) */}
      {isCaptain && showAdd && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['youtube', 'drive'] as AddType[]).map((t) => (
              <button
                key={t}
                onClick={() => { setAddType(t); setAddUrl(''); setAddError('') }}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  addType === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {t === 'youtube'
                  ? <Youtube className="h-3.5 w-3.5" />
                  : <HardDrive className="h-3.5 w-3.5" />
                }
                {t === 'youtube' ? 'YouTube' : 'Google Drive'}
              </button>
            ))}
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">
              {addType === 'youtube'
                ? 'YouTube URL — timestamps like ?t=42 are captured automatically'
                : 'Google Drive share URL or file ID'
              }
            </label>
            <input
              type="text"
              value={addUrl}
              onChange={(e) => { setAddUrl(e.target.value); setAddError('') }}
              placeholder={addType === 'youtube' ? 'https://youtu.be/...' : 'https://drive.google.com/file/d/...'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {addType === 'youtube' && ytInfo && (
              <p className="text-xs text-green-600">
                ✓ Video ID: {ytInfo.id}
                {ytInfo.startSeconds != null ? ` · starts at ${formatTime(ytInfo.startSeconds)}` : ''}
              </p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Title</label>
            <input
              type="text"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder="e.g. Downwind technique, Tacking drill…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {addError && <p className="text-xs text-red-500">{addError}</p>}

          <button
            onClick={handleAdd}
            disabled={adding || !addTitle.trim() || !addUrl.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding…' : 'Add to library'}
          </button>
        </div>
      )}

      {/* Loading / empty */}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && videos.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">No reference videos yet</p>
          <p className="text-sm mt-1">
            {isCaptain
              ? 'Add YouTube or Drive videos that teammates can reference at any time.'
              : 'The captain hasn\'t added any reference videos yet.'}
          </p>
        </div>
      )}

      {/* Grid */}
      {videos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((video) => {
            const thumb = video.type === 'youtube'
              ? youtubeThumbnailUrl(video.video_ref)
              : thumbnailUrl(video.video_ref)
            return (
              <div
                key={video.id}
                className="group relative bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all"
              >
                <button className="w-full text-left" onClick={() => setWatchTarget(video)}>
                  <div className="relative aspect-video bg-gray-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 bg-white/90 rounded-full p-2.5 shadow">
                        <Play className="h-5 w-5 text-blue-600 fill-blue-600" />
                      </div>
                    </div>
                    {/* Type badge */}
                    <div className={clsx(
                      'absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium',
                      video.type === 'youtube' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                    )}>
                      {video.type === 'youtube'
                        ? <Youtube className="h-2.5 w-2.5" />
                        : <HardDrive className="h-2.5 w-2.5" />
                      }
                      {video.type === 'youtube' ? 'YouTube' : 'Drive'}
                    </div>
                  </div>
                  <div className="px-3 pt-2 pb-1">
                    <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{video.title}</p>
                    {video.note && (
                      <p className="text-xs text-amber-600 mt-0.5 truncate">📝 {video.note}</p>
                    )}
                  </div>
                </button>
                {isCaptain && (
                  <div className="px-3 pb-2.5 flex justify-end">
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="p-1 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                      title="Remove from library"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Video viewer */}
      {watchTarget && (
        <VideoWatchView
          video={{
            id: watchTarget.id,
            name: watchTarget.title,
            note: watchTarget.note,
            noteTimestamp: watchTarget.note_timestamp,
          }}
          sessionId=""
          activeSessionId={activeSessionId}
          mediaId={watchTarget.video_ref}
          videoType={watchTarget.type}
          noteApiPath={isCaptain ? `/api/reference-videos/${watchTarget.id}` : undefined}
          userName={userName}
          isCaptain={isCaptain}
          onNoteUpdated={isCaptain ? handleNoteUpdated : undefined}
          onClose={() => setWatchTarget(null)}
        />
      )}
    </div>
  )
}
