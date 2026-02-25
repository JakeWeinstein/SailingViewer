'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Anchor, Loader2, Heart, MessageCircle, Play, ChevronDown, ChevronRight, BookOpen, GraduationCap } from 'lucide-react'
import NamePrompt from '@/components/NamePrompt'
import VideoWatchView from '@/components/VideoWatchView'
import ReferenceManager from '@/components/ReferenceManager'
import ArticleViewer from '@/components/ArticleViewer'
import { thumbnailUrl, type SessionVideo, type Article } from '@/lib/types'
import type { Comment } from '@/lib/supabase'
import clsx from 'clsx'
import Link from 'next/link'

interface BrowseSession {
  id: string
  label: string
  videos: SessionVideo[]
  is_active: boolean
  created_at: string
}

const NAME_KEY = 'telltale_name'
const FAV_KEY = 'telltale_favorites'

type MainView = 'sessions' | 'reference' | 'learn'
type Filter = 'all' | 'discussed' | 'favorites'

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]))
}

interface WatchTarget { video: SessionVideo; sessionId: string }

export default function TeamFormPage() {
  const [userName, setUserName] = useState<string | null>(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [sessions, setSessions] = useState<BrowseSession[]>([])
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<Comment[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [watchTarget, setWatchTarget] = useState<WatchTarget | null>(null)
  const [mainView, setMainView] = useState<MainView>('sessions')
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  // Auth state for login/dashboard button
  const [authUser, setAuthUser] = useState<{ role: string; userName?: string } | null | undefined>(undefined)

  // Learn
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [viewingArticle, setViewingArticle] = useState<Article | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY)
    if (saved) setUserName(saved)
    else setShowNamePrompt(true)
    setFavorites(loadFavorites())
    // Check if user is already authenticated
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setAuthUser(data ?? null))
      .catch(() => setAuthUser(null))
  }, [])

  useEffect(() => {
    fetch('/api/sessions/browse')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSessions(data)
          const active = data.find((s: BrowseSession) => s.is_active)
          if (active) setExpandedSessions(new Set([active.id]))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (sessions.length === 0) return
    Promise.all(
      sessions.map((s) =>
        fetch(`/api/comments?sessionId=${s.id}`)
          .then((r) => r.json())
          .then((data) => (Array.isArray(data) ? data : []))
      )
    ).then((results) => setComments(results.flat()))
  }, [sessions])

  useEffect(() => {
    if (mainView === 'learn' && articles.length === 0) {
      setArticlesLoading(true)
      fetch('/api/articles')
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setArticles(data) })
        .finally(() => setArticlesLoading(false))
    }
  }, [mainView, articles.length])

  function handleSetName(name: string) {
    localStorage.setItem(NAME_KEY, name)
    setUserName(name)
    setShowNamePrompt(false)
  }

  function toggleFavorite(videoId: string) {
    setFavorites((prev) => {
      const next = new Set(prev)
      next.has(videoId) ? next.delete(videoId) : next.add(videoId)
      saveFavorites(next)
      return next
    })
  }

  function handleNoteUpdated(videoId: string, note: string, noteTimestamp?: number) {
    setSessions((prev) => prev.map((s) => ({
      ...s,
      videos: s.videos.map((v) => v.id === videoId ? { ...v, note, noteTimestamp } : v),
    })))
    setWatchTarget((prev) => prev ? { ...prev, video: { ...prev.video, note, noteTimestamp } } : prev)
  }

  function toggleSession(sessionId: string) {
    setExpandedSessions((prev) => {
      const next = new Set(prev)
      next.has(sessionId) ? next.delete(sessionId) : next.add(sessionId)
      return next
    })
  }

  const activeSession = sessions.find((s) => s.is_active)

  const allVideos = useMemo(() =>
    sessions.flatMap((s) => s.videos.map((v) => ({ video: v, sessionId: s.id }))),
    [sessions]
  )

  const commentCountByVideo = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of comments) map.set(c.video_id, (map.get(c.video_id) ?? 0) + 1)
    return map
  }, [comments])

  const latestCommentByVideo = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of comments) {
      const t = new Date(c.created_at).getTime()
      if (!map.has(c.video_id) || t > map.get(c.video_id)!) map.set(c.video_id, t)
    }
    return map
  }, [comments])

  const discussedVideos = useMemo(() =>
    allVideos
      .filter(({ video }) => commentCountByVideo.has(video.id))
      .sort((a, b) => (latestCommentByVideo.get(b.video.id) ?? 0) - (latestCommentByVideo.get(a.video.id) ?? 0)),
    [allVideos, commentCountByVideo, latestCommentByVideo]
  )

  function getFilteredVideos(sessionVideos: SessionVideo[]) {
    if (filter === 'discussed') return sessionVideos.filter((v) => commentCountByVideo.has(v.id))
    if (filter === 'favorites') return sessionVideos.filter((v) => favorites.has(v.id))
    return sessionVideos
  }

  function VideoCard({ video, sessionId }: { video: SessionVideo; sessionId: string }) {
    const count = commentCountByVideo.get(video.id) ?? 0
    const fav = favorites.has(video.id)
    return (
      <div className="group relative bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all">
        <button className="w-full text-left" onClick={() => setWatchTarget({ video, sessionId })}>
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
              <div className="opacity-0 group-hover:opacity-100 bg-white/90 rounded-full p-2.5 shadow">
                <Play className="h-5 w-5 text-blue-600 fill-blue-600" />
              </div>
            </div>
            {count > 0 && (
              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full">
                <MessageCircle className="h-2.5 w-2.5" />
                {count}
              </div>
            )}
          </div>
          <div className="px-3 pt-2 pb-1">
            <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{video.name}</p>
            {video.note && <p className="text-xs text-amber-600 mt-0.5 truncate">📝 {video.note}</p>}
          </div>
        </button>
        <div className="px-3 pb-2.5 flex justify-end">
          <button
            onClick={() => toggleFavorite(video.id)}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <Heart className={clsx('h-4 w-4 transition-colors', fav ? 'fill-red-500 text-red-500' : 'text-gray-300 hover:text-red-400')} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showNamePrompt && <NamePrompt onSet={handleSetName} />}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="p-1.5 bg-blue-600 rounded-lg shrink-0">
            <Anchor className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 leading-none">Telltale</h1>
            {activeSession && <p className="text-xs text-gray-400 mt-0.5 truncate">{activeSession.label}</p>}
          </div>
          {userName && (
            <button
              onClick={() => setShowNamePrompt(true)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-full transition-colors"
            >
              <span className="font-medium">{userName}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
          {authUser !== undefined && (
            authUser ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
              >
                Dashboard
                <ChevronRight className="h-3 w-3" />
              </Link>
            ) : (
              <Link
                href="/dashboard/login"
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
              >
                Login
              </Link>
            )
          )}
        </div>

        {/* Main nav */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 -mb-px">
          {([
            { key: 'sessions' as MainView, label: 'Sessions', icon: null },
            { key: 'reference' as MainView, label: 'Reference', icon: <BookOpen className="h-3.5 w-3.5" /> },
            { key: 'learn' as MainView, label: 'Learn', icon: <GraduationCap className="h-3.5 w-3.5" /> },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setMainView(tab.key); setViewingArticle(null) }}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors',
                mainView === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── Reference Library ── */}
        {mainView === 'reference' && userName && (
          <ReferenceManager
            isCaptain={false}
            userName={userName}
            activeSessionId={activeSession?.id}
          />
        )}

        {/* ── Learn ── */}
        {mainView === 'learn' && (
          viewingArticle ? (
            <div>
              <button
                onClick={() => setViewingArticle(null)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Back to articles
              </button>
              <ArticleViewer article={viewingArticle} />
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Learn</h2>
                <p className="text-xs text-gray-400 mt-0.5">Team learning resources</p>
              </div>
              {articlesLoading && (
                <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              )}
              {!articlesLoading && articles.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                  <GraduationCap className="mx-auto mb-3 h-10 w-10 opacity-30" />
                  <p className="font-medium">No articles yet</p>
                  <p className="text-sm mt-1">Check back soon for team learning resources.</p>
                </div>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {articles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => setViewingArticle(article)}
                    className="group text-left bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                        <GraduationCap className="h-4 w-4 text-blue-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-800 leading-snug group-hover:text-blue-700 transition-colors">
                        {article.title}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400">
                      By {article.author_name} · {article.blocks.length} section{article.blocks.length !== 1 ? 's' : ''}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {mainView === 'sessions' && loading && (
          <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {mainView === 'sessions' && !loading && sessions.length === 0 && (
          <div className="text-center py-24">
            <Anchor className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-600">No sessions yet</h2>
            <p className="text-sm text-gray-400 mt-1">The captain hasn&apos;t set up any sessions yet.</p>
          </div>
        )}

        {mainView === 'sessions' && !loading && sessions.length > 0 && (
          <>
            {/* Recently discussed */}
            {discussedVideos.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Recently discussed
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {discussedVideos.slice(0, 10).map(({ video, sessionId }) => (
                    <button
                      key={video.id}
                      onClick={() => setWatchTarget({ video, sessionId })}
                      className="group shrink-0 w-48 text-left bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all"
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
                        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full">
                          <MessageCircle className="h-2.5 w-2.5" />
                          {commentCountByVideo.get(video.id)}
                        </div>
                      </div>
                      <p className="px-2.5 py-2 text-xs font-medium text-gray-700 truncate">{video.name}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Filter bar */}
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-bold text-gray-800">All videos</h2>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {([
                  { key: 'all' as Filter, label: 'All' },
                  { key: 'discussed' as Filter, label: '💬 Discussed' },
                  { key: 'favorites' as Filter, label: '❤️ Favorites' },
                ]).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={clsx(
                      'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                      filter === f.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sessions */}
            {sessions.map((session) => {
              const filtered = getFilteredVideos(session.videos)
              const isExpanded = expandedSessions.has(session.id)

              if (filter !== 'all' && filtered.length === 0) return null

              return (
                <section key={session.id}>
                  <button
                    onClick={() => toggleSession(session.id)}
                    className="flex items-center gap-2 mb-4 w-full text-left group"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />
                    }
                    <span className="text-sm font-semibold text-gray-700">{session.label}</span>
                    {session.is_active && (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {filtered.length} video{filtered.length !== 1 ? 's' : ''}
                      {filter === 'all' && commentCountByVideo.size > 0 && (() => {
                        const discussed = session.videos.filter((v) => commentCountByVideo.has(v.id)).length
                        return discussed > 0 ? ` · ${discussed} discussed` : null
                      })()}
                    </span>
                  </button>

                  {isExpanded && (
                    filtered.length === 0 ? (
                      <p className="text-sm text-gray-400 italic pl-6 pb-4">
                        {filter === 'favorites' ? 'No favorites in this session.' : 'No videos in this session.'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pl-6">
                        {filtered.map((video) => (
                          <VideoCard key={video.id} video={video} sessionId={session.id} />
                        ))}
                      </div>
                    )
                  )}
                </section>
              )
            })}
          </>
        )}
      </main>

      {watchTarget && userName && (
        <VideoWatchView
          video={watchTarget.video}
          sessionId={watchTarget.sessionId}
          activeSessionId={activeSession?.id}
          userName={userName}
          isFavorited={favorites.has(watchTarget.video.id)}
          onFavoriteToggle={() => toggleFavorite(watchTarget.video.id)}
          onNoteUpdated={handleNoteUpdated}
          onClose={() => setWatchTarget(null)}
        />
      )}
    </div>
  )
}
