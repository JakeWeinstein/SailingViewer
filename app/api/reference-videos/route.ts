import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'

export async function GET() {
  const { data, error } = await supabase
    .from('reference_videos')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, type, video_ref, note_timestamp, folder_id, parent_video_id, start_seconds } = await req.json()

  // When creating a chapter, look up parent to inherit type + video_ref
  let resolvedType = type
  let resolvedVideoRef = video_ref
  if (parent_video_id) {
    const { data: parent, error: parentErr } = await supabase
      .from('reference_videos')
      .select('type, video_ref')
      .eq('id', parent_video_id)
      .single()
    if (parentErr || !parent) {
      return NextResponse.json({ error: 'Parent video not found' }, { status: 404 })
    }
    resolvedType = parent.type
    resolvedVideoRef = parent.video_ref
  }

  if (!title?.trim() || !resolvedType || !resolvedVideoRef?.toString().trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reference_videos')
    .insert({
      title: title.trim(),
      type: resolvedType,
      video_ref: typeof resolvedVideoRef === 'string' ? resolvedVideoRef.trim() : resolvedVideoRef,
      note_timestamp: note_timestamp ?? null,
      folder_id: folder_id ?? null,
      parent_video_id: parent_video_id ?? null,
      start_seconds: start_seconds ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
