'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ExternalLink, Heart, Send, Shield, Pencil, Check, Clock } from 'lucide-react'
import { embedUrl, type SessionVideo } from '@/lib/types'
import type { Comment } from '@/lib/supabase'
import clsx from 'clsx'

interface VideoWatchViewProps {
  video: SessionVideo
  sessionId: string          // session the video belongs to
  activeSessionId?: string   // current active session — captain submissions go here
  userName: string
  isCaptain?: boolean
  isFavorited?: boolean
  onFavoriteToggle?: () => void
  onClose: () => void
  onNoteUpdated?: (videoId: string, note: string, noteTimestamp?: number) => void
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function parseTimestamp(raw: string): number | null {
  const hms = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  if (hms) return +hms[1] * 3600 + +hms[2] * 60 + +hms[3]
  const ms = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (ms && +ms[2] < 60) return +ms[1] * 60 + +ms[2]
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
  isFavorited = false, onFavoriteToggle, onClose, onNoteUpdated,
}: VideoWatchViewProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [iframeSrc, setIframeSrc] = useState(embedUrl(video.id))

  // Comment composer
  const [commentText, setCommentText] = useState('')
  const [timestampRaw, setTimestampRaw] = useState('')
  const [sendToCaptain, setSendToCaptain] = useState(false)
  const [posting, setPosting] = useState(false)

  // Captain note
  const [editingNote, setEditingNote] = useState(false)
  const [noteText, setNoteText] = useState(video.note ?? '')
  const [noteTimestampRaw, setNoteTimestampRaw] = useState(
    video.noteTimestamp != null ? formatTime(video.noteTimestamp) : ''
  )
  const [savingNote, setSavingNote] = useState(false)

  const backdropRef = useRef<HTMLDivElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    setLoadingComments(true)
    fetch(`/api/comments?videoId=${video.id}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setComments(data) })
      .finally(() => setLoadingComments(false))
  }, [video.id])

  const parsedTimestamp = parseTimestamp(timestampRaw)
  const timestampInvalid = timestampRaw.trim() !== '' && parsedTimestamp === null

  const parsedNoteTimestamp = parseTimestamp(noteTimestampRaw)
  const noteTimestampInvalid = noteTimestampRaw.trim() !== '' && parsedNoteTimestamp === null

  async function postComment() {
    if (!commentText.trim() || timestampInvalid) return
    // If sending to captain, use the active session so it appears in the current review queue
    const targetSessionId = sendToCaptain && activeSessionId ? activeSessionId : sessionId
    setPosting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: targetSessionId,
          video_id: video.id,
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

  async function saveNote() {
    if (noteTimestampInvalid) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/video-note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          note: noteText,
          noteTimestamp: parsedNoteTimestamp ?? undefined,
        }),
      })
      if (res.ok) {
        onNoteUpdated?.(video.id, noteText, parsedNoteTimestamp ?? undefined)
        setEditingNote(false)
      }
    } finally {
      setSavingNote(false)
    }
  }

  const sorted = [...comments].sort((a, b) => {
    if (a.timestamp_seconds != null && b.timestamp_seconds != null) return a.timestamp_seconds - b.timestamp_seconds
    if (a.timestamp_seconds != null) return -1
    if (b.timestamp_seconds != null) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-4 overflow-hidden"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="relative w-full h-full md:h-auto md:max-h-[94vh] max-w-7xl bg-white md:rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">

        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── Left: Video ── */}
        <div className="w-full md:w-[60%] bg-black flex flex-col shrink-0">
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
              <a
                href={`https://drive.google.com/file/d/${video.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />Open in Drive
              </a>
            </div>
            {onFavoriteToggle && (
              <button onClick={onFavoriteToggle} title={isFavorited ? 'Unfavorite' : 'Favorite'}>
                <Heart className={clsx('h-5 w-5 transition-colors', isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-500 hover:text-red-400')} />
              </button>
            )}
          </div>
        </div>

        {/* ── Right: Note + Composer + Thread ── */}
        <div className="flex-1 flex flex-col min-h-0 md:max-h-[94vh]">

          {/* Captain note — editable by captain */}
          {isCaptain && (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-amber-700">📝 Captain&apos;s note</p>
                {!editingNote && (
                  <button
                    onClick={() => setEditingNote(true)}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    {noteText ? 'Edit' : 'Add note'}
                  </button>
                )}
              </div>

              {editingNote ? (
                <div className="space-y-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder="Add a note visible to all teammates…"
                    className="w-full text-xs px-2.5 py-2 border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                  {/* Note timestamp */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <input
                        type="text"
                        value={noteTimestampRaw}
                        onChange={(e) => setNoteTimestampRaw(e.target.value)}
                        placeholder="Timestamp (optional) — e.g. 1:23"
                        className={clsx(
                          'flex-1 px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400',
                          noteTimestampInvalid ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-white'
                        )}
                      />
                    </div>
                    {noteTimestampInvalid && <p className="text-xs text-red-500 pl-5">Use M:SS or H:MM:SS format</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveNote}
                      disabled={savingNote || noteTimestampInvalid}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      {savingNote ? 'Saving…' : 'Save note'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingNote(false)
                        setNoteText(video.note ?? '')
                        setNoteTimestampRaw(video.noteTimestamp != null ? formatTime(video.noteTimestamp) : '')
                      }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {video.noteTimestamp != null && (
                    <button
                      onClick={() => setIframeSrc(`${embedUrl(video.id)}#t=${video.noteTimestamp}`)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white text-xs font-mono font-bold rounded-full hover:bg-amber-600 active:scale-95 transition-all"
                      title="Jump to this moment"
                    >
                      ▶ {formatTime(video.noteTimestamp)}
                    </button>
                  )}
                  <p className={clsx('text-xs leading-relaxed', noteText ? 'text-amber-800' : 'text-amber-400 italic')}>
                    {noteText || 'No note yet.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Captain note — read-only for teammates */}
          {!isCaptain && video.note && (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-2.5 shrink-0">
              <p className="text-xs font-semibold text-amber-700 mb-1">📝 Captain&apos;s note</p>
              {video.noteTimestamp != null && (
                <button
                  onClick={() => setIframeSrc(`${embedUrl(video.id)}#t=${video.noteTimestamp}`)}
                  className="flex items-center gap-1 px-2 py-0.5 mb-1 bg-amber-500 text-white text-xs font-mono font-bold rounded-full hover:bg-amber-600 active:scale-95 transition-all"
                  title="Jump to this moment"
                >
                  ▶ {formatTime(video.noteTimestamp)}
                </button>
              )}
              <p className="text-xs text-amber-800 leading-relaxed">{video.note}</p>
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

            {/* Optional timestamp */}
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

            {/* Send to captain */}
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
                        onClick={() => setIframeSrc(`${embedUrl(video.id)}#t=${c.timestamp_seconds}`)}
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
