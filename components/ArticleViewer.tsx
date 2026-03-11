'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { youtubeEmbedUrl, formatTime, type ReferenceVideo } from '@/lib/types'
import type { Article, ArticleBlock } from '@/lib/types'

interface Props {
  article: Article
}

function VideoBlock({ block }: { block: ArticleBlock & { type: 'video' } }) {
  // Self-contained block — render directly without any fetch
  if (block.videoRef && block.videoType) {
    const src = youtubeEmbedUrl(block.videoRef, block.startSeconds)

    return (
      <div className="my-4">
        <div className="aspect-video rounded-xl overflow-hidden shadow-sm border border-gray-100">
          <iframe
            src={src}
            className="w-full h-full"
            allow="autoplay"
            allowFullScreen
            title={block.title ?? 'Video'}
          />
        </div>
        {(block.caption ?? block.title) && (
          <p className="text-xs text-gray-500 mt-2 text-center font-medium">
            {block.caption ?? block.title}
          </p>
        )}
      </div>
    )
  }

  // Legacy block — look up reference video by id
  if (block.referenceVideoId) {
    return <LegacyVideoBlock block={block} />
  }

  return (
    <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm my-4">
      Video not available
    </div>
  )
}

function LegacyVideoBlock({ block }: { block: ArticleBlock & { type: 'video' } }) {
  const [video, setVideo] = useState<ReferenceVideo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reference-videos')
      .then((r) => r.json())
      .then((data: ReferenceVideo[]) => {
        if (Array.isArray(data)) {
          setVideo(data.find((v) => v.id === block.referenceVideoId) ?? null)
        }
      })
      .finally(() => setLoading(false))
  }, [block.referenceVideoId])

  if (loading) return <div className="aspect-video bg-gray-100 rounded-xl animate-pulse my-4" />
  if (!video) return (
    <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm my-4">
      Video not found
    </div>
  )

  const src = youtubeEmbedUrl(video.video_ref, block.startSeconds ?? video.note_timestamp)

  return (
    <div className="my-4">
      <div className="aspect-video rounded-xl overflow-hidden shadow-sm border border-gray-100">
        <iframe
          src={src}
          className="w-full h-full"
          allow="autoplay"
          allowFullScreen
          title={video.title}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center font-medium">
        {block.caption ?? video.title}
      </p>
    </div>
  )
}

function ImageBlock({ block }: { block: ArticleBlock & { type: 'image' } }) {
  const [errored, setErrored] = useState(false)

  return (
    <figure className="my-4">
      {errored ? (
        <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">
          Image could not be loaded
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.url}
          alt={block.alt ?? ''}
          onError={() => setErrored(true)}
          className="w-full rounded-xl shadow-sm border border-gray-100 object-contain max-h-[480px]"
        />
      )}
      {block.caption && (
        <figcaption className="text-xs text-gray-500 mt-2 text-center font-medium">
          {block.caption}
        </figcaption>
      )}
    </figure>
  )
}

function ClipBlock({ block }: { block: ArticleBlock & { type: 'clip' } }) {
  // Build embed URL with start and optional end
  let src = `https://www.youtube.com/embed/${block.videoRef}?start=${block.startSeconds}`
  if (block.endSeconds != null) src += `&end=${block.endSeconds}`

  const timeRange = block.endSeconds != null
    ? `${formatTime(block.startSeconds)} - ${formatTime(block.endSeconds)}`
    : formatTime(block.startSeconds)

  return (
    <div className="my-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
          {timeRange}
        </span>
        {block.title && (
          <span className="text-xs text-gray-500 font-medium">{block.title}</span>
        )}
      </div>
      <div className="aspect-video rounded-xl overflow-hidden shadow-sm border border-gray-100">
        <iframe
          src={src}
          className="w-full h-full"
          allow="autoplay"
          allowFullScreen
          title={block.title ?? `Clip at ${timeRange}`}
        />
      </div>
      {block.caption && (
        <p className="text-xs text-gray-500 mt-2 text-center font-medium">{block.caption}</p>
      )}
    </div>
  )
}

export default function ArticleViewer({ article }: Props) {
  return (
    <article className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{article.title}</h1>
        <p className="text-sm text-gray-400">By {article.author_name}</p>
      </header>
      <div className="space-y-4">
        {article.blocks.map((block, i) => (
          <div key={i}>
            {block.type === 'text' && (
              <div className="prose prose-sm prose-gray max-w-none">
                <ReactMarkdown>{block.content}</ReactMarkdown>
              </div>
            )}
            {block.type === 'video' && <VideoBlock block={block} />}
            {block.type === 'image' && <ImageBlock block={block} />}
            {block.type === 'clip' && <ClipBlock block={block} />}
            {/* Unknown block types are silently skipped */}
          </div>
        ))}
      </div>
    </article>
  )
}
