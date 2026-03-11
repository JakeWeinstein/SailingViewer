'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Film, MessageSquare, FileText, HelpCircle, BookOpen, ChevronDown, ChevronUp, AlertCircle, Search, RefreshCw } from 'lucide-react'
import { timeAgo } from '@/lib/comment-utils'
import clsx from 'clsx'

interface SearchResult {
  id: string
  type: 'video' | 'comment' | 'article' | 'qa' | 'reference' | 'chapter'
  title: string
  snippet: string
  url_hint: string
  rank: number
  created_at: string
}

/** Display sections — chapters are merged into the reference section */
type SectionType = 'video' | 'reference' | 'comment' | 'article' | 'qa'

type ResultSection = {
  type: SectionType
  label: string
  icon: React.ReactNode
  results: SearchResult[]
}

const SECTION_ORDER: SectionType[] = ['video', 'reference', 'comment', 'article', 'qa']
const DEFAULT_SHOW = 5

function ResultCard({
  result,
  onClick,
}: {
  result: SearchResult
  onClick: () => void
}) {
  const iconMap: Record<SearchResult['type'], React.ReactNode> = {
    video: <Film className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />,
    reference: <BookOpen className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />,
    chapter: <BookOpen className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />,
    comment: <MessageSquare className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />,
    article: <FileText className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />,
    qa: <HelpCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />,
  }

  // Comments may have a timestamp prefix like "[1:30] text"
  const hasTimestamp = result.type === 'comment' && result.snippet.startsWith('[')
  const timestampMatch = hasTimestamp ? result.snippet.match(/^\[([^\]]+)\]/) : null
  const timestampLabel = timestampMatch ? timestampMatch[1] : null
  const snippetText = timestampLabel
    ? result.snippet.slice(timestampMatch![0].length).trim()
    : result.snippet

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors rounded-lg group"
    >
      {iconMap[result.type]}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700 transition-colors truncate">
            {result.title}
          </span>
          {timestampLabel && (
            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
              {timestampLabel}
            </span>
          )}
          {result.type === 'chapter' && (
            <span className="text-xs bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded shrink-0">
              Chapter
            </span>
          )}
        </div>
        {snippetText && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{snippetText}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{timeAgo(result.created_at)}</p>
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 animate-pulse">
      <div className="h-4 w-4 rounded bg-gray-200 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-3" />
      </div>
    </div>
  )
}

