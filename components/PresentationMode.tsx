'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  X, BookOpen, Archive, CheckCircle2, RotateCcw, Send, Presentation,
  ChevronDown, Clock,
} from 'lucide-react'
import type { Comment } from '@/lib/types'
import { youtubeEmbedUrl } from '@/lib/types'
import { timeAgo, initials, avatarColor } from '@/lib/comment-utils'
import PresentationQueue from '@/components/PresentationQueue'
import ReferenceSidePanel from '@/components/ReferenceSidePanel'
import clsx from 'clsx'

interface BriefSession {
  id: string
  label: string
  is_active: boolean
  created_at: string
}

interface PresentationModeProps {
  sessions: BriefSession[]
  userName: string
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function PresentationMode({ sessions, userName }: PresentationModeProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Session selection
  const initialSessionId = searchParams.get('session') ??
    sessions.find((s) => s.is_active)?.id ??
    sessions[0]?.id ??
    null
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId)

  // Items state
  const [items, setItems] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)

  // UI state
  const [activeItemId, setActiveItemId] = useState<string | null>(
    searchParams.get('item')
  )
  const [showArchived, setShowArchived] = useState(false)
  const [referencePanelOpen, setReferencePanelOpen] = useState(false)

  // Reply state
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replySuccess, setReplySuccess] = useState(false)

  // Fetch items when session changes
  const fetchItems = useCallback(async (sessionId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/comments?sessionId=${sessionId}&captainOnly=true`)
      if (res.ok) {
        const data: Comment[] = await res.json()
        setItems(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSessionId) {
      fetchItems(selectedSessionId)
    }
  }, [selectedSessionId, fetchItems])

  // Separate active vs archived
  const activeItems = useMemo(
    () => items.filter((i) => !i.is_reviewed).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [items]
  )
  const archivedItems = useMemo(
    () => items.filter((i) => i.is_reviewed),
    [items]
  )

  const displayedItems = showArchived ? archivedItems : activeItems

  // Group by author alphabetically
  const groups = useMemo(() => {
    const map = new Map<string, Comment[]>()
    for (const item of displayedItems) {
      const author = item.author_name
      if (!map.has(author)) map.set(author, [])
      map.get(author)!.push(item)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([author, groupItems]) => ({ author, items: groupItems }))
  }, [displayedItems])

  // Flat order for keyboard navigation
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups])

  const activeItem = useMemo(
    () => (activeItemId ? items.find((i) => i.id === activeItemId) ?? null : null),
    [activeItemId, items]
  )

  // URL sync: update ?item= param on selection
  function selectItem(id: string) {
    setActiveItemId(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('item', id)
    router.replace(`?${params.toString()}`)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' ||
        (e.target as HTMLElement).isContentEditable
      if (isEditable) return

      if (e.key === 'Escape') {
        router.push('/dashboard')
        return
      }

      if (!activeItemId) return

      const idx = flatItems.findIndex((i) => i.id === activeItemId)
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        if (idx < flatItems.length - 1) selectItem(flatItems[idx + 1].id)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        if (idx > 0) selectItem(flatItems[idx - 1].id)
      } else if (e.key === 'r' || e.key === 'R') {
        if (activeItem && !showArchived) handleMarkReviewed(activeItem.id)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItemId, flatItems, activeItem, showArchived])

  // Mark as reviewed
  async function handleMarkReviewed(id: string) {
    // Optimistic: remove from active list
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_reviewed: true } : i))

    // Select next item
    const idx = flatItems.findIndex((i) => i.id === id)
    if (idx < flatItems.length - 1) {
      selectItem(flatItems[idx + 1].id)
    } else if (idx > 0) {
      selectItem(flatItems[idx - 1].id)
    } else {
      setActiveItemId(null)
    }

    await fetch(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_reviewed: true }),
    }).catch(() => {
      // Revert on failure
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_reviewed: false } : i))
    })
  }

  // Restore from archived
  async function handleRestore(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_reviewed: false } : i))
    await fetch(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_reviewed: false }),
    }).catch(() => {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_reviewed: true } : i))
    })
  }

  // Reorder (drag-and-drop)
  async function handleReorder(reordered: Comment[]) {
    if (!selectedSessionId) return
    // Optimistic: apply new order to active items in local state
    const reorderedIds = new Set(reordered.map((i) => i.id))
    const archivedInState = items.filter((i) => !reorderedIds.has(i.id))
    setItems([...archivedInState, ...reordered])

    const order = reordered.map((item, idx) => ({ id: item.id, sort_order: idx }))
    await fetch('/api/comments/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: selectedSessionId, order }),
    })
  }

  // Send reply
  async function handleReply() {
    if (!activeItem || !replyText.trim() || !selectedSessionId) return
    setReplySending(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeItem.session_id,
          video_id: activeItem.video_id,
          video_title: activeItem.video_title,
          comment_text: replyText.trim(),
          author_name: userName,
          parent_id: activeItem.id,
          send_to_captain: false,
        }),
      })
      if (res.ok) {
        setReplyText('')
        setReplySuccess(true)
        setTimeout(() => setReplySuccess(false), 2000)
      }
    } finally {
      setReplySending(false)
    }
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId)

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">

      {/* ── Left pane: Queue sidebar ── */}
      <aside className="w-[350px] shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">

        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <Presentation className="h-5 w-5 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white flex-1">Review Queue</span>
          <button
            onClick={() => router.push('/dashboard')}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Exit (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Session picker */}
        <div className="px-3 py-2 border-b border-gray-800">
          <div className="relative">
            <select
              value={selectedSessionId ?? ''}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full appearance-none bg-gray-800 text-sm text-gray-200 px-3 py-2 pr-8 rounded-lg border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}{s.is_active ? ' (active)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Active / Archived toggle */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-800">
          <button
            onClick={() => setShowArchived(false)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors',
              !showArchived
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800'
            )}
          >
            Active
            {activeItems.length > 0 && (
              <span className={clsx(
                'text-xs font-bold px-1.5 py-0.5 rounded-full leading-none',
                !showArchived ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
              )}>
                {activeItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors',
              showArchived
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:bg-gray-800'
            )}
          >
            <Archive className="h-3.5 w-3.5" />
            Archived
            {archivedItems.length > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full leading-none bg-gray-700 text-gray-300">
                {archivedItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Queue list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-500 text-sm py-10">Loading…</p>
          ) : (
            <PresentationQueue
              groups={groups}
              activeItemId={activeItemId}
              onSelectItem={selectItem}
              onReorder={handleReorder}
              showArchived={showArchived}
            />
          )}
        </div>

        {/* Keyboard shortcuts legend */}
        <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-500 space-y-0.5">
          <div className="flex justify-between"><span>Navigate</span><span className="font-mono">↑ ↓</span></div>
          <div className="flex justify-between"><span>Mark reviewed</span><span className="font-mono">R</span></div>
          <div className="flex justify-between"><span>Exit</span><span className="font-mono">Esc</span></div>
        </div>
      </aside>

      {/* ── Right pane: Detail ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Detail header toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900">
          <div className="flex-1 min-w-0">
            {selectedSession && (
              <p className="text-xs text-gray-500 truncate">{selectedSession.label}</p>
            )}
          </div>
          <button
            onClick={() => setReferencePanelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Reference
          </button>
        </div>

        {/* Item detail area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!activeItem ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <Presentation className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium text-gray-500">Select an item to review</p>
              <p className="text-sm mt-1 text-gray-600">Click an item in the queue or use arrow keys</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">

              {/* Author / metadata */}
              <div className="flex items-start gap-4">
                <div
                  className={clsx(
                    'h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0',
                    avatarColor(activeItem.author_name)
                  )}
                >
                  {initials(activeItem.author_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{activeItem.author_name}</span>
                    <span className="text-xs text-gray-500">{timeAgo(activeItem.created_at)}</span>
                    {activeItem.timestamp_seconds != null && (
                      <span className="flex items-center gap-1 text-xs font-mono bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">
                        <Clock className="h-3 w-3" />
                        {formatTime(activeItem.timestamp_seconds)}
                      </span>
                    )}
                    {!activeItem.video_id && (
                      <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded">
                        Q&A
                      </span>
                    )}
                    {activeItem.is_reviewed && (
                      <span className="flex items-center gap-1 text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded">
                        <CheckCircle2 className="h-3 w-3" />
                        Reviewed
                      </span>
                    )}
                  </div>
                  {activeItem.video_title && (
                    <p className="text-xs text-gray-500 mt-0.5">{activeItem.video_title}</p>
                  )}
                </div>
              </div>

              {/* Comment text */}
              <div className="bg-gray-800 rounded-xl p-5">
                <p className="text-gray-100 leading-relaxed whitespace-pre-wrap">
                  {activeItem.comment_text}
                </p>
              </div>

              {/* Video embed — video_id IS the YouTube video ID */}
              {activeItem.video_id && (
                <div className="rounded-xl overflow-hidden bg-black aspect-video">
                  <iframe
                    src={youtubeEmbedUrl(activeItem.video_id!, activeItem.timestamp_seconds ?? undefined)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={activeItem.video_title ?? 'Practice video'}
                  />
                </div>
              )}

              {/* Q&A youtube_attachment embed */}
              {!activeItem.video_id && activeItem.youtube_attachment && (
                <div className="rounded-xl overflow-hidden bg-black aspect-video">
                  <iframe
                    src={youtubeEmbedUrl(activeItem.youtube_attachment)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Q&A attachment"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                {!showArchived && !activeItem.is_reviewed && (
                  <button
                    onClick={() => handleMarkReviewed(activeItem.id)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as Reviewed (R)
                  </button>
                )}
                {showArchived && activeItem.is_reviewed && (
                  <button
                    onClick={() => handleRestore(activeItem.id)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-200 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore to Active
                  </button>
                )}
              </div>

              {/* Inline reply */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reply</p>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${activeItem.author_name}…`}
                  rows={3}
                  className="w-full bg-gray-900 text-gray-100 placeholder-gray-600 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleReply()
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  {replySuccess && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Reply sent
                    </span>
                  )}
                  {!replySuccess && <span />}
                  <button
                    onClick={handleReply}
                    disabled={replySending || !replyText.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {replySending ? 'Sending…' : 'Send (⌘↵)'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* Reference side panel */}
      <ReferenceSidePanel
        isOpen={referencePanelOpen}
        onClose={() => setReferencePanelOpen(false)}
      />
    </div>
  )
}
