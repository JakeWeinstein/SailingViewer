import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

// GET /api/comments?videoId=&sessionId=&captainOnly=true
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  const sessionId = searchParams.get('sessionId')
  const captainOnly = searchParams.get('captainOnly') === 'true'

  if (captainOnly) {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let query = supabase.from('comments').select('*').order('created_at', { ascending: true })
  if (videoId) query = query.eq('video_id', videoId)
  if (sessionId) query = query.eq('session_id', sessionId)
  if (captainOnly) query = query.eq('send_to_captain', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/comments — public
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { session_id, video_id, video_title, author_name, timestamp_seconds, comment_text, send_to_captain } = body

  // session_id may be null for reference video comments
  if (!video_id || !video_title || !author_name?.trim() || !comment_text?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      session_id,
      video_id,
      video_title,
      author_name: author_name.trim(),
      timestamp_seconds: timestamp_seconds ?? null,
      comment_text: comment_text.trim(),
      send_to_captain: !!send_to_captain,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
