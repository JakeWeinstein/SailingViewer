import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'

// GET /api/sessions — authenticated users only
export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/sessions — captain only, create new session and set it active
export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload || payload.role !== 'captain') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { label, videos = [] } = body

  if (!label?.trim()) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }

  // Deactivate all sessions first
  await supabase.from('sessions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')

  const { data, error } = await supabase
    .from('sessions')
    .insert({ label: label.trim(), videos, is_active: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
