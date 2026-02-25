'use client'

import { useState, useEffect, useMemo } from 'react'
import { Anchor, Loader2, Heart, MessageCircle, Play, ChevronDown, ChevronRight } from 'lucide-react'
import NamePrompt from '@/components/NamePrompt'
import VideoWatchView from '@/components/VideoWatchView'
import { thumbnailUrl, type SessionVideo } from '@/lib/types'
import type { Comment } from '@/lib/supabase'
import clsx from 'clsx'

interface BrowseSession {
  id: string
  label: string
  videos: SessionVideo[]
  is_active: boolean
  created_at: string
}

const NAME_KEY = 'theoryform_name'
const FAV_KEY = 'theoryform_favorites'

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
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY)
    if (saved) setUserName(saved)
    else setShowNamePrompt(true)
    setFavorites(loadFavorites())
  }, [])

  // Fetch all sessions
  useEffect(() => {
    fetch('/api/sessions/browse')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSessions(data)
          // Expand the active session by default
          const active = data.find((s: BrowseSession) => s.is_active)
          if (active) setExpandedSessions(new Set([active.id]))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Fetch all comments across all sessions
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

  // All videos across all sessions
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
            <h1 className="text-sm font-bold text-gray-900 leading-none">TheoryForm</h1>
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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {loading && (
          <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-center py-24">
            <Anchor className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-600">No sessions yet</h2>
            <p className="text-sm text-gray-400 mt-1">The captain hasn&apos;t set up any sessions yet.</p>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <>
            {/* Recently discussed — across all sessions */}
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
                  { key: 'all', label: 'All' },
                  { key: 'discussed', label: '💬 Discussed' },
                  { key: 'favorites', label: '❤️ Favorites' },
                ] as { key: Filter; label: string }[]).map((f) => (
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

            {/* Sessions — active first, then older */}
            {sessions.map((session) => {
              const filtered = getFilteredVideos(session.videos)
              const isExpanded = expandedSessions.has(session.id)

              // Hide session if filtering and it has no matching videos
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
