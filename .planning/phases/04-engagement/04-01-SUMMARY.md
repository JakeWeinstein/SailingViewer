---
phase: 04-engagement
plan: 01
subsystem: api
tags: [notifications, bookmarks, mentions, zod, vitest, supabase, postgresql]

# Dependency graph
requires:
  - phase: 03-core-content
    provides: comments table with author_id, parent_id, send_to_captain; sessions.videos JSONB; users table with username

provides:
  - notifications table (mention, reply, captain_response types) with user_id index
  - bookmarks table with unique constraint on (user_id, video_id, timestamp_seconds)
  - comments.youtube_attachment column for Q&A video attachments
  - GET/PATCH /api/notifications with count-only mode and deep-link enrichment
  - GET/POST /api/bookmarks with 409 on duplicate
  - DELETE /api/bookmarks/[id] with ownership enforcement
  - parseMentions() shared utility (8 behavioral tests)
  - Server-side mention + reply notification creation on comment save
  - Captain response notifications triggered on video note save

affects:
  - 04-02 (notification bell UI, bookmark button UI consume these endpoints)
  - 04-03 (mention rendering uses parseMentions from mention-utils.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fire-and-forget notification creation (.catch(() => {})) — response never fails due to notification errors
    - Q&A top-level posts auto-force send_to_captain=true in server POST handler
    - SupabaseClient passed as parameter to mention-utils functions — keeps module importable on client for parseMentions

key-files:
  created:
    - supabase-migration-phase4.sql
    - lib/schemas/notifications.ts
    - lib/schemas/bookmarks.ts
    - lib/mention-utils.ts
    - lib/__tests__/mention-utils.test.ts
    - app/api/notifications/route.ts
    - app/api/bookmarks/route.ts
    - app/api/bookmarks/[id]/route.ts
  modified:
    - lib/schemas/comments.ts
    - app/api/comments/route.ts
    - app/api/sessions/[id]/video-note/route.ts

key-decisions:
  - "Fire-and-forget notification creation — .catch(() => {}) on all notification helpers so response never fails due to notification errors"
  - "parseMentions + server functions co-located in lib/mention-utils.ts (not server-only) — client can import parseMentions for rendering without server-only restriction"
  - "Q&A top-level posts (no video_id, no parent_id) force send_to_captain=true server-side regardless of what client sends"
  - "SupabaseClient passed as parameter to createMentionNotifications/createReplyNotification/createCaptainResponseNotifications — avoids server-only import breaking client use of parseMentions"
  - "countOnly=true query param on GET /api/notifications returns {unread: count} for bell badge — avoids fetching full list on every page load"

patterns-established:
  - "Pattern: notification creation is always fire-and-forget — never block response on notification insert"
  - "Pattern: ownership check before delete — fetch row, compare user_id to JWT payload.userId, return 403 if mismatch"

requirements-completed: [QA-01, QA-02, QA-03, AUTH-05, COMM-04, COMM-05, VID-06]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 4 Plan 01: Engagement Backend Summary

**Supabase migration + Zod schemas + @mention parsing utility (8 behavioral tests) + notifications, bookmarks, and Q&A API routes with server-side mention/reply/captain_response notification creation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T21:13:00Z
- **Completed:** 2026-03-10T21:15:55Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Database migration SQL adding notifications table, bookmarks table with unique constraint, and comments.youtube_attachment column
- parseMentions utility with 8 passing behavioral tests covering empty strings, inline mentions, multiple mentions, adjacent mentions, email edge case, and underscores/numbers
- Full CRUD API for bookmarks (ownership-checked DELETE, 409 on duplicate) and notifications (count-only mode for bell badge, deep-link enrichment with comment preview)
- Server-side mention + reply notification creation wired into POST /api/comments; captain response notifications wired into PATCH /api/sessions/[id]/video-note

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration + Zod schemas + mention utility + behavioral tests** - `8b1d902` (feat)
2. **Task 2: Notification + bookmark API routes + comments + video-note extensions** - `7b8868c` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `supabase-migration-phase4.sql` - DDL for notifications, bookmarks tables + comments.youtube_attachment
- `lib/schemas/notifications.ts` - MarkReadSchema (id or markAll required)
- `lib/schemas/bookmarks.ts` - CreateBookmarkSchema with nonnegative int timestamp
- `lib/schemas/comments.ts` - Added youtube_attachment field to CreateCommentSchema
- `lib/mention-utils.ts` - parseMentions, createMentionNotifications, createReplyNotification, createCaptainResponseNotifications
- `lib/__tests__/mention-utils.test.ts` - 8 behavioral tests for parseMentions, all passing
- `app/api/notifications/route.ts` - GET (list + countOnly) + PATCH (markOne/markAll) with deep-link enrichment
- `app/api/bookmarks/route.ts` - GET list + POST create with 409 on duplicate
- `app/api/bookmarks/[id]/route.ts` - DELETE with ownership check, 204 on success
- `app/api/comments/route.ts` - Accept youtube_attachment, force send_to_captain for Q&A posts, fire mention+reply notifications
- `app/api/sessions/[id]/video-note/route.ts` - Fire captain_response notifications after saving video note

## Decisions Made
- Fire-and-forget notification creation (.catch(() => {})) — response never fails due to notification errors
- mention-utils.ts is NOT server-only — supabase client passed as parameter so parseMentions can be imported on client for rendering without restriction
- Q&A top-level posts (no video_id AND no parent_id) force send_to_captain=true server-side
- countOnly=true query param on GET /api/notifications returns {unread: count} for bell badge efficiency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
Run `supabase-migration-phase4.sql` against the Supabase database before using engagement features.

## Next Phase Readiness
- All backend endpoints are live and TypeScript-clean
- parseMentions is importable on client — 04-02/04-03 UI plans can use it for mention rendering
- Notification bell badge can use `GET /api/notifications?countOnly=true`
- 121 total tests passing (8 todo stubs, pre-existing)

## Self-Check: PASSED

---
*Phase: 04-engagement*
*Completed: 2026-03-10*
