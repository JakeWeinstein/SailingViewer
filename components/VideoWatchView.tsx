'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ExternalLink, Heart, Send, Shield, Plus, Trash2, Check, Clock, MessageSquare, ChevronDown, ChevronUp, Layers, Reply } from 'lucide-react'
import { embedUrl, youtubeEmbedUrl, parseTimestamp, formatTime, type SessionVideo, type VideoNote, type ReferenceVideo } from '@/lib/types'
import { timeAgo, initials, avatarColor } from '@/lib/comment-utils'
import type { Comment } from '@/lib/supabase'
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
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  destroy: () => void
  getPlayerState: () => number
}

interface VideoWatchViewProps {
  video: SessionVideo
  sessionId: string
  activeSessionId?: string
  userName: string
  isCaptain?: boolean
  isFavorited?: boolean
  onFavoriteToggle?: () => void
  onClose: () => void
  onNotesUpdated?: (videoId: string, notes: VideoNote[]) => void
  // Reference video / YouTube support
  mediaId?: string
  videoType?: 'drive' | 'youtube'
  noteApiPath?: string
  startSeconds?: number  // Chapter start time — seek on initial load
  // Chapter navigation
  siblingChapters?: ReferenceVideo[]  // all chapters sharing same parent, sorted by start_seconds
  onChapterChange?: (chapter: ReferenceVideo) => void  // switch watchTarget to a different chapter
  // Legacy callback (kept for callers that haven't migrated)
  onNoteUpdated?: (videoId: string, note: string, noteTimestamp?: number) => void
}

