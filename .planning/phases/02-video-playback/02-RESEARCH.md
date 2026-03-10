# Phase 2: Video Playback - Research

**Researched:** 2026-03-10
**Domain:** YouTube IFrame API, YouTube Data API v3 OAuth2, mobile video playback, server-side token storage
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Video Storage — YouTube Only**
- Drop Google Drive embeds entirely — all video content (practice AND reference) is YouTube-only
- Practice videos uploaded as unlisted YouTube videos on a team channel
- Reference library also switches to YouTube-only
- iOS Safari Drive embed blocking issue is eliminated by this decision

**Auto-Import via YouTube Data API**
- YouTube Data API v3 with OAuth — captain authorizes once, app discovers new uploads automatically
- App reads the channel's "uploads" playlist to find new unlisted videos
- Requires Google Cloud project with YouTube Data API enabled + OAuth consent screen
- Free tier: 10,000 quota units/day (listing videos costs ~1 unit per call)
- New uploads auto-create a new session (named by upload date); captain can rename/reorganize after

**Timestamped Comments**
- YouTube IFrame API `getCurrentTime()` enables auto-capture of current playback time
- Default behavior: posting a comment auto-attaches the current timestamp
- User can clear the timestamp if the comment isn't time-specific, or manually edit it

**Player Layout — Modal Overlay**
- Keep current modal overlay pattern: full-screen modal with video left (65%) + sidebar right (35%)
- On mobile, stacks vertically (video on top, sidebar below)
- Escape key and backdrop click to close (existing behavior)

**Chapter Navigation — Vertical List**
- Chapters displayed as a vertical stacked list in the sidebar (replacing current pill buttons)
- Each entry shows chapter title, timestamp, and optional description
- Active chapter highlighted
- Handles many chapters better than pills

**Mobile Experience — Auto-Fullscreen**
- Opening a video on mobile (375px) triggers auto-fullscreen via YouTube API
- Tap to exit fullscreen back to the comments/chapters view
- YouTube's native mobile controls handle the in-player experience

### Claude's Discretion
- YouTube API polling frequency and error retry strategy
- OAuth token refresh flow implementation
- Session auto-naming format (date-based, but exact format flexible)
- Chapter list styling and active chapter highlight treatment
- Loading states during YouTube video processing
- Error handling for API quota limits or OAuth expiration
- Player keyboard shortcuts
- Playback speed and quality controls (YouTube provides these natively)
- Migration approach for existing Drive-based data

### Deferred Ideas (OUT OF SCOPE)
- YouTube Data API auto-import enhanced with playlist-based organization
- Manual URL paste as fallback import method
- Picture-in-picture mode
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VID-01 | User can watch Google Drive embedded videos with reliable playback on mobile and desktop | Resolved by YouTube-only decision — Drive embeds eliminated, YouTube embeds are universal |
| VID-02 | User can watch YouTube embedded videos with reliable playback on mobile and desktop | YouTube IFrame API + `playsinline` param for iOS inline; `allowFullScreen` attribute for desktop |
| VID-03 | User can navigate chapters (timestamp markers) on reference videos to jump to specific moments | YouTube IFrame API `seekTo()` for same-video chapters; `onChapterChange` swap for multi-video chapters |
| VID-04 | Multi-part YouTube videos transition seamlessly between parts within a chapter sequence | `onStateChange` event (YT.PlayerState.ENDED = 0) triggers advance to next chapter; existing postMessage pattern in VideoWatchView.tsx is the right approach but needs the IFrame API player path (not postMessage) |
| VID-05 | Video player displays properly on mobile (sizing, fullscreen, controls) | `playsinline: 0` on mobile triggers YouTube native fullscreen; Tailwind responsive classes for vertical stacking |
</phase_requirements>

---

## Summary

This phase converts the app from a hybrid Google Drive + YouTube embed system to a pure YouTube-only architecture. The three technical domains are: (1) YouTube IFrame API integration for programmatic player control (seek, timestamp capture, chapter tracking, auto-advance), (2) YouTube Data API v3 OAuth for discovering channel uploads automatically, and (3) database schema migration to rename `drive_file_id` to `youtube_video_id` across `session_videos` and simplify `reference_videos` to YouTube-only.

