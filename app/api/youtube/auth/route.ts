import { type NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { createOAuthClient } from '@/lib/youtube-oauth'

export async function GET(req: NextRequest) {
  // Captain-only
  const payload = await getTokenPayload(req)
  if (!payload || payload.role !== 'captain') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const oauth2Client = createOAuthClient()

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    // CRITICAL: prompt='consent' ensures a refresh_token is always returned,
    // even if the user has previously authorized the app (Research Pitfall 1).
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/youtube.readonly'],
  })

  return NextResponse.redirect(authUrl)
}
