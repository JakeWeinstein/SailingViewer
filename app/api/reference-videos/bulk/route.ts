import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { parent_video_id, chapters, folder_id } = await req.json() as {
    parent_video_id: string
    chapters: Array<{ title: string; start_seconds: number }>
    folder_id?: string | null
  }

  if (!parent_video_id || !Array.isArray(chapters) || chapters.length === 0) {
    return NextResponse.json({ error: 'parent_video_id and at least one chapter are required' }, { status: 400 })
  }

  // Look up parent to inherit type + video_ref
  const { data: parent, error: parentErr } = await supabase
    .from('reference_videos')
    .select('type, video_ref, folder_id')
    .eq('id', parent_video_id)
    .single()

  if (parentErr || !parent) {
    return NextResponse.json({ error: 'Parent video not found' }, { status: 404 })
  }

  const rows = chapters.map((ch, i) => ({
    title: ch.title.trim(),
    type: parent.type,
    video_ref: parent.video_ref,
    parent_video_id,
    start_seconds: ch.start_seconds,
    folder_id: folder_id !== undefined ? (folder_id ?? null) : (parent.folder_id ?? null),
    sort_order: i,
  }))

  const { data, error } = await supabase
    .from('reference_videos')
    .insert(rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
