import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import type { SessionVideo } from '@/lib/types'

// PATCH /api/sessions/[id]
// Body: { videos: SessionVideo[] }           — replace full video list (auth required)
//    or { videoId: string, note: string }    — update one video's note (captain only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Update a single video's note — captain only
  if ('videoId' in body && 'note' in body) {
    if (payload.role !== 'captain') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('videos')
      .eq('id', id)
      .single()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    const videos = (session.videos as SessionVideo[]).map((v) =>
      v.id === body.videoId ? { ...v, note: body.note } : v
    )

    const { data, error } = await supabase
      .from('sessions')
      .update({ videos })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Replace full video list — any authenticated user
  if ('videos' in body) {
    if (!Array.isArray(body.videos)) {
      return NextResponse.json({ error: 'videos must be an array' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('sessions')
      .update({ videos: body.videos })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
}
