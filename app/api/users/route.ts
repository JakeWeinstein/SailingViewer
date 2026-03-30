import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { UpdateProfileSchema } from '@/lib/schemas/users'
import bcrypt from 'bcryptjs'

// GET /api/users
// Captain: full details (id, username, display_name, role, is_active, is_seed, last_login_at, created_at)
// Any authenticated user: basic fields (id, username, display_name) for @mention autocomplete
export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, role, is_active, is_seed, last_login_at, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (payload.role !== 'captain') {
    // Non-captains get only basic fields for @mention use
    const basic = (data ?? []).map((row) => ({
      id: row.id,
      username: row.username,
      display_name: row.display_name,
    }))
    return NextResponse.json(basic)
  }

  return NextResponse.json(data ?? [])
}

// PATCH /api/users — self-service profile update (any authenticated user)
export async function PATCH(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = UpdateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { displayName, currentPassword, newPassword } = parsed.data
  const updates: Record<string, string | boolean> = {}

  if (displayName) {
    updates.display_name = displayName
  }

  if (newPassword) {
    // Verify current password first
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', payload.userId)
      .single()

    if (fetchError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const valid = await bcrypt.compare(currentPassword!, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })
    }

    updates.password_hash = await bcrypt.hash(newPassword, 12)
    updates.must_change_password = false
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', payload.userId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
