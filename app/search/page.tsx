import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SearchResults from '@/components/SearchResults'
import GlobalSearchBar from '@/components/GlobalSearchBar'

export const metadata = {
  title: 'Search — Telltale',
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky search header */}
      <div className="sticky top-0 z-10 bg-gray-50 pt-6 pb-4 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 bg-white hover:bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-full transition-colors shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
            <Suspense fallback={null}>
              <GlobalSearchBar className="flex flex-1" expand />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <Suspense fallback={<div className="text-sm text-gray-400">Loading...</div>}>
          <SearchResults />
        </Suspense>
      </div>
    </div>
  )
}
