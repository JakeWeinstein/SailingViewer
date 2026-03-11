import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import { CreateSessionSchema } from '@/lib/schemas/sessions'

// GET /api/sessions — authenticated users only
export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/sessions — captain only, create new session and set it active
export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload || payload.role !== 'captain') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parseResult = CreateSessionSchema.safeParse(body)
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues?.[0]
    return NextResponse.json(
      { error: firstIssue?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { label } = parseResult.data
  const videos = body.videos ?? []

  // Deactivate all sessions first
  await supabase.from('sessions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')

  const { data, error } = await supabase
    .from('sessions')
    .insert({ label, videos, is_active: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
