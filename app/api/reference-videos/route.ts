import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET() {
  const { data, error } = await supabase
    .from('reference_videos')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, type, video_ref, note_timestamp } = await req.json()
  if (!title?.trim() || !type || !video_ref?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reference_videos')
    .insert({
      title: title.trim(),
      type,
      video_ref: video_ref.trim(),
      note_timestamp: note_timestamp ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
