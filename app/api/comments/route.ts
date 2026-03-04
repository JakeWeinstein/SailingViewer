import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

// GET /api/comments?videoId=&sessionId=&captainOnly=true&type=qa&parentId=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  const sessionId = searchParams.get('sessionId')
  const captainOnly = searchParams.get('captainOnly') === 'true'
  const type = searchParams.get('type')
  const parentId = searchParams.get('parentId')

  if (captainOnly) {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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

  // Fetch top-level Q&A posts
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

    // Fetch reply counts for these posts
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
  let query = supabase.from('comments').select('*').is('parent_id', null).order('created_at', { ascending: true })
  if (videoId) query = query.eq('video_id', videoId)
  if (sessionId) query = query.eq('session_id', sessionId)
  if (captainOnly) query = query.eq('send_to_captain', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch reply counts
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

// POST /api/comments — public
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { session_id, video_id, video_title, author_name, timestamp_seconds, comment_text, send_to_captain, parent_id } = body

  if (!author_name?.trim() || !comment_text?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // For non-reply, non-QA posts, video_id is required
  if (!parent_id && video_id === undefined && !body.is_qa) {
    // It's a Q&A post if video_id is explicitly null/undefined and is_qa is set
    // Otherwise require video_id
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      session_id: session_id ?? null,
      video_id: video_id ?? null,
      video_title: video_title ?? null,
      author_name: author_name.trim(),
      timestamp_seconds: timestamp_seconds ?? null,
      comment_text: comment_text.trim(),
      send_to_captain: !!send_to_captain,
      parent_id: parent_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
