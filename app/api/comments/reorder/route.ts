import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import { ReorderSchema } from '@/lib/schemas/comments'

// PATCH /api/comments/reorder — captain only
// Body: { session_id: uuid, order: [{ id: uuid, sort_order: number }] }
export async function PATCH(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (payload.role !== 'captain') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = ReorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { session_id, order } = parsed.data

  // Update each comment's sort_order, scoped to session_id for safety
  await Promise.all(
    order.map(({ id, sort_order }) =>
      supabase
        .from('comments')
        .update({ sort_order })
        .eq('id', id)
        .eq('session_id', session_id)
    )
  )

  return NextResponse.json({ ok: true })
}
