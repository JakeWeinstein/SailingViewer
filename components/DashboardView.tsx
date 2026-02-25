'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronDown, ChevronRight, Film, LogOut, Shield,
  MessageSquare, Play, Grid3x3, BookOpen
} from 'lucide-react'
import SessionManager from './SessionManager'
import VideoManager from './VideoManager'
import VideoWatchView from './VideoWatchView'
import ReferenceManager from './ReferenceManager'
import type { Session, Comment } from '@/lib/supabase'
import type { SessionVideo } from '@/lib/types'
import { thumbnailUrl } from '@/lib/types'
import clsx from 'clsx'

type SidebarView = 'session' | 'reference'
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

interface DashboardViewProps {
  initialSessions: Session[]
  userRole: 'captain' | 'contributor'
  userName: string
}

export default function DashboardView({ initialSessions, userRole, userName }: DashboardViewProps) {
  const isCaptain = userRole === 'captain'
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessions.find((s) => s.is_active)?.id ?? initialSessions[0]?.id ?? null
  )
  const [sidebarView, setSidebarView] = useState<SidebarView>('session')
  const [mainTab, setMainTab] = useState<MainTab>(userRole === 'captain' ? 'review' : 'videos')
  const [reviewComments, setReviewComments] = useState<Comment[]>([])
  const [loadingReview, setLoadingReview] = useState(false)
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set())
  const [showVideoManager, setShowVideoManager] = useState(false)
  const [watchTarget, setWatchTarget] = useState<WatchTarget | null>(null)

  const fetchReview = useCallback(async (sessionId: string) => {
    setLoadingReview(true)
    try {
      const res = await fetch(`/api/comments?sessionId=${sessionId}&captainOnly=true`)
      if (res.ok) setReviewComments(await res.json())
    } finally {
      setLoadingReview(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSessionId && mainTab === 'review') fetchReview(selectedSessionId)
  }, [selectedSessionId, mainTab, fetchReview])

  // Reset video manager when session changes
  useEffect(() => { setShowVideoManager(false) }, [selectedSessionId])

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
    window.location.href = '/dashboard/login'
  }

  function toggleExpand(videoId: string) {
    setExpandedVideos((prev) => {
      const next = new Set(prev)
      next.has(videoId) ? next.delete(videoId) : next.add(videoId)
      return next
    })
  }

  function handleNoteUpdated(videoId: string, note: string) {
    setSessions((prev) => prev.map((s) =>
      s.id === watchTarget?.sessionId
        ? { ...s, videos: s.videos.map((v) => v.id === videoId ? { ...v, note } : v) }
        : s
    ))
    // Also update the watchTarget video if open
    setWatchTarget((prev) => prev ? { ...prev, video: { ...prev.video, note } } : prev)
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId)
  const sessionVideos: SessionVideo[] = selectedSession?.videos ?? []

  // Group review comments by video
  const reviewGroups = useMemo(() => {
    const map = new Map<string, { videoTitle: string; comments: Comment[] }>()
    for (const c of reviewComments) {
      if (!map.has(c.video_id)) map.set(c.video_id, { videoTitle: c.video_title, comments: [] })
      map.get(c.video_id)!.comments.push(c)
    }
    return [...map.entries()].map(([videoId, { videoTitle, comments }]) => ({ videoId, videoTitle, comments }))
  }, [reviewComments])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Telltale</p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">{isCaptain ? 'Captain Dashboard' : userName}</p>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {/* Reference Library link */}
          <button
            onClick={() => setSidebarView('reference')}
            className={clsx(
              'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 mb-2',
              sidebarView === 'reference'
                ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            Reference Library
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

        {isCaptain && <SessionManager onSessionCreated={fetchSessions} />}

        <div className="px-4 py-3 border-t border-gray-100">
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

        {/* Reference Library view */}
        {sidebarView === 'reference' && (
          <div className="max-w-5xl mx-auto px-6 py-6">
            <ReferenceManager
              isCaptain={isCaptain}
              userName={userName}
              activeSessionId={sessions.find((s) => s.is_active)?.id}
            />
          </div>
        )}

        {sidebarView === 'session' && selectedSessionId && selectedSession ? (
          <div className="max-w-5xl mx-auto px-6 py-6">

            {/* Session header */}
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h1 className="text-lg font-bold text-gray-800">{selectedSession.label}</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {sessionVideos.length} video{sessionVideos.length !== 1 ? 's' : ''} &middot; {reviewComments.length} for review
                </p>
              </div>
              {isCaptain && (
                <button
                  onClick={() => setShowVideoManager((v) => !v)}
                  className="shrink-0 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {showVideoManager ? 'Done' : 'Manage videos'}
                </button>
              )}
            </div>

            {/* Video manager — captain only */}
            {isCaptain && showVideoManager && (
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
              {isCaptain && (
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
              )}
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
                {loadingReview && (
                  <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>
                )}
                {!loadingReview && reviewGroups.length === 0 && (
                  <div className="text-center py-20 text-gray-400">
                    <Shield className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p className="font-medium">No submissions for review yet</p>
                    <p className="text-sm mt-1">Team members can check &ldquo;Submit to captain for review&rdquo; when commenting.</p>
                  </div>
                )}
                <div className="space-y-4">
                  {reviewGroups.map((group) => {
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
                {/* All sessions as collapsible groups */}
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
                                    src={thumbnailUrl(video.id)}
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

      {/* Video watch + comment panel (captain view) */}
      {watchTarget && (
        <VideoWatchView
          video={watchTarget.video}
          sessionId={watchTarget.sessionId}
          userName={userName}
          isCaptain={isCaptain}
          onNoteUpdated={handleNoteUpdated}
          onClose={() => setWatchTarget(null)}
        />
      )}
    </div>
  )
}