The YouTube IFrame API work is the highest-confidence domain — the existing `VideoWatchView.tsx` already has a working implementation of YT.Player creation, `getCurrentTime()` polling, `seekTo()` for chapters, and `onStateChange` via postMessage for multi-video auto-advance. The primary work is refactoring: extending the YT player path to all videos (not just multi-chapter reference videos), adding timestamp auto-capture to the comment composer, and replacing pill-based chapter navigation with a vertical list.

The YouTube Data API OAuth work is new territory. The pattern is a standard server-side OAuth2 flow: captain visits `/api/youtube/auth` to start authorization, Google redirects to `/api/youtube/callback`, the app exchanges the code for access+refresh tokens and stores them in `app_config` (Supabase), then subsequent import calls use the stored refresh token to get a fresh access token. The `googleapis` npm package is the right tool — it handles token refresh automatically once initialized with stored credentials.

**Primary recommendation:** Extend the existing YT IFrame API patterns to all videos first, then layer in OAuth auto-import. Both flows are well-understood and the existing codebase has the scaffolding needed.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| YouTube IFrame API | (CDN, no npm) | Programmatic player control: play, pause, seek, state events, getCurrentTime | Official YouTube API — no alternative for programmatic control of embedded players |
| googleapis | 144.x (npm) | YouTube Data API v3 client with built-in OAuth2 token refresh | Official Google Node.js client — handles token refresh automatically |

### Already in Stack (Relevant)
| Library | Version | Purpose |
|---------|---------|---------|
| @supabase/supabase-js | 2.47.10 | Stores OAuth tokens in `app_config` table |
| jose | 5.9.6 | Existing JWT auth (not used for Google OAuth) |
| clsx | 2.1.1 | Conditional chapter list styling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| google-auth-library | (bundled with googleapis) | OAuth2 client for token exchange | Comes free with googleapis npm install |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| googleapis npm | Manual fetch to Google OAuth endpoints | googleapis handles token refresh, retry, and type safety automatically — don't hand-roll |
| app_config table for token storage | New `oauth_tokens` table | app_config already exists and is the right pattern for singleton captain config |
| YT IFrame Player API | react-youtube, lite-youtube-embed | Direct API gives full programmatic control needed for getCurrentTime() and seekTo(); wrapper libraries often lag API updates |

**Installation:**
```bash
npm install googleapis
```

---

## Architecture Patterns

### Recommended Project Structure Changes
```
app/
├── api/
│   ├── youtube/
│   │   ├── auth/route.ts       # GET — starts OAuth flow, redirects to Google
│   │   ├── callback/route.ts   # GET — receives code, exchanges for tokens, stores in DB
│   │   └── import/route.ts     # POST — reads uploads playlist, creates sessions (captain only)
│   └── sessions/
│       └── [id]/
│           └── video-note/route.ts  # existing, keep
lib/
├── youtube-oauth.ts            # OAuth2 client factory, token storage helpers
```

### Pattern 1: YouTube Data API OAuth Flow

**What:** Server-side OAuth2 authorization code flow. Captain clicks "Connect YouTube" in dashboard, gets redirected to Google consent screen, returns to app with code, app exchanges code for refresh token stored in DB.

**When to use:** One-time setup by captain. Token is then used for all subsequent import calls.

**Flow:**
```
Captain → GET /api/youtube/auth
  → redirect to https://accounts.google.com/o/oauth2/v2/auth
    ?client_id=...&redirect_uri=.../api/youtube/callback
    &scope=https://www.googleapis.com/auth/youtube.readonly
    &access_type=offline&prompt=consent
  → Google redirects to /api/youtube/callback?code=...
  → Exchange code for {access_token, refresh_token, expiry_date}
  → Store in app_config: {
      key: 'youtube_oauth_tokens',
      value: JSON.stringify({access_token, refresh_token, expiry_date})
    }
  → Redirect captain back to dashboard
```

