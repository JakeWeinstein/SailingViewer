import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'
import { UpdateRoleSchema } from '@/lib/schemas/users'

const UserUpdateSchema = z.union([
  UpdateRoleSchema,
  z.object({ is_active: z.boolean() }),
])

type Params = { params: Promise<{ id: string }> }

// PATCH /api/users/[id] — captain-only: change role or activation status
export async function PATCH(req: NextRequest, { params }: Params) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (payload.role !== 'captain') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = UserUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Fetch target user
  const { data: target, error: fetchError } = await supabase
    .from('users')
    .select('id, role, is_seed, is_active')
    .eq('id', id)
    .single()

  if (fetchError || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Role change protection for seed captain
  if ('role' in parsed.data && target.is_seed && parsed.data.role !== 'captain') {
    return NextResponse.json({ error: 'Cannot demote the seed captain' }, { status: 403 })
  }

  // Apply update
  const updatePayload = 'role' in parsed.data
    ? { role: parsed.data.role }
    : { is_active: parsed.data.is_active }

  const { error: updateError } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// DELETE /api/users/[id] — captain-only: delete a user account
export async function DELETE(req: NextRequest, { params }: Params) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (payload.role !== 'captain') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Fetch target user
  const { data: target, error: fetchError } = await supabase
    .from('users')
    .select('id, is_seed')
    .eq('id', id)
    .single()

  if (fetchError || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (target.is_seed) {
    return NextResponse.json({ error: 'Cannot delete the seed captain' }, { status: 403 })
  }

  if (id === payload.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 })
  }

  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
