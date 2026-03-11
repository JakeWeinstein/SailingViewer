import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import { EditCommentSchema } from '@/lib/schemas/comments'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/comments/[id] — edit own comment (or captain for moderation)
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await req.json()
  const parsed = EditCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  // Fetch existing comment to verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('comments')
    .select('id, author_id, comment_text')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  const isOwner = existing.author_id === payload.userId
  const isCaptain = payload.role === 'captain'

  if (!isOwner && !isCaptain) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('comments')
    .update({
      comment_text: parsed.data.comment_text,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json(updated)
}

// DELETE /api/comments/[id] — delete own comment (or captain for moderation)
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Fetch existing comment to verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('comments')
    .select('id, author_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  const isOwner = existing.author_id === payload.userId
  const isCaptain = payload.role === 'captain'

  if (!isOwner && !isCaptain) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete replies first (cascade), then the comment itself
  const { error: deleteRepliesError } = await supabase
    .from('comments')
    .delete()
    .eq('parent_id', id)

  if (deleteRepliesError) return NextResponse.json({ error: deleteRepliesError.message }, { status: 500 })

  const { error: deleteError } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