**Key pitfall — `prompt=consent` is required:** Without it, Google only returns a refresh token on the *first* authorization. `prompt=consent` forces the consent screen every time, ensuring a fresh refresh token. This is intentional for a server app where the captain re-authorizes occasionally.

**Token refresh pattern with googleapis:**
```typescript
// lib/youtube-oauth.ts
import { google } from 'googleapis'

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI  // e.g. https://app.vercel.app/api/youtube/callback
  )
}

export async function getAuthenticatedYouTube() {
  // Load tokens from app_config
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'youtube_oauth_tokens')
    .single()

  const tokens = JSON.parse(data.value)
  const oauth2Client = createOAuthClient()
  oauth2Client.setCredentials(tokens)

  // googleapis auto-refreshes when expiry_date is past
  return google.youtube({ version: 'v3', auth: oauth2Client })
}
```

### Pattern 2: Fetching Channel Uploads

**What:** Use `channels.list` to get the uploads playlist ID, then `playlistItems.list` to paginate through uploads.

**Uploads playlist ID shortcut:** If the channel ID is `UCxxxxxxxx`, the uploads playlist is always `UUxxxxxxxx` (replace `UC` prefix with `UU`). This saves one API call.

**Quota cost:** `playlistItems.list` = 1 unit per call. Fetching 50 items per page = 1 unit. For a team uploading ~5 videos/week, a weekly import costs 1-2 units. Well within 10,000/day free quota.

**Only unlisted videos are returned** when authenticated with `youtube.readonly` scope for your own channel — unlisted videos appear in the uploads playlist for the channel owner.

```typescript
// app/api/youtube/import/route.ts
export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (payload?.role !== 'captain') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const youtube = await getAuthenticatedYouTube()

  // Captain stores their channel ID in app_config or we derive uploads playlist ID
  const channelId = process.env.YOUTUBE_CHANNEL_ID  // e.g. UCxxxxxxxxx
  const uploadsPlaylistId = 'UU' + channelId.slice(2)  // UCxxx → UUxxx

  const response = await youtube.playlistItems.list({
    part: ['snippet', 'contentDetails'],
    playlistId: uploadsPlaylistId,
    maxResults: 50,
  })

  const items = response.data.items ?? []
  // Each item: snippet.title, snippet.publishedAt, contentDetails.videoId
  // Create sessions and session_videos from items not already imported
}
```

### Pattern 3: YT IFrame API — Auto-Timestamp Capture for Comments

**What:** When user clicks "Post Comment", call `ytPlayerRef.current.getCurrentTime()` to auto-fill the timestamp field.

**When to use:** Only when a YT player is active (all videos after this phase).

**Revised comment composer UX:**
1. User focuses the comment textarea
2. On focus OR on "Post" click: `const t = ytPlayerRef.current?.getCurrentTime()`
3. Pre-fill timestamp field with `formatTime(Math.floor(t))`
4. User can clear the timestamp if the comment is not time-specific
5. User submits

```typescript
// In VideoWatchView comment composer
function captureTimestamp() {
  const player = ytPlayerRef.current
  if (player && typeof player.getCurrentTime === 'function') {
    try {
      const seconds = Math.floor(player.getCurrentTime())
      setTimestampRaw(formatTime(seconds))
    } catch { /* player not ready */ }
  }
}

// Attach to textarea focus and the Post button onClick before postComment()
```

### Pattern 4: Multi-Video Auto-Advance via onStateChange (Native API — Not postMessage)

**What:** The existing VideoWatchView.tsx uses `postMessage` polling to detect video end for multi-video chapters. This is fragile (see CONCERNS.md). The correct pattern is using `onStateChange` in the YT.Player constructor, which fires reliably.

**The fix:** Route ALL YouTube video rendering through `new window.YT.Player(...)` (the IFrame API player), not a raw `<iframe src="...">`. This gives reliable `onStateChange` events for all videos.

