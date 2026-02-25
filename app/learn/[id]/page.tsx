import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArticleViewer from '@/components/ArticleViewer'
import type { Article } from '@/lib/types'
import { Anchor } from 'lucide-react'
import Link from 'next/link'

export default async function LearnArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (error || !data) notFound()

  const article = data as Article

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Anchor className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">Telltale</span>
          </Link>
          <span className="text-gray-300">/</span>
          <Link href="/?view=learn" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Learn
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-700 truncate">{article.title}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <ArticleViewer article={article} />
      </main>
    </div>
  )
}
