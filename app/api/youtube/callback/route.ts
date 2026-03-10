import { type NextRequest, NextResponse } from 'next/server'
import { createOAuthClient, storeTokens, getChannelInfo } from '@/lib/youtube-oauth'
import type { YouTubeTokens } from '@/lib/youtube-oauth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // User denied consent on Google's side
  if (error || !code) {
    return NextResponse.redirect(new URL('/dashboard?youtube=error', req.url))
  }

  try {
    const oauth2Client = createOAuthClient()

    // Exchange authorization code for access + refresh tokens
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('[youtube/callback] Missing tokens in response', {
        hasAccess: !!tokens.access_token,
        hasRefresh: !!tokens.refresh_token,
      })
      return NextResponse.redirect(new URL('/dashboard?youtube=error', req.url))
    }

    const youtubeTokens: YouTubeTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
    }

    // Persist tokens to app_config
    await storeTokens(youtubeTokens)

    // Set credentials and fetch channel info (stores channel_id + uploads_playlist_id)
    oauth2Client.setCredentials(tokens)
    await getChannelInfo(oauth2Client)

    return NextResponse.redirect(new URL('/dashboard?youtube=connected', req.url))
  } catch (err) {
    console.error('[youtube/callback] Error during token exchange:', err)
    return NextResponse.redirect(new URL('/dashboard?youtube=error', req.url))
  }
}
