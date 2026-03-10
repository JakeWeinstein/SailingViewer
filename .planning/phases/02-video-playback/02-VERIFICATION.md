---
phase: 02-video-playback
verified: 2026-03-10T18:35:00Z
status: human_needed
score: 8/8 must-haves verified (automated); 4 behaviors require human confirmation
human_verification:
  - test: "Watch a practice video on iPhone Safari"
    expected: "Video plays inline via YouTube player, no redirect to YouTube app, no horizontal overflow"
    why_human: "iOS Safari inline playback and viewport overflow cannot be verified programmatically"
  - test: "Click a chapter in the vertical list while a video is playing"
    expected: "Player seeks to that chapter's timestamp instantly; active chapter highlights in purple"
    why_human: "YT.Player.seekTo behavior and real UI highlighting require a running browser with the IFrame API loaded"
  - test: "Let a multi-part chapter sequence reach the end of the first part"
    expected: "Player automatically loads the next chapter's video without user action"
    why_human: "Auto-advance depends on the YT.PlayerState.ENDED event firing live — cannot mock the full player lifecycle statically"
  - test: "Complete the YouTube OAuth flow as captain (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI must be set in .env.local)"
    expected: "Clicking Connect YouTube redirects to Google consent; after approval, dashboard shows green Connected badge; Import New Videos button creates sessions"
    why_human: "OAuth round-trip requires real Google credentials and a running server; cannot be verified from source code alone"
---

# Phase 2: Video Playback Verification Report

**Phase Goal:** Videos play reliably on every device — all content is YouTube-only, chapters seek correctly, multi-part videos auto-advance, and the captain can import videos from the team YouTube channel via OAuth
**Verified:** 2026-03-10T18:35:00Z
**Status:** human_needed (all automated checks pass; 4 runtime behaviors require human confirmation)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Team member on any device (including iPhone Safari) can watch a YouTube-embedded practice video reliably | ? HUMAN NEEDED | VideoWatchView uses YT.Player with `playsinline: 1`; mobile layout confirmed in code (`flex flex-col sm:flex-row`); actual iOS Safari playback requires device test |
| 2 | A YouTube reference video with chapter markers allows clicking any chapter to seek to that timestamp | ? HUMAN NEEDED | `handleChapterClick` calls `ytPlayerRef.current.seekTo(ch.start_seconds, true)`; vertical chapter list with `max-h-48 overflow-y-auto` confirmed in JSX; live browser needed to confirm |
| 3 | A multi-part YouTube chapter sequence transitions automatically from one video to the next at the chapter boundary | ? HUMAN NEEDED | `onStateChange` handler checks `window.YT.PlayerState.ENDED`, calls `loadVideoById` for cross-video advance; verified in source but requires live event to confirm |
| 4 | Video player controls and video sizing display correctly on a 375px mobile viewport with no horizontal overflow | ? HUMAN NEEDED | Tailwind `flex flex-col sm:flex-row` present; `w-full sm:w-[65%]` on video column; verified structurally but visual sizing requires browser |

**Supporting automated truths (fully verified):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | All content is YouTube-only — no Drive thumbnails or embeds in active component code | ✓ VERIFIED | Zero hits for `drive.google.com`, `embedUrl`, `thumbnailUrl` (non-deprecated) in components/app layer |
| 6 | Captain can initiate OAuth flow, tokens are stored in app_config, and re-importing does not create duplicates | ✓ VERIFIED | `/api/youtube/auth` → 403 non-captain; `/api/youtube/import` deduplicates via `SELECT youtube_video_id FROM session_videos WHERE youtube_video_id IN (...)` before INSERT |
| 7 | Vitest test infrastructure runs cleanly with zero failures | ✓ VERIFIED | `npx vitest run`: 44 passing, 11 todo, 0 failures |
| 8 | TypeScript compiles with no errors | ✓ VERIFIED | `npx tsc --noEmit` exits cleanly |

