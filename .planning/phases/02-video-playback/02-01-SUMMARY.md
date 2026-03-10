---
phase: 02-video-playback
plan: 01
subsystem: database
tags: [youtube, googleapis, oauth2, typescript, postgresql, migration]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: normalized v2 schema (session_videos, reference_videos, app_config tables)
provides:
  - scripts/migrate-phase2.sql: DDL to rename drive_file_id->youtube_video_id and enforce YouTube-only type
  - supabase-schema-v2.sql: updated canonical schema with youtube_video_id
  - lib/types.ts: DbSessionVideo.youtube_video_id, ReferenceVideo.type='youtube'
  - lib/youtube-api.ts: IFrame API callback queue (onYouTubeReady, loadYouTubeAPI)
  - lib/youtube-oauth.ts: server-only OAuth2 helpers (createOAuthClient, getAuthenticatedYouTube, getStoredTokens, storeTokens, getChannelInfo)
affects:
  - 02-02 (YouTube OAuth import — needs youtube-oauth.ts and app_config channel fields)
  - 02-03 (player rewrite — needs youtube-api.ts callback queue and updated DbSessionVideo type)

# Tech tracking
tech-stack:
  added: [googleapis]
  patterns:
    - YouTube IFrame API loaded via callback queue to prevent race conditions
    - server-only guard on OAuth helpers to prevent token leakage to client
    - Deprecated Drive helpers retained with @deprecated JSDoc until Plan 03 removes them

key-files:
  created:
    - scripts/migrate-phase2.sql
    - lib/youtube-api.ts
    - lib/youtube-oauth.ts
  modified:
    - supabase-schema-v2.sql
    - lib/types.ts
    - package.json

key-decisions:
  - "Retained deprecated Drive helpers (thumbnailUrl, embedUrl, extractDriveFileId) with @deprecated JSDoc rather than deleting — components still import them; deletion deferred to Plan 03 component rewrite"
  - "youtube-api.ts omits Window.YT global redeclaration to avoid conflict with VideoWatchView.tsx which already declares it with a precise type"
  - "YouTubeTokens type explicitly exported from youtube-oauth.ts for type safety at call sites"

patterns-established:
  - "server-only: first line in any file that handles OAuth tokens or service credentials"
  - "Callback queue pattern for YouTube IFrame API: register via onYouTubeReady(), inject once via loadYouTubeAPI()"

requirements-completed: [VID-01, VID-02]

# Metrics
duration: 12min
completed: 2026-03-10
---

# Phase 2 Plan 1: YouTube-Only Foundation Summary

**Renamed session_videos.drive_file_id to youtube_video_id, enforced YouTube-only reference_videos type, installed googleapis, and created centralized YouTube IFrame API loader + OAuth2 helper library**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-10T00:00:00Z
- **Completed:** 2026-03-10T00:12:00Z
- **Tasks:** 2
- **Files modified:** 5 (plus 2 created)

## Accomplishments

- Database migration SQL written for drive_file_id rename and reference_videos type constraint update
- Canonical schema (supabase-schema-v2.sql) updated to reflect YouTube-only storage
- TypeScript types updated: DbSessionVideo.youtube_video_id, ReferenceVideo.type simplified to 'youtube'
- Centralized YouTube IFrame API loader with callback queue prevents race conditions across components
- googleapis-backed OAuth2 helpers (server-only) ready for captain authorization flow in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration + schema + type updates** - `7fefcce` (feat)
2. **Task 2: YouTube API libraries + googleapis install** - `5abc67b` (feat)

**Plan metadata:** (docs commit — see final_commit step)

## Files Created/Modified

- `scripts/migrate-phase2.sql` - DDL: rename drive_file_id, update type constraint to YouTube-only
- `supabase-schema-v2.sql` - Updated canonical fresh-install schema
- `lib/types.ts` - DbSessionVideo.youtube_video_id, ReferenceVideo.type='youtube', Drive helpers @deprecated
- `lib/youtube-api.ts` - IFrame API callback queue; exports onYouTubeReady, loadYouTubeAPI
- `lib/youtube-oauth.ts` - Server-only OAuth2 helpers; exports createOAuthClient, getAuthenticatedYouTube, getStoredTokens, storeTokens, getChannelInfo
- `package.json` / `package-lock.json` - googleapis added

## Decisions Made

- Retained deprecated Drive helpers with `@deprecated` JSDoc rather than deleting immediately. Components still import them; a hard delete at this point would break builds. Deletion deferred to Plan 03 which rewrites those components.
- Omitted `Window.YT` global redeclaration from `youtube-api.ts` to avoid a TypeScript "duplicate property" conflict with the precise `YT` type already declared in `VideoWatchView.tsx`.

## Deviations from Plan

None — plan executed exactly as written. One pre-existing TypeScript error in `VideoWatchView.tsx` (implicit `any` parameter) was noted but is out of scope (pre-existing, unrelated file). Deferred.

## Issues Encountered

- `VideoWatchView.tsx` already had a global `Window.YT` declaration with a precise type. Adding a second `Window.YT: any` in `youtube-api.ts` caused a TypeScript duplicate-property error. Resolved by omitting the `YT` property from the `youtube-api.ts` global augmentation — only `onYouTubeIframeAPIReady` is declared there.

## User Setup Required

New environment variables required for OAuth (used in Plans 02 and 03):
- `GOOGLE_CLIENT_ID` — OAuth2 client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` — OAuth2 client secret
- `GOOGLE_REDIRECT_URI` — e.g., `https://your-domain.com/api/auth/youtube/callback`

The migration SQL (`scripts/migrate-phase2.sql`) must be run against the live Supabase database before deploying Phase 2.

## Next Phase Readiness

- Plan 02-02 (YouTube OAuth import) can now proceed: `lib/youtube-oauth.ts` provides all necessary helpers and the `app_config` table is ready for channel_id and uploads_playlist_id
- Plan 02-03 (player rewrite) can now proceed: `DbSessionVideo.youtube_video_id` is the correct field name, and `lib/youtube-api.ts` callback queue is available

---
*Phase: 02-video-playback*
*Completed: 2026-03-10*
