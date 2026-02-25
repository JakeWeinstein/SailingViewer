'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Plus, Trash2, ArrowUp, ArrowDown, Save, Eye, EyeOff,
  FileText, Film, Loader2, ChevronDown
} from 'lucide-react'
import type { Article, ArticleBlock, ReferenceVideo } from '@/lib/types'
import { youtubeThumbnailUrl, thumbnailUrl } from '@/lib/types'
import clsx from 'clsx'

interface Props {
  article: Article | null  // null = creating new
  userName: string
  onSaved: (article: Article) => void
  onCancel: () => void
}

export default function ArticleEditor({ article, userName, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(article?.title ?? '')
  const [blocks, setBlocks] = useState<ArticleBlock[]>(article?.blocks ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewBlock, setPreviewBlock] = useState<number | null>(null)

  // Reference video picker state
  const [refVideos, setRefVideos] = useState<ReferenceVideo[]>([])
  const [refLoading, setRefLoading] = useState(false)
  const [videoPickerFor, setVideoPickerFor] = useState<number | null>(null)
  const [videoSearch, setVideoSearch] = useState('')

  useEffect(() => {
    if (refVideos.length === 0) {
      setRefLoading(true)
      fetch('/api/reference-videos')
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setRefVideos(data) })
        .finally(() => setRefLoading(false))
    }
  }, [refVideos.length])

  function addTextBlock() {
    setBlocks((prev) => [...prev, { type: 'text', content: '' }])
  }

  function addVideoBlock() {
    setBlocks((prev) => [...prev, { type: 'video', referenceVideoId: '', caption: '' }])
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
    const swapIdx = dir === 'up' ? i - 1 : i + 1
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[i], next[swapIdx]] = [next[swapIdx], next[i]]
    setBlocks(next)
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
          body: JSON.stringify({ title, blocks, ...(publish !== undefined ? { is_published: publish } : {}) }),
        })
      } else {
        res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, blocks }),
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

  const filteredRefVideos = refVideos.filter((v) =>
    !videoSearch || v.title.toLowerCase().includes(videoSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            {article ? 'Edit article' : 'New article'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">By {userName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

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

      {/* Blocks */}
      <div className="space-y-4">
        {blocks.map((block, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Block toolbar */}
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

            {/* Block content */}
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
                    placeholder="Write markdown content… (supports **bold**, _italic_, # headings, - lists)"
                    rows={6}
                    className="w-full resize-y text-sm text-gray-700 focus:outline-none font-mono leading-relaxed"
                  />
                )
              )}

              {block.type === 'video' && (
                <div className="space-y-3">
                  {block.referenceVideoId ? (
                    (() => {
                      const vid = refVideos.find((v) => v.id === block.referenceVideoId)
                      return (
                        <div className="flex items-center gap-3">
                          {vid && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={vid.type === 'youtube' ? youtubeThumbnailUrl(vid.video_ref) : thumbnailUrl(vid.video_ref)}
                              alt={vid.title}
                              className="h-14 w-24 object-cover rounded-lg shrink-0 bg-gray-100"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{vid?.title ?? 'Unknown video'}</p>
                            <button
                              onClick={() => { updateBlock(i, { referenceVideoId: '' } as Partial<ArticleBlock>); setVideoPickerFor(null) }}
                              className="text-xs text-red-500 hover:underline mt-0.5"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <div>
                      {videoPickerFor === i ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={videoSearch}
                            onChange={(e) => setVideoSearch(e.target.value)}
                            placeholder="Search reference videos…"
                            autoFocus
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {refLoading && <p className="text-xs text-gray-400">Loading…</p>}
                          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                            {filteredRefVideos.length === 0 && !refLoading && (
                              <p className="text-xs text-gray-400 italic p-3">No videos found.</p>
                            )}
                            {filteredRefVideos.map((v) => (
                              <button
                                key={v.id}
                                onClick={() => { updateBlock(i, { referenceVideoId: v.id } as Partial<ArticleBlock>); setVideoPickerFor(null); setVideoSearch('') }}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={v.type === 'youtube' ? youtubeThumbnailUrl(v.video_ref) : thumbnailUrl(v.video_ref)}
                                  alt={v.title}
                                  className="h-10 w-16 object-cover rounded shrink-0 bg-gray-100"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                                <span className="text-sm text-gray-700 truncate">{v.title}</span>
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setVideoPickerFor(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setVideoPickerFor(i)}
                          className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                        >
                          <Film className="h-4 w-4" />
                          Pick a reference video
                        </button>
                      )}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Caption (optional)</label>
                    <input
                      type="text"
                      value={(block as { type: 'video'; referenceVideoId: string; caption?: string }).caption ?? ''}
                      onChange={(e) => updateBlock(i, { caption: e.target.value } as Partial<ArticleBlock>)}
                      placeholder="Caption shown below video…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add block buttons */}
      <div className="flex gap-3">
        <button
          onClick={addTextBlock}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <FileText className="h-4 w-4" />
          Add text block
        </button>
        <button
          onClick={addVideoBlock}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <Film className="h-4 w-4" />
          Add video block
        </button>
      </div>
    </div>
  )
}
