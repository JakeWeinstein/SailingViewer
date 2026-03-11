'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronDown, ChevronRight, Film, LogOut, Shield,
  MessageSquare, Play, Grid3x3, BookOpen, Upload, FileText, Users, Anchor, Youtube,
  CheckCircle, AlertCircle, Loader2, RefreshCw, X, Plus
} from 'lucide-react'
import SessionManager from './SessionManager'
import VideoManager from './VideoManager'
import VideoWatchView from './VideoWatchView'
import ReferenceManager from './ReferenceManager'
import VideoUploader from './VideoUploader'
import ArticleEditor from './ArticleEditor'
import TeamManager from './TeamManager'
import ProfileEditor from './ProfileEditor'
import NotificationBell from './NotificationBell'
import type { Session, Comment } from '@/lib/types'
import type { SessionVideo, VideoNote, Article, ReferenceFolder } from '@/lib/types'
import { youtubeThumbnailUrl } from '@/lib/types'
import clsx from 'clsx'
import Link from 'next/link'

interface MentionUser { id: string; username: string; displayName: string }

type SidebarView = 'session' | 'reference' | 'upload' | 'articles' | 'team' | 'profile' | 'youtube'
type MainTab = 'review' | 'videos'

function formatTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

interface WatchTarget { video: SessionVideo; sessionId: string }

interface Props {
  initialSessions: Session[]
  userRole: 'captain' | 'contributor' | 'viewer'
  userName: string
  userId: string
}

