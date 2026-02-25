'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Plus, Trash2, ArrowUp, ArrowDown, Save,
  Eye, EyeOff, FileText, Film, Loader2, Clock, HardDrive, Youtube, X
} from 'lucide-react'
import type { Article, ArticleBlock, ReferenceVideo, ReferenceFolder } from '@/lib/types'
import type { SessionVideo } from '@/lib/types'
import { youtubeThumbnailUrl, thumbnailUrl } from '@/lib/types'
import clsx from 'clsx'

interface BrowseSession { id: string; label: string; videos: SessionVideo[] }

type VideoBlock = Extract<ArticleBlock, { type: 'video' }>

interface Props {
  article: Article | null
  userName: string
  folders?: ReferenceFolder[]
  onSaved: (article: Article) => void
  onCancel: () => void
}

function parseTs(raw: string): number | null {
  const hms = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  if (hms) return +hms[1] * 3600 + +hms[2] * 60 + +hms[3]
  const ms = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (ms && +ms[2] < 60) return +ms[1] * 60 + +ms[2]
  const secs = raw.match(/^(\d+)$/)
  if (secs) return +secs[1]
  return null
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function ArticleEditor({ article, userName, folders = [], onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(article?.title ?? '')
  const [blocks, setBlocks] = useState<ArticleBlock[]>(article?.blocks ?? [])
  const [folderId, setFolderId] = useState<string>(article?.folder_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewBlock, setPreviewBlock] = useState<number | null>(null)

  // Reference video library
  const [refVideos, setRefVideos] = useState<ReferenceVideo[]>([])
  const [refLoading, setRefLoading] = useState(false)
  // Practice sessions
  const [practiceSessions, setPracticeSessions] = useState<BrowseSession[]>([])
  const [practiceLoading, setPracticeLoading] = useState(false)

  // Video picker state per block
  const [videoPickerFor, setVideoPickerFor] = useState<number | null>(null)
  const [videoPickerTab, setVideoPickerTab] = useState<'reference' | 'practice'>('reference')
  const [videoSearch, setVideoSearch] = useState('')

  useEffect(() => {
    if (refVideos.length === 0) {
      setRefLoading(true)
      fetch('/api/reference-videos').then((r) => r.json())
        .then((d) => { if (Array.isArray(d)) setRefVideos(d) })
        .finally(() => setRefLoading(false))
    }
  }, [refVideos.length])

  useEffect(() => {
    if (videoPickerTab === 'practice' && practiceSessions.length === 0) {
      setPracticeLoading(true)
      fetch('/api/sessions/browse').then((r) => r.json())
        .then((d) => { if (Array.isArray(d)) setPracticeSessions(d) })
        .finally(() => setPracticeLoading(false))
    }
  }, [videoPickerTab, practiceSessions.length])

  function addTextBlock() {
    setBlocks((prev) => [...prev, { type: 'text', content: '' }])
  }

  function addVideoBlock() {
    setBlocks((prev) => [...prev, { type: 'video', videoType: undefined, videoRef: '', title: '', caption: '', startSeconds: undefined }])
  }

  function updateBlock(i: number, patch: Partial<ArticleBlock>) {
    setBlocks((prev) => prev.map((b, idx) => idx === i ? { ...b, ...patch } as ArticleBlock : b))
  }

  function removeBlock(i: number) {
    setBlocks((prev) => prev.filter((_, idx) => idx !== i))
    if (previewBlock === i) setPreviewBlock(null)
  }

  function moveBlock(i: number, dir: 'up' | 'down') {
    const next = [...blocks]
    const swap = dir === 'up' ? i - 1 : i + 1
    if (swap < 0 || swap >= next.length) return;
    [next[i], next[swap]] = [next[swap], next[i]]
    setBlocks(next)
  }

  function pickRefVideo(i: number, v: ReferenceVideo) {
    updateBlock(i, {
      type: 'video',
      videoType: v.type,
      videoRef: v.video_ref,
      title: v.title,
      referenceVideoId: v.id,
    } as Partial<ArticleBlock>)
    setVideoPickerFor(null)
    setVideoSearch('')
  }

  function pickPracticeVideo(i: number, v: SessionVideo) {
    updateBlock(i, {
      type: 'video',
      videoType: 'drive',
      videoRef: v.id,
      title: v.name,
      referenceVideoId: undefined,
    } as Partial<ArticleBlock>)
    setVideoPickerFor(null)
    setVideoSearch('')
  }

  async function handleSave(publish?: boolean) {
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError('')
    try {
      let res: Response
      if (article) {
        res = await fetch(`/api/articles/${article.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title, blocks,
            folder_id: folderId || null,
            ...(publish !== undefined ? { is_published: publish } : {}),
          }),
        })
      } else {
        res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, blocks, folder_id: folderId || null }),
        })
        if (res.ok && publish) {
          const created = await res.json()
          res = await fetch(`/api/articles/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_published: true }),
          })
        }
      }
      if (res.ok) {
        onSaved(await res.json())
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  const filteredRef = refVideos.filter((v) => !videoSearch || v.title.toLowerCase().includes(videoSearch.toLowerCase()))
  const filteredPractice = practiceSessions.flatMap((s) =>
    s.videos
      .filter((v) => !videoSearch || v.name.toLowerCase().includes(videoSearch.toLowerCase()))
      .map((v) => ({ video: v, sessionLabel: s.label }))
  )

  function VideoBlockContent({ block, i }: { block: VideoBlock; i: number }) {
    const hasVideo = !!(block.videoRef || block.referenceVideoId)
    const startRaw = block.startSeconds != null ? fmtTime(block.startSeconds) : ''
    const [tsRaw, setTsRaw] = useState(startRaw)
    const tsInvalid = tsRaw.trim() !== '' && parseTs(tsRaw) === null

    function commitTs(raw: string) {
      const parsed = parseTs(raw)
      updateBlock(i, { startSeconds: parsed ?? undefined } as Partial<ArticleBlock>)
    }

    return (
      <div className="space-y-3">
        {/* Video selection */}
        {hasVideo ? (
          <div className="flex items-center gap-3">
            {block.videoType && block.videoRef && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={block.videoType === 'youtube' ? youtubeThumbnailUrl(block.videoRef) : thumbnailUrl(block.videoRef)}
                alt={block.title ?? ''}
                className="h-14 w-24 object-cover rounded-lg shrink-0 bg-gray-100"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {block.videoType === 'youtube'
                  ? <Youtube className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  : <HardDrive className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                <p className="text-sm font-medium text-gray-800 truncate">{block.title ?? 'Video'}</p>
              </div>
              <button
                onClick={() => { updateBlock(i, { videoRef: '', title: '', referenceVideoId: undefined, startSeconds: undefined } as Partial<ArticleBlock>); setTsRaw('') }}
                className="text-xs text-red-500 hover:underline"
              >
                Change video
              </button>
            </div>
          </div>
        ) : (
          videoPickerFor === i ? (
            <div className="space-y-2">
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {(['reference', 'practice'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setVideoPickerTab(tab); setVideoSearch('') }}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                      videoPickerTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {tab === 'reference' ? 'Reference library' : 'Practice sessions'}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={videoSearch}
                onChange={(e) => setVideoSearch(e.target.value)}
                placeholder="Search…"
                autoFocus
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {(refLoading || practiceLoading) && <p className="text-xs text-gray-400">Loading…</p>}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {videoPickerTab === 'reference' && filteredRef.map((v) => (
                  <button key={v.id} onClick={() => pickRefVideo(i, v)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.type === 'youtube' ? youtubeThumbnailUrl(v.video_ref) : thumbnailUrl(v.video_ref)} alt={v.title}
                      className="h-10 w-16 object-cover rounded shrink-0 bg-gray-100"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700 truncate">{v.title}</p>
                      <p className="text-xs text-gray-400">{v.type === 'youtube' ? 'YouTube' : 'Drive'}</p>
                    </div>
                  </button>
                ))}
                {videoPickerTab === 'practice' && filteredPractice.map(({ video, sessionLabel }) => (
                  <button key={video.id} onClick={() => pickPracticeVideo(i, video)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnailUrl(video.id)} alt={video.name}
                      className="h-10 w-16 object-cover rounded shrink-0 bg-gray-100"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700 truncate">{video.name}</p>
                      <p className="text-xs text-gray-400">{sessionLabel}</p>
                    </div>
                  </button>
                ))}
                {videoPickerTab === 'reference' && filteredRef.length === 0 && !refLoading && (
                  <p className="text-xs text-gray-400 italic p-3">No reference videos found.</p>
                )}
                {videoPickerTab === 'practice' && filteredPractice.length === 0 && !practiceLoading && (
                  <p className="text-xs text-gray-400 italic p-3">No practice videos found.</p>
                )}
              </div>
              <button onClick={() => setVideoPickerFor(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setVideoPickerFor(i); setVideoPickerTab('reference'); setVideoSearch('') }}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Film className="h-4 w-4" />
              Pick a video
            </button>
          )
        )}

        {/* Start timestamp */}
        {hasVideo && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                value={tsRaw}
                onChange={(e) => setTsRaw(e.target.value)}
                onBlur={(e) => commitTs(e.target.value)}
                placeholder="Start at (optional) — 1:23 or 83"
                className={clsx(
                  'flex-1 px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500',
                  tsInvalid ? 'border-red-300 bg-red-50' : 'border-gray-200'
                )}
              />
            </div>
            {tsInvalid && <p className="text-xs text-red-500 pl-5">Use M:SS, H:MM:SS, or seconds</p>}
            {!tsInvalid && parseTs(tsRaw) != null && (
              <p className="text-xs text-blue-600 pl-5">Starts at {fmtTime(parseTs(tsRaw)!)}</p>
            )}
          </div>
        )}

        {/* Caption */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Caption (optional)</label>
          <input
            type="text"
            value={block.caption ?? ''}
            onChange={(e) => updateBlock(i, { caption: e.target.value } as Partial<ArticleBlock>)}
            placeholder="Caption shown below video…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{article ? 'Edit article' : 'New article'}</h2>
          <p className="text-xs text-gray-400 mt-0.5">By {userName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {article?.is_published ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title…"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Folder */}
      {folders.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Folder (optional)</label>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— No folder —</option>
            {folders.filter((f) => !f.parent_id).map((f) => (
              <optgroup key={f.id} label={f.name}>
                <option value={f.id}>{f.name}</option>
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {/* Blocks */}
      <div className="space-y-4">
        {blocks.map((block, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-50 bg-gray-50">
              <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                {block.type === 'text' ? <FileText className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                {block.type === 'text' ? 'Text' : 'Video'}
              </span>
              <div className="flex-1" />
              {block.type === 'text' && (
                <button
                  onClick={() => setPreviewBlock(previewBlock === i ? null : i)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-600 rounded transition-colors"
                >
                  {previewBlock === i ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {previewBlock === i ? 'Edit' : 'Preview'}
                </button>
              )}
              <button onClick={() => moveBlock(i, 'up')} disabled={i === 0} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 rounded">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => moveBlock(i, 'down')} disabled={i === blocks.length - 1} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 rounded">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => removeBlock(i)} className="p-1 text-gray-300 hover:text-red-400 rounded">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-4">
              {block.type === 'text' && (
                previewBlock === i ? (
                  <div className="prose prose-sm prose-gray max-w-none min-h-[80px]">
                    {block.content ? (
                      <ReactMarkdown>{block.content}</ReactMarkdown>
                    ) : (
                      <p className="text-gray-300 italic">Nothing to preview yet.</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={block.content}
                    onChange={(e) => updateBlock(i, { content: e.target.value })}
                    placeholder="Write markdown… (**bold**, _italic_, # heading, - list)"
                    rows={6}
                    className="w-full resize-y text-sm text-gray-700 focus:outline-none font-mono leading-relaxed"
                  />
                )
              )}
              {block.type === 'video' && (
                <VideoBlockContent block={block as VideoBlock} i={i} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add block */}
      <div className="flex gap-3">
        <button
          onClick={addTextBlock}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Plus className="h-4 w-4" /><FileText className="h-4 w-4" />
          Add text block
        </button>
        <button
          onClick={addVideoBlock}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Plus className="h-4 w-4" /><Film className="h-4 w-4" />
          Add video block
        </button>
      </div>
    </div>
  )
}