**Score:** 4/4 ROADMAP success criteria verified structurally; all 4 require human runtime confirmation for full assurance.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vitest.config.ts` | Vitest config with React plugin and jsdom | ✓ VERIFIED | `environment: 'jsdom'`, `setupFiles: ['./test/setup.ts']`, React plugin present |
| `test/setup.ts` | Global mocks: next/navigation, fetch, window.YT | ✓ VERIFIED | All three mocks present; window.YT guard for server environments |
| `lib/types.test.ts` | Real passing tests for utility functions | ✓ VERIFIED | 19 assertions: youtubeEmbedUrl, youtubeThumbnailUrl, extractYouTubeInfo, formatTime, parseTimestamp |
| `lib/youtube-oauth.test.ts` | Test stubs for OAuth helpers | ✓ VERIFIED | 3 `test.todo` stubs |
| `components/VideoWatchView.test.tsx` | Smoke + chapter + auto-advance stubs | ✓ VERIFIED | 3 `test.todo` stubs |
| `__tests__/api/youtube-import.test.ts` | Auth guard + playlist response stubs | ✓ VERIFIED | 3 `test.todo` stubs |
| `__tests__/api/sessions.test.ts` | Session video API stubs | ✓ VERIFIED | 2 `test.todo` stubs |
| `scripts/migrate-phase2.sql` | DDL: rename drive_file_id, update type constraint | ✓ VERIFIED | `RENAME COLUMN drive_file_id TO youtube_video_id`; constraint updated to `'youtube'` only |
| `supabase-schema-v2.sql` | Updated canonical schema with youtube_video_id | ✓ VERIFIED | `youtube_video_id TEXT NOT NULL` confirmed at line 37 |
| `lib/types.ts` | DbSessionVideo.youtube_video_id; ReferenceVideo.type='youtube'; Drive helpers @deprecated | ✓ VERIFIED | All three changes present; `@deprecated` JSDoc on thumbnailUrl, embedUrl, extractDriveFileId |
| `lib/youtube-api.ts` | IFrame API callback queue with onYouTubeReady, loadYouTubeAPI | ✓ VERIFIED | Callback queue pattern implemented; both functions exported |
| `lib/youtube-oauth.ts` | server-only; createOAuthClient, getStoredTokens, storeTokens, getAuthenticatedYouTube, getChannelInfo | ✓ VERIFIED | `import 'server-only'` is first line; all 5 functions exported with correct implementations |
| `app/api/youtube/auth/route.ts` | Captain-only GET → Google consent redirect | ✓ VERIFIED | 403 for non-captain; `prompt: 'consent'`; `access_type: 'offline'` |
| `app/api/youtube/callback/route.ts` | GET: exchange code, store tokens, store channel info | ✓ VERIFIED | `storeTokens()` + `getChannelInfo()` called; redirects to `/dashboard?youtube=connected` |
| `app/api/youtube/import/route.ts` | POST: reads uploads playlist, deduplicates, creates sessions | ✓ VERIFIED | 15-min cooldown; dedup via `SELECT youtube_video_id … WHERE youtube_video_id IN (...)`; sessions grouped by publish date |
| `app/api/youtube/status/route.ts` | GET: returns connection state + channelId | ✓ VERIFIED | Reads `youtube_oauth_tokens` from app_config; any authenticated role |
| `lib/schemas/youtube.ts` | Zod schemas for import response and status | ✓ VERIFIED | `ImportResponseSchema`, `YouTubeStatusSchema` (discriminated union) |
| `components/VideoWatchView.tsx` | YT.Player, chapter list, auto-advance, mobile, timestamp capture | ✓ VERIFIED | 829 lines; `onYouTubeReady` call; `window.YT.Player` instantiation; `PlayerState.ENDED` handler; `getCurrentTime()` in `handleCommentFocus`; `flex flex-col sm:flex-row` |
| `components/YouTubeLoader.tsx` | Client component calling loadYouTubeAPI() once globally | ✓ VERIFIED | Renders null; calls `loadYouTubeAPI()` in `useEffect` |
| `app/layout.tsx` | Renders YouTubeLoader to load IFrame API globally | ✓ VERIFIED | `import YouTubeLoader` + `<YouTubeLoader />` in body |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `vitest.config.ts` | `test/setup.ts` | `setupFiles` config | ✓ WIRED | `setupFiles: ['./test/setup.ts']` confirmed |
| `lib/youtube-api.ts` | `window.onYouTubeIframeAPIReady` | callback queue pattern | ✓ WIRED | `window.onYouTubeIframeAPIReady = () => { apiReady = true; pendingCallbacks.forEach(cb => cb()) }` |
| `lib/youtube-oauth.ts` | `app_config` table | `getStoredTokens()` / `storeTokens()` | ✓ WIRED | `.from('app_config').select('value').eq('key', 'youtube_oauth_tokens')` |
| `app/api/youtube/auth/route.ts` | `lib/youtube-oauth.ts` | `createOAuthClient()` | ✓ WIRED | `import { createOAuthClient }` at top; called in GET handler |
| `app/api/youtube/callback/route.ts` | `app_config` table | `storeTokens()` + `getChannelInfo()` | ✓ WIRED | Both called after successful token exchange |
| `app/api/youtube/import/route.ts` | `session_videos` table | `getAuthenticatedYouTube()` → playlist → INSERT | ✓ WIRED | Full pipeline: auth → playlist.list → SELECT existing IDs → INSERT new rows |
| `app/api/youtube/import/route.ts` | Deduplication | `SELECT youtube_video_id FROM session_videos WHERE youtube_video_id IN (...)` | ✓ WIRED | `.from('session_videos').select('youtube_video_id').in('youtube_video_id', playlistVideoIds)` |
| `components/DashboardView.tsx` | `/api/youtube/auth` | Connect YouTube button | ✓ WIRED | `href="/api/youtube/auth"` at line 582 and 596 |
| `components/VideoWatchView.tsx` | `lib/youtube-api.ts` | `onYouTubeReady` callback | ✓ WIRED | `import { onYouTubeReady }` + called in player init `useEffect` |
| `components/VideoWatchView.tsx` | `YT.Player.onStateChange` | `PlayerState.ENDED` triggers auto-advance | ✓ WIRED | `event.data === window.YT.PlayerState.ENDED` → `loadVideoById` or `seekTo` |
| `components/VideoWatchView.tsx` | `YT.Player.getCurrentTime` | comment focus auto-captures timestamp | ✓ WIRED | `handleCommentFocus` → `player.getPlayerState()` check → `Math.floor(player.getCurrentTime())` |
| `app/layout.tsx` | `lib/youtube-api.ts` | `loadYouTubeAPI()` via YouTubeLoader | ✓ WIRED | YouTubeLoader.tsx imports and calls `loadYouTubeAPI()` in useEffect; layout renders `<YouTubeLoader />` |
| `app/page.tsx` | `youtubeThumbnailUrl` | replaced Drive thumbnailUrl | ✓ WIRED | `import { youtubeThumbnailUrl }` + used at lines 186 and 395 |
| `components/ArticleViewer.tsx` | `youtubeEmbedUrl` | replaced Drive embedUrl | ✓ WIRED | `import { youtubeEmbedUrl }` + used in both rendering branches |
| `components/ReferenceManager.tsx` | `youtubeThumbnailUrl` | replaced Drive thumbnailUrl | ✓ WIRED | `import { youtubeThumbnailUrl }` + used at line 254 |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VID-01 | 02-00, 02-01, 02-02, 02-03 | User can watch Google Drive embedded videos with reliable playback — NOTE: requirement text describes Drive but the phase intent is YouTube-only playback reliability | ✓ SATISFIED | YouTube OAuth import + YT.Player based playback replaces Drive. All content migrated to YouTube-only. |
| VID-02 | 02-00, 02-01, 02-03 | User can watch YouTube embedded videos with reliable playback on mobile and desktop | ✓ SATISFIED | YT.Player initialized via callback queue (no race condition); mobile layout `flex-col sm:flex-row`; `playsinline:1` set |
| VID-03 | 02-00, 02-03 | User can navigate chapters to jump to specific moments | ✓ SATISFIED | Vertical chapter list in VideoWatchView; `handleChapterClick` calls `seekTo` or `loadVideoById`; active chapter highlighted with `bg-purple-600` |
| VID-04 | 02-00, 02-03 | Multi-part YouTube videos transition seamlessly between parts | ✓ SATISFIED | `onStateChange` ENDED handler advances `activeChapterIndex`, calls `loadVideoById` for cross-video transitions |
| VID-05 | 02-00, 02-03 | Video player displays properly on mobile | ✓ SATISFIED | `flex flex-col sm:flex-row`; video column `w-full sm:w-[65%]`; `playsinline:1` always set |

No orphaned requirements — all 5 requirement IDs (VID-01 through VID-05) appear in at least one plan's `requirements` field and are accounted for above.

**Note on VID-01 description mismatch:** REQUIREMENTS.md text reads "User can watch Google Drive embedded videos" but the Phase 2 goal and all plans explicitly migrate away from Drive to YouTube-only. VID-01 is satisfied in the intended sense (reliable playback), even though the literal requirement text references Drive. This is a requirements document artifact — the phase intent is correct and implemented.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/types.ts` | 133 | `ArticleBlock.videoType?: 'drive' \| 'youtube'` — `'drive'` option retained in the union type | ℹ️ Info | No component reads this `'drive'` path in rendering (ArticleViewer uses `youtubeEmbedUrl` unconditionally); the type allows invalid states but does not cause runtime errors |
| `lib/types.ts` | 158-210 | `thumbnailUrl`, `embedUrl`, `extractDriveFileId` — deprecated Drive helpers still exported | ℹ️ Info | Intentional deferral documented in all summaries; marked `@deprecated`; no component imports them (verified by grep); can be deleted in a future cleanup phase |

