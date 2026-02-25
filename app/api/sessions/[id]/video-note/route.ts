import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import type { SessionVideo } from '@/lib/types'

// PATCH /api/sessions/[id]/video-note — captain only
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getTokenPayload(req)
  if (!payload || payload.role !== 'captain') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { videoId, note, noteTimestamp } = await req.json()

  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('videos')
    .eq('id', id)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const videos = (session.videos as SessionVideo[]).map((v) => {
    if (v.id !== videoId) return v
    const updated: SessionVideo = { ...v, note: note ?? '' }
    if (noteTimestamp != null) updated.noteTimestamp = noteTimestamp
    else delete updated.noteTimestamp
    return updated
  })

  const { error } = await supabase.from('sessions').update({ videos }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
