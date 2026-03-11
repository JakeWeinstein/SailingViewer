import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import { UpdateReferenceVideoSchema } from '@/lib/schemas/reference-videos'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase.from('reference_videos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const parseResult = UpdateReferenceVideoSchema.safeParse(body)
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues?.[0]
    return NextResponse.json(
      { error: firstIssue?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const validated = parseResult.data
  const updates: Record<string, unknown> = {}

  if ('note' in body) updates.note = body.note ?? null
  if ('noteTimestamp' in body) updates.note_timestamp = body.noteTimestamp ?? null
  if ('notes' in body) updates.notes = body.notes ?? []
  if ('folder_id' in body) updates.folder_id = body.folder_id ?? null
  if ('title' in body && validated.title !== undefined) updates.title = validated.title
  if ('type' in body && validated.type !== undefined) updates.type = validated.type
  if ('video_ref' in body && validated.video_ref !== undefined) updates.video_ref = validated.video_ref
  if ('start_seconds' in body) updates.start_seconds = body.start_seconds ?? null
  if ('tags' in body && validated.tags !== undefined) {
    // Normalize tags: lowercase and trim
    updates.tags = validated.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reference_videos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
