import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import { CreateReferenceVideoSchema } from '@/lib/schemas/reference-videos'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tagsParam = searchParams.get('tags')
  const allTagsParam = searchParams.get('allTags')

  // Return all unique tags for autocomplete
  if (allTagsParam === 'true') {
    const { data, error } = await supabase.rpc('get_all_reference_tags')
    if (error) {
      // Fallback: aggregate from videos in JS if RPC not available
      const { data: videos, error: vidError } = await supabase
        .from('reference_videos')
        .select('tags')
      if (vidError) return NextResponse.json({ error: vidError.message }, { status: 500 })
      const allTags = new Set<string>()
      for (const v of (videos ?? [])) {
        if (Array.isArray(v.tags)) v.tags.forEach((t: string) => allTags.add(t))
      }
      return NextResponse.json(Array.from(allTags).sort())
    }
    // RPC returns array of {tag: string} rows
    const tags = (data ?? []).map((row: { tag: string }) => row.tag)
    return NextResponse.json(tags)
  }

  let query = supabase
    .from('reference_videos')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  // AND-logic tag filter using Supabase .contains() which checks array containment
  if (tagsParam) {
    const selectedTags = tagsParam
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    if (selectedTags.length > 0) {
      query = query.contains('tags', selectedTags)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // When creating a chapter, look up parent to inherit type + video_ref
  let resolvedType = body.type
  let resolvedVideoRef = body.video_ref
  if (body.parent_video_id) {
    const { data: parent, error: parentErr } = await supabase
      .from('reference_videos')
      .select('type, video_ref')
      .eq('id', body.parent_video_id)
      .single()
    if (parentErr || !parent) {
      return NextResponse.json({ error: 'Parent video not found' }, { status: 404 })
    }
    resolvedType = parent.type
    resolvedVideoRef = parent.video_ref
  }

  const parseResult = CreateReferenceVideoSchema.safeParse({
    ...body,
    type: resolvedType,
    video_ref: resolvedVideoRef,
  })
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues?.[0]
    return NextResponse.json(
      { error: firstIssue?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const validated = parseResult.data

  // Normalize tags: lowercase and trim
  const normalizedTags = validated.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)

  const { data, error } = await supabase
    .from('reference_videos')
    .insert({
      title: validated.title,
      type: validated.type,
      video_ref: validated.video_ref,
      tags: normalizedTags,
      note_timestamp: validated.note_timestamp ?? null,
      folder_id: validated.folder_id ?? null,
      parent_video_id: validated.parent_video_id ?? null,
      start_seconds: validated.start_seconds ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
