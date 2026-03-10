---
phase: 02-video-playback
plan: 02
subsystem: api
tags: [youtube, oauth, googleapis, google-oauth2, zod, import-pipeline]

# Dependency graph
requires:
  - phase: 02-video-playback plan 01
    provides: youtube-oauth.ts (createOAuthClient, storeTokens, getAuthenticatedYouTube, getChannelInfo), DbSessionVideo type, session_videos table, app_config table

provides:
  - YouTube OAuth auth endpoint (GET /api/youtube/auth) — captain-only, redirects to Google consent
  - YouTube OAuth callback endpoint (GET /api/youtube/callback) — exchanges code for tokens
  - YouTube import endpoint (POST /api/youtube/import) — reads uploads playlist, deduplicates, creates sessions
  - YouTube status endpoint (GET /api/youtube/status) — returns connection state + channelId
  - Zod schemas for import response and status (lib/schemas/youtube.ts)
  - Dashboard YouTube UI — connect button, import controls, result/error display, query-param banners

affects:
  - 02-video-playback plan 03 (video player component will use session_videos created by import)
  - 02-video-playback plan 04 (multi-part video transitions will rely on imported session_videos)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Quota protection via 15-minute cooldown stored in app_config (youtube_last_import)"
    - "OAuth prompt=consent enforced to guarantee refresh_token on re-authorization"
    - "Deduplication via SELECT existing youtube_video_ids before INSERT (no unique constraint needed)"
    - "Sessions grouped by publish date with label format: Practice - MMM D, YYYY"
    - "invalid_grant detection for expired token UX (401 prompts reconnect)"

key-files:
  created:
    - app/api/youtube/auth/route.ts
    - app/api/youtube/callback/route.ts
    - app/api/youtube/import/route.ts
    - app/api/youtube/status/route.ts
    - lib/schemas/youtube.ts
  modified:
    - components/DashboardView.tsx

key-decisions:
  - "prompt=consent on OAuth URL generation ensures refresh_token is always included, even after prior authorization"
  - "15-minute import cooldown enforced server-side via app_config timestamp (quota protection, Research Pitfall 6)"
  - "Deduplication via SELECT + Set before INSERT — avoids race-condition duplicate inserts without requiring DB unique constraint on youtube_video_id"
  - "Sessions created as is_active=false by default — captain activates manually to control which session is shown to team"
  - "Dashboard YouTube view is a dedicated sidebar item (not inlined into existing views) — keeps concerns separated"

patterns-established:
  - "OAuth callback error-redirect pattern: on any error redirect to /dashboard?youtube=error"
  - "Query param banners: ?youtube=connected and ?youtube=error cleaned via window.history.replaceState after reading"

requirements-completed: [VID-01]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 2 Plan 02: YouTube OAuth + Auto-Import Summary

**Google OAuth2 flow and uploads-playlist import pipeline for captain to auto-discover and import YouTube practice videos into sessions with 15-minute cooldown and deduplication.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-10T22:37:23Z
- **Completed:** 2026-03-10T22:40:06Z
- **Tasks:** 3 of 3 complete
- **Files modified:** 6

## Accomplishments
- Four YouTube API routes created under `app/api/youtube/` — auth, callback, import, status
- Import pipeline deduplicates by `youtube_video_id` and groups uploads into sessions by publish date
- Dashboard YouTube section (captain-only) with connect button, import trigger, result display, and error states
- `?youtube=connected` / `?youtube=error` query-param banners handled and auto-dismissed

## Task Commits

Each task was committed atomically:

1. **Task 1: YouTube OAuth endpoints, import pipeline, Zod schemas** - `251c179` (feat)
2. **Task 2: Dashboard YouTube connection UI** - `7437081` (feat)
3. **Task 3: Verify YouTube OAuth and import flow** - human-verify checkpoint (approved by captain)

## Files Created/Modified
- `app/api/youtube/auth/route.ts` - Captain-only GET that redirects to Google OAuth consent screen
- `app/api/youtube/callback/route.ts` - GET that exchanges auth code for tokens + fetches channel info
- `app/api/youtube/import/route.ts` - POST that reads uploads playlist, deduplicates, creates sessions
- `app/api/youtube/status/route.ts` - GET that returns connected state + channelId for any authenticated user
- `lib/schemas/youtube.ts` - ImportResponseSchema and YouTubeStatusSchema Zod types
- `components/DashboardView.tsx` - Added YouTube sidebar item, status fetch, import controls, banners

## Decisions Made
- `prompt=consent` enforced on OAuth URL — guarantees refresh_token is always returned even on re-auth
- 15-minute cooldown stored as Unix timestamp string in `app_config` (key: `youtube_last_import`)
- Deduplication uses SELECT + in-memory Set before INSERT rather than relying on DB constraints
- Sessions created with `is_active=false` — captain controls which session is visible to team
- Dedicated YouTube sidebar view in DashboardView rather than inlining into settings

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
The plan's `user_setup` block specifies:
- `GOOGLE_CLIENT_ID` — from Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs
- `GOOGLE_CLIENT_SECRET` — same location
- `GOOGLE_REDIRECT_URI` — set to `https://{your-domain}/api/youtube/callback` (or `http://localhost:3000/api/youtube/callback` for dev)
- YouTube Data API v3 must be enabled in Google Cloud Console
- OAuth 2.0 Client ID must be type "Web application" with the redirect URI added to authorized redirect URIs

## Next Phase Readiness
- Session videos from the import pipeline are ready for Plan 03 (video player component rewrite)
- The `session_videos` table now contains rows with real `youtube_video_id` values for testing
- Plan 03 can use `/api/youtube/status` to gate YouTube-specific playback features

---
*Phase: 02-video-playback*
*Completed: 2026-03-10*