```typescript
// Extend YT.Player constructor events to ALL youtube videos
ytPlayerRef.current = new window.YT.Player(containerId, {
  videoId: effectiveMediaId,
  playerVars: { playsinline: 1, rel: 0 },
  events: {
    onReady: (e) => {
      if (startSecondsRef.current) e.target.seekTo(startSecondsRef.current, true)
    },
    onStateChange: (e) => {
      if (e.data === window.YT.PlayerState.ENDED && isMultiVideo) {
        advanceToNextChapter()
      }
    },
  },
})
```

### Pattern 5: Mobile Video Layout

**What:** On mobile (< 640px), stack video above comments/chapters vertically. YouTube's native fullscreen handles the in-player experience via the native fullscreen button.

**`playsinline: 1`** — Required for iOS Safari to allow inline (non-fullscreen) playback initially. Without it, iOS auto-opens fullscreen on play, which prevents the user from seeing comments.

**Auto-fullscreen on mobile (CONTEXT.md requirement):** To trigger fullscreen programmatically on mobile, call `requestFullscreen()` on the player container div. On iPhone, `Element.requestFullscreen()` is NOT supported — instead YouTube's own fullscreen button (rendered in the player) is the only reliable trigger. The implementation should:
- Detect mobile: `window.innerWidth <= 640`
- If mobile: add `fs: 1` playerVar (enables the fullscreen button within the player)
- On player onReady: if mobile, call the player container's `requestFullscreen()` — it works on Android; on iOS it silently fails and the user taps YouTube's native fullscreen button
- Document this behavior: "On iPhone, tap the fullscreen icon in the player to enter fullscreen"

```typescript
const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640
// playerVars:
{ playsinline: isMobile ? 0 : 1, fs: 1, rel: 0 }
// After onReady on mobile:
try { document.getElementById(containerId)?.requestFullscreen() } catch { /* iOS — user taps manually */ }
```

### Pattern 6: Database Migration — drive_file_id → youtube_video_id

**What:** `session_videos.drive_file_id` column needs to be renamed/repurposed for YouTube video IDs. `reference_videos.type` constraint currently allows `'drive' | 'youtube'` — simplify to YouTube-only.

**Migration SQL:**
```sql
-- Phase 2 migration
ALTER TABLE session_videos RENAME COLUMN drive_file_id TO youtube_video_id;

-- reference_videos: drop drive constraint, default to youtube
ALTER TABLE reference_videos DROP CONSTRAINT reference_videos_type_check;
ALTER TABLE reference_videos ADD CONSTRAINT reference_videos_type_check
  CHECK (type IN ('youtube'));
ALTER TABLE reference_videos ALTER COLUMN type SET DEFAULT 'youtube';

-- Update existing drive rows (captain will re-add as YouTube)
UPDATE reference_videos SET type = 'youtube' WHERE type = 'drive';
```

**Also update `DbSessionVideo` type in `lib/types.ts`:**
```typescript
export type DbSessionVideo = {
  id: string
  session_id: string
  youtube_video_id: string  // was drive_file_id
  title: string
  position: number
  note: string | null
  note_timestamp: number | null
  created_at: string
}
```

### Anti-Patterns to Avoid

