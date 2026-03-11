import { Suspense } from 'react'
import SearchResults from '@/components/SearchResults'

export const metadata = {
  title: 'Search — Telltale',
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Search Results</h1>
        <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
          <SearchResults />
        </Suspense>
      </div>
    </div>
  )
}
