import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import type { SessionVideo } from '@/lib/types'

async function authCheck(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}

// PATCH /api/sessions/[id]
// Body: { videos: SessionVideo[] }           — replace full video list
//    or { videoId: string, note: string }    — update one video's note
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authCheck(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  // Update a single video's note
  if ('videoId' in body && 'note' in body) {
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

  // Replace full video list
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