- **Using `<iframe src="...">` for YT with `postMessage` state detection:** Use `new YT.Player()` instead — postMessage is polling-based and race-condition-prone (documented in CONCERNS.md).
- **Storing `googleapis` OAuth2 client as a module singleton:** Next.js serverless functions are stateless; always reconstruct the client from stored tokens in `app_config`.
- **Storing OAuth tokens in env vars:** Refresh tokens change when re-authorized. Store in DB (`app_config` table), not in `.env.local`.
- **Not using `prompt=consent`:** Google only returns a refresh token on first consent. Omitting `prompt=consent` means a re-authorization won't give a new refresh token, leaving the app unable to recover from an expired/revoked token.
- **Using `access_type=online`:** Always `access_type=offline` to get a refresh token for server-side apps.
- **Not guarding `window.YT` access in SSR:** The YouTube IFrame API script is client-side only. All YT.Player construction must be inside `useEffect` (not render body).
- **Polling `getCurrentTime()` with `setInterval` while paused:** Check `player.getPlayerState() === YT.PlayerState.PLAYING` before polling to avoid wasteful battery drain on mobile.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube OAuth token refresh | Manual `fetch` to `https://oauth2.googleapis.com/token` | `googleapis` npm package (`oauth2Client.setCredentials(tokens)` auto-refreshes) | Edge cases: concurrent requests with expired token, race conditions on refresh |
| YouTube video thumbnail URL | Build thumbnail logic | `https://img.youtube.com/vi/{id}/mqdefault.jpg` (already in `lib/types.ts` as `youtubeThumbnailUrl()`) | Already exists |
| YouTube embed URL | Build embed string | `youtubeEmbedUrl()` in `lib/types.ts` | Already exists |
| Chapter timestamp parsing | New parser | `parseTimestamp()` in `lib/types.ts` | Already exists and handles H:MM:SS, M:SS, seconds |
| Time formatting | Custom formatter | `formatTime()` in `lib/types.ts` | Already exists |
| YouTube video ID extraction | URL parser | `extractYouTubeInfo()` in `lib/types.ts` | Already exists and handles all URL formats |
| IFrame API script deduplication | Custom script manager | Move YT script loading to app layout (`app/layout.tsx`) as a single load | Prevents the race condition documented in CONCERNS.md |

**Key insight:** The existing `VideoWatchView.tsx` and `lib/types.ts` already have most YouTube primitives. This phase refactors and extends them, not replaces them.

---

## Common Pitfalls

