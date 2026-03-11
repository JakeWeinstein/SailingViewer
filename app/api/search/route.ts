import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { SearchQuerySchema } from '@/lib/schemas/comments'

// GET /api/search?q=term&limit=20 — public, no auth required
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const rawQuery = {
    q: searchParams.get('q') ?? '',
    limit: searchParams.get('limit') ?? undefined,
  }

  const parsed = SearchQuerySchema.safeParse(rawQuery)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query params', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { q, limit } = parsed.data

  const { data, error } = await supabase.rpc('search_all', {
    search_query: q,
    result_limit: limit,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
