import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/sessions/browse — public, returns all sessions with videos for browsing
export async function GET() {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, label, videos, is_active, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