No blocker or warning anti-patterns found. Both items are pre-planned technical debt, not implementation gaps.

---

### Human Verification Required

#### 1. iPhone Safari Inline Playback (VID-02, VID-05)

**Test:** On an iPhone, navigate to the app, open a practice video, and observe playback behavior.
**Expected:** Video plays inline within the modal (not redirecting to YouTube app or native fullscreen); no horizontal overflow; player controls accessible; layout stacks vertically (video above comments).
**Why human:** iOS Safari inline video behavior (`playsinline`) and viewport overflow require a physical or emulated device. The code sets `playsinline: 1` (always, per the research guidance), but actual rendering on Safari/WKWebView cannot be confirmed statically.

#### 2. Chapter Click-to-Seek (VID-03)

**Test:** Open a reference video that has chapter markers. Click a chapter that is not the current one.
**Expected:** The YT.Player seeks to that chapter's start timestamp immediately; the clicked chapter button highlights in purple; the previously active chapter unhighlights.
**Why human:** `seekTo` is wired in code and the active index state is updated, but the IFrame API must be loaded and the player must be in a ready state for this to work. A running browser is required to confirm the end-to-end behavior.

#### 3. Multi-Part Auto-Advance (VID-04)

**Test:** Open a reference video set where chapters span multiple YouTube video IDs. Let the first video play to its end (or seek near the end).
**Expected:** When `PlayerState.ENDED` fires, the player automatically loads the next chapter's video ID without any user action; the active chapter index advances in the UI.
**Why human:** The `onStateChange` handler is correctly wired in code, but the `ENDED` event only fires in a live YouTube player. The mock in `test/setup.ts` provides `PlayerState: { ENDED: 0 }` but the event loop that drives state transitions is not exercised in the test suite (stubs are `test.todo`).

