'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Trash2, ArrowUp, ArrowDown, Save,
  Eye, EyeOff, FileText, Film, Loader2, Clock, Youtube, Image, Scissors, GripVertical,
} from 'lucide-react'
import type { Article, ArticleBlock, ReferenceVideo, ReferenceFolder } from '@/lib/types'
import type { SessionVideo } from '@/lib/types'
import { youtubeThumbnailUrl, extractYouTubeInfo, parseTimestamp, formatTime } from '@/lib/types'
import MentionTextarea, { type MentionUser } from '@/components/MentionTextarea'
import clsx from 'clsx'

// ─── Internal types ───────────────────────────────────────────────────────────

/** ArticleBlock with a stable client-side ID for drag-and-drop keying. Stripped before saving. */
type ArticleBlockWithId = ArticleBlock & { _id: string }

interface BrowseSession { id: string; label: string; videos: SessionVideo[] }

type VideoBlock = Extract<ArticleBlock, { type: 'video' }>
type ImageBlock = Extract<ArticleBlock, { type: 'image' }>
type ClipBlock = Extract<ArticleBlock, { type: 'clip' }>

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  article: Article | null
  userName: string
  folders?: ReferenceFolder[]
  users?: MentionUser[]
  onSaved: (article: Article) => void
  onCancel: () => void
}

// ─── Sortable block wrapper ───────────────────────────────────────────────────

function SortableBlock({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="absolute left-0 top-0 bottom-0 flex items-center px-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing z-10"
        style={{ width: 24 }}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div style={{ paddingLeft: 24 }}>
        {children}
      </div>
    </div>
  )
}

// ─── Block type editors ───────────────────────────────────────────────────────

