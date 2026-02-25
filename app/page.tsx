'use client'

import { useState, useEffect, useMemo } from 'react'
import { Anchor, Loader2, Heart, MessageCircle, Play, ChevronDown } from 'lucide-react'
import NamePrompt from '@/components/NamePrompt'
import VideoWatchView from '@/components/VideoWatchView'
import { thumbnailUrl, type SessionVideo } from '@/lib/types'
import type { Comment } from '@/lib/supabase'
import clsx from 'clsx'

interface ActiveSession {
  id: string
  label: string
  videos: SessionVideo[]
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

export default function TeamFormPage() {
  const [userName, setUserName] = useState<string | null>(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [session, setSession] = useState<ActiveSession | null | undefined>(undefined)
  const [comments, setComments] = useState<Comment[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [selectedVideo, setSelectedVideo] = useState<SessionVideo | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  // Restore name + favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY)
    if (saved) setUserName(saved)
    else setShowNamePrompt(true)
    setFavorites(loadFavorites())
  }, [])

  // Fetch active session
  useEffect(() => {
    fetch('/api/sessions/active')
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession(null))
  }, [])

  // Fetch all comments for this session
  useEffect(() => {
    if (!session?.id) return
    fetch(`/api/comments?sessionId=${session.id}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setComments(data) })
  }, [session?.id])

  function handleSetName(name: string) {
    localStorage.setItem(NAME_KEY, name)
    setUserName(name)
    setShowNamePrompt(false)
  }

  function toggleFavorite(videoId: string) {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      saveFavorites(next)
      return next
    })
  }

  function handleNoteUpdated(videoId: string, note: string) {
    setSession((prev) => prev ? {
      ...prev,
      videos: prev.videos.map((v) => v.id === videoId ? { ...v, note } : v),
    } : prev)
  }

  // Comment count per video
  const commentCountByVideo = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of comments) map.set(c.video_id, (map.get(c.video_id) ?? 0) + 1)
    return map
  }, [comments])

  // Most-recent comment timestamp per video (for sorting "discussed")
  const latestCommentByVideo = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of comments) {
      const t = new Date(c.created_at).getTime()
      if (!map.has(c.video_id) || t > map.get(c.video_id)!) map.set(c.video_id, t)
    }
    return map
  }, [comments])

  const videos = session?.videos ?? []

  const discussedVideos = useMemo(() =>
    videos
      .filter((v) => commentCountByVideo.has(v.id))
      .sort((a, b) => (latestCommentByVideo.get(b.id) ?? 0) - (latestCommentByVideo.get(a.id) ?? 0)),
    [videos, commentCountByVideo, latestCommentByVideo]
  )

  const filteredVideos = useMemo(() => {
    if (filter === 'discussed') return discussedVideos
    if (filter === 'favorites') return videos.filter((v) => favorites.has(v.id))
    return videos
  }, [filter, videos, discussedVideos, favorites])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Name prompt */}
      {showNamePrompt && <NamePrompt onSet={handleSetName} />}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="p-1.5 bg-blue-600 rounded-lg shrink-0">
            <Anchor className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 leading-none">TheoryForm</h1>
            {session?.label && <p className="text-xs text-gray-400 mt-0.5 truncate">{session.label}</p>}
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
        {/* Loading */}
        {session === undefined && (
          <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {/* No active session */}
        {session === null && (
          <div className="text-center py-24">
            <Anchor className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-600">No active session</h2>
            <p className="text-sm text-gray-400 mt-1">The captain hasn&apos;t set up this week&apos;s session yet.</p>
          </div>
        )}

        {session && (
          <>
            {/* Recently discussed */}
            {discussedVideos.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Recently discussed
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {discussedVideos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => setSelectedVideo(video)}
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

            {/* All videos */}
            <section>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-sm font-bold text-gray-800">{session.label}</h2>
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

              {filteredVideos.length === 0 && (
                <p className="text-sm text-gray-400 italic py-8 text-center">
                  {filter === 'favorites' ? 'No favorites yet — click the ❤️ on any video.' : 'No videos in this session yet.'}
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredVideos.map((video) => {
                  const count = commentCountByVideo.get(video.id) ?? 0
                  const fav = favorites.has(video.id)
                  return (
                    <div key={video.id} className="group relative bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all">
                      {/* Thumbnail */}
                      <button className="w-full text-left" onClick={() => setSelectedVideo(video)}>
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
                          {video.note && (
                            <p className="text-xs text-amber-600 mt-1 truncate">📝 {video.note}</p>
                          )}
                        </div>
                      </button>

                      {/* Favorite button */}
                      <div className="px-3 pb-2.5 flex justify-end">
                        <button
                          onClick={() => toggleFavorite(video.id)}
                          className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                          title={fav ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart className={clsx('h-4 w-4 transition-colors', fav ? 'fill-red-500 text-red-500' : 'text-gray-300 hover:text-red-400')} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Video watch + comment modal */}
      {selectedVideo && session && userName && (
        <VideoWatchView
          video={selectedVideo}
          sessionId={session.id}
          userName={userName}
          isFavorited={favorites.has(selectedVideo.id)}
          onFavoriteToggle={() => toggleFavorite(selectedVideo.id)}
          onNoteUpdated={handleNoteUpdated}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  )
}
