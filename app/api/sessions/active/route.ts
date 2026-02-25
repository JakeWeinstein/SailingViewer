import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/sessions/active — public, returns current active session including its videos
export async function GET() {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, label, videos')
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json(null)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