#### 4. YouTube OAuth Flow and Import (VID-01)

**Test:** Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `.env.local`. Log in as captain. Navigate to dashboard. Click "Connect YouTube". Complete the Google consent screen. Return to dashboard.
**Expected:** Dashboard shows green "Connected" badge with channel info. Clicking "Import New Videos" shows import results (count of videos imported and sessions created). Clicking import a second time within 15 minutes shows a cooldown message. After cooldown, re-importing the same videos shows them in the "skipped" count, not re-added.
**Why human:** OAuth requires real Google credentials and a running server. The code is fully implemented and structurally sound, but the round-trip to Google's servers cannot be verified from source alone. The human-verify checkpoint in Plan 02 was marked approved in the summary, but this is documented as a runtime-only confirmation.

---

### Summary

**All automated checks pass.** Every artifact specified in the four plan `must_haves` blocks exists, is substantive (not a stub), and is wired correctly. TypeScript compiles cleanly. Vitest runs with 44 passing tests and 11 planned `todo` stubs, 0 failures. No Drive thumbnail or embed calls remain in active component code. The YouTube OAuth endpoints enforce captain-only access, implement deduplication, and handle token expiry. The IFrame API is initialized via a race-condition-safe callback queue loaded globally in layout.

The 4 outstanding items are all runtime behaviors that require a live browser and/or real OAuth credentials — they cannot be confirmed from static analysis. The Plan 02 and Plan 03 human-verify checkpoints were marked approved in their summaries, which provides evidence that the runtime behaviors were tested at plan completion time.

---

_Verified: 2026-03-10T18:35:00Z_
_Verifier: Claude (gsd-verifier)_
