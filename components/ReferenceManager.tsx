'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Play, BookOpen, Youtube, HardDrive, X, FolderOpen, ChevronDown, Film } from 'lucide-react'
import VideoWatchView from './VideoWatchView'
import FolderManager from './FolderManager'
import {
  type ReferenceVideo,
  type ReferenceFolder,
  type SessionVideo,
  youtubeThumbnailUrl,
  thumbnailUrl,
  extractYouTubeInfo,
  extractDriveFileId,
} from '@/lib/types'
import clsx from 'clsx'

type AddType = 'youtube' | 'drive' | 'practice'

function formatTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

interface BrowseSession {
  id: string
  label: string
  videos: SessionVideo[]
  is_active: boolean
}

interface Props {
  isCaptain?: boolean
  userName?: string
  activeSessionId?: string
}

export default function ReferenceManager({ isCaptain = false, userName = 'Captain', activeSessionId }: Props) {
  const [videos, setVideos] = useState<ReferenceVideo[]>([])
  const [folders, setFolders] = useState<ReferenceFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [watchTarget, setWatchTarget] = useState<ReferenceVideo | null>(null)
  const [showFolderManager, setShowFolderManager] = useState(false)

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState<AddType>('youtube')
  const [addUrl, setAddUrl] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [addFolderId, setAddFolderId] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Practice library picker
  const [practiceSearch, setPracticeSearch] = useState('')
  const [practiceSessions, setPracticeSessions] = useState<BrowseSession[]>([])
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [selectedPractice, setSelectedPractice] = useState<SessionVideo | null>(null)

  const ytInfo = addType === 'youtube' ? extractYouTubeInfo(addUrl) : null

  useEffect(() => {
    Promise.all([
      fetch('/api/reference-videos').then((r) => r.json()),
      fetch('/api/reference-folders').then((r) => r.json()),
    ]).then(([vids, flds]) => {
      if (Array.isArray(vids)) setVideos(vids)
      if (Array.isArray(flds)) setFolders(flds)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (addType === 'practice' && practiceSessions.length === 0) {
      setPracticeLoading(true)
      fetch('/api/sessions/browse')
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setPracticeSessions(data) })
        .finally(() => setPracticeLoading(false))
    }
  }, [addType, practiceSessions.length])

  async function handleAdd() {
    setAddError('')

    let video_ref = ''
    let note_timestamp: number | undefined
    let type: 'drive' | 'youtube' = 'drive'
    let title = addTitle.trim()

    if (addType === 'practice') {
      if (!selectedPractice) { setAddError('Select a video from the practice library.'); return }
      video_ref = selectedPractice.id
      type = 'drive'
      title = title || selectedPractice.name
    } else {
      if (!title || !addUrl.trim()) { setAddError('Title and URL are required.'); return }
      if (addType === 'youtube') {
        const info = extractYouTubeInfo(addUrl)
        if (!info) { setAddError('Could not find a YouTube video ID in that URL.'); return }
        video_ref = info.id
        note_timestamp = info.startSeconds
        type = 'youtube'
      } else {
        const id = extractDriveFileId(addUrl)
        if (!id) { setAddError('Could not find a Drive file ID in that URL.'); return }
        video_ref = id
        type = 'drive'
      }
    }

    if (!title) { setAddError('Title is required.'); return }

    setAdding(true)
    try {
      const res = await fetch('/api/reference-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type,
          video_ref,
          note_timestamp: note_timestamp ?? null,
          folder_id: addFolderId || null,
        }),
      })
      if (res.ok) {
        const newVid = await res.json()
        setVideos((prev) => [...prev, newVid])
        setAddUrl(''); setAddTitle(''); setAddFolderId(''); setSelectedPractice(null); setPracticeSearch('')
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

  function handleNotesUpdated(dbId: string, notes: import('@/lib/types').VideoNote[]) {
    setVideos((prev) => prev.map((v) => v.id === dbId ? { ...v, notes } : v))
    setWatchTarget((prev) => prev && prev.id === dbId ? { ...prev, notes } : prev)
  }

  // Organize videos into folder hierarchy
  const topFolders = folders.filter((f) => !f.parent_id).sort((a, b) => a.sort_order - b.sort_order)
  const getSubFolders = (pid: string) => folders.filter((f) => f.parent_id === pid).sort((a, b) => a.sort_order - b.sort_order)
  const getVideosInFolder = (fid: string | null) => {
    if (fid === null) return videos.filter((v) => !v.folder_id)
    return videos.filter((v) => v.folder_id === fid)
  }

  // All unique folder IDs present in video data (may include sub-folders)
  const hasContent = videos.length > 0

  // Filtered practice videos
  const filteredPractice = practiceSessions.flatMap((s) =>
    s.videos
      .filter((v) => !practiceSearch || v.name.toLowerCase().includes(practiceSearch.toLowerCase()))
      .map((v) => ({ video: v, sessionLabel: s.label }))
  )

  function VideoCard({ video }: { video: ReferenceVideo }) {
    const thumb = video.type === 'youtube'
      ? youtubeThumbnailUrl(video.video_ref)
      : thumbnailUrl(video.video_ref)
    return (
      <div className="group relative bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all">
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
            <div className={clsx(
              'absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium',
              video.type === 'youtube' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
            )}>
              {video.type === 'youtube' ? <Youtube className="h-2.5 w-2.5" /> : <HardDrive className="h-2.5 w-2.5" />}
              {video.type === 'youtube' ? 'YouTube' : 'Drive'}
            </div>
          </div>
          <div className="px-3 pt-2 pb-1">
            <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{video.title}</p>
            {video.note && <p className="text-xs text-amber-600 mt-0.5 truncate">📝 {video.note}</p>}
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
  }

  function FolderSection({ folder, depth = 0 }: { folder: ReferenceFolder; depth?: number }) {
    const [open, setOpen] = useState(true)
    const subFolders = getSubFolders(folder.id)
    const folderVideos = getVideosInFolder(folder.id)
    if (folderVideos.length === 0 && subFolders.every((sf) => getVideosInFolder(sf.id).length === 0)) {
      // Show even if empty so captain can see folder structure
      if (!isCaptain) return null
    }

    return (
      <div className={clsx(depth > 0 && 'ml-4 border-l border-gray-100 pl-4')}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 w-full text-left mb-2"
        >
          <ChevronDown className={clsx('h-4 w-4 text-gray-400 transition-transform', !open && '-rotate-90')} />
          <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" />
          <span className={clsx('font-semibold text-gray-700', depth === 0 ? 'text-base' : 'text-sm')}>{folder.name}</span>
          <span className="text-xs text-gray-400">{folderVideos.length}</span>
        </button>
        {folder.description && open && (
          <p className="text-sm text-gray-500 mb-3 ml-10 leading-relaxed">{folder.description}</p>
        )}
        {open && (
          <>
            {subFolders.map((sf) => (
              <FolderSection key={sf.id} folder={sf} depth={depth + 1} />
            ))}
            {folderVideos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                {folderVideos.map((v) => <VideoCard key={v.id} video={v} />)}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const unfolderedVideos = getVideosInFolder(null)

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
        <div className="flex items-center gap-2">
          {isCaptain && (
            <button
              onClick={() => setShowFolderManager((v) => !v)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
                showFolderManager
                  ? 'bg-gray-100 text-gray-700 border-gray-200'
                  : 'text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              <FolderOpen className="h-4 w-4" />
              Folders
            </button>
          )}
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
      </div>

      {/* Folder manager */}
      {showFolderManager && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <FolderManager folders={folders} onFoldersChanged={setFolders} />
        </div>
      )}

      {/* Add form */}
      {isCaptain && showAdd && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
            {([
              { key: 'youtube' as AddType, label: 'YouTube', icon: <Youtube className="h-3.5 w-3.5" /> },
              { key: 'drive' as AddType, label: 'Google Drive', icon: <HardDrive className="h-3.5 w-3.5" /> },
              { key: 'practice' as AddType, label: 'From practice', icon: <Film className="h-3.5 w-3.5" /> },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => { setAddType(t.key); setAddUrl(''); setAddError(''); setSelectedPractice(null) }}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  addType === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {addType !== 'practice' && (
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
          )}

          {addType === 'practice' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Search practice videos</label>
              <input
                type="text"
                value={practiceSearch}
                onChange={(e) => setPracticeSearch(e.target.value)}
                placeholder="Search by name…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {practiceLoading && <p className="text-xs text-gray-400">Loading…</p>}
              {selectedPractice && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                  <HardDrive className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate font-medium">{selectedPractice.name}</span>
                  <button onClick={() => setSelectedPractice(null)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {!selectedPractice && (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {filteredPractice.length === 0 && !practiceLoading && (
                    <p className="text-xs text-gray-400 italic p-3">No videos found.</p>
                  )}
                  {filteredPractice.slice(0, 30).map(({ video, sessionLabel }) => (
                    <button
                      key={video.id}
                      onClick={() => { setSelectedPractice(video); if (!addTitle) setAddTitle(video.name) }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm text-gray-800 truncate">{video.name}</p>
                      <p className="text-xs text-gray-400">{sessionLabel}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Title</label>
            <input
              type="text"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder={addType === 'practice' && selectedPractice ? selectedPractice.name : 'e.g. Downwind technique…'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Folder selector */}
          {folders.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Folder (optional)</label>
              <select
                value={addFolderId}
                onChange={(e) => setAddFolderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No folder —</option>
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

          {addError && <p className="text-xs text-red-500">{addError}</p>}

          <button
            onClick={handleAdd}
            disabled={adding || (addType !== 'practice' && (!addTitle.trim() || !addUrl.trim())) || (addType === 'practice' && !selectedPractice)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding…' : 'Add to library'}
          </button>
        </div>
      )}

      {/* Loading / empty */}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && !hasContent && (
        <div className="text-center py-20 text-gray-400">
          <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">No reference videos yet</p>
          <p className="text-sm mt-1">
            {isCaptain
              ? 'Add YouTube or Drive videos that teammates can reference at any time.'
              : "The captain hasn't added any reference videos yet."}
          </p>
        </div>
      )}

      {/* Foldered content */}
      {!loading && hasContent && (
        <div className="space-y-6">
          {topFolders.map((folder) => (
            <FolderSection key={folder.id} folder={folder} depth={0} />
          ))}
          {/* Unfoldered videos */}
          {unfolderedVideos.length > 0 && (
            <div>
              {topFolders.length > 0 && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Other</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {unfolderedVideos.map((video) => <VideoCard key={video.id} video={video} />)}
              </div>
            </div>
          )}
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
            notes: watchTarget.notes,
          }}
          sessionId=""
          activeSessionId={activeSessionId}
          mediaId={watchTarget.video_ref}
          videoType={watchTarget.type}
          noteApiPath={isCaptain ? `/api/reference-videos/${watchTarget.id}` : undefined}
          userName={userName}
          isCaptain={isCaptain}
          onNotesUpdated={isCaptain ? handleNotesUpdated : undefined}
          onClose={() => setWatchTarget(null)}
        />
      )}
    </div>
  )
}