export default function DashboardView({ initialSessions, userRole, userName, userId }: Props) {
  const isCaptain = userRole === 'captain'
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessions.find((s) => s.is_active)?.id ?? initialSessions[0]?.id ?? null
  )
  const [sidebarView, setSidebarView] = useState<SidebarView>('session')
  const [mainTab, setMainTab] = useState<MainTab>('review')
  const [reviewComments, setReviewComments] = useState<Comment[]>([])
  const [qaReviewComments, setQaReviewComments] = useState<Comment[]>([])
  const [loadingReview, setLoadingReview] = useState(false)
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set())
  const [showVideoManager, setShowVideoManager] = useState(false)
  const [watchTarget, setWatchTarget] = useState<WatchTarget | null>(null)
  const [reviewUserFilter, setReviewUserFilter] = useState<string>('all')

  // Articles state
  const [articles, setArticles] = useState<Article[]>([])
  const [articleFolders, setArticleFolders] = useState<ReferenceFolder[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Article | null | 'new'>(null)

  // Session lifecycle state (captain-only)
  const [closingSession, setClosingSession] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [nextSessionLabel, setNextSessionLabel] = useState('')
  const [addVideoUrl, setAddVideoUrl] = useState('')
  const [addingVideo, setAddingVideo] = useState(false)
  const [addVideoError, setAddVideoError] = useState<string | null>(null)

  // @mention users list (fetched once on mount)
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([])

  // YouTube state (captain-only)
  const [youtubeConnected, setYoutubeConnected] = useState<boolean | null>(null)
  const [youtubeChannelId, setYoutubeChannelId] = useState<string | null>(null)
  const [youtubeBanner, setYoutubeBanner] = useState<'connected' | 'error' | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; sessions_created: number; skipped: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const fetchReview = useCallback(async (sessionId: string) => {
    setLoadingReview(true)
    try {
      const [sessionRes, qaRes] = await Promise.all([
        fetch(`/api/comments?sessionId=${sessionId}&captainOnly=true`),
        fetch('/api/comments?type=qa&captainOnly=true'),
      ])
      if (sessionRes.ok) setReviewComments(await sessionRes.json())
      if (qaRes.ok) setQaReviewComments(await qaRes.json())
    } finally {
      setLoadingReview(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSessionId && mainTab === 'review') fetchReview(selectedSessionId)
  }, [selectedSessionId, mainTab, fetchReview])

  useEffect(() => { setShowVideoManager(false) }, [selectedSessionId])

  // Reset review filter when session changes
  useEffect(() => { setReviewUserFilter('all') }, [selectedSessionId])

  // Fetch articles + folders when articles view is selected
  useEffect(() => {
    if (sidebarView === 'articles' && articles.length === 0) {
      setArticlesLoading(true)
      Promise.all([
        fetch('/api/articles?drafts=true').then((r) => r.json()),
        fetch('/api/reference-folders').then((r) => r.json()),
      ]).then(([arts, flds]) => {
        if (Array.isArray(arts)) setArticles(arts)
        if (Array.isArray(flds)) setArticleFolders(flds)
      }).finally(() => setArticlesLoading(false))
    }
  }, [sidebarView, articles.length])

  // Fetch users list for @mention autocomplete (dashboard is always authenticated)
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.ok ? r.json() : [])
      .then((users) => {
        if (Array.isArray(users)) {
          setMentionUsers(users.map((u: { id: string; username: string; display_name: string }) => ({
            id: u.id,
            username: u.username,
            displayName: u.display_name,
          })))
        }
      })
      .catch(() => {})
  }, [])

  // Fetch YouTube connection status on mount (captain only)
  useEffect(() => {
    if (!isCaptain) return
    fetch('/api/youtube/status')
      .then((r) => r.json())
      .then((data) => {
        setYoutubeConnected(data.connected ?? false)
        setYoutubeChannelId(data.channelId ?? null)
      })
      .catch(() => setYoutubeConnected(false))
  }, [isCaptain])

  // Handle ?youtube=connected / ?youtube=error query params
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const yt = params.get('youtube')
    if (yt === 'connected') {
      setYoutubeBanner('connected')
      setYoutubeConnected(true)
      // Re-fetch status to get channelId
      fetch('/api/youtube/status')
        .then((r) => r.json())
        .then((data) => { setYoutubeChannelId(data.channelId ?? null) })
        .catch(() => {})
      // Clean query param from URL
      params.delete('youtube')
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params}`
        : window.location.pathname
      window.history.replaceState({}, '', newUrl)
      // Auto-dismiss after 5s
      setTimeout(() => setYoutubeBanner(null), 5000)
    } else if (yt === 'error') {
      setYoutubeBanner('error')
      params.delete('youtube')
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params}`
        : window.location.pathname
      window.history.replaceState({}, '', newUrl)
      setTimeout(() => setYoutubeBanner(null), 8000)
    }
  }, [])

  async function handleYoutubeImport() {
    setImportLoading(true)
    setImportResult(null)
    setImportError(null)
    try {
      const res = await fetch('/api/youtube/import', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error ?? 'Import failed — please try again')
        if (res.status === 401) {
          // Token expired — need to reconnect
          setYoutubeConnected(false)
        }
      } else {
        setImportResult(data)
        // Refresh sessions if any were created
        if (data.sessions_created > 0) {
          await fetchSessions()
        }
      }
    } catch {
      setImportError('Import failed — please try again')
    } finally {
      setImportLoading(false)
    }
  }

  async function handleCloseSession() {
    if (!selectedSessionId) return
    setClosingSession(true)
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          next_label: nextSessionLabel.trim() || undefined,
        }),
      })
      if (res.ok) {
        const { next } = await res.json()
        await fetchSessions()
        setSelectedSessionId(next.id)
        setShowCloseConfirm(false)
        setNextSessionLabel('')
      }
    } finally {
      setClosingSession(false)
    }
  }

  async function handleAddVideo() {
    if (!selectedSessionId || !addVideoUrl.trim()) return
    setAddingVideo(true)
    setAddVideoError(null)
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-video', youtube_url: addVideoUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddVideoError(data.error ?? 'Failed to add video')
      } else {
        // Refresh sessions to get updated video list
        await fetchSessions()
        setAddVideoUrl('')
      }
    } finally {
      setAddingVideo(false)
    }
  }

  // Generate next week label for close session confirmation
  function generateNextWeekLabel() {
    const d = new Date()
    const dayOfWeek = d.getDay()
    const daysUntilNextMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7
    d.setDate(d.getDate() + daysUntilNextMonday)
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
    return `Week of ${months[d.getMonth()]} ${d.getDate()}`
  }

  async function fetchSessions() {
    const res = await fetch('/api/sessions')
    if (res.ok) {
      const data = await res.json()
      setSessions(data)
      const active = data.find((s: Session) => s.is_active)
      if (active) setSelectedSessionId(active.id)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  function toggleExpand(videoId: string) {
    setExpandedVideos((prev) => {
      const next = new Set(prev)
      next.has(videoId) ? next.delete(videoId) : next.add(videoId)
      return next
    })
  }

  function handleNotesUpdated(videoId: string, notes: VideoNote[]) {
    setSessions((prev) => prev.map((s) =>
      s.id === watchTarget?.sessionId
        ? { ...s, videos: s.videos.map((v) => v.id === videoId ? { ...v, notes } : v) }
        : s
    ))
    setWatchTarget((prev) => prev ? { ...prev, video: { ...prev.video, notes } } : prev)
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId)
  const sessionVideos: SessionVideo[] = selectedSession?.videos ?? []

  // Group review comments by video
  const reviewGroups = useMemo(() => {
    const map = new Map<string, { videoTitle: string; comments: Comment[] }>()
    for (const c of reviewComments) {
      const vid = c.video_id ?? '__unknown__'
      const title = c.video_title ?? 'Unknown video'
      if (!map.has(vid)) map.set(vid, { videoTitle: title, comments: [] })
      map.get(vid)!.comments.push(c)
    }
    return [...map.entries()].map(([videoId, { videoTitle, comments }]) => ({ videoId, videoTitle, comments }))
  }, [reviewComments])

  // Per-video flagged comment count (from already-fetched review comments)
  const flaggedCountByVideo = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of reviewComments) {
      if (c.video_id) map.set(c.video_id, (map.get(c.video_id) ?? 0) + 1)
    }
    return map
  }, [reviewComments])

  // Unique authors for the filter dropdown (include Q&A authors)
  const reviewAuthors = useMemo(() => {
    const names = new Set<string>()
    for (const c of reviewComments) names.add(c.author_name)
    for (const c of qaReviewComments) names.add(c.author_name)
    return [...names].sort()
  }, [reviewComments, qaReviewComments])

  // Filtered Q&A review comments
  const filteredQaReview = useMemo(() => {
    if (reviewUserFilter === 'all') return qaReviewComments
    return qaReviewComments.filter((c) => c.author_name === reviewUserFilter)
  }, [qaReviewComments, reviewUserFilter])

  // Filtered review groups
  const filteredReviewGroups = useMemo(() => {
    if (reviewUserFilter === 'all') return reviewGroups
    return reviewGroups
      .map((g) => ({ ...g, comments: g.comments.filter((c) => c.author_name === reviewUserFilter) }))
      .filter((g) => g.comments.length > 0)
  }, [reviewGroups, reviewUserFilter])

  function ArticleRow({ article, onEdit }: { article: Article; onEdit: (a: Article) => void }) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-800">{article.title}</h3>
            {article.is_published
              ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">Published</span>
              : <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Draft</span>
            }
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            By {article.author_name} · {article.blocks.length} block{article.blocks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => onEdit(article)}
          className="shrink-0 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Telltale</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5 truncate">
                {isCaptain ? 'Captain' : userName}
              </p>
            </div>
            <NotificationBell />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {/* Reference Library */}
          <button
            onClick={() => setSidebarView('reference')}
            className={clsx(
              'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2',
              sidebarView === 'reference'
                ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            Reference Library
          </button>

          {/* Upload Videos */}
          <button
            onClick={() => setSidebarView('upload')}
            className={clsx(
              'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2',
              sidebarView === 'upload'
                ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Upload className="h-4 w-4 shrink-0" />
            Upload Videos
          </button>

          {/* Articles */}
          <button
            onClick={() => setSidebarView('articles')}
            className={clsx(
              'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2',
              sidebarView === 'articles'
                ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <FileText className="h-4 w-4 shrink-0" />
            Articles
          </button>

          {/* YouTube — captain only */}
          {isCaptain && (
            <button
              onClick={() => setSidebarView('youtube')}
              className={clsx(
                'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2',
                sidebarView === 'youtube'
                  ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Youtube className="h-4 w-4 shrink-0" />
              YouTube
              {youtubeConnected === true && (
                <span className="ml-auto h-2 w-2 bg-green-500 rounded-full shrink-0" />
              )}
            </button>
          )}

          {/* Team — captain only */}
          {isCaptain && (
            <button
              onClick={() => setSidebarView('team')}
              className={clsx(
                'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2',
                sidebarView === 'team'
                  ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Users className="h-4 w-4 shrink-0" />
              Team
            </button>
          )}

          {/* Profile — all roles */}
          <button
            onClick={() => setSidebarView('profile')}
            className={clsx(
              'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 mb-2',
              sidebarView === 'profile'
                ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Shield className="h-4 w-4 shrink-0" />
            Profile
          </button>

          <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Sessions</p>
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => { setSelectedSessionId(session.id); setSidebarView('session') }}
              className={clsx(
                'w-full text-left px-4 py-2.5 text-sm transition-colors',
                sidebarView === 'session' && selectedSessionId === session.id
                  ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <span className="block truncate">{session.label}</span>
              {session.is_active && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                  <span className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                  Active
                </span>
              )}
            </button>
          ))}
        </div>

        {/* New session — captain only */}
        {isCaptain && <SessionManager onSessionCreated={fetchSessions} />}

        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Anchor className="h-4 w-4" />
            Back to site
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">

        {/* YouTube connection banner */}
        {youtubeBanner === 'connected' && (
          <div className="flex items-center gap-2 px-6 py-3 bg-green-50 border-b border-green-100 text-sm text-green-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            YouTube channel connected successfully
          </div>
        )}
        {youtubeBanner === 'error' && (
          <div className="flex items-center gap-2 px-6 py-3 bg-red-50 border-b border-red-100 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to connect YouTube — try again
          </div>
        )}

        {/* Reference Library view */}
        {sidebarView === 'reference' && (
          <div className="max-w-5xl mx-auto px-6 py-6">
            <ReferenceManager
              isCaptain={true}
              userName={userName}
              activeSessionId={sessions.find((s) => s.is_active)?.id}
            />
          </div>
        )}

        {/* Upload Videos view */}
        {sidebarView === 'upload' && (
          <div className="max-w-3xl mx-auto px-6 py-6">
            <VideoUploader sessions={sessions} onUploaded={fetchSessions} />
          </div>
        )}

        {/* Articles view */}
        {sidebarView === 'articles' && (
          <div className="max-w-4xl mx-auto px-6 py-6">
            {editingArticle !== null ? (
              <ArticleEditor
                article={editingArticle === 'new' ? null : editingArticle}
                userName={userName}
                folders={articleFolders}
                users={mentionUsers}
                onSaved={(saved) => {
                  setArticles((prev) => {
                    const exists = prev.find((a) => a.id === saved.id)
                    return exists ? prev.map((a) => a.id === saved.id ? saved : a) : [saved, ...prev]
                  })
                  setEditingArticle(null)
                }}
                onCancel={() => setEditingArticle(null)}
              />
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Articles</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Team learning resources</p>
                  </div>
                  <button
                    onClick={() => setEditingArticle('new')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    New article
                  </button>
                </div>
                {articlesLoading && <p className="text-sm text-gray-400">Loading…</p>}
                {!articlesLoading && articles.length === 0 && (
                  <div className="text-center py-20 text-gray-400">
                    <FileText className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p className="font-medium">No articles yet</p>
                    <p className="text-sm mt-1">Write the first team learning article.</p>
                  </div>
                )}
                {/* Articles grouped by folder */}
                {!articlesLoading && articles.length > 0 && (() => {
                  const folderGroups = articleFolders.map((f) => ({
                    folder: f,
                    items: articles.filter((a) => a.folder_id === f.id),
                  })).filter((g) => g.items.length > 0)
                  const unfoldered = articles.filter((a) => !a.folder_id)
                  return (
                    <div className="space-y-6">
                      {folderGroups.map(({ folder, items }) => (
                        <div key={folder.id}>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{folder.name}</p>
                          <div className="space-y-2">
                            {items.map((article) => <ArticleRow key={article.id} article={article} onEdit={setEditingArticle} />)}
                          </div>
                        </div>
                      ))}
                      {unfoldered.length > 0 && (
                        <div>
                          {folderGroups.length > 0 && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Other</p>}
                          <div className="space-y-2">
                            {unfoldered.map((article) => <ArticleRow key={article.id} article={article} onEdit={setEditingArticle} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* Team view — captain only */}
        {sidebarView === 'team' && isCaptain && (
          <div className="max-w-5xl mx-auto px-6 py-6">
            <TeamManager />
          </div>
        )}

        {/* YouTube view — captain only */}
        {sidebarView === 'youtube' && isCaptain && (
          <div className="max-w-xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3 mb-6">
              <Youtube className="h-6 w-6 text-red-500" />
              <div>
                <h2 className="text-lg font-bold text-gray-800">YouTube Integration</h2>
                <p className="text-xs text-gray-400 mt-0.5">Auto-import practice videos from your YouTube channel</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              {/* Connection status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Connection status</p>
                  {youtubeChannelId && (
                    <p className="text-xs text-gray-400 mt-0.5">Channel: {youtubeChannelId}</p>
                  )}
                </div>
                {youtubeConnected === null ? (
                  <span className="text-xs text-gray-400">Checking…</span>
                ) : youtubeConnected ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
                    <span className="h-2 w-2 bg-green-500 rounded-full" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                    Not connected
                  </span>
                )}
              </div>

              {/* Connect / reconnect button */}
              {!youtubeConnected && (
                <a
                  href="/api/youtube/auth"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Youtube className="h-4 w-4" />
                  Connect YouTube
                </a>
              )}

              {youtubeConnected && (
                <>
                  <hr className="border-gray-100" />

                  {/* Reconnect link (subtle) */}
                  <a
                    href="/api/youtube/auth"
                    className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                  >
                    Re-authorize / switch channel
                  </a>

                  <hr className="border-gray-100" />

                  {/* Import controls */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Import new videos</p>
                    <p className="text-xs text-gray-400 mb-3">
                      Discovers recent uploads from your channel and creates sessions grouped by date. Videos already imported are skipped. Import is limited to once every 15 minutes.
                    </p>
                    <button
                      onClick={handleYoutubeImport}
                      disabled={importLoading}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {importLoading
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <RefreshCw className="h-4 w-4" />
                      }
                      {importLoading ? 'Importing…' : 'Import new videos'}
                    </button>
                  </div>

                  {/* Import result */}
                  {importResult && !importError && (
                    <div className="bg-green-50 rounded-lg px-4 py-3 text-sm text-green-800">
                      <p className="font-semibold mb-1">Import complete</p>
                      <ul className="space-y-0.5 text-xs">
                        <li>{importResult.imported} video{importResult.imported !== 1 ? 's' : ''} imported</li>
                        <li>{importResult.sessions_created} session{importResult.sessions_created !== 1 ? 's' : ''} created</li>
                        <li>{importResult.skipped} already imported (skipped)</li>
                      </ul>
                    </div>
                  )}

                  {/* Import error */}
                  {importError && (
                    <div className="flex items-start gap-2 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{importError}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Profile view — all roles */}
        {sidebarView === 'profile' && (
          <div className="max-w-xl mx-auto px-6 py-6">
            <ProfileEditor
              user={{
                id: userId,
                username: userName,
                displayName: userName,
                role: userRole,
              }}
            />
          </div>
        )}

        {sidebarView === 'session' && selectedSessionId && selectedSession ? (
          <div className="max-w-5xl mx-auto px-6 py-6">

            {/* Session header */}
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-gray-800">{selectedSession.label}</h1>
                  {selectedSession.is_active && (
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {sessionVideos.length} video{sessionVideos.length !== 1 ? 's' : ''} &middot; {reviewComments.length} for review
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isCaptain && selectedSession.is_active && !showCloseConfirm && (
                  <button
                    onClick={() => {
                      setNextSessionLabel(generateNextWeekLabel())
                      setShowCloseConfirm(true)
                    }}
                    className="shrink-0 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    Close &amp; Start Next Week
                  </button>
                )}
                <button
                  onClick={() => setShowVideoManager((v) => !v)}
                  className="shrink-0 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {showVideoManager ? 'Done' : 'Manage videos'}
                </button>
              </div>
            </div>

            {/* Close session confirmation */}
            {showCloseConfirm && isCaptain && (
              <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-800">Close this session</p>
                  <button
                    onClick={() => setShowCloseConfirm(false)}
                    className="text-amber-400 hover:text-amber-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-amber-700">
                  This will close the current session and create a new active session. Flagged comments will carry forward.
                </p>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-amber-800">Next session label</label>
                  <input
                    type="text"
                    value={nextSessionLabel}
                    onChange={(e) => setNextSessionLabel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Week of..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCloseSession}
                    disabled={closingSession}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
                  >
                    {closingSession ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                    {closingSession ? 'Closing...' : 'Confirm & Close'}
                  </button>
                  <button
                    onClick={() => setShowCloseConfirm(false)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:bg-amber-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Add YouTube video URL — captain + contributor */}
            {selectedSession.is_active && (
              <div className="mb-5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addVideoUrl}
                    onChange={(e) => { setAddVideoUrl(e.target.value); setAddVideoError(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddVideo() }}
                    placeholder="Paste YouTube URL to add video..."
                    className={clsx(
                      'flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
                      addVideoError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                    )}
                  />
                  <button
                    onClick={handleAddVideo}
                    disabled={addingVideo || !addVideoUrl.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {addingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </button>
                </div>
                {addVideoError && <p className="text-xs text-red-600 mt-1">{addVideoError}</p>}
              </div>
            )}

            {showVideoManager && (
              <div className="mb-5 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <VideoManager
                  sessionId={selectedSessionId}
                  videos={sessionVideos}
                  onUpdated={(next) => setSessions((prev) =>
                    prev.map((s) => s.id === selectedSessionId ? { ...s, videos: next } : s)
                  )}
                />
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
              <button
                onClick={() => setMainTab('review')}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  mainTab === 'review' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Shield className="h-4 w-4" />
                Review queue
                {reviewComments.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {reviewComments.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMainTab('videos')}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  mainTab === 'videos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Grid3x3 className="h-4 w-4" />
                Browse videos
              </button>
            </div>

            {/* ── Review tab ── */}
            {mainTab === 'review' && (
              <>
                {/* User filter */}
                {reviewAuthors.length > 1 && (
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-gray-400 shrink-0" />
                    <select
                      value={reviewUserFilter}
                      onChange={(e) => setReviewUserFilter(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="all">All users</option>
                      {reviewAuthors.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {loadingReview && (
                  <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>
                )}
                {!loadingReview && filteredReviewGroups.length === 0 && filteredQaReview.length === 0 && (
                  <div className="text-center py-20 text-gray-400">
                    <Shield className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p className="font-medium">No submissions for review yet</p>
                    <p className="text-sm mt-1">Team members can check &ldquo;Submit to captain for review&rdquo; when commenting.</p>
                  </div>
                )}

                {/* Q&A Review Section */}
                {filteredQaReview.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="h-4 w-4 text-purple-500" />
                      <h3 className="text-sm font-semibold text-gray-700">General Q&A</h3>
                      <span className="text-xs text-gray-400">({filteredQaReview.length})</span>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                      {filteredQaReview.map((c) => (
                        <div key={c.id} className="px-5 py-4">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold text-gray-800">{c.author_name}</span>
                            <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">{c.comment_text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {filteredReviewGroups.map((group) => {
                    const isExpanded = expandedVideos.has(group.videoId)
                    const sessionVideo = sessionVideos.find((v) => v.id === group.videoId)
                    return (
                      <div key={group.videoId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-4">
                          <button
                            onClick={() => toggleExpand(group.videoId)}
                            className="flex items-center gap-2 flex-1 text-left min-w-0"
                          >
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                              : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                            }
                            <span className="text-sm font-semibold text-gray-800 truncate">{group.videoTitle}</span>
                            <span className="shrink-0 text-xs text-gray-400">({group.comments.length})</span>
                          </button>
                          <button
                            onClick={() => setWatchTarget({
                              video: sessionVideo ?? { id: group.videoId, name: group.videoTitle },
                              sessionId: selectedSessionId,
                            })}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Watch &amp; review
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-50 divide-y divide-gray-50">
                            {group.comments
                              .slice()
                              .sort((a, b) => (a.timestamp_seconds ?? Infinity) - (b.timestamp_seconds ?? Infinity))
                              .map((c) => (
                                <div key={c.id} className="px-5 py-4 flex items-start gap-3">
                                  {c.timestamp_seconds != null && (
                                    <span className="shrink-0 mt-0.5 px-2.5 py-1 bg-blue-600 text-white text-xs font-mono font-bold rounded-full">
                                      {formatTime(c.timestamp_seconds)}
                                    </span>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className="text-sm font-semibold text-gray-800">{c.author_name}</span>
                                      <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 leading-relaxed">{c.comment_text}</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* ── Videos tab ── */}
            {mainTab === 'videos' && (
              <>
                {sessions.map((session) => {
                  const vids: SessionVideo[] = session.videos ?? []
                  const isOpen = expandedVideos.has(session.id)
                  return (
                    <div key={session.id} className="mb-6">
                      <button
                        onClick={() => toggleExpand(session.id)}
                        className="flex items-center gap-2 mb-3 w-full text-left"
                      >
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 text-gray-400" />
                          : <ChevronRight className="h-4 w-4 text-gray-400" />
                        }
                        <span className="text-sm font-semibold text-gray-700">{session.label}</span>
                        {session.is_active && (
                          <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                        )}
                        <span className="text-xs text-gray-400 ml-1">{vids.length} video{vids.length !== 1 ? 's' : ''}</span>
                      </button>

                      {isOpen && (
                        vids.length === 0 ? (
                          <p className="text-xs text-gray-400 italic pl-6 mb-4">No videos in this session.</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pl-6 mb-4">
                            {vids.map((video) => (
                              <button
                                key={video.id}
                                onClick={() => setWatchTarget({ video, sessionId: session.id })}
                                className="group text-left bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all"
                              >
                                <div className="relative aspect-video bg-gray-100 overflow-hidden">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={youtubeThumbnailUrl(video.id)}
                                    alt={video.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <div className="opacity-0 group-hover:opacity-100 bg-white/90 rounded-full p-2">
                                      <Play className="h-4 w-4 text-blue-600 fill-blue-600" />
                                    </div>
                                  </div>
                                  {/* Flagged count badge */}
                                  {flaggedCountByVideo.get(video.id) != null && flaggedCountByVideo.get(video.id)! > 0 && (
                                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-amber-500/90 text-white text-xs px-1.5 py-0.5 rounded-full">
                                      <Shield className="h-2 w-2" />
                                      {flaggedCountByVideo.get(video.id)}
                                    </div>
                                  )}
                                </div>
                                <div className="p-2.5">
                                  <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{video.name}</p>
                                  {video.note && (
                                    <p className="text-xs text-amber-600 mt-1 truncate">📝 {video.note}</p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  )
                })}

                {sessions.every((s) => (s.videos ?? []).length === 0) && (
                  <div className="text-center py-20 text-gray-400">
                    <Film className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p className="font-medium">No videos yet</p>
                    <p className="text-sm mt-1">Use &ldquo;Manage videos&rdquo; to add videos to this session.</p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : sidebarView === 'session' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">Select a session or create a new one.</p>
            </div>
          </div>
        ) : null}
      </main>

      {/* Video watch + comment panel */}
      {watchTarget && (
        <VideoWatchView
          video={watchTarget.video}
          sessionId={watchTarget.sessionId}
          userName={userName}
          isCaptain={isCaptain}
          onNotesUpdated={isCaptain ? handleNotesUpdated : undefined}
          onClose={() => setWatchTarget(null)}
        />
      )}
    </div>
  )
}
