'use client'

import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'

interface Props {
  className?: string
  /** When true, input expands to fill available width */
  expand?: boolean
}

export default function GlobalSearchBar({ className, expand }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentQ = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(currentQ)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync input if q param changes (e.g. browser back/forward)
  useEffect(() => {
    setQuery(currentQ)
  }, [currentQ])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={clsx('relative flex items-center', className)}
    >
      <Search
        className="absolute left-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search…"
        aria-label="Search"
        className={clsx(
          'h-8 rounded-full border bg-gray-50 pl-8 pr-3 text-xs text-gray-800 placeholder-gray-400',
          'outline-none transition-all duration-200',
          expand
            ? 'w-full border-gray-200 hover:border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-300 focus:bg-white'
            : focused
              ? 'w-64 border-blue-400 ring-1 ring-blue-300 bg-white'
              : 'w-48 border-gray-200 hover:border-gray-300',
        )}
      />
    </form>
  )
}
