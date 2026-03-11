'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ExternalLink, Heart, Send, Shield, Plus, Trash2, Check, Clock, MessageSquare, ChevronDown, ChevronUp, Layers, Reply, Edit2, Bookmark, Pencil } from 'lucide-react'
import { parseTimestamp, formatTime, youtubeThumbnailUrl, type SessionVideo, type VideoNote, type ReferenceVideo } from '@/lib/types'
import { timeAgo, initials, avatarColor, parseMentions } from '@/lib/comment-utils'
import { onYouTubeReady } from '@/lib/youtube-api'
import type { Comment } from '@/lib/types'
import MentionTextarea, { type MentionUser } from '@/components/MentionTextarea'
import clsx from 'clsx'

/* ── YouTube IFrame API type declarations ── */
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId: string
          playerVars?: Record<string, number | string>
          events?: {
            onReady?: (event: { target: YTPlayer }) => void
            onStateChange?: (event: { data: number }) => void
          }
        }
      ) => YTPlayer
      PlayerState: {
        PLAYING: number
        PAUSED: number
        ENDED: number
      }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface YTPlayer {
  getCurrentTime: () => number
  getPlayerState: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  loadVideoById: (videoId: string, startSeconds?: number) => void
  destroy: () => void
}

interface VideoWatchViewProps {
  video: SessionVideo
  sessionId: string
  activeSessionId?: string
  userName: string
  userId?: string        // current user's ID — used to show edit/delete on own comments
  userRole?: 'captain' | 'contributor' | 'viewer'
  isCaptain?: boolean
  isFavorited?: boolean
  onFavoriteToggle?: () => void
  onClose: () => void
  onNotesUpdated?: (videoId: string, notes: VideoNote[]) => void
  // Reference video / YouTube support
  mediaId?: string
  videoType?: 'youtube'
  noteApiPath?: string
  startSeconds?: number  // Chapter start time — seek on initial load
  // Chapter navigation
  siblingChapters?: ReferenceVideo[]  // all chapters sharing same parent, sorted by start_seconds
  onChapterChange?: (chapter: ReferenceVideo) => void  // switch watchTarget to a different chapter
  // Legacy callback (kept for callers that haven't migrated)
  onNoteUpdated?: (videoId: string, note: string, noteTimestamp?: number) => void
  // Auth state for chapter editing
  isAuthenticated?: boolean
  onChaptersChanged?: () => void
  // @mention autocomplete data
  users?: MentionUser[]
}

