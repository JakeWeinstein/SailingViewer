import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { randomUUID } from 'crypto'

// GET /api/settings/invite-code — captain-only: read current invite code
export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (payload.role !== 'captain') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'invite_code')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Invite code not found' }, { status: 404 })
  }

  return NextResponse.json({ inviteCode: data.value })
}

// POST /api/settings/invite-code — captain-only: rotate invite code
export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (payload.role !== 'captain') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const newCode = randomUUID()

  const { error } = await supabase
    .from('app_config')
    .update({ value: newCode, updated_at: new Date().toISOString() })
    .eq('key', 'invite_code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inviteCode: newCode })
}
