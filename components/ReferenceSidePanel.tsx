'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, FolderOpen, ChevronDown, ChevronRight, Play, BookOpen } from 'lucide-react'
import { onYouTubeReady } from '@/lib/youtube-api'
import type { ReferenceVideo, ReferenceFolder } from '@/lib/types'
import { youtubeEmbedUrl, formatTime } from '@/lib/types'
import clsx from 'clsx'

interface ReferenceSidePanelProps {
  isOpen: boolean
  onClose: () => void
}

interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  loadVideoById: (videoId: string, startSeconds?: number) => void
  destroy: () => void
}

export default function ReferenceSidePanel({ isOpen, onClose }: ReferenceSidePanelProps) {
  const [videos, setVideos] = useState<ReferenceVideo[]>([])
  const [folders, setFolders] = useState<ReferenceFolder[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVideo, setSelectedVideo] = useState<ReferenceVideo | null>(null)

  const playerRef = useRef<YTPlayer | null>(null)
  const playerDivId = selectedVideo ? `ref-player-${selectedVideo.id}` : 'ref-player-none'

  // Fetch data on open (not on mount)
  useEffect(() => {
    if (!isOpen || fetched) return
    setLoading(true)
    Promise.all([
      fetch('/api/reference-videos').then((r) => r.json()),
      fetch('/api/reference-folders').then((r) => r.json()),
    ]).then(([vids, flds]) => {
      if (Array.isArray(vids)) setVideos(vids)
      if (Array.isArray(flds)) setFolders(flds)
      setFetched(true)
    }).finally(() => setLoading(false))
  }, [isOpen, fetched])

  // Initialize YouTube player when a video is selected
  useEffect(() => {
    if (!selectedVideo) return

    // Destroy previous player if any
    if (playerRef.current) {
      try { playerRef.current.destroy() } catch { /* ignore */ }
      playerRef.current = null
    }

    const videoId = selectedVideo.video_ref
    const startSeconds = selectedVideo.start_seconds ?? undefined

    onYouTubeReady(() => {
      if (typeof window === 'undefined' || !window.YT?.Player) return
      playerRef.current = new window.YT.Player(playerDivId, {
        videoId,
        playerVars: {
          autoplay: 0,
          start: startSeconds ?? 0,
          playsinline: 1,
        },
        events: {
          onReady: (event: { target: YTPlayer }) => {
            if (startSeconds) {
              event.target.seekTo(startSeconds, true)
            }
          },
        },
      })
    })

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
        playerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideo?.id])

  function seekToChapter(startSeconds: number) {
    if (playerRef.current) {
      playerRef.current.seekTo(startSeconds, true)
    }
  }

  // Get chapters for a video
  const getChapters = useCallback(
    (sourceId: string) =>
      videos
        .filter((v) => v.parent_video_id === sourceId)
        .sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0)),
    [videos]
  )

  // Filter videos by search query
  const filteredVideos = searchQuery
    ? videos.filter(
        (v) =>
          v.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !v.parent_video_id // only top-level
      )
    : videos.filter((v) => !v.parent_video_id)

  // Folder helpers
  const topFolders = folders.filter((f) => !f.parent_id).sort((a, b) => a.sort_order - b.sort_order)
  const getSubFolders = (pid: string) =>
    folders.filter((f) => f.parent_id === pid).sort((a, b) => a.sort_order - b.sort_order)
  const getVideosInFolder = (fid: string) =>
    filteredVideos.filter((v) => v.folder_id === fid)
  const unfolderedVideos = filteredVideos.filter((v) => !v.folder_id)

  function VideoItem({ video }: { video: ReferenceVideo }) {
    const chapters = getChapters(video.id)
    const isSelected = selectedVideo?.id === video.id
    return (
      <div>
        <button
          onClick={() => setSelectedVideo(video)}
          className={clsx(
            'w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            isSelected
              ? 'bg-blue-900/40 text-blue-300'
              : 'text-gray-300 hover:bg-gray-800'
          )}
        >
          <Play className="h-3.5 w-3.5 shrink-0 text-gray-500" />
          <span className="truncate flex-1">{video.title}</span>
          {chapters.length > 0 && (
            <span className="text-xs text-gray-500 shrink-0">{chapters.length}ch</span>
          )}
        </button>
      </div>
    )
  }

  function FolderSection({ folder, depth = 0 }: { folder: ReferenceFolder; depth?: number }) {
    const [open, setOpen] = useState(false)
    const subFolders = getSubFolders(folder.id)
    const folderVideos = getVideosInFolder(folder.id)
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
              <FolderSection key={sf.id} folder={sf} depth={depth + 1} />
            ))}
            {folderVideos.map((v) => (
              <VideoItem key={v.id} video={v} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Chapters for selected video
  const selectedChapters = selectedVideo ? getChapters(selectedVideo.id) : []

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={clsx(
          'fixed top-0 right-0 h-full w-[450px] max-w-full bg-gray-900 border-l border-gray-800 z-50',
          'flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Panel header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
          <BookOpen className="h-5 w-5 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white flex-1">Reference Library</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-800 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos…"
              className="w-full bg-gray-800 text-sm text-gray-200 placeholder-gray-500 pl-8 pr-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content split: folder browser + player */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* Video player area */}
          {selectedVideo && (
            <div className="shrink-0 border-b border-gray-800">
              <div className="aspect-video bg-black">
                <div id={playerDivId} className="w-full h-full" />
              </div>
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-gray-200 truncate">{selectedVideo.title}</p>
              </div>
              {/* Chapters */}
              {selectedChapters.length > 0 && (
                <div className="px-3 pb-2 space-y-0.5 max-h-36 overflow-y-auto">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Chapters</p>
                  {selectedChapters.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => seekToChapter(ch.start_seconds ?? 0)}
                      className="w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                    >
                      <span className="font-mono text-blue-400 shrink-0">
                        {formatTime(ch.start_seconds ?? 0)}
                      </span>
                      <span className="truncate">{ch.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Folder browser */}
          <div className="flex-1 overflow-y-auto py-2 px-1">
            {loading && (
              <p className="text-center text-gray-500 text-sm py-8">Loading…</p>
            )}
            {!loading && videos.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">No reference videos</p>
            )}
            {!loading && (
              <div className="space-y-1">
                {topFolders.map((folder) => (
                  <FolderSection key={folder.id} folder={folder} />
                ))}
                {unfolderedVideos.length > 0 && (
                  <div>
                    {topFolders.length > 0 && (
                      <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unfoldered</p>
                    )}
                    <div className="space-y-0.5">
                      {unfolderedVideos.map((v) => (
                        <VideoItem key={v.id} video={v} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
