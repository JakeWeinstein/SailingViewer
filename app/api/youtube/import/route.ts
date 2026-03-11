import { type NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { getAuthenticatedYouTube } from '@/lib/youtube-oauth'
import { supabase } from '@/lib/supabase'

const IMPORT_COOLDOWN_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(req: NextRequest) {
  // Captain-only
  const payload = await getTokenPayload(req)
  if (!payload || payload.role !== 'captain') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Quota protection: enforce 15-minute cooldown ──────────────────────────
  const { data: lastImportRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'youtube_last_import')
    .single()

  if (lastImportRow?.value) {
    const lastImport = parseInt(lastImportRow.value, 10)
    const elapsed = Date.now() - lastImport
    if (elapsed < IMPORT_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((IMPORT_COOLDOWN_MS - elapsed) / 1000)
      const remainingMinutes = Math.ceil(remainingSeconds / 60)
      return NextResponse.json(
        { error: `Import cooldown active — try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}` },
        { status: 429 }
      )
    }
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
      // No videos found — update timestamp and return
      await supabase.from('app_config').upsert(
        { key: 'youtube_last_import', value: String(Date.now()) },
        { onConflict: 'key' }
      )
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

    const newItems = items.filter(
      (item) => item.contentDetails?.videoId && !existingIds.has(item.contentDetails.videoId)
    )

    const skipped = items.length - newItems.length

    if (newItems.length === 0) {
      await supabase.from('app_config').upsert(
        { key: 'youtube_last_import', value: String(Date.now()) },
        { onConflict: 'key' }
      )
      return NextResponse.json({ imported: 0, sessions_created: 0, skipped })
    }

    // ── Group new videos by publish date ──────────────────────────────────────
    // Session label format: "Practice - MMM D, YYYY"
    const byDate = new Map<string, Array<{ videoId: string; title: string }>>()

    for (const item of newItems) {
      const videoId = item.contentDetails?.videoId!
      const title = item.snippet?.title ?? 'Untitled'
      const publishedAt = item.snippet?.publishedAt ?? new Date().toISOString()
      const date = new Date(publishedAt)
      const label = `Practice - ${date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`

      if (!byDate.has(label)) byDate.set(label, [])
      byDate.get(label)!.push({ videoId, title })
    }

    // ── Create sessions + append to sessions.videos JSONB ─────────────────────
    let imported = 0
    let sessionsCreated = 0

    for (const [label, videos] of byDate) {
      // Check if a session with this label already exists
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('id, videos')
        .eq('label', label)
        .single()

      let sessionId: string
      let currentVideos: Array<{ id: string; name: string; note?: string; noteTimestamp?: number }> = []

      if (existingSession) {
        sessionId = existingSession.id
        currentVideos = (existingSession.videos as typeof currentVideos) ?? []
      } else {
        // Create new session (not active by default)
        const { data: newSession, error: sessionError } = await supabase
          .from('sessions')
          .insert({ label, videos: [], is_active: false })
          .select('id')
          .single()

        if (sessionError || !newSession) {
          console.error('[youtube/import] Failed to create session:', sessionError)
          continue
        }

        sessionId = newSession.id
        sessionsCreated++
      }

      // Append new videos to JSONB array
      const newVideos = videos.map((v) => ({
        id: v.videoId,
        name: v.title,
      }))

      const updatedVideos = [...currentVideos, ...newVideos]

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ videos: updatedVideos })
        .eq('id', sessionId)

      if (updateError) {
        console.error('[youtube/import] Failed to update session videos:', updateError)
        continue
      }

      imported += videos.length
    }

    // ── Update last import timestamp ──────────────────────────────────────────
    await supabase.from('app_config').upsert(
      { key: 'youtube_last_import', value: String(Date.now()) },
      { onConflict: 'key' }
    )

    return NextResponse.json({ imported, sessions_created: sessionsCreated, skipped })
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
