import 'server-only'

import { google } from 'googleapis'
import { supabase } from './supabase'

// ─── OAuth2 client factory ────────────────────────────────────────────────────

/**
 * Create a fresh OAuth2 client configured from environment variables.
 * Required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 */
export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

// ─── Token storage (app_config table) ────────────────────────────────────────

export type YouTubeTokens = {
  access_token: string
  refresh_token: string
  expiry_date: number
}

/**
 * Retrieve stored OAuth tokens from app_config.
 * Returns null if no tokens have been stored yet (captain has not authorized).
 */
export async function getStoredTokens(): Promise<YouTubeTokens | null> {
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'youtube_oauth_tokens')
    .single()
  return data ? (JSON.parse(data.value) as YouTubeTokens) : null
}

/**
 * Persist OAuth tokens to app_config (upsert — safe to call on each token refresh).
 */
export async function storeTokens(tokens: YouTubeTokens): Promise<void> {
  await supabase
    .from('app_config')
    .upsert(
      { key: 'youtube_oauth_tokens', value: JSON.stringify(tokens) },
      { onConflict: 'key' }
    )
}

// ─── Authenticated YouTube client ─────────────────────────────────────────────

/**
 * Build a googleapis YouTube client pre-authenticated with stored tokens.
 * Throws if no tokens are stored (captain must complete OAuth flow first).
 */
export async function getAuthenticatedYouTube() {
  const tokens = await getStoredTokens()
  if (!tokens) {
    throw new Error('YouTube not connected — captain must authorize first')
  }
  const oauth2Client = createOAuthClient()
  oauth2Client.setCredentials(tokens)
  return google.youtube({ version: 'v3', auth: oauth2Client })
}

// ─── Channel info ─────────────────────────────────────────────────────────────

export type ChannelInfo = {
  channelId: string
  uploadsPlaylistId: string
}

/**
 * Fetch the captain's YouTube channel ID and uploads-playlist ID, then persist
 * them to app_config. Called once immediately after the OAuth callback succeeds.
 */
export async function getChannelInfo(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>
): Promise<ChannelInfo> {
  const yt = google.youtube({ version: 'v3', auth: oauth2Client })
  const res = await yt.channels.list({ part: ['id', 'contentDetails'], mine: true })
  const channel = res.data.items?.[0]
  if (!channel) throw new Error('No YouTube channel found for this account')

  const channelId = channel.id!
  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads!

  await supabase.from('app_config').upsert(
    [
      { key: 'youtube_channel_id', value: channelId },
      { key: 'youtube_uploads_playlist_id', value: uploadsPlaylistId },
    ],
    { onConflict: 'key' }
  )

  return { channelId, uploadsPlaylistId }
}
