import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import { MarkReadSchema } from '@/lib/schemas/notifications'

// GET /api/notifications — auth required
// ?countOnly=true returns { unread: number }
// Otherwise returns last 30 notifications with deep-link data
export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload || !payload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const countOnly = searchParams.get('countOnly') === 'true'

  if (countOnly) {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', payload.userId)
      .eq('is_read', false)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ unread: count ?? 0 })
  }

  // Full notification list — last 30, ordered newest first
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', payload.userId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!notifications || notifications.length === 0) return NextResponse.json([])

  // Enrich each notification with deep-link data from the source comment
  const sourceIds = notifications.map((n: { source_id: string }) => n.source_id)
  const { data: comments } = await supabase
    .from('comments')
    .select('id, video_id, session_id, parent_id, comment_text, author_name')
    .in('id', sourceIds)

  const commentMap = new Map<string, {
    id: string
    video_id: string | null
    session_id: string | null
    parent_id: string | null
    comment_text: string
    author_name: string
  }>()
  if (comments) {
    for (const c of comments) commentMap.set(c.id, c)
  }

  const enriched = notifications.map((n: {
    id: string
    user_id: string
    type: string
    source_id: string
    is_read: boolean
    created_at: string
  }) => {
    const source = commentMap.get(n.source_id)
    let link: string | null = null

    if (source) {
      if (source.video_id) {
        link = `/?video=${source.video_id}&session=${source.session_id}&comment=${source.id}`
      } else {
        link = `/?view=qa&post=${source.parent_id ?? source.id}`
      }
    }

    return {
      ...n,
      preview: source ? source.comment_text.slice(0, 100) : null,
      author_name: source?.author_name ?? null,
      link,
    }
  })

  return NextResponse.json(enriched)
}

// PATCH /api/notifications — auth required
// Body: { id: uuid } to mark one read, or { markAll: true } to mark all read
export async function PATCH(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload || !payload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = MarkReadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { id, markAll } = parsed.data

  if (id) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', payload.userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (markAll) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', payload.userId)
      .eq('is_read', false)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
