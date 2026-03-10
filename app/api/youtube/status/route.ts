import { type NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  // Auth required (any role)
  const payload = await getTokenPayload(req)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if OAuth tokens exist
  const { data: tokensRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'youtube_oauth_tokens')
    .single()

  if (!tokensRow?.value) {
    return NextResponse.json({ connected: false })
  }

  // Fetch channel ID for display
  const { data: channelRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'youtube_channel_id')
    .single()

  return NextResponse.json({
    connected: true,
    channelId: channelRow?.value ?? null,
  })
}