export default function VideoWatchView({
  video, sessionId, activeSessionId, userName, userId, userRole,
  isCaptain = false,
  isFavorited = false, onFavoriteToggle, onClose, onNotesUpdated, onNoteUpdated,
  mediaId, videoType = 'youtube', noteApiPath, startSeconds,
  siblingChapters, onChapterChange,
  isAuthenticated = false, onChaptersChanged,
  users = [],
}: VideoWatchViewProps) {
  // isCaptain can be set via prop or derived from userRole
  const effectiveCaptain = isCaptain || userRole === 'captain'
  const canEditChapters = isAuthenticated || effectiveCaptain || !!userId
  const effectiveVideoId = mediaId ?? video.id

  // Whether we are in multi-part mode (chapters have different video_refs)
  const isMultiVideo = siblingChapters
    ? new Set(siblingChapters.map((s) => s.video_ref)).size > 1
    : false

  // Detect mobile on initial render
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640

  // ── YouTube Player API state ──
  const ytPlayerRef = useRef<YTPlayer | null>(null)
  const containerIdRef = useRef(`yt-player-${effectiveVideoId}-${Math.random().toString(36).slice(2, 7)}`)
  const startSecondsRef = useRef(startSeconds)
  const siblingChaptersRef = useRef(siblingChapters)
  const onChapterChangeRef = useRef(onChapterChange)

  // Track active chapter index for auto-advance and UI highlighting
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(() => {
    if (!siblingChapters) return 0
    const idx = siblingChapters.findIndex((ch) => ch.id === video.id)
    return idx >= 0 ? idx : 0
  })
  const activeChapterIndexRef = useRef(activeChapterIndex)

  // ── Chapter editing state ──
  const [addingChapter, setAddingChapter] = useState(false)
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [newChapterTimestamp, setNewChapterTimestamp] = useState('')
  const [chapterSaving, setChapterSaving] = useState(false)
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editChapterTitle, setEditChapterTitle] = useState('')
  const [editChapterTimestamp, setEditChapterTimestamp] = useState('')
  const [chapterError, setChapterError] = useState('')

  // Keep refs in sync
  useEffect(() => { onChapterChangeRef.current = onChapterChange }, [onChapterChange])
  useEffect(() => { siblingChaptersRef.current = siblingChapters }, [siblingChapters])
  useEffect(() => { startSecondsRef.current = startSeconds }, [startSeconds])
  useEffect(() => { activeChapterIndexRef.current = activeChapterIndex }, [activeChapterIndex])

  // ── Initialize YT.Player ──
  useEffect(() => {
    const containerId = containerIdRef.current

    // Guard: make sure container div is mounted before player creation
    let playerCreated = false

    onYouTubeReady(() => {
      if (playerCreated) return
      const container = document.getElementById(containerId)
      if (!container) return
      if (ytPlayerRef.current) return

      playerCreated = true
      ytPlayerRef.current = new window.YT.Player(containerId, {
        videoId: effectiveVideoId,
        playerVars: {
          playsinline: isMobile ? 0 : 1,
          rel: 0,
          fs: 1,
          start: startSecondsRef.current ?? 0,
        },
        events: {
          onReady: (event) => {
            if (startSecondsRef.current && startSecondsRef.current > 0) {
              event.target.seekTo(startSecondsRef.current, true)
            }
          },
          onStateChange: (event) => {
            // Auto-advance when video ends
            if (event.data === window.YT.PlayerState.ENDED) {
              const chapters = siblingChaptersRef.current
              if (!chapters || chapters.length <= 1) return
              const currentIdx = activeChapterIndexRef.current
              const nextIdx = currentIdx + 1
              if (nextIdx >= chapters.length) return
              const nextChapter = chapters[nextIdx]
              activeChapterIndexRef.current = nextIdx
              setActiveChapterIndex(nextIdx)
              if (nextChapter.video_ref !== chapters[currentIdx].video_ref) {
                // Different video — load new video ID
                ytPlayerRef.current?.loadVideoById(nextChapter.video_ref, nextChapter.start_seconds ?? 0)
              } else {
                // Same video — just seek
                ytPlayerRef.current?.seekTo(nextChapter.start_seconds ?? 0, true)
              }
              onChapterChangeRef.current?.(nextChapter)
            }
          },
        },
      })
    })

    return () => {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy() } catch { /* ignore */ }
        ytPlayerRef.current = null
      }
    }
    // Only re-run when the video ID changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveVideoId])

  // ── Chapter click: seek or load new video ──
  const handleChapterClick = useCallback((chapter: ReferenceVideo, idx: number) => {
    if (activeChapterIndexRef.current === idx) return
    activeChapterIndexRef.current = idx
    setActiveChapterIndex(idx)
    if (ytPlayerRef.current) {
      if (chapter.video_ref !== effectiveVideoId) {
        ytPlayerRef.current.loadVideoById(chapter.video_ref, chapter.start_seconds ?? 0)
      } else {
        ytPlayerRef.current.seekTo(chapter.start_seconds ?? 0, true)
      }
    }
    onChapterChangeRef.current?.(chapter)
  }, [effectiveVideoId])

  // ── Chapter add/edit handlers ──
  async function handleAddChapter() {
    const title = newChapterTitle.trim()
    if (!title) { setChapterError('Title is required.'); return }
    let start_seconds: number | null = null
    if (newChapterTimestamp.trim()) {
      start_seconds = parseTimestamp(newChapterTimestamp.trim())
      if (start_seconds === null) { setChapterError('Invalid timestamp. Use MM:SS or HH:MM:SS.'); return }
    }
    // Determine parent_video_id
    const parent_video_id = siblingChapters?.[0]?.parent_video_id || video.id
    setChapterSaving(true)
    setChapterError('')
    try {
      const res = await fetch('/api/reference-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type: 'youtube', video_ref: '', parent_video_id, start_seconds, tags: [] }),
      })
      if (res.ok) {
        onChaptersChanged?.()
        setAddingChapter(false)
        setNewChapterTitle('')
        setNewChapterTimestamp('')
        setChapterError('')
      } else {
        const err = await res.json()
        setChapterError(err.error ?? 'Failed to add chapter.')
      }
    } catch {
      setChapterError('Network error.')
    } finally {
      setChapterSaving(false)
    }
  }

  async function handleEditChapter() {
    if (!editingChapterId) return
    const title = editChapterTitle.trim()
    if (!title) { setChapterError('Title is required.'); return }
    let start_seconds: number | null = null
    if (editChapterTimestamp.trim()) {
      start_seconds = parseTimestamp(editChapterTimestamp.trim())
      if (start_seconds === null) { setChapterError('Invalid timestamp. Use MM:SS or HH:MM:SS.'); return }
    }
    setChapterSaving(true)
    setChapterError('')
    try {
      const res = await fetch(`/api/reference-videos/${editingChapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, start_seconds }),
      })
      if (res.ok) {
        onChaptersChanged?.()
        setEditingChapterId(null)
        setEditChapterTitle('')
        setEditChapterTimestamp('')
        setChapterError('')
      } else {
        const err = await res.json()
        setChapterError(err.error ?? 'Failed to update chapter.')
      }
    } catch {
      setChapterError('Network error.')
    } finally {
      setChapterSaving(false)
    }
  }

  function startEditingChapter(ch: ReferenceVideo) {
    setEditingChapterId(ch.id)
    setEditChapterTitle(ch.title)
    setEditChapterTimestamp(ch.start_seconds != null ? formatTime(ch.start_seconds) : '')
    setChapterError('')
    setAddingChapter(false)
  }

  function getCurrentTimeFormatted(): string {
    const player = ytPlayerRef.current
    if (!player) return '0:00'
    const seconds = Math.floor(player.getCurrentTime())
    return formatTime(seconds)
  }

  // ── Seek helper (for comment timestamps and captain notes) ──
  function seekTo(seconds: number) {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(seconds, true)
    }
  }

  // ── Notes ──
  function resolveNotes(v: SessionVideo): VideoNote[] {
    if (v.notes && v.notes.length > 0) return v.notes
    if (v.note) return [{ text: v.note, timestamp: v.noteTimestamp }]
    return []
  }

  const [notes, setNotes] = useState<VideoNote[]>(() => resolveNotes(video))

  useEffect(() => {
    setNotes(resolveNotes(video))
  }, [video.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [addingNote, setAddingNote] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteTimestampRaw, setNewNoteTimestampRaw] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const parsedNewTimestamp = parseTimestamp(newNoteTimestampRaw)
  const newTimestampInvalid = newNoteTimestampRaw.trim() !== '' && parsedNewTimestamp === null

  // ── Comments ──
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [timestampRaw, setTimestampRaw] = useState('')
  const [sendToCaptain, setSendToCaptain] = useState(false)
  const [posting, setPosting] = useState(false)
  const [commentsExpanded, setCommentsExpanded] = useState(false)

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [postingReply, setPostingReply] = useState(false)
  const [repliesByComment, setRepliesByComment] = useState<Map<string, Comment[]>>(new Map())
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())
  const replyInputRef = useRef<HTMLTextAreaElement>(null)

  // Edit/delete state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Bookmark state
  const [bookmarkFlash, setBookmarkFlash] = useState<string | null>(null) // 'saved' | 'duplicate' | 'play-first' | null

  const backdropRef = useRef<HTMLDivElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    setLoadingComments(true)
    fetch(`/api/comments?videoId=${effectiveVideoId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setComments(data) })
      .finally(() => setLoadingComments(false))
  }, [video.id, effectiveVideoId])

  // ── 30-second polling: append new comments without disrupting scroll ──
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/comments?videoId=${effectiveVideoId}`)
        if (!res.ok) return
        const fresh: Comment[] = await res.json()
        if (!Array.isArray(fresh)) return
        setComments((prev) => {
          const existingIds = new Set(prev.map((c) => c.id))
          const newOnes = fresh.filter((c) => !existingIds.has(c.id))
          if (newOnes.length === 0) return prev
          return [...prev, ...newOnes]
        })
      } catch { /* silent failure on polling errors */ }
    }
    const interval = setInterval(poll, 30000)
    return () => clearInterval(interval)
  }, [effectiveVideoId])

  const parsedTimestamp = parseTimestamp(timestampRaw)
  const timestampInvalid = timestampRaw.trim() !== '' && parsedTimestamp === null

  // ── Timestamp auto-capture on comment focus ──
  function handleCommentFocus() {
    if (timestampRaw.trim() !== '') return
    const player = ytPlayerRef.current
    if (!player) return
    try {
      const state = player.getPlayerState()
      // Only capture if PLAYING (1) or PAUSED (2)
      if (state === 1 || state === 2) {
        const seconds = Math.floor(player.getCurrentTime())
        setTimestampRaw(formatTime(seconds))
      }
    } catch { /* player may not be ready */ }
  }

  async function persistNotes(nextNotes: VideoNote[]) {
    setSavingNote(true)
    try {
      const endpoint = noteApiPath ?? `/api/sessions/${sessionId}/video-note`
      const payload = noteApiPath
        ? { notes: nextNotes }
        : { videoId: video.id, notes: nextNotes }
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setNotes(nextNotes)
        onNotesUpdated?.(video.id, nextNotes)
        onNoteUpdated?.(video.id, nextNotes[0]?.text ?? '', nextNotes[0]?.timestamp)
      }
    } finally {
      setSavingNote(false)
    }
  }

  async function handleAddNote() {
    if (!newNoteText.trim() || newTimestampInvalid) return
    const newNote: VideoNote = {
      text: newNoteText.trim(),
      ...(parsedNewTimestamp != null ? { timestamp: parsedNewTimestamp } : {}),
    }
    const sorted = [...notes, newNote].sort((a, b) => {
      if (a.timestamp != null && b.timestamp != null) return a.timestamp - b.timestamp
      if (a.timestamp != null) return -1
      if (b.timestamp != null) return 1
      return 0
    })
    await persistNotes(sorted)
    setNewNoteText('')
    setNewNoteTimestampRaw('')
    setAddingNote(false)
  }

  async function handleDeleteNote(idx: number) {
    await persistNotes(notes.filter((_, i) => i !== idx))
  }

  async function toggleReplies(commentId: string) {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies((prev) => { const next = new Set(prev); next.delete(commentId); return next })
      return
    }
    setExpandedReplies((prev) => new Set(prev).add(commentId))
    if (!repliesByComment.has(commentId)) {
      setLoadingReplies((prev) => new Set(prev).add(commentId))
      try {
        const res = await fetch(`/api/comments?parentId=${commentId}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) setRepliesByComment((prev) => new Map(prev).set(commentId, data))
        }
      } finally {
        setLoadingReplies((prev) => { const next = new Set(prev); next.delete(commentId); return next })
      }
    }
  }

  function startReply(commentId: string) {
    setReplyingTo(commentId)
    setReplyText('')
    if (!expandedReplies.has(commentId)) toggleReplies(commentId)
    setTimeout(() => replyInputRef.current?.focus(), 50)
  }

  async function postReply(parentId: string) {
    if (!replyText.trim()) return
    setPostingReply(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || undefined,
          video_id: effectiveVideoId,
          video_title: video.name,
          author_name: userName,
          comment_text: replyText.trim(),
          parent_id: parentId,
        }),
      })
      if (res.ok) {
        const newReply = await res.json()
        setRepliesByComment((prev) => {
          const next = new Map(prev)
          next.set(parentId, [...(next.get(parentId) ?? []), newReply])
          return next
        })
        setComments((prev) => prev.map((c) =>
          c.id === parentId ? { ...c, reply_count: (c.reply_count ?? 0) + 1 } : c
        ))
        setReplyText('')
        setReplyingTo(null)
      }
    } finally {
      setPostingReply(false)
    }
  }

  // ── Edit comment ──
  function startEdit(comment: Comment) {
    setEditingCommentId(comment.id)
    setEditText(comment.comment_text)
    setConfirmDeleteId(null)
  }

  async function saveEdit(commentId: string) {
    if (!editText.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_text: editText.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, ...updated, is_edited: true } : c))
        setEditingCommentId(null)
        setEditText('')
      }
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Delete comment ──
  async function deleteComment(commentId: string) {
    setDeletingCommentId(commentId)
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
        setConfirmDeleteId(null)
      }
    } finally {
      setDeletingCommentId(null)
    }
  }

  // Ownership check: user can edit/delete own comments; captain can edit/delete any
  function canEditComment(comment: Comment) {
    if (!userId && !effectiveCaptain) return false
    const commentAuthorId = (comment as Comment & { author_id?: string }).author_id
    return effectiveCaptain || (userId != null && commentAuthorId === userId)
  }

  async function postComment() {
    if (!commentText.trim() || timestampInvalid) return
    const targetSessionId = sendToCaptain && activeSessionId ? activeSessionId : sessionId
    setPosting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: targetSessionId || undefined,
          video_id: effectiveVideoId,
          video_title: video.name,
          author_name: userName,
          timestamp_seconds: parsedTimestamp,
          comment_text: commentText.trim(),
          send_to_captain: sendToCaptain,
        }),
      })
      if (res.ok) {
        const newComment = await res.json()
        setComments((prev) => [...prev, newComment])
        setCommentText('')
        setTimestampRaw('')
        setSendToCaptain(false)
        setTimeout(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }), 100)
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to post comment:', res.status, err)
      }
    } finally {
      setPosting(false)
    }
  }

  function expandAndFocusComposer() {
    setCommentsExpanded(true)
    setTimeout(() => composerRef.current?.focus(), 50)
  }

  async function handleBookmark() {
    if (!userId) return
    const player = ytPlayerRef.current
    if (!player) {
      setBookmarkFlash('play-first')
      setTimeout(() => setBookmarkFlash(null), 1500)
      return
    }
    try {
      const state = player.getPlayerState()
      if (state !== 1 && state !== 2) {
        setBookmarkFlash('play-first')
        setTimeout(() => setBookmarkFlash(null), 1500)
        return
      }
      const ts = Math.floor(player.getCurrentTime())
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: effectiveVideoId,
          session_id: sessionId || undefined,
          timestamp_seconds: ts,
          video_title: video.name,
        }),
      })
      if (res.status === 409) {
        setBookmarkFlash('duplicate')
        setTimeout(() => setBookmarkFlash(null), 1500)
      } else if (res.ok || res.status === 201) {
        setBookmarkFlash('saved')
        setTimeout(() => setBookmarkFlash(null), 1500)
      }
    } catch { /* silent */ }
  }

  const sorted = [...comments].sort((a, b) => {
    if (a.timestamp_seconds != null && b.timestamp_seconds != null) return a.timestamp_seconds - b.timestamp_seconds
    if (a.timestamp_seconds != null) return -1
    if (b.timestamp_seconds != null) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const hasNotes = notes.length > 0

  // Resolve thumbnail for YouTube link (not used in player but useful for og-tags)
  void youtubeThumbnailUrl

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-4 overflow-hidden"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="relative w-full h-full md:h-auto max-w-7xl bg-white md:rounded-2xl shadow-2xl flex flex-col sm:flex-row overflow-hidden">

        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── Left: Video (full width mobile, 65% desktop) ── */}
        <div className="w-full sm:w-[65%] bg-black flex flex-col shrink-0">
          <div className="aspect-video w-full">
            {/* YT.Player mounts into this div */}
            <div id={containerIdRef.current} className="w-full h-full" />
          </div>
          <div className="bg-gray-900 px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{video.name}</p>
            </div>
            {userId && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleBookmark}
                  title="Bookmark this moment"
                  className="flex items-center gap-1 text-gray-400 hover:text-blue-400 transition-colors"
                >
                  <Bookmark className="h-4 w-4" />
                </button>
                {bookmarkFlash === 'saved' && (
                  <span className="text-xs text-green-400">Saved!</span>
                )}
                {bookmarkFlash === 'duplicate' && (
                  <span className="text-xs text-yellow-400">Already saved</span>
                )}
                {bookmarkFlash === 'play-first' && (
                  <span className="text-xs text-gray-400">Play video first</span>
                )}
              </div>
            )}
            {onFavoriteToggle && (
              <button onClick={onFavoriteToggle} title={isFavorited ? 'Unfavorite' : 'Favorite'}>
                <Heart className={clsx('h-5 w-5 transition-colors', isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-500 hover:text-red-400')} />
              </button>
            )}
            <a
              href={`https://www.youtube.com/watch?v=${effectiveVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              title="Open on YouTube"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* ── Right panel (full width mobile, 35% desktop) ── */}
        <div className="flex-1 sm:w-[35%] flex flex-col overflow-hidden border-l border-gray-100">

          {/* Chapter navigation — vertical scrollable list */}
          {siblingChapters && siblingChapters.length > 1 && (
            <div className="border-b border-purple-100 bg-purple-50 px-4 py-2.5 shrink-0">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-xs font-semibold text-purple-700">
                  Chapters ({siblingChapters.length})
                </span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {siblingChapters.map((ch, idx) => {
                  const isActive = idx === activeChapterIndex
                  // Inline edit form for this chapter
                  if (editingChapterId === ch.id) {
                    return (
                      <div key={ch.id} className="bg-white border border-purple-200 rounded-lg p-2 space-y-1.5">
                        <input
                          type="text"
                          value={editChapterTitle}
                          onChange={(e) => setEditChapterTitle(e.target.value)}
                          placeholder="Chapter title"
                          autoFocus
                          className="w-full px-2 py-1 text-xs border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                        />
                        <input
                          type="text"
                          value={editChapterTimestamp}
                          onChange={(e) => setEditChapterTimestamp(e.target.value)}
                          placeholder="MM:SS"
                          className="w-full px-2 py-1 text-xs border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                        />
                        {chapterError && <p className="text-xs text-red-500">{chapterError}</p>}
                        <div className="flex gap-1.5">
                          <button
                            onClick={handleEditChapter}
                            disabled={chapterSaving}
                            className="flex-1 px-2 py-1 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                          >
                            {chapterSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditingChapterId(null); setChapterError('') }}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={ch.id} className="group/ch relative">
                      <button
                        onClick={() => handleChapterClick(ch, idx)}
                        className={clsx(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all',
                          isActive
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white text-purple-700 border border-purple-100 hover:bg-purple-100 hover:border-purple-200'
                        )}
                      >
                        {ch.start_seconds != null && (
                          <span className={clsx('font-mono text-[10px] shrink-0', isActive ? 'text-purple-200' : 'text-purple-400')}>
                            {formatTime(ch.start_seconds)}
                          </span>
                        )}
                        <span className="flex-1 truncate font-medium">{ch.title}</span>
                      </button>
                      {canEditChapters && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditingChapter(ch) }}
                          className={clsx(
                            'absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover/ch:opacity-100 transition-opacity',
                            isActive ? 'text-purple-200 hover:text-white' : 'text-purple-300 hover:text-purple-600'
                          )}
                          title="Edit chapter"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Add chapter button */}
              {canEditChapters && !addingChapter && (
                <button
                  onClick={() => { setAddingChapter(true); setChapterError(''); setEditingChapterId(null) }}
                  className="flex items-center gap-1 mt-2 text-xs text-purple-500 hover:text-purple-700 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add chapter
                </button>
              )}
              {/* Add chapter form */}
              {canEditChapters && addingChapter && (
                <div className="mt-2 bg-white border border-purple-200 rounded-lg p-2 space-y-1.5">
                  <input
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder="Chapter title"
                    autoFocus
                    className="w-full px-2 py-1 text-xs border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                  />
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={newChapterTimestamp}
                      onChange={(e) => setNewChapterTimestamp(e.target.value)}
                      placeholder="MM:SS"
                      className="flex-1 px-2 py-1 text-xs border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                    <button
                      onClick={() => setNewChapterTimestamp(getCurrentTimeFormatted())}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-purple-500 hover:text-purple-700 border border-purple-200 rounded transition-colors"
                      title="Use current player time"
                    >
                      <Clock className="h-3 w-3" />
                      Now
                    </button>
                  </div>
                  {chapterError && <p className="text-xs text-red-500">{chapterError}</p>}
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAddChapter}
                      disabled={chapterSaving}
                      className="flex-1 px-2 py-1 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      {chapterSaving ? 'Adding...' : 'Add chapter'}
                    </button>
                    <button
                      onClick={() => { setAddingChapter(false); setChapterError('') }}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add first chapter — shown for reference videos without existing chapters */}
          {(!siblingChapters || siblingChapters.length <= 1) && (mediaId || noteApiPath) && canEditChapters && (
            <div className="border-b border-purple-100 bg-purple-50/50 px-4 py-2.5 shrink-0">
              {!addingChapter ? (
                <button
                  onClick={() => { setAddingChapter(true); setChapterError('') }}
                  className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add first chapter
                </button>
              ) : (
                <div className="bg-white border border-purple-200 rounded-lg p-2 space-y-1.5">
                  <input
                    type="text"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder="Chapter title"
                    autoFocus
                    className="w-full px-2 py-1 text-xs border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                  />
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={newChapterTimestamp}
                      onChange={(e) => setNewChapterTimestamp(e.target.value)}
                      placeholder="MM:SS"
                      className="flex-1 px-2 py-1 text-xs border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                    <button
                      onClick={() => setNewChapterTimestamp(getCurrentTimeFormatted())}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-purple-500 hover:text-purple-700 border border-purple-200 rounded transition-colors"
                      title="Use current player time"
                    >
                      <Clock className="h-3 w-3" />
                      Now
                    </button>
                  </div>
                  {chapterError && <p className="text-xs text-red-500">{chapterError}</p>}
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAddChapter}
                      disabled={chapterSaving}
                      className="flex-1 px-2 py-1 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      {chapterSaving ? 'Adding...' : 'Add chapter'}
                    </button>
                    <button
                      onClick={() => { setAddingChapter(false); setChapterError('') }}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Captain notes section */}
          {(effectiveCaptain || hasNotes) && (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-700">
                  Captain&apos;s notes {notes.length > 0 && <span className="font-normal text-amber-500">({notes.length})</span>}
                </p>
                {effectiveCaptain && !addingNote && (
                  <button
                    onClick={() => setAddingNote(true)}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add note
                  </button>
                )}
              </div>

              {notes.length > 0 && (
                <div className="space-y-2">
                  {notes.map((n, i) => (
                    <div key={i} className="flex items-start gap-2 group">
                      {n.timestamp != null && (
                        <button
                          onClick={() => seekTo(n.timestamp!)}
                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white text-xs font-mono font-bold rounded-full hover:bg-amber-600 active:scale-95 transition-all mt-0.5"
                          title="Jump to this moment"
                        >
                          {formatTime(n.timestamp)}
                        </button>
                      )}
                      <p className="flex-1 text-xs text-amber-800 leading-relaxed">{n.text}</p>
                      {effectiveCaptain && (
                        <button
                          onClick={() => handleDeleteNote(i)}
                          disabled={savingNote}
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-amber-300 hover:text-red-400 disabled:opacity-30 transition-all mt-0.5"
                          title="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!hasNotes && !addingNote && (
                <p className="text-xs text-amber-400 italic">No notes yet.</p>
              )}

              {addingNote && (
                <div className="space-y-2 pt-1">
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    rows={2}
                    autoFocus
                    placeholder="Note text…"
                    className="w-full text-xs px-2.5 py-2 border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <input
                      type="text"
                      value={newNoteTimestampRaw}
                      onChange={(e) => setNewNoteTimestampRaw(e.target.value)}
                      placeholder="Timestamp (optional) — 1:23 or 83"
                      className={clsx(
                        'flex-1 px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400',
                        newTimestampInvalid ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-white'
                      )}
                    />
                  </div>
                  {newTimestampInvalid && <p className="text-xs text-red-500">Use M:SS, H:MM:SS, or seconds</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddNote}
                      disabled={savingNote || !newNoteText.trim() || newTimestampInvalid}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      {savingNote ? 'Saving…' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setAddingNote(false); setNewNoteText(''); setNewNoteTimestampRaw('') }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments section — collapsible */}
          {!commentsExpanded ? (
            <div className="border-b border-gray-100 shrink-0">
              <button
                onClick={() => setCommentsExpanded(true)}
                className="w-full pl-4 pr-12 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">
                    {loadingComments ? 'Loading comments…' : (
                      comments.length === 0
                        ? 'No comments yet'
                        : `${comments.length} comment${comments.length !== 1 ? 's' : ''}`
                    )}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
              <div className="px-4 pb-3">
                <button
                  onClick={expandAndFocusComposer}
                  className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-gray-500 transition-colors cursor-text"
                >
                  <div className={clsx('h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0', avatarColor(userName))}>
                    {initials(userName)}
                  </div>
                  Leave a comment...
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setCommentsExpanded(false)}
                className="w-full pl-4 pr-12 py-2.5 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors shrink-0"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Comments ({comments.length})
                  </span>
                </div>
                <ChevronUp className="h-4 w-4 text-gray-400" />
              </button>

              {/* Comment composer */}
              <div className="px-4 py-3 border-b border-gray-100 space-y-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <div className={clsx('h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0', avatarColor(userName))}>
                    {initials(userName)}
                  </div>
                  <span className="text-xs font-medium text-gray-600">{userName}</span>
                </div>

                <MentionTextarea
                  ref={composerRef}
                  value={commentText}
                  onChange={setCommentText}
                  onFocus={handleCommentFocus}
                  users={users}
                  rows={2}
                  placeholder="Leave a comment... (Cmd+Enter to post)"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment() }}
                />

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <Clock className="h-3 w-3 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={timestampRaw}
                      onChange={(e) => setTimestampRaw(e.target.value)}
                      placeholder="Timestamp — e.g. 1:23"
                      className={clsx(
                        'w-28 px-2 py-1 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500',
                        timestampInvalid ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      )}
                    />
                    {timestampInvalid && <span className="text-xs text-red-500">Invalid</span>}
                    {!timestampInvalid && parsedTimestamp !== null && (
                      <span className="text-xs text-blue-600">at {formatTime(parsedTimestamp)}</span>
                    )}
                    {timestampRaw && (
                      <button
                        onClick={() => setTimestampRaw('')}
                        className="text-gray-300 hover:text-gray-500 transition-colors"
                        title="Clear timestamp"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={postComment}
                    disabled={posting || !commentText.trim() || timestampInvalid}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-3 w-3" />
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={sendToCaptain}
                    onChange={(e) => setSendToCaptain(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 h-3 w-3"
                  />
                  <Shield className="h-3 w-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs text-gray-500">Submit to captain for review</span>
                </label>
              </div>

              {/* Comment thread */}
              <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {loadingComments && <p className="text-xs text-gray-400">Loading...</p>}
                {!loadingComments && sorted.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No comments yet. Be the first!</p>
                )}
                {sorted.map((c) => {
                  const replyCount = c.reply_count ?? 0
                  const isRepliesOpen = expandedReplies.has(c.id)
                  const replies = repliesByComment.get(c.id) ?? []
                  const isLoadingRep = loadingReplies.has(c.id)

                  const isEditing = editingCommentId === c.id
                  const isConfirmingDelete = confirmDeleteId === c.id
                  const canEdit = canEditComment(c)

                  return (
                    <div key={c.id} className="border-b border-gray-100 py-3">
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <div className={clsx('h-4 w-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0', avatarColor(c.author_name))}>
                              {initials(c.author_name)}
                            </div>
                            <span className="text-xs font-semibold text-gray-800">{c.author_name}</span>
                            {c.timestamp_seconds != null && (
                              <button
                                onClick={() => seekTo(c.timestamp_seconds!)}
                                title="Jump to this moment"
                                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-mono font-bold rounded-full hover:bg-blue-200 active:scale-95 transition-all cursor-pointer"
                              >
                                {formatTime(c.timestamp_seconds)}
                              </button>
                            )}
                            <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                            {c.is_edited && (
                              <span className="text-gray-400 text-xs italic">edited</span>
                            )}
                            {c.send_to_captain && (
                              <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded-full font-medium">
                                <Shield className="h-2 w-2" />
                                Review
                              </span>
                            )}
                          </div>

                          {/* Edit inline textarea or comment text */}
                          {isEditing ? (
                            <div className="space-y-1.5 mt-1">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={2}
                                autoFocus
                                className="w-full px-2 py-1 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => saveEdit(c.id)}
                                  disabled={savingEdit || !editText.trim()}
                                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-[10px] font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                  <Check className="h-2.5 w-2.5" />
                                  Save
                                </button>
                                <button
                                  onClick={() => { setEditingCommentId(null); setEditText('') }}
                                  className="px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-700 leading-relaxed">
                              {parseMentions(c.comment_text).map((seg, i) =>
                                seg.type === 'mention' ? (
                                  <strong key={i} className="text-blue-600 font-semibold">{seg.value}</strong>
                                ) : (
                                  <span key={i}>{seg.value}</span>
                                )
                              )}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={() => startReply(c.id)}
                              className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Reply className="h-3 w-3" />
                              Reply
                            </button>
                            {replyCount > 0 && (
                              <button
                                onClick={() => toggleReplies(c.id)}
                                className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
                              >
                                {isRepliesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                              </button>
                            )}
                            {/* Edit / Delete — own comments only */}
                            {canEdit && !isEditing && (
                              <>
                                <button
                                  onClick={() => startEdit(c)}
                                  title="Edit comment"
                                  className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-blue-600 transition-colors"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                {isConfirmingDelete ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => deleteComment(c.id)}
                                      disabled={deletingCommentId === c.id}
                                      className="text-[10px] text-red-600 font-medium hover:text-red-800 transition-colors"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteId(c.id)}
                                    title="Delete comment"
                                    className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {isRepliesOpen && (
                        <div className="ml-6 pl-3 border-l-2 border-gray-200 mt-1 space-y-2">
                          {isLoadingRep && <p className="text-[10px] text-gray-400">Loading...</p>}
                          {replies.map((r) => (
                            <div key={r.id} className="flex gap-1.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 flex-wrap mb-0.5">
                                  <div className={clsx('h-3.5 w-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0', avatarColor(r.author_name))}>
                                    {initials(r.author_name)}
                                  </div>
                                  <span className="text-[11px] font-semibold text-gray-700">{r.author_name}</span>
                                  <span className="text-[10px] text-gray-400">{timeAgo(r.created_at)}</span>
                                </div>
                                <p className="text-[11px] text-gray-600 leading-relaxed">{r.comment_text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {replyingTo === c.id && (
                        <div className="ml-6 pl-3 border-l-2 border-blue-200 mt-2 space-y-1.5">
                          <MentionTextarea
                            ref={replyInputRef}
                            value={replyText}
                            onChange={setReplyText}
                            users={users}
                            rows={2}
                            placeholder="Write a reply..."
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postReply(c.id) }}
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => postReply(c.id)}
                              disabled={postingReply || !replyText.trim()}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-[10px] font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              <Send className="h-2.5 w-2.5" />
                              {postingReply ? 'Posting...' : 'Reply'}
                            </button>
                            <button
                              onClick={() => { setReplyingTo(null); setReplyText('') }}
                              className="px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
