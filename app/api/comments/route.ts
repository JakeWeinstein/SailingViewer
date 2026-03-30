import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import { CreateCommentSchema, CommentQuerySchema } from '@/lib/schemas/comments'
import { createMentionNotifications, createReplyNotification } from '@/lib/mention-utils'

// GET /api/comments?videoId=&sessionId=&captainOnly=true&type=qa&parentId=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const rawQuery = {
    videoId: searchParams.get('videoId') ?? undefined,
    sessionId: searchParams.get('sessionId') ?? undefined,
    captainOnly: searchParams.get('captainOnly') ?? undefined,
    type: searchParams.get('type') ?? undefined,
    parentId: searchParams.get('parentId') ?? undefined,
  }

  const parsed = CommentQuerySchema.safeParse(rawQuery)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query params', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { videoId, sessionId, captainOnly, type, parentId } = parsed.data

  if (captainOnly) {
    const payload = await getTokenPayload(req)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch replies for a specific parent
  if (parentId) {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Fetch top-level Q&A posts (no video_id)
  if (type === 'qa') {
    let query = supabase
      .from('comments')
      .select('*')
      .is('video_id', null)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
    if (captainOnly) query = query.eq('send_to_captain', true)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (data && data.length > 0) {
      const ids = data.map((c: { id: string }) => c.id)
      const { data: replyCounts } = await supabase
        .rpc('comment_reply_counts', { parent_ids: ids })

      const countMap = new Map<string, number>()
      if (replyCounts) {
        for (const r of replyCounts) countMap.set(r.parent_id, r.count)
      }
      for (const c of data) {
        (c as Record<string, unknown>).reply_count = countMap.get(c.id) ?? 0
      }
    }

    return NextResponse.json(data)
  }

  // Default: fetch comments for a video (top-level only, with reply counts)
  let query = supabase
    .from('comments')
    .select('*')
    .is('parent_id', null)
    .order('created_at', { ascending: true })

  if (videoId) query = query.eq('video_id', videoId)
  if (sessionId) query = query.eq('session_id', sessionId)
  if (captainOnly) {
    query = query.eq('send_to_captain', true).eq('is_reviewed', false)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (data && data.length > 0) {
    const ids = data.map((c: { id: string }) => c.id)
    const { data: replyCounts } = await supabase
      .rpc('comment_reply_counts', { parent_ids: ids })

    const countMap = new Map<string, number>()
    if (replyCounts) {
      for (const r of replyCounts) countMap.set(r.parent_id, r.count)
    }
    for (const c of data) {
      (c as Record<string, unknown>).reply_count = countMap.get(c.id) ?? 0
    }
  }

  return NextResponse.json(data)
}

// POST /api/comments — auth required
export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { video_id, session_id, timestamp_seconds, comment_text, send_to_captain, parent_id, youtube_attachment } = parsed.data

  // Q&A top-level posts (no video_id, no parent_id) always go to captain
  const effectiveSendToCaptain = (!video_id && !parent_id) ? true : send_to_captain

  const { data, error } = await supabase
    .from('comments')
    .insert({
      author_id: payload.userId,
      author_name: payload.userName,
      video_id: video_id ?? null,
      session_id: session_id ?? null,
      timestamp_seconds: timestamp_seconds ?? null,
      comment_text,
      send_to_captain: effectiveSendToCaptain,
      parent_id: parent_id ?? null,
      youtube_attachment: youtube_attachment ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget: create mention and reply notifications
  if (payload.userId) {
    createMentionNotifications(data.id, comment_text, payload.userId, supabase).catch(() => {})
    if (parent_id) {
      createReplyNotification(data.id, parent_id, payload.userId, supabase).catch(() => {})
    }
  }

  return NextResponse.json(data, { status: 201 })
}
