'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  X, BookOpen, Archive, CheckCircle2, RotateCcw, Send, Presentation,
  ChevronDown, ChevronRight, Clock, Film, ListChecks, Search, FolderOpen, Play,
  MessageSquare, FileText, HelpCircle,
} from 'lucide-react'
import type { Comment, SessionVideo, ReferenceVideo, ReferenceFolder } from '@/lib/types'
import { youtubeEmbedUrl, youtubeThumbnailUrl } from '@/lib/types'
import { timeAgo, initials, avatarColor } from '@/lib/comment-utils'
import PresentationQueue from '@/components/PresentationQueue'
import clsx from 'clsx'

interface SearchResult {
  id: string
  type: 'video' | 'comment' | 'article' | 'qa' | 'reference' | 'chapter'
  title: string
  snippet: string
  url_hint: string
  rank: number
  created_at: string
}

type SidebarMode = 'queue' | 'videos' | 'reference'

interface FullSession {
  id: string
  label: string
  is_active: boolean
  created_at: string
  videos: SessionVideo[]
}

interface BriefSession {
  id: string
  label: string
  is_active: boolean
  created_at: string
}

interface SelectedBrowseVideo {
  youtubeId: string
  title: string
  source: 'session' | 'reference'
  startSeconds?: number
  refVideoId?: string
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

  // Sidebar mode
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('queue')

