import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTokenPayload } from '@/lib/auth'
import type { SessionVideo } from '@/lib/types'
import { extractYouTubeInfo } from '@/lib/types'
import { CloseSessionSchema, AddVideoSchema } from '@/lib/schemas/sessions'

// PATCH /api/sessions/[id]
// Body: { videos: SessionVideo[] }           — replace full video list (auth required)
//    or { videoId: string, note: string }    — update one video's note (captain only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Update a single video's note — captain only
  if ('videoId' in body && 'note' in body) {
    if (payload.role !== 'captain') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('videos')
      .eq('id', id)
      .single()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    const videos = (session.videos as SessionVideo[]).map((v) =>
      v.id === body.videoId ? { ...v, note: body.note } : v
    )

    const { data, error } = await supabase
      .from('sessions')
      .update({ videos })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Replace full video list — captain or contributor only
  if ('videos' in body) {
    if (payload.role === 'viewer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!Array.isArray(body.videos)) {
      return NextResponse.json({ error: 'videos must be an array' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('sessions')
      .update({ videos: body.videos })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
}

// POST /api/sessions/[id]
// Body: { action: 'close', next_label?: string }   — captain only
//    or { action: 'add-video', youtube_url: string } — any authenticated user
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action } = body

  // ── Close session action ────────────────────────────────────────────────────
  if (action === 'close') {
    if (payload.role !== 'captain') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parseResult = CloseSessionSchema.safeParse(body)
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues?.[0]
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Set current session as closed
    const { data: closedSession, error: closeError } = await supabase
      .from('sessions')
      .update({ is_active: false, closed_at: now.toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (closeError || !closedSession) {
      return NextResponse.json(
        { error: closeError?.message ?? 'Session not found' },
        { status: closeError ? 500 : 404 }
      )
    }

    // Auto-generate next session label: "Week of [next Monday]"
    const nextLabel = parseResult.data.next_label?.trim() || generateNextWeekLabel(now)

    // Deactivate all other sessions, then create new active session
    await supabase
      .from('sessions')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    const { data: newSession, error: createError } = await supabase
      .from('sessions')
      .insert({ label: nextLabel, videos: [], is_active: true })
      .select()
      .single()

    if (createError || !newSession) {
      return NextResponse.json(
        { error: createError?.message ?? 'Failed to create next session' },
        { status: 500 }
      )
    }

    // Carry forward: move unreviewed flagged comments to new session.
    // Only move is_reviewed=false items; reset sort_order so they re-sort in new session context.
    await supabase
      .from('comments')
      .update({ session_id: newSession.id, sort_order: null })
      .eq('session_id', id)
      .eq('send_to_captain', true)
      .eq('is_reviewed', false)

    return NextResponse.json({ closed: closedSession, next: newSession })
  }

  // ── Add video action ────────────────────────────────────────────────────────
  if (action === 'add-video') {
    const parseResult = AddVideoSchema.safeParse(body)
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues?.[0]
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }

    const { youtube_url } = parseResult.data
    const ytInfo = extractYouTubeInfo(youtube_url)
    if (!ytInfo) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
    }

    // Get current session videos JSONB
    const { data: session, error: fetchErr } = await supabase
      .from('sessions')
      .select('videos')
      .eq('id', id)
      .single()

    if (fetchErr || !session) {
      return NextResponse.json({ error: fetchErr?.message ?? 'Session not found' }, { status: fetchErr ? 500 : 404 })
    }

    const currentVideos = (session.videos as SessionVideo[]) ?? []

    // Check for duplicate
    if (currentVideos.some((v) => v.id === ytInfo.id)) {
      return NextResponse.json({ error: 'Video already in session' }, { status: 409 })
    }

    const newVideo: SessionVideo = {
      id: ytInfo.id,
      name: ytInfo.id, // Will be updated by caller or left as video ID
    }

    const updatedVideos = [...currentVideos, newVideo]

    const { data: updated, error: updateErr } = await supabase
      .from('sessions')
      .update({ videos: updatedVideos })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json(newVideo, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a "Week of [date]" label for the next Monday.
 * If today IS Monday, uses the FOLLOWING Monday.
 */
function generateNextWeekLabel(from: Date): string {
  const d = new Date(from)
  const dayOfWeek = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilNextMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7
  d.setDate(d.getDate() + daysUntilNextMonday)

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return `Week of ${months[d.getMonth()]} ${d.getDate()}`
}
