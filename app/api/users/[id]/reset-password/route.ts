import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ResetPasswordSchema } from '@/lib/schemas/users'
import bcrypt from 'bcryptjs'

type Params = { params: Promise<{ id: string }> }

// POST /api/users/[id]/reset-password — captain-only: set a temporary password
export async function POST(req: NextRequest, { params }: Params) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (payload.role !== 'captain') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = ResetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const passwordHash = await bcrypt.hash(parsed.data.temporaryPassword, 12)

  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash: passwordHash, must_change_password: true })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
