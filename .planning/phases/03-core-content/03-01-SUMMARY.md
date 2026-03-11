---
phase: 03-core-content
plan: 01
subsystem: api
tags: [comments, auth, zod, postgresql, migrations]

requires:
  - phase: 01-foundation
    provides: JWT auth (getTokenPayload), TokenPayload type, Zod schema patterns
  - phase: 02-video-playback
    provides: YouTube-only types (DbSessionVideo), deprecated Drive helper removal deferred to here

provides:
  - Auth-gated comment API (POST/PATCH/DELETE require JWT; author_id from token only)
  - Threaded reply support via parent_id
  - Comment edit with is_edited flag and updated_at timestamp
  - Zod validation on all comment inputs and query params
  - Phase 3 schema migration SQL (is_edited, updated_at, tags, closed_at, GIN index)
  - Removal of Google Sheet import route

affects:
  - 03-02 (reference video tags — tags column added here)
  - 03-03 (session close — closed_at column added here)
  - Any frontend component reading comments (now must send auth cookie)

tech-stack:
  added: []
  patterns:
    - Zod safeParse on route body and query params with flatten().fieldErrors response shape
    - author_id always from JWT payload, never from request body
    - Ownership check pattern: isOwner || isCaptain for moderation
    - Cascade delete: delete replies before deleting parent comment

key-files:
  created:
    - scripts/migrate-phase3.sql
    - lib/schemas/comments.ts
    - app/api/comments/[id]/route.ts
    - app/api/comments/route.test.ts
  modified:
    - lib/types.ts
    - app/api/comments/route.ts
  deleted:
    - app/api/import-sheet/route.ts

key-decisions:
  - "author_id comes from JWT payload exclusively — body-injected author_id silently ignored"
  - "Captain role can edit or delete any comment for moderation (ownership check: isOwner || isCaptain)"
  - "DELETE cascades to replies in application code (delete parent_id=id, then delete id) — no DB cascade constraint"
  - "Deprecated Drive helpers (thumbnailUrl, embedUrl, extractDriveFileId) removed — Phase 2 Plan 03 confirmed no remaining imports"
  - "Google Sheet import dropped entirely per locked Phase 3 decision — no UI references found"

patterns-established:
  - "Zod schema files in lib/schemas/ — one file per domain (comments.ts, auth.ts, youtube.ts)"
  - "Route auth pattern: getTokenPayload(req) → null check → 401"
  - "Ownership guard pattern: fetch existing record, compare author_id to payload.userId, allow captain override"

requirements-completed: [COMM-01, COMM-02, COMM-03, CONT-02]

duration: 4min
completed: 2026-03-11
---

# Phase 03 Plan 01: DB Foundation + Auth-Gated Comments Summary

**Phase 3 schema migration + comment API rewrite: POST/PATCH/DELETE auth-gated with author_id from JWT, Zod validation, threaded replies, ownership-enforced edit/delete, Google Sheet import removed**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T00:36:49Z
- **Completed:** 2026-03-11T00:41:11Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 2 modified, 1 deleted)

## Accomplishments
- Created idempotent `migrate-phase3.sql` covering all Phase 3 schema changes (5 ALTER/CREATE statements)
- Rewrote comment API: POST now requires auth and takes author_id from JWT; PATCH/DELETE enforce ownership with captain moderation override
- Created `lib/schemas/comments.ts` with three Zod schemas (Create, Edit, Query) following established pattern from `lib/schemas/auth.ts`
- Deleted `app/api/import-sheet/route.ts` per locked Phase 3 decision; confirmed zero UI references remained

## Task Commits

1. **Task 1: Schema migration + Zod schemas** - `63f4b0b` (feat)
2. **Task 2: Rewrite comment API (RED)** - `4ef8216` (test)
3. **Task 2: Rewrite comment API (GREEN)** - `e940fb0` (feat)
4. **Task 3: Delete Google Sheet import route** - `a89da8e` (feat)

## Files Created/Modified
- `scripts/migrate-phase3.sql` - Idempotent Phase 3 DDL: is_edited/updated_at on comments, tags on reference_videos (GIN index), closed_at on sessions
- `lib/schemas/comments.ts` - CreateCommentSchema, EditCommentSchema, CommentQuerySchema (Zod)
- `lib/types.ts` - DbComment (is_edited, updated_at), DbSession (closed_at), ReferenceVideo (tags), Comment legacy type (is_edited?, updated_at?); removed deprecated Drive helpers
- `app/api/comments/route.ts` - Auth-gated POST; Zod-validated GET query params; captainOnly requires auth
- `app/api/comments/[id]/route.ts` - PATCH (edit own + is_edited=true) + DELETE (own + cascade replies) with captain override
- `app/api/comments/route.test.ts` - 15 tests covering all auth, ownership, and validation behaviors
- `app/api/import-sheet/route.ts` - Deleted

## Decisions Made
- `author_id` exclusively from JWT — body-provided `author_id` is silently discarded (no error, just ignored)
- Captain can edit/delete any comment for moderation — ownership guard: `isOwner || isCaptain`
- Reply cascade handled in application code (two DELETE calls) rather than a DB constraint — avoids schema migration complexity
- Removed deprecated Drive helpers (`thumbnailUrl`, `embedUrl`, `extractDriveFileId`) from `lib/types.ts` — grep confirmed no remaining imports across the entire codebase

## Deviations from Plan

None - plan executed exactly as written.

The test mock issue (DELETE tests needed 3 `from()` mocks, not 2, because the route deletes replies first) was a test-correctness fix within the TDD RED→GREEN cycle, not a plan deviation.

## Issues Encountered
- Test mocks for DELETE needed updating to cover 3 sequential `supabase.from()` calls (select + delete replies + delete comment) rather than 2. Fixed immediately during GREEN phase.

## User Setup Required
Run `scripts/migrate-phase3.sql` against the Supabase database before deploying Phase 3 features.

## Next Phase Readiness
- Comments schema (is_edited, updated_at) is live and comment API is auth-gated — Plans 02/03/04 can proceed
- `tags` column on `reference_videos` ready for Plan 02
- `closed_at` on `sessions` ready for Plan 03
- All 15 comment API tests pass; TypeScript compiles clean

---
*Phase: 03-core-content*
*Completed: 2026-03-11*

## Self-Check: PASSED

All files present, all commits verified.
