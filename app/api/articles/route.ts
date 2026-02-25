import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'

// GET /api/articles — public returns published; auth + ?drafts=true returns own drafts too
export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  const showDrafts = req.nextUrl.searchParams.get('drafts') === 'true'

  let query = supabase.from('articles').select('*').order('updated_at', { ascending: false })

  if (!payload || !showDrafts) {
    query = query.eq('is_published', true)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/articles — auth required; creates draft
export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, blocks, folder_id } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('articles')
    .insert({
      title: title.trim(),
      author_id: payload.userId ?? null,
      author_name: payload.userName ?? 'Unknown',
      blocks: blocks ?? [],
      is_published: false,
      folder_id: folder_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
