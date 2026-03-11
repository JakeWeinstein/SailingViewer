'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, Play, BookOpen, Youtube, X, FolderOpen, ChevronDown, Film, Scissors, Layers, Tag } from 'lucide-react'
import VideoWatchView from './VideoWatchView'
import FolderManager from './FolderManager'
import ChapterEditor from './ChapterEditor'
import {
  type ReferenceVideo,
  type ReferenceFolder,
  type SessionVideo,
  formatTime,
  parseTimestamp,
  youtubeThumbnailUrl,
  extractYouTubeInfo,
} from '@/lib/types'
import clsx from 'clsx'

type AddType = 'youtube' | 'practice'

interface BrowseSession {
  id: string
  label: string
  videos: SessionVideo[]
  is_active: boolean
}

interface Props {
  isCaptain?: boolean
  isAuthenticated?: boolean
  userName?: string
  activeSessionId?: string
  initialVideoId?: string | null
  onInitialVideoHandled?: () => void
}

export default function ReferenceManager({ isCaptain = false, isAuthenticated = false, userName = 'Captain', activeSessionId, initialVideoId, onInitialVideoHandled }: Props) {
  const [videos, setVideos] = useState<ReferenceVideo[]>([])
  const [folders, setFolders] = useState<ReferenceFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [watchTarget, setWatchTarget] = useState<ReferenceVideo | null>(null)
  const [showFolderManager, setShowFolderManager] = useState(false)
  const [isDragOverUnfoldered, setIsDragOverUnfoldered] = useState(false)

  // Folder open/close state persisted to sessionStorage
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem('tf_ref_folders')
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  })

  // Tag filter state
  const [allTags, setAllTags] = useState<string[]>([])
  const [activeFilterTags, setActiveFilterTags] = useState<string[]>([])

  // Chapter editor
  const [chapterSource, setChapterSource] = useState<ReferenceVideo | null>(null)

  // Inline chapter add form
  const [inlineChapterParentId, setInlineChapterParentId] = useState<string | null>(null)
  const [inlineChapterTitle, setInlineChapterTitle] = useState('')
  const [inlineChapterTimestamp, setInlineChapterTimestamp] = useState('')
  const [inlineChapterAdding, setInlineChapterAdding] = useState(false)
  const [inlineChapterError, setInlineChapterError] = useState('')

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState<AddType>('youtube')
  const [addUrl, setAddUrl] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [addFolderId, setAddFolderId] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Tag editing state (per-video inline editor)
  const [editingTagVideoId, setEditingTagVideoId] = useState<string | null>(null)
  const [tagInputValue, setTagInputValue] = useState('')
  const [tagAutocomplete, setTagAutocomplete] = useState<string[]>([])
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Practice library picker
  const [practiceSearch, setPracticeSearch] = useState('')
  const [practiceSessions, setPracticeSessions] = useState<BrowseSession[]>([])
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [selectedPractice, setSelectedPractice] = useState<SessionVideo | null>(null)

  const ytInfo = addType === 'youtube' ? extractYouTubeInfo(addUrl) : null

  // Sync folder open/close state to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem('tf_ref_folders', JSON.stringify([...openFolderIds])) } catch {}
  }, [openFolderIds])

  useEffect(() => {
    Promise.all([
      fetch('/api/reference-videos').then((r) => r.json()),
      fetch('/api/reference-folders').then((r) => r.json()),
      fetch('/api/reference-videos?allTags=true').then((r) => r.json()),
    ]).then(([vids, flds, tags]) => {
      if (Array.isArray(vids)) setVideos(vids)
      if (Array.isArray(flds)) setFolders(flds)
      if (Array.isArray(tags)) setAllTags(tags)
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

  // Re-fetch videos when tag filter changes
  useEffect(() => {
    const url = activeFilterTags.length > 0
      ? `/api/reference-videos?tags=${activeFilterTags.join(',')}`
      : '/api/reference-videos'
    fetch(url)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setVideos(data) })
  }, [activeFilterTags])

  // Deep-link: auto-open a video when initialVideoId is provided
  useEffect(() => {
    if (!initialVideoId || loading) return
    const match = videos.find((v) => v.id === initialVideoId)
    if (match) {
      setWatchTarget(match)
    }
    onInitialVideoHandled?.()
  }, [initialVideoId, loading, videos, onInitialVideoHandled])

  // Tag autocomplete: filter allTags by current input
  useEffect(() => {
    if (!tagInputValue.trim()) {
      setTagAutocomplete([])
      return
    }
    const input = tagInputValue.trim().toLowerCase()
    const filtered = allTags.filter(
      (t) => t.includes(input) && t !== input
    )
    setTagAutocomplete(filtered.slice(0, 8))
  }, [tagInputValue, allTags])

  // Helper: count chapters for a given source video
  function getChapterCount(sourceId: string): number {
    return videos.filter((v) => v.parent_video_id === sourceId).length
  }

  // Helper: get chapters for a given source video, sorted by start_seconds
  function getChaptersOf(sourceId: string): ReferenceVideo[] {
    return videos
      .filter((v) => v.parent_video_id === sourceId)
      .sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0))
  }

  async function handleAdd() {
    setAddError('')

    let video_ref = ''
    let note_timestamp: number | undefined
    const type: 'youtube' = 'youtube'
    let title = addTitle.trim()

    if (addType === 'practice') {
      if (!selectedPractice) { setAddError('Select a video from the practice library.'); return }
      video_ref = selectedPractice.id
      title = title || selectedPractice.name
    } else {
      if (!title || !addUrl.trim()) { setAddError('Title and URL are required.'); return }
      const info = extractYouTubeInfo(addUrl)
      if (!info) { setAddError('Could not find a YouTube video ID in that URL.'); return }
      video_ref = info.id
      note_timestamp = info.startSeconds
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
          tags: [],
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
    const childCount = getChapterCount(id)
    const msg = childCount > 0
      ? `This will also remove ${childCount} chapter${childCount !== 1 ? 's' : ''}. Continue?`
      : 'Remove this video from the reference library?'
    if (!confirm(msg)) return
    const res = await fetch(`/api/reference-videos/${id}`, { method: 'DELETE' })
    if (res.ok) {
      // Remove the video and all its chapters from local state
      setVideos((prev) => prev.filter((v) => v.id !== id && v.parent_video_id !== id))
    }
  }

  function handleNotesUpdated(dbId: string, notes: import('@/lib/types').VideoNote[]) {
    setVideos((prev) => prev.map((v) => v.id === dbId ? { ...v, notes } : v))
    setWatchTarget((prev) => prev && prev.id === dbId ? { ...prev, notes } : prev)
  }

  async function handleAssignFolder(videoId: string, folderId: string | null) {
    // Optimistic update
    setVideos((prev) => prev.map((v) => v.id === videoId ? { ...v, folder_id: folderId } : v))
    await fetch(`/api/reference-videos/${videoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    })
  }

  function handleChaptersCreated(chapters: ReferenceVideo[]) {
    setVideos((prev) => [...prev, ...chapters])
    setChapterSource(null)
  }

  // ── Tag filter chip toggle ─────────────────────────────────────────────────
  function toggleFilterTag(tag: string) {
    setActiveFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  // ── Per-video tag management ──────────────────────────────────────────────
  function openTagEditor(videoId: string) {
    setEditingTagVideoId(videoId)
    setTagInputValue('')
    setTagAutocomplete([])
    setTimeout(() => tagInputRef.current?.focus(), 50)
  }

  async function addTagToVideo(videoId: string, newTag: string) {
    const normalizedTag = newTag.trim().toLowerCase()
    if (!normalizedTag) return
    const video = videos.find((v) => v.id === videoId)
    if (!video) return
    if (video.tags?.includes(normalizedTag)) return

    const updatedTags = [...(video.tags ?? []), normalizedTag]
    setVideos((prev) => prev.map((v) => v.id === videoId ? { ...v, tags: updatedTags } : v))
    setTagInputValue('')
    setTagAutocomplete([])

    // Add to allTags if new
    if (!allTags.includes(normalizedTag)) {
      setAllTags((prev) => [...prev, normalizedTag].sort())
    }

    await fetch(`/api/reference-videos/${videoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updatedTags }),
    })
  }

  async function removeTagFromVideo(videoId: string, tag: string) {
    const video = videos.find((v) => v.id === videoId)
    if (!video) return
    const updatedTags = (video.tags ?? []).filter((t) => t !== tag)
    setVideos((prev) => prev.map((v) => v.id === videoId ? { ...v, tags: updatedTags } : v))

    await fetch(`/api/reference-videos/${videoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updatedTags }),
    })
  }

  // ── Inline chapter add ─────────────────────────────────────────────────────
  function openInlineChapterAdd(parentId: string) {
    setInlineChapterParentId(parentId)
    setInlineChapterTitle('')
    setInlineChapterTimestamp('')
    setInlineChapterError('')
  }

  async function handleInlineChapterAdd() {
    if (!inlineChapterParentId) return
    if (!inlineChapterTitle.trim()) {
      setInlineChapterError('Title is required.')
      return
    }

    let start_seconds: number | null = null
    if (inlineChapterTimestamp.trim()) {
      start_seconds = parseTimestamp(inlineChapterTimestamp.trim())
      if (start_seconds === null) {
        setInlineChapterError('Invalid timestamp. Use MM:SS or HH:MM:SS format.')
        return
      }
    }

    setInlineChapterAdding(true)
    setInlineChapterError('')
    try {
      const res = await fetch('/api/reference-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: inlineChapterTitle.trim(),
          type: 'youtube',
          video_ref: '', // will be inherited from parent
          parent_video_id: inlineChapterParentId,
          start_seconds,
          tags: [],
        }),
      })
      if (res.ok) {
        const newChapter = await res.json()
        setVideos((prev) => [...prev, newChapter])
        setInlineChapterParentId(null)
        setInlineChapterTitle('')
        setInlineChapterTimestamp('')
      } else {
        const err = await res.json()
        setInlineChapterError(err.error ?? 'Failed to add chapter.')
      }
    } finally {
      setInlineChapterAdding(false)
    }
  }

  // Organize videos into folder hierarchy
  const topFolders = folders.filter((f) => !f.parent_id).sort((a, b) => a.sort_order - b.sort_order)
  const getSubFolders = (pid: string) => folders.filter((f) => f.parent_id === pid).sort((a, b) => a.sort_order - b.sort_order)
  const getVideosInFolder = (fid: string | null) => {
    if (fid === null) return videos.filter((v) => !v.folder_id)
    return videos.filter((v) => v.folder_id === fid)
  }

  const hasContent = videos.length > 0

  // Filtered practice videos
  const filteredPractice = practiceSessions.flatMap((s) =>
    s.videos
      .filter((v) => !practiceSearch || v.name.toLowerCase().includes(practiceSearch.toLowerCase()))
      .map((v) => ({ video: v, sessionLabel: s.label }))
  )

  // ── Group videos within a folder for rendering ──
  // Returns: standalone videos + source+chapter groups, in order
  function groupFolderVideos(folderVideos: ReferenceVideo[]): Array<
    | { kind: 'standalone'; video: ReferenceVideo }
    | { kind: 'group'; source: ReferenceVideo; chapters: ReferenceVideo[] }
  > {
    const result: Array<
      | { kind: 'standalone'; video: ReferenceVideo }
      | { kind: 'group'; source: ReferenceVideo; chapters: ReferenceVideo[] }
    > = []

    // Collect IDs of all chapter videos in this folder
    const chapterIdsInFolder = new Set(
      folderVideos.filter((v) => v.parent_video_id).map((v) => v.id)
    )

    // Process non-chapter videos first
    for (const video of folderVideos) {
      if (video.parent_video_id) continue // skip chapters, handled in groups

      const chapters = getChaptersOf(video.id).filter((ch) => chapterIdsInFolder.has(ch.id))
      if (chapters.length > 0) {
        result.push({ kind: 'group', source: video, chapters })
      } else {
        result.push({ kind: 'standalone', video })
      }
    }

    // Handle orphan chapters (parent in different folder or parent not in this folder view)
    const orphanChapters = folderVideos.filter(
      (v) => v.parent_video_id && !folderVideos.some((fv) => fv.id === v.parent_video_id)
    )
    if (orphanChapters.length > 0) {
      // Group by parent_video_id
      const byParent = new Map<string, ReferenceVideo[]>()
      for (const ch of orphanChapters) {
        const pid = ch.parent_video_id!
        if (!byParent.has(pid)) byParent.set(pid, [])
        byParent.get(pid)!.push(ch)
      }
      for (const [parentId, chapters] of byParent) {
        const parentVideo = videos.find((v) => v.id === parentId)
        if (parentVideo) {
          result.push({ kind: 'group', source: parentVideo, chapters: chapters.sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0)) })
        } else {
          // No parent found, show as standalone
          for (const ch of chapters) {
            result.push({ kind: 'standalone', video: ch })
          }
        }
      }
    }

    return result
  }

  // ── VideoTagEditor component ──────────────────────────────────────────────
  function VideoTagEditor({ video }: { video: ReferenceVideo }) {
    const isEditing = editingTagVideoId === video.id
    const tags = video.tags ?? []

    return (
      <div className="px-3 pb-2.5">
        {/* Existing tags as removable chips */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800"
              >
                {tag}
                <button
                  onClick={() => removeTagFromVideo(video.id, tag)}
                  className="ml-0.5 hover:text-red-600"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tag input */}
        {isEditing ? (
          <div className="relative">
            <input
              ref={tagInputRef}
              type="text"
              value={tagInputValue}
              onChange={(e) => setTagInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTagToVideo(video.id, tagInputValue)
                } else if (e.key === 'Escape') {
                  setEditingTagVideoId(null)
                  setTagInputValue('')
                }
              }}
              onBlur={() => {
                // Slight delay to allow autocomplete click to register
                setTimeout(() => {
                  setEditingTagVideoId(null)
                  setTagInputValue('')
                }, 150)
              }}
              placeholder="Add tag…"
              className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {tagAutocomplete.length > 0 && (
              <div className="absolute z-20 left-0 top-full mt-0.5 bg-white shadow-lg rounded border border-gray-200 max-h-40 overflow-y-auto w-full min-w-[120px]">
                {tagAutocomplete.map((suggestion) => (
                  <button
                    key={suggestion}
                    onMouseDown={(e) => {
                      e.preventDefault() // prevent blur
                      addTagToVideo(video.id, suggestion)
                    }}
                    className="w-full text-left px-2 py-1 text-xs hover:bg-blue-50 text-gray-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => openTagEditor(video.id)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
          >
            <Tag className="h-3 w-3" />
            <span>{tags.length === 0 ? 'Add tags' : 'Edit tags'}</span>
          </button>
        )}
      </div>
    )
  }

  // ── VideoCard component ────────────────────────────────────────────────────
  function VideoCard({ video, chapters }: { video: ReferenceVideo; chapters?: ReferenceVideo[] }) {
    const [chaptersExpanded, setChaptersExpanded] = useState(false)
    const thumb = youtubeThumbnailUrl(video.video_ref)
    const isChapter = !!video.parent_video_id
    const chapterCount = chapters?.length ?? (!isChapter ? getChapterCount(video.id) : 0)
    const showInlineChapterForm = inlineChapterParentId === video.id

    return (
      <div
        draggable={isCaptain}
        onDragStart={isCaptain ? (e) => {
          e.dataTransfer.setData('text/plain', video.id)
          e.dataTransfer.effectAllowed = 'move'
        } : undefined}
        className={clsx(
          'group/card relative bg-white rounded-xl border overflow-hidden hover:shadow-md hover:border-blue-200 transition-all',
          'border-gray-100',
          isCaptain && 'cursor-grab active:cursor-grabbing active:opacity-50'
        )}
      >
        <button className="w-full text-left" onClick={() => setWatchTarget(video)}>
          <div className="relative aspect-video bg-gray-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt={video.title}
              className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover/card:opacity-100 bg-white/90 rounded-full p-2.5 shadow">
                <Play className="h-5 w-5 text-blue-600 fill-blue-600" />
              </div>
            </div>
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
              <Youtube className="h-2.5 w-2.5" />
              YouTube
            </div>
            {/* Timestamp badge for chapters */}
            {video.start_seconds != null && video.start_seconds > 0 && (
              <div className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-xs font-mono rounded px-1.5 py-0.5">
                {formatTime(video.start_seconds)}
              </div>
            )}
            {/* Chapter count badge for source videos */}
            {chapterCount > 0 && (
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-purple-600/90 text-white text-xs font-medium rounded-full px-1.5 py-0.5">
                <Layers className="h-2.5 w-2.5" />
                {chapterCount}
              </div>
            )}
          </div>
          <div className="px-3 pt-2 pb-1">
            <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{video.title}</p>
            {video.note && <p className="text-xs text-amber-600 mt-0.5 truncate">📝 {video.note}</p>}
          </div>
        </button>

        {/* Chapter dropdown toggle + expandable list */}
        {chapters && chapters.length > 0 && (
          <div className="px-3 pb-1">
            <button
              onClick={() => setChaptersExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-purple-500 hover:text-purple-700 transition-colors py-1"
            >
              <ChevronDown className={clsx('h-3 w-3 transition-transform', !chaptersExpanded && '-rotate-90')} />
              <span>{chapters.length} chapter{chapters.length !== 1 ? 's' : ''}</span>
            </button>
            {chaptersExpanded && (
              <div className="border-l-2 border-purple-200 ml-1 mb-1">
                {chapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setWatchTarget(ch)}
                    className="w-full text-left flex items-center gap-2 py-1 px-3 text-xs hover:bg-purple-50 transition-colors"
                  >
                    {ch.start_seconds != null && ch.start_seconds > 0 && (
                      <span className="shrink-0 font-mono text-purple-500 bg-purple-50 rounded px-1 py-0.5 text-[10px]">
                        {formatTime(ch.start_seconds)}
                      </span>
                    )}
                    <span className="text-gray-700 truncate">{ch.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tag display / editor — visible to all logged-in users */}
        <VideoTagEditor video={video} />

        {/* Chapter + delete actions */}
        {(isCaptain || isAuthenticated) && (
          <div className="px-3 pb-2.5 flex items-center justify-between">
            {/* Create chapters button — visible to any authenticated user, only for non-chapter videos */}
            {!isChapter && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setChapterSource(video)}
                  className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700 transition-colors"
                  title="Create chapters with ChapterEditor"
                >
                  <Scissors className="h-3 w-3" />
                  <span className="hidden sm:inline">Chapters</span>
                </button>
                <button
                  onClick={() => openInlineChapterAdd(video.id)}
                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-600 transition-colors"
                  title="Quick add chapter"
                >
                  <Plus className="h-3 w-3" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              </div>
            )}
            {isChapter && <span />}
            {/* Delete — captain only */}
            {isCaptain && (
              <button
                onClick={() => handleDelete(video.id)}
                className="p-1 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                title="Remove from library"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Inline chapter add form */}
        {showInlineChapterForm && (
          <div className="px-3 pb-3 border-t border-purple-100 bg-purple-50/50 space-y-2 pt-2">
            <p className="text-xs font-medium text-purple-700">Quick add chapter</p>
            <input
              type="text"
              value={inlineChapterTitle}
              onChange={(e) => setInlineChapterTitle(e.target.value)}
              placeholder="Chapter title"
              autoFocus
              className="w-full px-2 py-1 text-xs border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            <input
              type="text"
              value={inlineChapterTimestamp}
              onChange={(e) => setInlineChapterTimestamp(e.target.value)}
              placeholder="Timestamp (MM:SS)"
              className="w-full px-2 py-1 text-xs border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            {inlineChapterError && <p className="text-xs text-red-500">{inlineChapterError}</p>}
            <div className="flex gap-1.5">
              <button
                onClick={handleInlineChapterAdd}
                disabled={inlineChapterAdding}
                className="flex-1 px-2 py-1 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {inlineChapterAdding ? 'Adding…' : 'Add chapter'}
              </button>
              <button
                onClick={() => setInlineChapterParentId(null)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function VideoGrid({ folderVideos }: { folderVideos: ReferenceVideo[] }) {
    const groups = groupFolderVideos(folderVideos)

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
        {groups.map((item) => {
          if (item.kind === 'standalone') {
            return <VideoCard key={item.video.id} video={item.video} />
          }
          // Group: single card for source with chapters passed as prop
          return <VideoCard key={item.source.id} video={item.source} chapters={item.chapters} />
        })}
      </div>
    )
  }

  function toggleFolder(folderId: string) {
    setOpenFolderIds(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  function FolderSection({ folder, depth = 0 }: { folder: ReferenceFolder; depth?: number }) {
    const isOpen = openFolderIds.has(folder.id)
    const [isDragOver, setIsDragOver] = useState(false)
    const subFolders = getSubFolders(folder.id)
    const folderVideos = getVideosInFolder(folder.id)
    if (folderVideos.length === 0 && subFolders.every((sf) => getVideosInFolder(sf.id).length === 0)) {
      if (!isCaptain) return null
    }

    return (
      <div
        className={clsx(
          depth > 0 && 'ml-4 border-l border-gray-100 pl-4',
          isDragOver && 'ring-2 ring-blue-400 ring-inset rounded-xl bg-blue-50/40 transition-all'
        )}
        onDragOver={isCaptain ? (e) => { e.preventDefault(); setIsDragOver(true) } : undefined}
        onDragLeave={isCaptain ? (e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
        } : undefined}
        onDrop={isCaptain ? (e) => {
          e.preventDefault()
          setIsDragOver(false)
          const videoId = e.dataTransfer.getData('text/plain')
          if (videoId) handleAssignFolder(videoId, folder.id)
        } : undefined}
      >
        <button
          onClick={() => toggleFolder(folder.id)}
          className="flex items-center gap-2 w-full text-left mb-2"
        >
          <ChevronDown className={clsx('h-4 w-4 text-gray-400 transition-transform', !isOpen && '-rotate-90')} />
          <FolderOpen className="h-4 w-4 text-blue-400 shrink-0" />
          <span className={clsx('font-semibold text-gray-700', depth === 0 ? 'text-base' : 'text-sm')}>{folder.name}</span>
          <span className="text-xs text-gray-400">{folderVideos.length}</span>
        </button>
        {folder.description && isOpen && (
          <p className="text-sm text-gray-500 mb-3 ml-10 leading-relaxed">{folder.description}</p>
        )}
        {isOpen && (
          <>
            {subFolders.map((sf) => (
              <FolderSection key={sf.id} folder={sf} depth={depth + 1} />
            ))}
            {folderVideos.length > 0 && (
              <VideoGrid folderVideos={folderVideos} />
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

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500">Filter by tag:</span>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleFilterTag(tag)}
              className={clsx(
                'px-2 py-0.5 rounded-full text-sm transition-colors',
                activeFilterTags.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {tag}
            </button>
          ))}
          {activeFilterTags.length > 0 && (
            <button
              onClick={() => setActiveFilterTags([])}
              className="text-xs text-gray-400 hover:text-gray-600 ml-1"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

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
                YouTube URL — timestamps like ?t=42 are captured automatically
              </label>
              <input
                type="text"
                value={addUrl}
                onChange={(e) => { setAddUrl(e.target.value); setAddError('') }}
                placeholder="https://youtu.be/..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {addType === 'youtube' && ytInfo && (
                <p className="text-xs text-green-600">
                  Video ID: {ytInfo.id}
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
                  <Film className="h-3.5 w-3.5 shrink-0" />
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
          {/* Unfoldered videos — always show as drop zone when captain has folders */}
          {(unfolderedVideos.length > 0 || (isCaptain && folders.length > 0)) && (
            <div
              onDragOver={isCaptain ? (e) => { e.preventDefault(); setIsDragOverUnfoldered(true) } : undefined}
              onDragLeave={isCaptain ? (e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOverUnfoldered(false)
              } : undefined}
              onDrop={isCaptain ? (e) => {
                e.preventDefault()
                setIsDragOverUnfoldered(false)
                const videoId = e.dataTransfer.getData('text/plain')
                if (videoId) handleAssignFolder(videoId, null)
              } : undefined}
              className={clsx(
                'rounded-xl transition-all',
                isDragOverUnfoldered && 'ring-2 ring-blue-400 ring-inset bg-blue-50/40 p-2'
              )}
            >
              {topFolders.length > 0 && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Unfoldered</p>
              )}
              {unfolderedVideos.length === 0 ? (
                <div className="py-8 flex items-center justify-center text-gray-300 text-xs border-2 border-dashed border-gray-200 rounded-xl">
                  Drop here to remove from folder
                </div>
              ) : (
                <VideoGrid folderVideos={unfolderedVideos} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Video viewer */}
      {watchTarget && (() => {
        // Collect sibling chapters whether clicking a parent or a chapter
        const parentId = watchTarget.parent_video_id
        const resolvedParentId = parentId || watchTarget.id
        const children = videos
          .filter((v) => v.parent_video_id === resolvedParentId)
          .sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0))

        let siblings: ReferenceVideo[] | undefined
        if (children.length > 0) {
          const parentVideo = parentId ? videos.find((v) => v.id === parentId) : watchTarget
          // Multi-video chapters: each child has a different video_ref from parent
          const isMultiVideo = parentVideo && children.some((c) => c.video_ref !== parentVideo.video_ref)
          if (isMultiVideo && parentVideo) {
            // Include parent as "Part 1" so user can navigate back to it
            siblings = [{ ...parentVideo, title: 'Part 1' }, ...children]
          } else {
            siblings = children
          }
        }

        return (
          <VideoWatchView
            key={watchTarget.video_ref}
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
            startSeconds={watchTarget.start_seconds ?? undefined}
            siblingChapters={siblings}
            onChapterChange={(chapter) => setWatchTarget(chapter)}
            noteApiPath={isCaptain ? `/api/reference-videos/${watchTarget.id}` : undefined}
            userName={userName}
            isCaptain={isCaptain}
            isAuthenticated={isAuthenticated || isCaptain}
            onNotesUpdated={isCaptain ? handleNotesUpdated : undefined}
            onChaptersChanged={() => {
              // Re-fetch videos to reflect chapter changes
              fetch('/api/reference-videos').then((r) => r.json()).then((vids) => {
                if (Array.isArray(vids)) setVideos(vids)
              })
            }}
            onClose={() => setWatchTarget(null)}
          />
        )
      })()}

      {/* Chapter editor */}
      {chapterSource && (
        <ChapterEditor
          sourceVideo={chapterSource}
          folders={folders}
          onChaptersCreated={handleChaptersCreated}
          onClose={() => setChapterSource(null)}
        />
      )}
    </div>
  )
}