### Pitfall 1: Refresh Token Only Returned Once
**What goes wrong:** Captain authorizes the app, refresh token is stored. Later the token is revoked (e.g., security audit) or expires. Captain re-authorizes but Google doesn't return a new refresh token because consent was already granted.
**Why it happens:** Google omits `refresh_token` in responses after first consent unless `prompt=consent` is included.
**How to avoid:** Always include `prompt=consent` in the authorization URL. When storing new tokens, merge with existing (preserve refresh token if new response doesn't include one).
**Warning signs:** `googleapis` throws `invalid_grant` error when trying to refresh.

### Pitfall 2: YT IFrame API Global Callback Race Condition
**What goes wrong:** Two modals open before the YouTube API script finishes loading. The second mount overwrites `window.onYouTubeIframeAPIReady`, so the first component's player never initializes.
**Why it happens:** `onYouTubeIframeAPIReady` is a global single-slot callback (documented in CONCERNS.md).
**How to avoid:** Load the YouTube API script once in `app/layout.tsx` (not per-component). Use a module-level callback queue pattern:
```typescript
// lib/youtube-api.ts
const pendingCallbacks: (() => void)[] = []
let apiReady = false

if (typeof window !== 'undefined') {
  window.onYouTubeIframeAPIReady = () => {
    apiReady = true
    pendingCallbacks.forEach(cb => cb())
    pendingCallbacks.length = 0
  }
}

export function onYouTubeReady(cb: () => void) {
  if (apiReady) cb()
  else pendingCallbacks.push(cb)
}
```
**Warning signs:** Player container div renders but video never loads; no console errors.

### Pitfall 3: iOS Safari Fullscreen API Limitations
**What goes wrong:** `Element.requestFullscreen()` is called on the player container. On Android it works. On iPhone it silently fails.
**Why it happens:** iPhone does not support `Element.requestFullscreen()` at all. Only `HTMLVideoElement.webkitEnterFullscreen()` works on iPhone, but this is inaccessible for embedded YouTube players (the `<video>` element is inside the cross-origin iframe).
**How to avoid:** Set `playsinline: 0` on mobile (allows YouTube's native fullscreen button to trigger native fullscreen). Wrap `requestFullscreen()` in try-catch. Add a note in the UI for iPhone users: "Tap the fullscreen icon in the player."
**Warning signs:** Fullscreen works on Android but not iPhone.

### Pitfall 4: Unlisted Videos Not Returned Without OAuth
**What goes wrong:** A `playlistItems.list` call returns empty or only public videos.
**Why it happens:** Unauthenticated or API-key-only requests only return public content from the uploads playlist. Unlisted videos are hidden from unauthenticated requests.
**How to avoid:** Always use the OAuth2 authenticated client (not a simple API key) for the import endpoint. Verify the OAuth scope includes `youtube.readonly`.
**Warning signs:** Import returns 0 items even though videos exist on the channel.

### Pitfall 5: `drive_file_id` Column Rename Breaks Existing Data
**What goes wrong:** After renaming `session_videos.drive_file_id` to `youtube_video_id`, all existing queries using the old column name fail.
**Why it happens:** Column rename requires updating all TypeScript types and all Supabase query strings.
**How to avoid:** Search for all uses of `drive_file_id` in the codebase before running the migration. Update `DbSessionVideo` type, all API route queries, and component code in a single wave.
**Warning signs:** `supabase.from('session_videos').select('drive_file_id')` returns a Postgres column-not-found error.

### Pitfall 6: YouTube API Quota Exhaustion During Development
**What goes wrong:** Frequent test imports during development consume the 10,000 unit daily quota.
**Why it happens:** Developers trigger the import endpoint repeatedly during testing without caching.
**How to avoid:** Cache the last import timestamp in `app_config`. Add a minimum polling interval (e.g., 15 minutes). During development, use a hardcoded mock response for the import endpoint.
**Warning signs:** API returns `quotaExceeded` error.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### YouTube IFrame API — Player Initialization (ALL videos)
```typescript
// Source: https://developers.google.com/youtube/iframe_api_reference
// Pattern: Use for ALL youtube videos, not just multi-chapter reference videos

useEffect(() => {
  if (!videoId) return
  onYouTubeReady(() => {  // from lib/youtube-api.ts queue
    if (ytPlayerRef.current) return  // already created
    const container = document.getElementById(containerId)
    if (!container) return

    const isMobile = window.innerWidth <= 640
    ytPlayerRef.current = new window.YT.Player(containerId, {
      videoId,
      playerVars: {
        playsinline: isMobile ? 0 : 1,  // 0 = fullscreen on mobile tap
        rel: 0,
        fs: 1,
        start: startSeconds ?? 0,
      },
      events: {
        onReady: (e) => {
          if (startSeconds) e.target.seekTo(startSeconds, true)
        },
        onStateChange: (e) => {
          // Auto-advance multi-video chapters
          if (e.data === window.YT.PlayerState.ENDED && onVideoEnded) {
            onVideoEnded()
          }
        },
      },
    })
  })
  return () => {
    try { ytPlayerRef.current?.destroy() } catch {}
    ytPlayerRef.current = null
  }
}, [videoId])
```

### YouTube Data API — Get Uploads Playlist Items
```typescript
// Source: https://developers.google.com/youtube/v3/docs/playlistItems/list
// Quota cost: 1 unit per call

const uploadsPlaylistId = 'UU' + channelId.replace(/^UC/, '')  // UCxxx → UUxxx

const response = await youtube.playlistItems.list({
  part: ['snippet', 'contentDetails'],
  playlistId: uploadsPlaylistId,
  maxResults: 50,
})

type UploadItem = {
  videoId: string
  title: string
  publishedAt: string
}

const uploads: UploadItem[] = (response.data.items ?? []).map(item => ({
  videoId: item.contentDetails?.videoId ?? '',
  title: item.snippet?.title ?? 'Untitled',
  publishedAt: item.snippet?.publishedAt ?? new Date().toISOString(),
}))
```

### Auto-capture Timestamp on Comment Post
```typescript
// Capture current playback time when user posts a comment
function handleCommentFocus() {
  if (!timestampRaw && ytPlayerRef.current) {
    try {
      const state = ytPlayerRef.current.getPlayerState()
      // Only auto-capture if video is playing or paused (not ended/unstarted)
      if (state === 1 || state === 2) {  // 1=PLAYING, 2=PAUSED
        const seconds = Math.floor(ytPlayerRef.current.getCurrentTime())
        if (seconds > 0) setTimestampRaw(formatTime(seconds))
      }
    } catch { /* player not ready */ }
  }
}
```

### Chapter List — Vertical Stacked (replacing pill buttons)
```typescript
// Current: flex-wrap pills — REPLACE WITH:
<div className="space-y-1 overflow-y-auto max-h-48">
  {chapters.map((ch) => {
    const isActive = ch.id === activeChapterId
    return (
      <button
        key={ch.id}
        onClick={() => handleChapterClick(ch)}
        className={clsx(
          'w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors',
          isActive
            ? 'bg-purple-600 text-white'
            : 'hover:bg-purple-50 text-gray-700'
        )}
      >
        <span className={clsx('font-mono text-xs shrink-0 mt-0.5', isActive ? 'text-purple-200' : 'text-purple-400')}>
          {ch.start_seconds != null ? formatTime(ch.start_seconds) : '--:--'}
        </span>
        <span className="text-sm font-medium leading-snug">{ch.title}</span>
      </button>
    )
  })}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Drive embeds (iOS-blocked) | YouTube-only embeds | Phase 2 | Eliminates #1 known blocker |
| Manual timestamp entry for comments | Auto-capture via `getCurrentTime()` | Phase 2 | Major UX improvement for reviewers |
| postMessage polling for video end detection | `onStateChange` event in YT.Player constructor | Phase 2 | Eliminates race condition documented in CONCERNS.md |
| Pill-based chapter nav (gets crowded >5) | Vertical scrollable list | Phase 2 | Handles unlimited chapters cleanly |
| import-sheet route (Google Sheets CSV) | YouTube Data API uploads playlist | Phase 2 | Fully automated, no manual sheet maintenance |

**Deprecated/outdated:**
- `app/api/import-sheet/route.ts`: Replaced by `/api/youtube/import/route.ts`. File can be deleted.
- `embedUrl()` and `thumbnailUrl()` in `lib/types.ts`: Drive-specific helpers become dead code. Mark `@deprecated` or remove.
- `session_videos.drive_file_id` column: Renamed to `youtube_video_id`.
- `reference_videos.type = 'drive'` check constraint variant: Eliminated.
- `videoType === 'drive'` branches in VideoWatchView: All dead code after migration.

---

## Open Questions

1. **Channel ID source**
   - What we know: The app needs the team's YouTube channel ID to derive the uploads playlist ID (`UUxxx`).
   - What's unclear: Does the captain know their channel ID? Should the app store it in `app_config` or read it from the OAuth token via `channels.list(mine: true)` at first-auth time?
   - Recommendation: At OAuth callback time, call `channels.list({ part: ['id', 'contentDetails'], mine: true })` once and store the channel ID + uploads playlist ID in `app_config`. This is 1 quota unit and saves needing a separate env var.

2. **Existing Drive reference videos — migration UX**
   - What we know: The context doc says "existing Drive reference videos will need re-adding as YouTube links."
   - What's unclear: Should the app show these videos in a degraded state with a "re-add as YouTube" prompt, or silently hide them?
   - Recommendation: Add a visual indicator on Drive-type reference videos (e.g., orange badge "Needs YouTube link") so the captain knows what to update. Don't delete them automatically.

3. **OAuth token expiry in Vercel serverless**
   - What we know: `googleapis` will auto-refresh the access token using the stored refresh token.
   - What's unclear: If two concurrent import requests arrive simultaneously with an expired token, both will try to refresh, creating a race condition (two refresh token exchanges, one is invalidated).
   - Recommendation: At Claude's discretion — for this team size (50 users) concurrent imports are extremely unlikely. Document the risk; handle gracefully with a `429 Too Many Requests` fallback.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (not yet installed — Wave 0 gap) |
| Config file | `vitest.config.ts` — Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose lib/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VID-02 | `youtubeEmbedUrl()` builds correct embed URL with start param | unit | `npx vitest run lib/types.test.ts` | Wave 0 |
| VID-02 | `extractYouTubeInfo()` parses all URL formats | unit | `npx vitest run lib/types.test.ts` | Wave 0 |
| VID-03 | Chapter click calls `seekTo()` with correct seconds | unit | `npx vitest run components/VideoWatchView.test.tsx` | Wave 0 |
| VID-04 | `onStateChange` ENDED triggers `onVideoEnded` callback | unit | `npx vitest run components/VideoWatchView.test.tsx` | Wave 0 |
| VID-05 | Player renders with `playsinline: 1` on desktop | unit | `npx vitest run components/VideoWatchView.test.tsx` | Wave 0 |
| VID-01/02 | All session video API routes return `youtube_video_id` field | unit | `npx vitest run __tests__/api/sessions.test.ts` | Wave 0 |
| import | `/api/youtube/import` returns 403 for non-captain | unit | `npx vitest run __tests__/api/youtube-import.test.ts` | Wave 0 |
| import | Uploads playlist ID derivation: `UCxxx` → `UUxxx` | unit | `npx vitest run lib/youtube-oauth.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run lib/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — framework config
- [ ] `test/setup.ts` — mock `next/navigation`, global fetch, `window.YT`
- [ ] `lib/types.test.ts` — covers `youtubeEmbedUrl()`, `extractYouTubeInfo()`, `formatTime()`, `parseTimestamp()`
- [ ] `lib/youtube-oauth.test.ts` — covers uploads playlist ID derivation, token storage helpers
- [ ] `components/VideoWatchView.test.tsx` — smoke render + chapter interaction + auto-advance callback
- [ ] `__tests__/api/youtube-import.test.ts` — auth guard, mock googleapis response
- [ ] Framework install: `npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @vitejs/plugin-react`

---

## Sources

### Primary (HIGH confidence)
- [YouTube IFrame Player API Reference](https://developers.google.com/youtube/iframe_api_reference) — onStateChange events, PlayerState constants, getCurrentTime, playerVars (playsinline, fs, rel)
- [YouTube Data API — PlaylistItems:list](https://developers.google.com/youtube/v3/docs/playlistItems/list) — quota cost (1 unit), parameters, response schema
- [YouTube Data API — OAuth Server-Side Flow](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps) — authorization URL parameters, token exchange, refresh token behavior
- [googleapis npm](https://www.npmjs.com/package/googleapis) — OAuth2 client, youtube.playlistItems.list, token auto-refresh
- Existing codebase: `components/VideoWatchView.tsx` — working YT.Player implementation, getCurrentTime polling, postMessage auto-advance
- Existing codebase: `lib/types.ts` — `youtubeEmbedUrl()`, `youtubeThumbnailUrl()`, `extractYouTubeInfo()`, `parseTimestamp()`, `formatTime()`
- Existing codebase: `supabase-schema-v2.sql` — `session_videos.drive_file_id`, `reference_videos.type` constraint, `app_config` table

### Secondary (MEDIUM confidence)
- [YouTube channel playlist ID prefixes (codegenes.net)](https://www.codegenes.net/blog/youtube-channel-and-playlist-id-prefixes/) — UU prefix for uploads playlist derivation from UC channel ID
- [Apple Developer Forums — iOS Fullscreen API](https://developer.apple.com/forums/thread/133248) — iPhone does not support Element.requestFullscreen(); webkitEnterFullscreen only works on video elements
- [YouTube Embedded Players Parameters](https://developers.google.com/youtube/player_parameters) — `playsinline` parameter behavior on iOS

### Tertiary (LOW confidence)
- [GitHub Gist — IFrame time events without polling](https://gist.github.com/zavan/75ed641de5afb1296dbc02185ebf1ea0) — Alternative to setInterval polling using postMessage; LOW — official API events are preferred

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — googleapis is the official Google library; YouTube IFrame API is first-party; existing codebase already implements both
- Architecture: HIGH — OAuth server-side flow is well-documented; IFrame API patterns are already in production in VideoWatchView.tsx
- Pitfalls: HIGH — `prompt=consent` refresh token issue is well-documented by Google; iOS fullscreen limitation confirmed by Apple Developer Forums; YT callback race condition is documented in existing CONCERNS.md

**Research date:** 2026-03-10
**Valid until:** 2026-06-10 (YouTube API v3 is stable; googleapis major version changes slowly)