  // Items state (review queue)
  const [items, setItems] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)

  // UI state
  const [activeItemId, setActiveItemId] = useState<string | null>(
    searchParams.get('item')
  )
  const [showArchived, setShowArchived] = useState(false)

  // Browse videos state
  const [fullSessions, setFullSessions] = useState<FullSession[]>([])
  const [fullSessionsFetched, setFullSessionsFetched] = useState(false)
  const [selectedBrowseVideo, setSelectedBrowseVideo] = useState<SelectedBrowseVideo | null>(null)

  // Reference state
  const [refVideos, setRefVideos] = useState<ReferenceVideo[]>([])
  const [refFolders, setRefFolders] = useState<ReferenceFolder[]>([])
  const [refFetched, setRefFetched] = useState(false)
  const [refLoading, setRefLoading] = useState(false)

  // Reply state (review queue)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replySuccess, setReplySuccess] = useState(false)

  // Browse comment state
  const [browseCommentText, setBrowseCommentText] = useState('')
  const [browseCommentSending, setBrowseCommentSending] = useState(false)
  const [browseCommentSuccess, setBrowseCommentSuccess] = useState(false)

  // Search state
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fetch review queue items when session changes
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

  // Fetch full sessions (with videos) on first switch to 'videos' mode
  useEffect(() => {
    if (sidebarMode !== 'videos' || fullSessionsFetched) return
    fetch('/api/sessions')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFullSessions(data)
        setFullSessionsFetched(true)
      })
  }, [sidebarMode, fullSessionsFetched])

  // Fetch reference data on first switch to 'reference' mode
  useEffect(() => {
    if (sidebarMode !== 'reference' || refFetched) return
    setRefLoading(true)
    Promise.all([
      fetch('/api/reference-videos').then((r) => r.json()),
      fetch('/api/reference-folders').then((r) => r.json()),
    ]).then(([vids, flds]) => {
      if (Array.isArray(vids)) setRefVideos(vids)
      if (Array.isArray(flds)) setRefFolders(flds)
      setRefFetched(true)
    }).finally(() => setRefLoading(false))
  }, [sidebarMode, refFetched])

  // Debounced search
  useEffect(() => {
    if (!showSearch || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=20`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setSearchResults(data)
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false))
    }, 300)
    return () => {
      clearTimeout(timer)
      setSearchLoading(false)
    }
  }, [searchQuery, showSearch])

  // Focus search input when search opens
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [showSearch])

  // Session videos for the selected session
  const sessionVideos = useMemo(() => {
    if (!selectedSessionId || !fullSessionsFetched) return []
    const session = fullSessions.find((s) => s.id === selectedSessionId)
    return session?.videos ?? []
  }, [selectedSessionId, fullSessions, fullSessionsFetched])

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

  // Switch sidebar mode with cleanup
  function switchSidebarMode(mode: SidebarMode) {
    if (mode === sidebarMode) return
    if (mode === 'queue') {
      setSelectedBrowseVideo(null)
      setBrowseCommentText('')
    } else {
      setActiveItemId(null)
      setReplyText('')
    }
    setSidebarMode(mode)
  }

  // Toggle search overlay
  function toggleSearch() {
    if (showSearch) {
      setShowSearch(false)
      setSearchQuery('')
      setSearchResults([])
    } else {
      setShowSearch(true)
    }
  }

  // Handle search result click
  function handleSearchResultClick(result: SearchResult) {
    switch (result.type) {
      case 'video': {
        // Ensure sessions are fetched then select
        if (!fullSessionsFetched) setFullSessionsFetched(false) // trigger fetch
        switchSidebarMode('videos')
        setSelectedBrowseVideo({ youtubeId: result.id, title: result.title, source: 'session' })
        break
      }
      case 'reference': {
        switchSidebarMode('reference')
        const refVideo = refVideos.find((v) => v.id === result.id)
        if (refVideo) {
          setSelectedBrowseVideo({
            youtubeId: refVideo.video_ref,
            title: refVideo.title,
            source: 'reference',
            startSeconds: refVideo.start_seconds ?? undefined,
            refVideoId: refVideo.id,
          })
        } else if (!refFetched) {
          setRefFetched(false)
        }
        break
      }
      case 'chapter': {
        switchSidebarMode('reference')
        // url_hint is the parent reference video ID; result.id is the chapter ID
        const parentRef = refVideos.find((v) => v.id === result.url_hint)
        const chapter = refVideos.find((v) => v.id === result.id)
        if (parentRef) {
          setSelectedBrowseVideo({
            youtubeId: parentRef.video_ref,
            title: parentRef.title,
            source: 'reference',
            startSeconds: chapter?.start_seconds ?? undefined,
            refVideoId: parentRef.id,
          })
        } else if (!refFetched) {
          setRefFetched(false)
        }
        break
      }
      case 'comment': {
        // Parse url_hint "session_id|video_id"
        const [, videoId] = (result.url_hint || '').split('|')
        // Parse timestamp from snippet prefix like "[1:30] comment text"
        const tsMatch = result.snippet.match(/^\[(\d+):(\d{2})\]/)
        const seconds = tsMatch ? parseInt(tsMatch[1], 10) * 60 + parseInt(tsMatch[2], 10) : undefined
        if (videoId) {
          switchSidebarMode('videos')
          setSelectedBrowseVideo({
            youtubeId: videoId,
            title: result.title,
            source: 'session',
            startSeconds: seconds,
          })
        }
        break
      }
      case 'article': {
        window.open('/learn/' + result.id, '_blank')
        break
      }
      case 'qa':
        // Q&A posts not viewable in presentation mode — no action
        break
    }
    // Clear search after selection
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  // Search result icon helper
  function searchResultIcon(type: SearchResult['type']) {
    switch (type) {
      case 'video': return <Film className="h-4 w-4 text-blue-400 shrink-0" />
      case 'reference': return <BookOpen className="h-4 w-4 text-teal-400 shrink-0" />
      case 'chapter': return <BookOpen className="h-4 w-4 text-teal-400 shrink-0" />
      case 'comment': return <MessageSquare className="h-4 w-4 text-green-400 shrink-0" />
      case 'article': return <FileText className="h-4 w-4 text-purple-400 shrink-0" />
      case 'qa': return <HelpCircle className="h-4 w-4 text-amber-400 shrink-0" />
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' ||
        (e.target as HTMLElement).isContentEditable

      // Escape: close search first, then exit presentation
      if (e.key === 'Escape') {
        if (showSearch) {
          e.preventDefault()
          setShowSearch(false)
          setSearchQuery('')
          setSearchResults([])
          return
        }
        if (!isEditable) {
          router.push('/dashboard')
        }
        return
      }

      if (isEditable) return

      // "/" opens search
      if (e.key === '/') {
        e.preventDefault()
        setShowSearch(true)
        return
      }

      if (sidebarMode !== 'queue') return
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
  }, [activeItemId, flatItems, activeItem, showArchived, sidebarMode, showSearch])

  // Mark as reviewed
  async function handleMarkReviewed(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_reviewed: true } : i))
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

  // Send reply (review queue)
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

  // Send comment on browsed video
  async function handleBrowseComment() {
    if (!selectedBrowseVideo || !browseCommentText.trim() || !selectedSessionId) return
    setBrowseCommentSending(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: selectedSessionId,
          video_id: selectedBrowseVideo.youtubeId,
          video_title: selectedBrowseVideo.title,
          comment_text: browseCommentText.trim(),
          author_name: userName,
          send_to_captain: true,
        }),
      })
      if (res.ok) {
        setBrowseCommentText('')
        setBrowseCommentSuccess(true)
        setTimeout(() => setBrowseCommentSuccess(false), 2000)
      }
    } finally {
      setBrowseCommentSending(false)
    }
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId)

  // Reference helpers
  const topRefFolders = useMemo(
    () => refFolders.filter((f) => !f.parent_id).sort((a, b) => a.sort_order - b.sort_order),
    [refFolders]
  )
  const getRefSubFolders = useCallback(
    (pid: string) => refFolders.filter((f) => f.parent_id === pid).sort((a, b) => a.sort_order - b.sort_order),
    [refFolders]
  )
  const filteredRefVideos = useMemo(() => {
    return refVideos.filter((v) => !v.parent_video_id)
  }, [refVideos])
  const getRefVideosInFolder = useCallback(
    (fid: string) => filteredRefVideos.filter((v) => v.folder_id === fid),
    [filteredRefVideos]
  )
  const unfolderedRefVideos = useMemo(
    () => filteredRefVideos.filter((v) => !v.folder_id),
    [filteredRefVideos]
  )
  const getChapters = useCallback(
    (sourceId: string) =>
      refVideos
        .filter((v) => v.parent_video_id === sourceId)
        .sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0)),
    [refVideos]
  )

  // Reference folder section component
  function RefFolderSection({ folder, depth = 0 }: { folder: ReferenceFolder; depth?: number }) {
    const [open, setOpen] = useState(false)
    const subFolders = getRefSubFolders(folder.id)
    const folderVideos = getRefVideosInFolder(folder.id)
    if (folderVideos.length === 0 && subFolders.length === 0) return null

    return (
      <div className={clsx(depth > 0 && 'ml-3 border-l border-gray-800 pl-2')}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <span className="truncate">{folder.name}</span>
          <span className="text-gray-600 ml-1">({folderVideos.length})</span>
        </button>
        {open && (
          <div className="space-y-0.5">
            {subFolders.map((sf) => (
              <RefFolderSection key={sf.id} folder={sf} depth={depth + 1} />
            ))}
            {folderVideos.map((v) => {
              const chapters = getChapters(v.id)
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedBrowseVideo({
                    youtubeId: v.video_ref,
                    title: v.title,
                    source: 'reference',
                    startSeconds: v.start_seconds ?? undefined,
                    refVideoId: v.id,
                  })}
                  className={clsx(
                    'w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                    selectedBrowseVideo?.youtubeId === v.video_ref && selectedBrowseVideo?.source === 'reference'
                      ? 'bg-blue-900/40 ring-1 ring-blue-400 text-blue-300'
                      : 'text-gray-300 hover:bg-gray-800'
                  )}
                >
                  <Play className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                  <span className="truncate flex-1">{v.title}</span>
                  {chapters.length > 0 && (
                    <span className="text-xs text-gray-500 shrink-0">{chapters.length}ch</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Determine what to show in main area
  const showingBrowseVideo = sidebarMode !== 'queue' && selectedBrowseVideo !== null
  const showingReviewItem = sidebarMode === 'queue' && activeItem !== null

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">

      {/* -- Left pane: Sidebar -- */}
      <aside className="w-[350px] shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">

        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <Presentation className="h-5 w-5 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white flex-1">Presentation</span>
          <button
            onClick={toggleSearch}
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              showSearch
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-800 text-gray-400 hover:text-white'
            )}
            title="Search (/)"
          >
            <Search className="h-4 w-4" />
          </button>
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

        {/* Sidebar mode tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-800">
          <button
            onClick={() => switchSidebarMode('queue')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors',
              sidebarMode === 'queue'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800'
            )}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Review
            {activeItems.length > 0 && (
              <span className={clsx(
                'text-xs font-bold px-1.5 py-0.5 rounded-full leading-none',
                sidebarMode === 'queue' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
              )}>
                {activeItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => switchSidebarMode('videos')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors',
              sidebarMode === 'videos'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800'
            )}
          >
            <Film className="h-3.5 w-3.5" />
            Videos
            {sessionVideos.length > 0 && (
              <span className={clsx(
                'text-xs font-bold px-1.5 py-0.5 rounded-full leading-none',
                sidebarMode === 'videos' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
              )}>
                {sessionVideos.length}
              </span>
            )}
          </button>
          <button
            onClick={() => switchSidebarMode('reference')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg transition-colors',
              sidebarMode === 'reference'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800'
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Reference
          </button>
        </div>

        {/* Active / Archived toggle (queue mode only) */}
        {sidebarMode === 'queue' && (
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
        )}

        {/* Search bar (when active) */}
        {showSearch && (
          <div className="px-3 py-2 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos, comments, articles..."
                className="w-full bg-gray-800 text-sm text-gray-200 placeholder-gray-500 pl-8 pr-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Sidebar content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Search results overlay */}
          {showSearch && (
            <div className="py-2">
              {searchLoading && (
                <p className="text-center text-gray-500 text-sm py-6">Searching...</p>
              )}
              {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-6">No results found</p>
              )}
              {!searchLoading && searchQuery.length < 2 && searchQuery.length > 0 && (
                <p className="text-center text-gray-500 text-sm py-6">Type at least 2 characters</p>
              )}
              {!searchLoading && searchResults.length > 0 && (
                <>
                  <p className="px-3 text-xs text-gray-500 mb-2">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-0.5">
                    {searchResults.map((result) => {
                      // Parse timestamp from comment snippet
                      const tsMatch = result.type === 'comment' ? result.snippet.match(/^\[([^\]]+)\]/) : null
                      const tsLabel = tsMatch ? tsMatch[1] : null
                      const snippetText = tsLabel
                        ? result.snippet.slice(tsMatch![0].length).trim()
                        : result.snippet

                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSearchResultClick(result)}
                          className="w-full text-left flex items-start gap-2.5 px-3 py-2 hover:bg-gray-800 rounded-lg transition-colors group"
                        >
                          <span className="mt-0.5">{searchResultIcon(result.type)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm text-gray-200 group-hover:text-white truncate">
                                {result.title}
                              </span>
                              {tsLabel && (
                                <span className="text-xs font-mono bg-gray-800 text-blue-300 px-1.5 py-0.5 rounded shrink-0">
                                  {tsLabel}
                                </span>
                              )}
                              {result.type === 'chapter' && (
                                <span className="text-xs bg-teal-900/50 text-teal-300 px-1.5 py-0.5 rounded shrink-0">
                                  Chapter
                                </span>
                              )}
                              {result.type === 'qa' && (
                                <span className="text-xs bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded shrink-0">
                                  Q&A
                                </span>
                              )}
                            </div>
                            {snippetText && (
                              <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{snippetText}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Queue mode */}
          {!showSearch && sidebarMode === 'queue' && (
            loading ? (
              <p className="text-center text-gray-500 text-sm py-10">Loading...</p>
            ) : (
              <PresentationQueue
                groups={groups}
                activeItemId={activeItemId}
                onSelectItem={selectItem}
                onReorder={handleReorder}
                showArchived={showArchived}
              />
            )
          )}

          {/* Videos mode */}
          {!showSearch && sidebarMode === 'videos' && (
            !fullSessionsFetched ? (
              <p className="text-center text-gray-500 text-sm py-10">Loading...</p>
            ) : sessionVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                <Film className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No videos in this session</p>
              </div>
            ) : (
              <div className="py-1 space-y-0.5">
                {sessionVideos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedBrowseVideo({
                      youtubeId: v.id,
                      title: v.name,
                      source: 'session',
                    })}
                    className={clsx(
                      'w-full text-left flex items-center gap-3 px-3 py-2 transition-colors',
                      selectedBrowseVideo?.youtubeId === v.id && selectedBrowseVideo?.source === 'session'
                        ? 'bg-blue-900/40 ring-1 ring-blue-400'
                        : 'hover:bg-gray-800'
                    )}
                  >
                    <img
                      src={youtubeThumbnailUrl(v.id)}
                      alt=""
                      className="w-20 h-[45px] rounded object-cover shrink-0 bg-gray-800"
                    />
                    <span className="text-sm text-gray-200 truncate flex-1">{v.name}</span>
                  </button>
                ))}
              </div>
            )
          )}

          {/* Reference mode */}
          {!showSearch && sidebarMode === 'reference' && (
            refLoading ? (
              <p className="text-center text-gray-500 text-sm py-10">Loading...</p>
            ) : filteredRefVideos.length === 0 && topRefFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                <BookOpen className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No reference videos</p>
              </div>
            ) : (
              <div className="py-1 space-y-1">
                {topRefFolders.map((folder) => (
                  <RefFolderSection key={folder.id} folder={folder} />
                ))}
                {unfolderedRefVideos.length > 0 && (
                  <div>
                    {topRefFolders.length > 0 && (
                      <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unfoldered</p>
                    )}
                    <div className="space-y-0.5">
                      {unfolderedRefVideos.map((v) => {
                        const chapters = getChapters(v.id)
                        return (
                        <button
                          key={v.id}
                          onClick={() => setSelectedBrowseVideo({
                            youtubeId: v.video_ref,
                            title: v.title,
                            source: 'reference',
                            startSeconds: v.start_seconds ?? undefined,
                            refVideoId: v.id,
                          })}
                          className={clsx(
                            'w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                            selectedBrowseVideo?.youtubeId === v.video_ref && selectedBrowseVideo?.source === 'reference'
                              ? 'bg-blue-900/40 ring-1 ring-blue-400 text-blue-300'
                              : 'text-gray-300 hover:bg-gray-800'
                          )}
                        >
                          <Play className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                          <span className="truncate flex-1">{v.title}</span>
                          {chapters.length > 0 && (
                            <span className="text-xs text-gray-500 shrink-0">{chapters.length}ch</span>
                          )}
                        </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Keyboard shortcuts legend */}
        <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-500 space-y-0.5">
          <div className="flex justify-between"><span>Search</span><span className="font-mono">/</span></div>
          {sidebarMode === 'queue' && (
            <>
              <div className="flex justify-between"><span>Navigate</span><span className="font-mono">{'\u2191'} {'\u2193'}</span></div>
              <div className="flex justify-between"><span>Mark reviewed</span><span className="font-mono">R</span></div>
            </>
          )}
          <div className="flex justify-between"><span>Exit</span><span className="font-mono">Esc</span></div>
        </div>
      </aside>

      {/* -- Right pane: Detail -- */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Detail header toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900">
          <div className="flex-1 min-w-0">
            {selectedSession && (
              <p className="text-xs text-gray-500 truncate">{selectedSession.label}</p>
            )}
          </div>
          <button
            onClick={() => switchSidebarMode('reference')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              sidebarMode === 'reference'
                ? 'text-white bg-blue-600 hover:bg-blue-700'
                : 'text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700'
            )}
          >
            <BookOpen className="h-4 w-4" />
            Reference
          </button>
        </div>

        {/* Detail area */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Empty state */}
          {!showingBrowseVideo && !showingReviewItem && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <Presentation className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium text-gray-500">
                {sidebarMode === 'queue' ? 'Select an item to review' : 'Select a video to watch'}
              </p>
              <p className="text-sm mt-1 text-gray-600">
                {sidebarMode === 'queue'
                  ? 'Click an item in the queue or use arrow keys'
                  : 'Browse videos in the sidebar'}
              </p>
            </div>
          )}

          {/* Browse video detail */}
          {showingBrowseVideo && selectedBrowseVideo && (
            <div className="max-w-3xl mx-auto space-y-6">
              <h2 className="text-xl font-semibold text-white">{selectedBrowseVideo.title}</h2>

              <div className="rounded-xl overflow-hidden bg-black aspect-video">
                <iframe
                  src={youtubeEmbedUrl(selectedBrowseVideo.youtubeId, selectedBrowseVideo.startSeconds)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={selectedBrowseVideo.title}
                />
              </div>

              {/* Chapters for reference videos */}
              {selectedBrowseVideo.source === 'reference' && selectedBrowseVideo.refVideoId && (() => {
                const chapters = getChapters(selectedBrowseVideo.refVideoId!)
                return chapters.length > 0 ? (
                  <div className="bg-gray-800 rounded-xl p-4 space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chapters</p>
                    {chapters.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedBrowseVideo({
                          ...selectedBrowseVideo,
                          startSeconds: ch.start_seconds ?? 0,
                        })}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
                      >
                        <span className="font-mono text-blue-400 shrink-0 text-xs">
                          {formatTime(ch.start_seconds ?? 0)}
                        </span>
                        <span className="truncate">{ch.title}</span>
                      </button>
                    ))}
                  </div>
                ) : null
              })()}

              {/* Comment form for browsed video */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Add Comment</p>
                <textarea
                  value={browseCommentText}
                  onChange={(e) => setBrowseCommentText(e.target.value)}
                  placeholder="Write a comment on this video..."
                  rows={3}
                  className="w-full bg-gray-900 text-gray-100 placeholder-gray-600 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleBrowseComment()
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  {browseCommentSuccess && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Comment saved
                    </span>
                  )}
                  {!browseCommentSuccess && <span />}
                  <button
                    onClick={handleBrowseComment}
                    disabled={browseCommentSending || !browseCommentText.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {browseCommentSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Review item detail (existing, unchanged) */}
          {showingReviewItem && activeItem && (
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

              {/* Video embed */}
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
                  placeholder={`Reply to ${activeItem.author_name}...`}
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
                    {replySending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  )
}
