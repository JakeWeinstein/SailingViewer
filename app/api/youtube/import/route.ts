import { type NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { getAuthenticatedYouTube } from '@/lib/youtube-oauth'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  // Captain-only
  const payload = await getTokenPayload(req)
  if (!payload || payload.role !== 'captain') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // ── Authenticate YouTube client ───────────────────────────────────────────
    const youtube = await getAuthenticatedYouTube()

    // ── Read uploads playlist ID from app_config ──────────────────────────────
    const { data: playlistRow } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'youtube_uploads_playlist_id')
      .single()

    if (!playlistRow?.value) {
      return NextResponse.json(
        { error: 'YouTube channel not connected — complete OAuth flow first' },
        { status: 400 }
      )
    }

    const playlistId = playlistRow.value

    // ── Fetch up to 50 recent uploads ────────────────────────────────────────
    const playlistRes = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId,
      maxResults: 50,
    })

    const items = playlistRes.data.items ?? []

    if (items.length === 0) {
      return NextResponse.json({ imported: 0, sessions_created: 0, skipped: 0 })
    }

    // ── Deduplication: collect all video IDs already in sessions.videos JSONB ─
    const playlistVideoIds = items
      .map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id))

    const { data: allSessions } = await supabase
      .from('sessions')
      .select('videos')

    const existingIds = new Set<string>()
    for (const s of allSessions ?? []) {
      for (const v of (s.videos as Array<{ id: string }>) ?? []) {
        if (v.id) existingIds.add(v.id)
      }
    }

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const newItems = items.filter((item) => {
      if (!item.contentDetails?.videoId || existingIds.has(item.contentDetails.videoId)) return false
      const publishedAt = item.snippet?.publishedAt
      if (publishedAt && new Date(publishedAt) < oneYearAgo) return false
      return true
    })

    const skipped = items.length - newItems.length

    if (newItems.length === 0) {
      return NextResponse.json({ imported: 0, sessions_created: 0, skipped })
    }

    // ── Find the active session ───────────────────────────────────────────────
    const { data: activeSession } = await supabase
      .from('sessions')
      .select('id, videos')
      .eq('is_active', true)
      .single()

    if (!activeSession) {
      return NextResponse.json(
        { error: 'No active session — create one first' },
        { status: 400 }
      )
    }

    // ── Append all new videos to active session ─────────────────────────────
    const currentVideos = (activeSession.videos as Array<{ id: string; name: string }>) ?? []
    const newVideos = newItems.map((item) => ({
      id: item.contentDetails!.videoId!,
      name: item.snippet?.title ?? 'Untitled',
    }))

    const updatedVideos = [...currentVideos, ...newVideos]

    const { error: updateError } = await supabase
      .from('sessions')
      .update({ videos: updatedVideos })
      .eq('id', activeSession.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ imported: newVideos.length, skipped })
  } catch (err: unknown) {
    // Handle expired OAuth tokens (user must re-authorize)
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('invalid_grant') || message.includes('Token has been expired')) {
      return NextResponse.json(
        { error: 'YouTube authorization expired — reconnect' },
        { status: 401 }
      )
    }
    console.error('[youtube/import] Unexpected error:', err)
    return NextResponse.json({ error: 'Import failed — please try again' }, { status: 500 })
  }
}