export default function VideoWatchView({
  video, sessionId, activeSessionId, userName, isCaptain = false,
  isFavorited = false, onFavoriteToggle, onClose, onNotesUpdated, onNoteUpdated,
  mediaId, videoType = 'drive', noteApiPath, startSeconds,
  siblingChapters, onChapterChange,
}: VideoWatchViewProps) {
  const effectiveMediaId = mediaId ?? video.id

  // Determine whether to use the YouTube Player API (YouTube + has chapters)
  const useYTPlayer = videoType === 'youtube' && !!siblingChapters && siblingChapters.length > 1

  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [iframeSrc, setIframeSrc] = useState(() => {
    if (useYTPlayer) return '' // Player API handles the embed
    if (videoType === 'youtube') {
      return startSeconds
        ? `https://www.youtube.com/embed/${effectiveMediaId}?start=${startSeconds}`
        : youtubeEmbedUrl(effectiveMediaId)
    }
    return startSeconds
      ? `${embedUrl(effectiveMediaId)}#t=${startSeconds}`
      : embedUrl(effectiveMediaId)
  })

  // ── YouTube Player API state ──
  const ytPlayerRef = useRef<YTPlayer | null>(null)
  const ytContainerIdRef = useRef(`yt-player-${effectiveMediaId}`)
  const [activeChapterId, setActiveChapterId] = useState(video.id)
  const activeChapterIdRef = useRef(video.id)
  const startSecondsRef = useRef(startSeconds)
  const onChapterChangeRef = useRef(onChapterChange)
  const siblingChaptersRef = useRef(siblingChapters)

  // Keep refs in sync
  useEffect(() => { onChapterChangeRef.current = onChapterChange }, [onChapterChange])
  useEffect(() => { siblingChaptersRef.current = siblingChapters }, [siblingChapters])

  // ── Load YouTube IFrame API script ──
  useEffect(() => {
    if (!useYTPlayer) return

    // If the API is already loaded, create the player immediately
    if (window.YT && window.YT.Player) {
      createPlayer()
      return
    }

    // Check if script tag already exists (from a previous mount)
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (existingScript) {
      // Script is loading but not yet ready — wait for the callback
      const prevCallback = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.()
        createPlayer()
      }
      return
    }

    // Load the script
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    window.onYouTubeIframeAPIReady = () => {
      createPlayer()
    }
    document.head.appendChild(script)

    function createPlayer() {
      // Guard: container div must exist, player not already created
      if (ytPlayerRef.current) return
      const container = document.getElementById(ytContainerIdRef.current)
      if (!container) return

      ytPlayerRef.current = new window.YT.Player(ytContainerIdRef.current, {
        videoId: effectiveMediaId,
        playerVars: {
          autoplay: 0,
          start: startSecondsRef.current ?? 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            if (startSecondsRef.current != null && startSecondsRef.current > 0) {
              event.target.seekTo(startSecondsRef.current, true)
            }
          },
        },
      })
    }

    return () => {
      // Cleanup: destroy the player on unmount
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy() } catch { /* ignore */ }
        ytPlayerRef.current = null
      }
    }
    // Only re-run if we switch between YT player and non-YT player mode, or if the media changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useYTPlayer, effectiveMediaId])

  // ── Poll getCurrentTime for active chapter auto-tracking ──
  useEffect(() => {
    if (!useYTPlayer || !siblingChapters || siblingChapters.length <= 1) return

    const interval = setInterval(() => {
      const player = ytPlayerRef.current
      if (!player || typeof player.getCurrentTime !== 'function') return

      try {
        const currentTime = player.getCurrentTime()
        const chapters = siblingChaptersRef.current
        if (!chapters) return

        // Find the active chapter: the last chapter whose start_seconds <= currentTime
        let activeChapter = chapters[0]
        for (let i = chapters.length - 1; i >= 0; i--) {
          if ((chapters[i].start_seconds ?? 0) <= currentTime) {
            activeChapter = chapters[i]
            break
          }
        }

        if (activeChapter && activeChapter.id !== activeChapterIdRef.current) {
          activeChapterIdRef.current = activeChapter.id
          setActiveChapterId(activeChapter.id)
          onChapterChangeRef.current?.(activeChapter)
        }
      } catch {
        // Player may not be ready yet — ignore
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [useYTPlayer, siblingChapters])

  // ── Handle chapter click: seek instead of re-mount ──
  const handleChapterClick = useCallback((chapter: ReferenceVideo) => {
    if (useYTPlayer && ytPlayerRef.current) {
      const seekTarget = chapter.start_seconds ?? 0
      ytPlayerRef.current.seekTo(seekTarget, true)
      activeChapterIdRef.current = chapter.id
      setActiveChapterId(chapter.id)
      onChapterChangeRef.current?.(chapter)
    } else {
      // Fallback for non-YT: use the original onChapterChange to swap the view
      onChapterChange?.(chapter)
    }
  }, [useYTPlayer, onChapterChange])

  // Resolve notes — support both new array format and legacy single note
  function resolveNotes(v: SessionVideo): VideoNote[] {
    if (v.notes && v.notes.length > 0) return v.notes
    if (v.note) return [{ text: v.note, timestamp: v.noteTimestamp }]
    return []
  }

  const [notes, setNotes] = useState<VideoNote[]>(() => resolveNotes(video))

  // Sync notes when the parent updates video props (e.g., chapter switch without re-mount)
  useEffect(() => {
    setNotes(resolveNotes(video))
  }, [video.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [addingNote, setAddingNote] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteTimestampRaw, setNewNoteTimestampRaw] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const parsedNewTimestamp = parseTimestamp(newNoteTimestampRaw)
  const newTimestampInvalid = newNoteTimestampRaw.trim() !== '' && parsedNewTimestamp === null

  function seekTo(seconds: number) {
    if (useYTPlayer && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(seconds, true)
    } else if (videoType === 'youtube') {
      setIframeSrc(`https://www.youtube.com/embed/${effectiveMediaId}?start=${seconds}&autoplay=1`)
    } else {
      setIframeSrc(`${embedUrl(effectiveMediaId)}#t=${seconds}`)
    }
  }

  // Comment composer
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
    fetch(`/api/comments?videoId=${effectiveMediaId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setComments(data) })
      .finally(() => setLoadingComments(false))
  }, [video.id, effectiveMediaId])

  const parsedTimestamp = parseTimestamp(timestampRaw)
  const timestampInvalid = timestampRaw.trim() !== '' && parsedTimestamp === null

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
        // Legacy callback compat
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
          video_id: effectiveMediaId,
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
          video_id: effectiveMediaId,
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
      }
    } finally {
      setPosting(false)
    }
  }

  function expandAndFocusComposer() {
    setCommentsExpanded(true)
    setTimeout(() => composerRef.current?.focus(), 50)
  }

  const sorted = [...comments].sort((a, b) => {
    if (a.timestamp_seconds != null && b.timestamp_seconds != null) return a.timestamp_seconds - b.timestamp_seconds
    if (a.timestamp_seconds != null) return -1
    if (b.timestamp_seconds != null) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const hasNotes = notes.length > 0

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-4 overflow-hidden"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="relative w-full h-full md:h-auto max-w-7xl bg-white md:rounded-2xl shadow-2xl flex flex-col md:block overflow-hidden">

        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── Left: Video ── */}
        <div className="w-full md:w-[65%] bg-black flex flex-col">
          <div className="aspect-video w-full">
            {useYTPlayer ? (
              <div id={ytContainerIdRef.current} className="w-full h-full" />
            ) : (
              <iframe
                key={iframeSrc}
                src={iframeSrc}
                className="w-full h-full"
                allow="autoplay"
                allowFullScreen
                title={video.name}
              />
            )}
          </div>
          <div className="bg-gray-900 px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{video.name}</p>
              {videoType === 'drive' && (
                <a
                  href={`https://drive.google.com/file/d/${effectiveMediaId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />Open in Drive
                </a>
              )}
            </div>
            {onFavoriteToggle && (
              <button onClick={onFavoriteToggle} title={isFavorited ? 'Unfavorite' : 'Favorite'}>
                <Heart className={clsx('h-5 w-5 transition-colors', isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-500 hover:text-red-400')} />
              </button>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 md:absolute md:inset-y-0 md:right-0 md:w-[35%] flex flex-col overflow-hidden border-l border-gray-100">

          {/* Chapter navigation */}
          {siblingChapters && siblingChapters.length > 1 && onChapterChange && (
            <div className="border-b border-purple-100 bg-purple-50 px-4 py-2.5 shrink-0">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-xs font-semibold text-purple-700">
                  Chapters ({siblingChapters.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {siblingChapters.map((ch) => {
                  const isActive = useYTPlayer ? ch.id === activeChapterId : ch.id === video.id
                  return (
                    <button
                      key={ch.id}
                      onClick={() => { if (!isActive) handleChapterClick(ch) }}
                      className={clsx(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                        isActive
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-100 hover:border-purple-300'
                      )}
                    >
                      {ch.start_seconds != null && ch.start_seconds > 0 && (
                        <span className={clsx('font-mono text-[10px]', isActive ? 'text-purple-200' : 'text-purple-400')}>
                          {formatTime(ch.start_seconds)}
                        </span>
                      )}
                      <span className="max-w-[120px] truncate">{ch.title}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Captain notes section */}
          {(isCaptain || hasNotes) && (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-700">
                  📝 Captain&apos;s notes {notes.length > 0 && <span className="font-normal text-amber-500">({notes.length})</span>}
                </p>
                {isCaptain && !addingNote && (
                  <button
                    onClick={() => setAddingNote(true)}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add note
                  </button>
                )}
              </div>

              {/* Existing notes list */}
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
                          ▶ {formatTime(n.timestamp)}
                        </button>
                      )}
                      <p className="flex-1 text-xs text-amber-800 leading-relaxed">{n.text}</p>
                      {isCaptain && (
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

              {/* Add note form */}
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
            /* ── Collapsed: compact summary bar ── */
            <div className="border-b border-gray-100 shrink-0">
              <button
                onClick={() => setCommentsExpanded(true)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
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
            /* ── Expanded: full composer + thread ── */
            <>
              {/* Collapse toggle header */}
              <button
                onClick={() => setCommentsExpanded(false)}
                className="w-full px-4 py-2.5 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors shrink-0"
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

                <textarea
                  ref={composerRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment() }}
                  rows={2}
                  placeholder="Leave a comment... (Cmd+Enter to post)"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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

                  return (
                    <div key={c.id}>
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
                                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-mono font-bold rounded-full hover:bg-blue-700 active:scale-95 transition-all"
                              >
                                ▶ {formatTime(c.timestamp_seconds)}
                              </button>
                            )}
                            <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                            {c.send_to_captain && (
                              <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded-full font-medium">
                                <Shield className="h-2 w-2" />
                                Review
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-700 leading-relaxed">{c.comment_text}</p>

                          {/* Reply actions */}
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
                                className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                {isRepliesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Threaded replies */}
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

                      {/* Inline reply composer */}
                      {replyingTo === c.id && (
                        <div className="ml-6 pl-3 border-l-2 border-blue-200 mt-2 space-y-1.5">
                          <textarea
                            ref={replyInputRef}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postReply(c.id) }}
                            rows={2}
                            placeholder="Write a reply..."
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
