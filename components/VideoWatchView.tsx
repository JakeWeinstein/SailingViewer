'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ExternalLink, Heart, Send, Shield, Plus, Trash2, Check, Clock } from 'lucide-react'
import { embedUrl, youtubeEmbedUrl, type SessionVideo, type VideoNote } from '@/lib/types'
import type { Comment } from '@/lib/supabase'
import clsx from 'clsx'

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
  // Legacy callback (kept for callers that haven't migrated)
  onNoteUpdated?: (videoId: string, note: string, noteTimestamp?: number) => void
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function parseTimestamp(raw: string): number | null {
  const hms = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  if (hms) return +hms[1] * 3600 + +hms[2] * 60 + +hms[3]
  const ms = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (ms && +ms[2] < 60) return +ms[1] * 60 + +ms[2]
  const secs = raw.match(/^(\d+)s?$/)
  if (secs) return +secs[1]
  return null
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-rose-500',
]

function avatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function VideoWatchView({
  video, sessionId, activeSessionId, userName, isCaptain = false,
  isFavorited = false, onFavoriteToggle, onClose, onNotesUpdated, onNoteUpdated,
  mediaId, videoType = 'drive', noteApiPath,
}: VideoWatchViewProps) {
  const effectiveMediaId = mediaId ?? video.id

  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [iframeSrc, setIframeSrc] = useState(() =>
    videoType === 'youtube'
      ? youtubeEmbedUrl(effectiveMediaId)
      : embedUrl(effectiveMediaId)
  )

  // Resolve notes — support both new array format and legacy single note
  function resolveNotes(v: SessionVideo): VideoNote[] {
    if (v.notes && v.notes.length > 0) return v.notes
    if (v.note) return [{ text: v.note, timestamp: v.noteTimestamp }]
    return []
  }

  const [notes, setNotes] = useState<VideoNote[]>(() => resolveNotes(video))
  const [addingNote, setAddingNote] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteTimestampRaw, setNewNoteTimestampRaw] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const parsedNewTimestamp = parseTimestamp(newNoteTimestampRaw)
  const newTimestampInvalid = newNoteTimestampRaw.trim() !== '' && parsedNewTimestamp === null

  function seekTo(seconds: number) {
    if (videoType === 'youtube') {
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

  const backdropRef = useRef<HTMLDivElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)

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
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              className="w-full h-full"
              allow="autoplay"
              allowFullScreen
              title={video.name}
            />
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

          {/* Comment composer */}
          <div className="p-4 border-b border-gray-100 space-y-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className={clsx('h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor(userName))}>
                {initials(userName)}
              </div>
              <span className="text-xs font-medium text-gray-600">{userName}</span>
            </div>

            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment() }}
              rows={3}
              placeholder="Leave a comment… (⌘+Enter to post)"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={timestampRaw}
                  onChange={(e) => setTimestampRaw(e.target.value)}
                  placeholder="Timestamp (optional) — e.g. 1:23"
                  className={clsx(
                    'flex-1 px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500',
                    timestampInvalid ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  )}
                />
              </div>
              {timestampInvalid && <p className="text-xs text-red-500 pl-5">Use M:SS or H:MM:SS format</p>}
              {!timestampInvalid && parsedTimestamp !== null && (
                <p className="text-xs text-blue-600 pl-5">Will post at {formatTime(parsedTimestamp)}</p>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={sendToCaptain}
                onChange={(e) => setSendToCaptain(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <Shield className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-xs text-gray-600">Submit to captain for review session</span>
            </label>

            <button
              onClick={postComment}
              disabled={posting || !commentText.trim() || timestampInvalid}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              {posting ? 'Posting…' : 'Post comment'}
            </button>
          </div>

          {/* Comment thread */}
          <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </p>
            {loadingComments && <p className="text-sm text-gray-400">Loading…</p>}
            {!loadingComments && sorted.length === 0 && (
              <p className="text-sm text-gray-400 italic">No comments yet. Be the first!</p>
            )}
            {sorted.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <div className={clsx('h-5 w-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor(c.author_name))}>
                      {initials(c.author_name)}
                    </div>
                    <span className="text-xs font-semibold text-gray-800">{c.author_name}</span>
                    {c.timestamp_seconds != null && (
                      <button
                        onClick={() => seekTo(c.timestamp_seconds!)}
                        title="Jump to this moment"
                        className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-xs font-mono font-bold rounded-full hover:bg-blue-700 active:scale-95 transition-all"
                      >
                        ▶ {formatTime(c.timestamp_seconds)}
                      </button>
                    )}
                    <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                    {c.send_to_captain && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium">
                        <Shield className="h-2.5 w-2.5" />
                        For review
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{c.comment_text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