function TextBlockEditor({
  block, i, previewBlock, setPreviewBlock, updateBlock, users,
}: {
  block: Extract<ArticleBlockWithId, { type: 'text' }>
  i: number
  previewBlock: number | null
  setPreviewBlock: (n: number | null) => void
  updateBlock: (i: number, patch: Partial<ArticleBlock>) => void
  users?: MentionUser[]
}) {
  return (
    <>
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-50 bg-gray-50 rounded-t-xl">
        <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
          <FileText className="h-3 w-3" />Text
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setPreviewBlock(previewBlock === i ? null : i)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-600 rounded transition-colors"
        >
          {previewBlock === i ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {previewBlock === i ? 'Edit' : 'Preview'}
        </button>
      </div>
      <div className="p-4">
        {previewBlock === i ? (
          <div className="prose prose-sm prose-gray max-w-none min-h-[80px]">
            {block.content ? (
              <ReactMarkdown>{block.content}</ReactMarkdown>
            ) : (
              <p className="text-gray-300 italic">Nothing to preview yet.</p>
            )}
          </div>
        ) : (
          <MentionTextarea
            value={block.content}
            onChange={(val) => updateBlock(i, { content: val })}
            users={users ?? []}
            autoResize
            placeholder="Write markdown… (**bold**, _italic_, # heading, - list) Use @ to mention team members"
            rows={4}
            className="w-full resize-none text-sm text-gray-700 focus:outline-none font-mono leading-relaxed min-h-[80px]"
          />
        )}
      </div>
    </>
  )
}

function VideoBlockEditor({
  block, i, updateBlock,
  refVideos, refLoading, practiceSessions, practiceLoading,
  videoPickerFor, setVideoPickerFor, videoPickerTab, setVideoPickerTab,
  videoSearch, setVideoSearch, filteredRef, filteredPractice,
}: {
  block: VideoBlock
  i: number
  updateBlock: (i: number, patch: Partial<ArticleBlock>) => void
  refVideos: ReferenceVideo[]
  refLoading: boolean
  practiceSessions: BrowseSession[]
  practiceLoading: boolean
  videoPickerFor: number | null
  setVideoPickerFor: (n: number | null) => void
  videoPickerTab: 'reference' | 'practice'
  setVideoPickerTab: (t: 'reference' | 'practice') => void
  videoSearch: string
  setVideoSearch: (s: string) => void
  filteredRef: ReferenceVideo[]
  filteredPractice: { video: SessionVideo; sessionLabel: string }[]
}) {
  const hasVideo = !!(block.videoRef || block.referenceVideoId)
  const startRaw = block.startSeconds != null ? formatTime(block.startSeconds) : ''
  const [tsRaw, setTsRaw] = useState(startRaw)
  const tsInvalid = tsRaw.trim() !== '' && parseTimestamp(tsRaw) === null

  function commitTs(raw: string) {
    const parsed = parseTimestamp(raw)
    updateBlock(i, { startSeconds: parsed ?? undefined } as Partial<ArticleBlock>)
  }

  function pickRefVideo(v: ReferenceVideo) {
    updateBlock(i, {
      type: 'video', videoType: 'youtube',
      videoRef: v.video_ref, title: v.title, referenceVideoId: v.id,
    } as Partial<ArticleBlock>)
    setVideoPickerFor(null)
    setVideoSearch('')
  }

  function pickPracticeVideo(v: SessionVideo) {
    updateBlock(i, {
      type: 'video', videoType: 'youtube',
      videoRef: v.id, title: v.name, referenceVideoId: undefined,
    } as Partial<ArticleBlock>)
    setVideoPickerFor(null)
    setVideoSearch('')
  }

  return (
    <>
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-50 bg-gray-50 rounded-t-xl">
        <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
          <Film className="h-3 w-3" />Video
        </span>
        <div className="flex-1" />
      </div>
      <div className="p-4 space-y-3">
        {hasVideo ? (
          <div className="flex items-center gap-3">
            {block.videoType && block.videoRef && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={youtubeThumbnailUrl(block.videoRef)}
                alt={block.title ?? ''}
                className="h-14 w-24 object-cover rounded-lg shrink-0 bg-gray-100"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Youtube className="h-3.5 w-3.5 text-red-500 shrink-0" />
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
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {(['reference', 'practice'] as const).map((tab) => (
                  <button key={tab} onClick={() => { setVideoPickerTab(tab); setVideoSearch('') }}
                    className={clsx('px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                      videoPickerTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    )}>
                    {tab === 'reference' ? 'Reference library' : 'Practice sessions'}
                  </button>
                ))}
              </div>
              <input type="text" value={videoSearch} onChange={(e) => setVideoSearch(e.target.value)}
                placeholder="Search…" autoFocus
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {(refLoading || practiceLoading) && <p className="text-xs text-gray-400">Loading…</p>}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {videoPickerTab === 'reference' && filteredRef.map((v) => (
                  <button key={v.id} onClick={() => pickRefVideo(v)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={youtubeThumbnailUrl(v.video_ref)} alt={v.title} className="h-10 w-16 object-cover rounded shrink-0 bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <div className="min-w-0"><p className="text-sm text-gray-700 truncate">{v.title}</p><p className="text-xs text-gray-400">YouTube</p></div>
                  </button>
                ))}
                {videoPickerTab === 'practice' && filteredPractice.map(({ video, sessionLabel }) => (
                  <button key={video.id} onClick={() => pickPracticeVideo(video)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={youtubeThumbnailUrl(video.id)} alt={video.name} className="h-10 w-16 object-cover rounded shrink-0 bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <div className="min-w-0"><p className="text-sm text-gray-700 truncate">{video.name}</p><p className="text-xs text-gray-400">{sessionLabel}</p></div>
                  </button>
                ))}
                {videoPickerTab === 'reference' && filteredRef.length === 0 && !refLoading && <p className="text-xs text-gray-400 italic p-3">No reference videos found.</p>}
                {videoPickerTab === 'practice' && filteredPractice.length === 0 && !practiceLoading && <p className="text-xs text-gray-400 italic p-3">No practice videos found.</p>}
              </div>
              <button onClick={() => setVideoPickerFor(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <button onClick={() => { setVideoPickerFor(i); setVideoPickerTab('reference'); setVideoSearch('') }}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              <Film className="h-4 w-4" />Pick a video
            </button>
          )
        )}

        {hasVideo && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <input type="text" value={tsRaw} onChange={(e) => setTsRaw(e.target.value)} onBlur={(e) => commitTs(e.target.value)}
                placeholder="Start at (optional) — 1:23 or 83"
                className={clsx('flex-1 px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500',
                  tsInvalid ? 'border-red-300 bg-red-50' : 'border-gray-200')} />
            </div>
            {tsInvalid && <p className="text-xs text-red-500 pl-5">Use M:SS, H:MM:SS, or seconds</p>}
            {!tsInvalid && parseTimestamp(tsRaw) != null && <p className="text-xs text-blue-600 pl-5">Starts at {formatTime(parseTimestamp(tsRaw)!)}</p>}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Caption (optional)</label>
          <input type="text" value={block.caption ?? ''} onChange={(e) => updateBlock(i, { caption: e.target.value } as Partial<ArticleBlock>)}
            placeholder="Caption shown below video…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </>
  )
}

function ImageBlockEditor({ block, i, updateBlock }: {
  block: ImageBlock
  i: number
  updateBlock: (i: number, patch: Partial<ArticleBlock>) => void
}) {
  const [urlInput, setUrlInput] = useState(block.url ?? '')
  const [urlError, setUrlError] = useState('')
  const [imgErrored, setImgErrored] = useState(false)

  function commitUrl(val: string) {
    setImgErrored(false)
    if (!val.trim()) { updateBlock(i, { url: '' } as Partial<ArticleBlock>); return }
    try { new URL(val); setUrlError(''); updateBlock(i, { url: val.trim() } as Partial<ArticleBlock>) }
    catch { setUrlError('Enter a valid URL (https://…)') }
  }

  return (
    <>
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-50 bg-gray-50 rounded-t-xl">
        <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
          <Image className="h-3 w-3" />Image
        </span>
        <div className="flex-1" />
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Image URL</label>
          <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onBlur={(e) => commitUrl(e.target.value)}
            placeholder="Image URL (https://…)"
            className={clsx('w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
              urlError ? 'border-red-300 bg-red-50' : 'border-gray-200')} />
          {urlError && <p className="text-xs text-red-500">{urlError}</p>}
        </div>

        {block.url && !urlError && (
          <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center min-h-[120px]">
            {imgErrored ? (
              <p className="text-xs text-gray-400 italic p-4">Preview unavailable</p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={block.url} alt={block.alt ?? 'preview'} onError={() => setImgErrored(true)}
                className="max-h-48 max-w-full object-contain" />
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Alt text (optional)</label>
          <input type="text" value={block.alt ?? ''} onChange={(e) => updateBlock(i, { alt: e.target.value } as Partial<ArticleBlock>)}
            placeholder="Describe the image for screen readers…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Caption (optional)</label>
          <input type="text" value={block.caption ?? ''} onChange={(e) => updateBlock(i, { caption: e.target.value } as Partial<ArticleBlock>)}
            placeholder="Caption shown below image…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </>
  )
}

function ClipBlockEditor({ block, i, updateBlock }: {
  block: ClipBlock
  i: number
  updateBlock: (i: number, patch: Partial<ArticleBlock>) => void
}) {
  const [videoInput, setVideoInput] = useState('')
  const [startRaw, setStartRaw] = useState(block.startSeconds != null ? formatTime(block.startSeconds) : '')
  const [endRaw, setEndRaw] = useState(block.endSeconds != null ? formatTime(block.endSeconds) : '')
  const startInvalid = startRaw.trim() !== '' && parseTimestamp(startRaw) === null
  const endInvalid = endRaw.trim() !== '' && parseTimestamp(endRaw) === null

  function commitVideo(val: string) {
    const info = extractYouTubeInfo(val.trim())
    if (info) {
      updateBlock(i, {
        videoRef: info.id,
        ...(info.startSeconds != null ? { startSeconds: info.startSeconds } : {}),
      } as Partial<ArticleBlock>)
      if (info.startSeconds != null) setStartRaw(formatTime(info.startSeconds))
    }
  }

  function commitStart(val: string) {
    const parsed = parseTimestamp(val)
    if (parsed != null) updateBlock(i, { startSeconds: parsed } as Partial<ArticleBlock>)
  }

  function commitEnd(val: string) {
    const parsed = parseTimestamp(val)
    updateBlock(i, { endSeconds: parsed ?? undefined } as Partial<ArticleBlock>)
  }

  const thumbnailId = block.videoRef || null

  return (
    <>
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-50 bg-gray-50 rounded-t-xl">
        <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
          <Scissors className="h-3 w-3" />Clip
        </span>
        <div className="flex-1" />
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">YouTube video URL or ID</label>
          <div className="flex gap-2">
            <input type="text" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} onBlur={(e) => commitVideo(e.target.value)}
              placeholder="YouTube video URL or ID"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {thumbnailId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={youtubeThumbnailUrl(thumbnailId)} alt=""
                className="h-10 w-16 object-cover rounded shrink-0 bg-gray-100"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            )}
          </div>
          {block.videoRef && <p className="text-xs text-green-600 font-mono">{block.videoRef}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Start time</label>
            <input type="text" value={startRaw} onChange={(e) => setStartRaw(e.target.value)} onBlur={(e) => commitStart(e.target.value)}
              placeholder="Start time e.g. 1:23"
              className={clsx('w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500',
                startInvalid ? 'border-red-300 bg-red-50' : 'border-gray-200')} />
            {startInvalid && <p className="text-xs text-red-500">Use M:SS or seconds</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">End time (optional)</label>
            <input type="text" value={endRaw} onChange={(e) => setEndRaw(e.target.value)} onBlur={(e) => commitEnd(e.target.value)}
              placeholder="e.g. 2:45"
              className={clsx('w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500',
                endInvalid ? 'border-red-300 bg-red-50' : 'border-gray-200')} />
            {endInvalid && <p className="text-xs text-red-500">Use M:SS or seconds</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Title (optional)</label>
          <input type="text" value={block.title ?? ''} onChange={(e) => updateBlock(i, { title: e.target.value } as Partial<ArticleBlock>)}
            placeholder="e.g. 'Mark rounds the gate'"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Caption (optional)</label>
          <input type="text" value={block.caption ?? ''} onChange={(e) => updateBlock(i, { caption: e.target.value } as Partial<ArticleBlock>)}
            placeholder="Caption shown below clip…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArticleEditor({ article, userName, folders = [], users = [], onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(article?.title ?? '')
  const [blocks, setBlocks] = useState<ArticleBlockWithId[]>(() =>
    (article?.blocks ?? []).map((b) => ({ ...b, _id: crypto.randomUUID() }))
  )
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

  // Video picker state
  const [videoPickerFor, setVideoPickerFor] = useState<number | null>(null)
  const [videoPickerTab, setVideoPickerTab] = useState<'reference' | 'practice'>('reference')
  const [videoSearch, setVideoSearch] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

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

  // ─── Block mutations ────────────────────────────────────────────────────────

  function addBlock(type: 'text' | 'video' | 'image' | 'clip') {
    const _id = crypto.randomUUID()
    setBlocks((prev) => {
      switch (type) {
        case 'text': return [...prev, { type: 'text', content: '', _id }]
        case 'video': return [...prev, { type: 'video', videoType: undefined, videoRef: '', title: '', caption: '', startSeconds: undefined, _id }]
        case 'image': return [...prev, { type: 'image', url: '', alt: '', caption: '', _id }]
        case 'clip': return [...prev, { type: 'clip', videoRef: '', startSeconds: 0, endSeconds: undefined, title: '', caption: '', _id }]
      }
    })
  }

  function updateBlock(i: number, patch: Partial<ArticleBlock>) {
    setBlocks((prev) => prev.map((b, idx) => idx === i ? { ...b, ...patch } as ArticleBlockWithId : b))
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBlocks((prev) => {
      const oldIdx = prev.findIndex((b) => b._id === active.id)
      const newIdx = prev.findIndex((b) => b._id === over.id)
      if (oldIdx === -1 || newIdx === -1) return prev
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  // ─── Save ───────────────────────────────────────────────────────────────────

  async function handleSave(publish?: boolean) {
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError('')
    // Strip _id from blocks before sending to API
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cleanBlocks: ArticleBlock[] = blocks.map(({ _id, ...rest }) => rest as ArticleBlock)
    try {
      let res: Response
      if (article) {
        res = await fetch(`/api/articles/${article.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title, blocks: cleanBlocks,
            folder_id: folderId || null,
            ...(publish !== undefined ? { is_published: publish } : {}),
          }),
        })
      } else {
        res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, blocks: cleanBlocks, folder_id: folderId || null }),
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

  // ─── Derived ────────────────────────────────────────────────────────────────

  const filteredRef = refVideos.filter((v) => !videoSearch || v.title.toLowerCase().includes(videoSearch.toLowerCase()))
  const filteredPractice = practiceSessions.flatMap((s) =>
    s.videos
      .filter((v) => !videoSearch || v.name.toLowerCase().includes(videoSearch.toLowerCase()))
      .map((v) => ({ video: v, sessionLabel: s.label }))
  )

  // ─── Render ─────────────────────────────────────────────────────────────────

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
          <button onClick={() => handleSave(false)} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {article?.is_published ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title…"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Folder */}
      {folders.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Folder (optional)</label>
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">— No folder —</option>
            {folders.filter((f) => !f.parent_id).map((f) => (
              <optgroup key={f.id} label={f.name}>
                <option value={f.id}>{f.name}</option>
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {/* Blocks — drag sortable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b._id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {blocks.map((block, i) => (
              <SortableBlock key={block._id} id={block._id}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Block-type toolbar + editor */}
                  {block.type === 'text' && (
                    <TextBlockEditor block={block as Extract<ArticleBlockWithId, { type: 'text' }>} i={i}
                      previewBlock={previewBlock} setPreviewBlock={setPreviewBlock} updateBlock={updateBlock} users={users} />
                  )}
                  {block.type === 'video' && (
                    <VideoBlockEditor block={block as VideoBlock} i={i} updateBlock={updateBlock}
                      refVideos={refVideos} refLoading={refLoading} practiceSessions={practiceSessions} practiceLoading={practiceLoading}
                      videoPickerFor={videoPickerFor} setVideoPickerFor={setVideoPickerFor}
                      videoPickerTab={videoPickerTab} setVideoPickerTab={setVideoPickerTab}
                      videoSearch={videoSearch} setVideoSearch={setVideoSearch}
                      filteredRef={filteredRef} filteredPractice={filteredPractice} />
                  )}
                  {block.type === 'image' && (
                    <ImageBlockEditor block={block as ImageBlock} i={i} updateBlock={updateBlock} />
                  )}
                  {block.type === 'clip' && (
                    <ClipBlockEditor block={block as ClipBlock} i={i} updateBlock={updateBlock} />
                  )}

                  {/* Per-block footer: arrow buttons (keyboard fallback) + delete */}
                  <div className="flex items-center gap-1 px-3 py-2 border-t border-gray-50 bg-gray-50 justify-end">
                    <button onClick={() => moveBlock(i, 'up')} disabled={i === 0} aria-label="Move block up"
                      className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 rounded">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => moveBlock(i, 'down')} disabled={i === blocks.length - 1} aria-label="Move block down"
                      className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 rounded">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeBlock(i)} aria-label="Delete block"
                      className="p-1 text-gray-300 hover:text-red-400 rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </SortableBlock>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add block buttons */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => addBlock('text')} aria-label="Add text block"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors">
          <Plus className="h-4 w-4" /><FileText className="h-4 w-4" />
          Add text block
        </button>
        <button onClick={() => addBlock('video')} aria-label="Add video block"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors">
          <Plus className="h-4 w-4" /><Film className="h-4 w-4" />
          Add video block
        </button>
        <button onClick={() => addBlock('image')} aria-label="Add image block"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors">
          <Plus className="h-4 w-4" /><Image className="h-4 w-4" />
          Add image block
        </button>
        <button onClick={() => addBlock('clip')} aria-label="Add clip block"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors">
          <Plus className="h-4 w-4" /><Scissors className="h-4 w-4" />
          Add clip block
        </button>
      </div>
    </div>
  )
}
