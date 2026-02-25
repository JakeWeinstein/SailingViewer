'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { embedUrl, youtubeEmbedUrl, type ReferenceVideo } from '@/lib/types'
import type { Article, ArticleBlock } from '@/lib/types'

interface Props {
  article: Article
}

function VideoBlock({ block }: { block: ArticleBlock & { type: 'video' } }) {
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

  if (loading) return <div className="aspect-video bg-gray-100 rounded-xl animate-pulse" />
  if (!video) return (
    <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">
      Video not found
    </div>
  )

  const src = video.type === 'youtube'
    ? youtubeEmbedUrl(video.video_ref, video.note_timestamp)
    : embedUrl(video.video_ref)

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
          </div>
        ))}
      </div>
    </article>
  )
}