export default function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') ?? ''

  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<SectionType>>(new Set())

  const fetchResults = useCallback(async (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=40`)
      if (!res.ok) throw new Error(`Search failed: ${res.status}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  // Restore scroll position on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const scrollKey = `scroll:${window.location.pathname}${window.location.search}`
    const saved = sessionStorage.getItem(scrollKey)
    if (saved) {
      sessionStorage.removeItem(scrollKey)
      const pos = parseInt(saved, 10)
      // Small delay to allow content to render before scrolling
      setTimeout(() => window.scrollTo(0, pos), 50)
    }
  }, [])

  useEffect(() => {
    if (q) fetchResults(q)
    else setResults([])
  }, [q, fetchResults])

  function navigateToResult(url: string) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        `scroll:${window.location.pathname}${window.location.search}`,
        String(window.scrollY)
      )
    }
    router.push(url)
  }

  function getResultUrl(result: SearchResult): string {
    switch (result.type) {
      case 'video':
        // url_hint is session_id; id is video_id
        return `/?session=${result.url_hint}&video=${result.id}`
      case 'reference':
        // Navigate to reference tab; url_hint is reference video id
        return `/?view=reference&ref=${result.id}`
      case 'chapter':
        // Navigate to reference tab with parent video; url_hint is parent_video_id
        return `/?view=reference&ref=${result.url_hint}`
      case 'comment': {
        // url_hint is "session_id|video_id" pipe-separated
        const [sessionId, videoId] = result.url_hint.split('|')
        if (sessionId && videoId) {
          // Parse timestamp from snippet prefix like "[1:30] comment text"
          const tsMatch = result.snippet.match(/^\[(\d+):(\d{2})\]/)
          const seconds = tsMatch ? parseInt(tsMatch[1], 10) * 60 + parseInt(tsMatch[2], 10) : null
          return seconds !== null
            ? `/?session=${sessionId}&video=${videoId}&t=${seconds}`
            : `/?session=${sessionId}&video=${videoId}`
        }
        // Fallback if only session_id available
        return sessionId ? `/?session=${sessionId}` : '/'
      }
      case 'article':
        return `/learn/${result.id}`
      case 'qa':
        return `/?view=qa`
      default:
        return '/'
    }
  }

  function toggleSection(type: SectionType) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  const SECTION_CONFIG: Record<SectionType, { label: string; icon: React.ReactNode }> = {
    video: { label: 'Videos', icon: <Film className="h-4 w-4" /> },
    reference: { label: 'Reference Library', icon: <BookOpen className="h-4 w-4" /> },
    comment: { label: 'Comments', icon: <MessageSquare className="h-4 w-4" /> },
    article: { label: 'Articles', icon: <FileText className="h-4 w-4" /> },
    qa: { label: 'Q&A', icon: <HelpCircle className="h-4 w-4" /> },
  }

  // Build sections, merging 'chapter' results into the 'reference' section
  const sections: ResultSection[] = SECTION_ORDER
    .map((type) => ({
      type,
      label: SECTION_CONFIG[type].label,
      icon: SECTION_CONFIG[type].icon,
      results: type === 'reference'
        ? results.filter((r) => r.type === 'reference' || r.type === 'chapter')
        : results.filter((r) => r.type === type),
    }))
    .filter((s) => s.results.length > 0)

  // Empty query state
  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Search className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-600">Enter a search term</p>
        <p className="text-xs text-gray-400 mt-1">
          Find videos, comments, articles, and Q&A posts
        </p>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-gray-200 animate-pulse" />
              <div className="h-3.5 w-24 rounded bg-gray-200 animate-pulse" />
            </div>
            <div className="divide-y divide-gray-50">
              {[0, 1, 2].map((j) => <SkeletonCard key={j} />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
        <p className="text-sm font-medium text-red-600">{error}</p>
        <button
          onClick={() => fetchResults(q)}
          className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    )
  }

  // Empty results
  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Search className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-600">No results found for &ldquo;{q}&rdquo;</p>
        <p className="text-xs text-gray-400 mt-1">Try different keywords</p>
      </div>
    )
  }

  // Results
  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-400">
        {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
      </p>
      {sections.map((section) => {
        const isExpanded = expandedSections.has(section.type)
        const shown = isExpanded ? section.results : section.results.slice(0, DEFAULT_SHOW)
        const hasMore = section.results.length > DEFAULT_SHOW

        return (
          <div key={section.type} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Section header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'p-1 rounded-md',
                  section.type === 'video' && 'bg-blue-50 text-blue-500',
                  section.type === 'reference' && 'bg-teal-50 text-teal-500',
                  section.type === 'comment' && 'bg-green-50 text-green-500',
                  section.type === 'article' && 'bg-purple-50 text-purple-500',
                  section.type === 'qa' && 'bg-amber-50 text-amber-500',
                )}>
                  {section.icon}
                </span>
                <span className="text-sm font-semibold text-gray-800">{section.label}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {section.results.length}
                </span>
              </div>
            </div>

            {/* Result list */}
            <div className="divide-y divide-gray-50">
              {shown.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  onClick={() => navigateToResult(getResultUrl(result))}
                />
              ))}
            </div>

            {/* Show more / less */}
            {hasMore && (
              <div className="px-4 py-2 border-t border-gray-50">
                <button
                  onClick={() => toggleSection(section.type)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Show {section.results.length - DEFAULT_SHOW} more
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
