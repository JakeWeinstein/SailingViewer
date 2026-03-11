import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import { CreateBookmarkSchema } from '@/lib/schemas/bookmarks'

// GET /api/bookmarks — auth required
// Returns the authenticated user's bookmarks, newest first
export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload || !payload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', payload.userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/bookmarks — auth required
// Body: CreateBookmarkSchema
// Returns 201 on success, 409 on duplicate (same user+video+timestamp)
export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload || !payload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = CreateBookmarkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { video_id, session_id, timestamp_seconds, video_title } = parsed.data

  const { data, error } = await supabase
    .from('bookmarks')
    .insert({
      user_id: payload.userId,
      video_id,
      session_id: session_id ?? null,
      timestamp_seconds,
      video_title: video_title ?? null,
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation (duplicate bookmark)
    if (error.code === '23505' || error.message?.includes('unique')) {
      return NextResponse.json({ error: 'Bookmark already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
