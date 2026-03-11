---
phase: 03-core-content
verified: 2026-03-11T22:00:00Z
status: human_needed
score: 10/10 truths verified (automated); 1 item needs human confirmation
re_verification: false
human_verification:
  - test: "Drag-to-reorder blocks in the article editor"
    expected: "Blocks physically move when dragged by the GripVertical handle; final order persists on save"
    why_human: "dnd-kit tests mock out DndContext and SortableContext entirely; arrayMove logic is tested but pointer-event drag is not exercisable in jsdom"
---

# Phase 3: Core Content Verification Report

**Phase Goal:** Team members can leave timestamped comments on practice videos, and the captain can manage sessions via YouTube auto-import, and contributors maintain the reference library (tags, chapters) and write block-based articles.
**Verified:** 2026-03-11
**Status:** human_needed — all automated checks pass; one drag-to-reorder behavior needs human confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | POST /api/comments requires auth and stores author_id from JWT | VERIFIED | `getTokenPayload(req)` called first; `author_id: payload.userId` on insert; body-provided author_id ignored |
| 2  | POST /api/comments with parent_id creates a threaded reply | VERIFIED | `parent_id: parent_id ?? null` stored; GET supports `?parentId=X` to fetch replies; VideoWatchView posts with `parent_id` set |
| 3  | PATCH /api/comments/[id] allows editing own comment, sets is_edited=true | VERIFIED | Ownership check: `isOwner \|\| isCaptain`; update sets `is_edited: true, updated_at: now` |
| 4  | DELETE /api/comments/[id] allows deleting own comment only | VERIFIED | Same ownership guard; cascade deletes replies first, then comment; returns 204 |
| 5  | send_to_captain boolean is stored on comment creation | VERIFIED | `send_to_captain` in CreateCommentSchema, stored in insert, rendered as flag checkbox in VideoWatchView |
| 6  | Google Sheet import route no longer exists | VERIFIED | `app/api/import-sheet/route.ts` deleted; no live component references; only planning docs mention it |
| 7  | Article editor supports four block types: text, video, image, timestamped clip | VERIFIED | ArticleBlock union in lib/types.ts has all 4 variants; ArticleEditor.tsx has insertion buttons for all 4; 14 tests pass |
| 8  | Blocks can be reordered via drag-and-drop | VERIFIED (partial — see Human Verification) | dnd-kit imported and wired; SortableBlock + useSortable + handleDragEnd with arrayMove implemented; pointer drag not testable in jsdom |
| 9  | Reference videos can be tagged with freeform tags | VERIFIED | `tags TEXT[]` in migration SQL + ReferenceVideo type; POST/PATCH normalize and store tags; GET with `?tags=x,y` uses `.contains()` AND logic |
| 10 | Each video in session list shows comment count and flagged count badges | VERIFIED | Home page: `commentCountByVideo` + `flaggedCountByVideo` computed from fetched comments; both rendered as badges on VideoCard; DashboardView mirrors same pattern |

**Score:** 10/10 truths verified (automated)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/migrate-phase3.sql` | Phase 3 DDL: is_edited, updated_at, tags (GIN index), closed_at | VERIFIED | All 5 ALTER/CREATE statements present; IF NOT EXISTS guards make it idempotent |
| `lib/schemas/comments.ts` | Zod schemas: CreateCommentSchema, EditCommentSchema, CommentQuerySchema | VERIFIED | All 3 schemas exported; correct field validation (min/max, uuid, boolean default) |
| `app/api/comments/route.ts` | Auth-gated GET + POST | VERIFIED | POST requires auth; Zod validates body; author_id from JWT; GET supports all query params |
| `app/api/comments/[id]/route.ts` | PATCH + DELETE with ownership | VERIFIED | Both handlers auth-gated; ownership OR captain override; PATCH sets is_edited; DELETE cascades replies |
| `components/ArticleEditor.tsx` | Block editor with 4 types + dnd-kit | VERIFIED | 720 lines; imports useSortable, arrayMove, DndContext; SortableBlock wrapper with drag handle |
| `components/ArticleViewer.tsx` | Renders all 4 block types | VERIFIED | 177 lines; handles text, video, image (with onError fallback), clip (start/end params); unknown types silently skipped |
| `components/ArticleEditor.test.tsx` | RTL tests for blocks + reorder | VERIFIED | 220 lines; 14 tests covering all 4 block types, insertion, deletion, arrayMove, viewer robustness, image error fallback |
| `app/api/reference-videos/route.ts` | GET with tag filter, POST with tags | VERIFIED | `.contains('tags', selectedTags)` for AND logic; `?allTags=true` returns unique tags; POST normalizes tags to lowercase |
| `app/api/sessions/[id]/route.ts` | Session close + carry-forward + add-video | VERIFIED | `action: 'close'` sets closed_at, creates next session, carries `send_to_captain=true` comments forward; `action: 'add-video'` parses YouTube URL |
| `lib/schemas/sessions.ts` | Zod schemas for session create and close | VERIFIED | CreateSessionSchema, CloseSessionSchema, AddVideoSchema all exported |
| `components/ReferenceManager.tsx` | Tag chips, filter UI, autocomplete, inline chapter add | VERIFIED | Tag filter chips toggled; `activeFilterTags` re-fetches with `?tags=x,y`; autocomplete from allTags; inlineChapterParentId form with title + timestamp |
| `components/VideoWatchView.tsx` | Comment UI with polling, edit/delete, threading, timestamp seek | VERIFIED | 982 lines; 30s polling interval; handleCommentFocus() for timestamp capture; seekTo on badge click; edit/delete with canEditComment ownership check |
| `components/VideoWatchView.test.tsx` | RTL tests for timestamp, seekTo, reply, edit/delete, flag | VERIFIED | 383 lines; 10 tests covering all specified behaviors |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/comments/route.ts` | `lib/auth.ts` | `getTokenPayload(req)` | WIRED | Line 3: import; line 103: called before any insert |
| `app/api/comments/route.ts` | `lib/schemas/comments.ts` | `CreateCommentSchema.safeParse(body)` | WIRED | Line 4: import; line 107: safeParse on request body |
| `components/ArticleEditor.tsx` | `@dnd-kit/sortable` | `SortableContext + useSortable` | WIRED | Lines 13-18: imports; line 53: useSortable called in SortableBlock |
| `components/ArticleViewer.tsx` | `lib/types.ts` | `ArticleBlock` type union | WIRED | Line 7: import; all 4 block types discriminated in render map |
| `app/api/reference-videos/route.ts` | supabase | `.contains('tags', selectedTags)` | WIRED | Line 44: `.contains('tags', selectedTags)` after tag parse |
| `app/api/sessions/[id]/route.ts` | comments table | carry-forward `send_to_captain=true` | WIRED | Lines 133-137: `.update({ session_id: newSession.id }).eq('send_to_captain', true)` |
| `components/VideoWatchView.tsx` | `/api/comments` | fetch for CRUD + 30s polling interval | WIRED | Lines 251, 261: GET; line 453: POST; line 411: PATCH; line 431: DELETE; line 273: `setInterval(poll, 30000)` |
| `components/VideoWatchView.tsx` | `YT.Player` | `getCurrentTime()` for timestamp capture, `seekTo()` for badge click | WIRED | Line 289: `player.getCurrentTime()`; line 189: `ytPlayerRef.current.seekTo(seconds, true)` |
| `app/page.tsx` | `/api/sessions` | fetch sessions via `/api/sessions/browse` | WIRED | Line 75: `fetch('/api/sessions/browse')`; lines 87-96: per-session comment fetch |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COMM-01 | 03-01, 03-04 | User can leave timestamped comments on practice videos | SATISFIED | VideoWatchView.tsx: timestamp auto-fill from YT player; POST to /api/comments with timestamp_seconds |
| COMM-02 | 03-01, 03-04 | User can reply to comments in threaded conversations | SATISFIED | POST with parent_id; GET `?parentId=X`; reply toggle in VideoWatchView |
| COMM-03 | 03-01, 03-04 | User can flag a comment with "send to captain for review" | SATISFIED | send_to_captain checkbox in composer; stored and carried forward on session close |
| CONT-01 | 03-03, 03-04 | Captain can create sessions (weekly practice groupings) | SATISFIED | POST /api/sessions (captain-only); close + auto-create next session; add-video; session browser on home page |
| CONT-02 | 03-01 | Captain can import practice videos from Google Sheet containing Drive links | SATISFIED (reinterpreted) | Locked decision: replaced by YouTube auto-import via /api/youtube/import (Phase 2); import-sheet route deleted; DashboardView wires to /api/youtube/import |
| CONT-03 | (Phase 2) | Reference videos organized in folder hierarchy | SATISFIED | Two-level folder tree already implemented; ReferenceManager.tsx renders it |
| CONT-04 | 03-03 | Reference videos can be tagged for cross-cutting topics | SATISFIED | tags TEXT[] column in migration; POST/PATCH store tags; GET ?tags=x,y uses .contains() AND filter |
| CONT-05 | 03-03 | Anyone logged in can add chapters to reference videos | SATISFIED | Inline chapter form in ReferenceManager.tsx; POST with parent_video_id; available to all authenticated users |
| CONT-06 | 03-02 | Block-based article editor with text and video embed blocks | SATISFIED | ArticleEditor.tsx: 4 block types (text, video, image, clip) with dnd-kit drag reorder |
| CONT-07 | 03-02 | Articles have published/draft visibility | SATISFIED | is_published field on Article type; API returns drafts to auth users only; this behavior was already implemented and is unchanged |

**Note on CONT-02:** The REQUIREMENTS.md description refers to Google Sheet import. The locked Phase 3 decision explicitly reinterpreted this as YouTube auto-import only, deleted the import-sheet route, and credited CONT-02 as satisfied by YouTube auto-import delivered in Phase 2. This is a planned reinterpretation documented in 03-RESEARCH.md.

---

## Anti-Patterns Found

None detected. Scan covered all 13 key artifacts for TODO/FIXME/PLACEHOLDER/stub patterns. No empty implementations, no console.log-only handlers, no return null stubs found.

---

## Human Verification Required

### 1. Article Block Drag-to-Reorder

**Test:** Open the article editor in the dashboard, create an article with at least 3 blocks of mixed types (text, image, video). Grab the GripVertical drag handle on a block and drag it to a different position.
**Expected:** The block moves to the new position in real-time during drag; on release the order is preserved; saving and reopening the article shows the reordered blocks.
**Why human:** dnd-kit tests in ArticleEditor.test.tsx mock out `DndContext`, `SortableContext`, and `useSortable` entirely. The `arrayMove` logic is tested in isolation and passes, but the pointer-event drag behavior (PointerSensor, draggable transforms, drop targeting) cannot be verified in jsdom. This is the only behavior in Phase 3 that requires physical interaction to confirm.

---

## Gaps Summary

No blocking gaps. All 10 truths verified, all 13 artifacts substantive and wired, all 10 requirements covered. The single item pending human verification (drag-to-reorder) has the underlying logic (`arrayMove`, stable `_id`, `handleDragEnd`) verified in tests — only the pointer interaction is unconfirmed.

**Implementation note on per-video comment stats:** Plan 03 truth states "GET /api/sessions returns sessions with comment_count and flagged_count per video." The actual implementation delivers this observable behavior differently: the home page and dashboard fetch comments separately per session and compute counts client-side. The truth as observable to the user (video cards show correct badges) is satisfied. The API contract differs from the plan spec but does not create a user-facing gap.

---

*Verified: 2026-03-11*
*Verifier: Claude (gsd-verifier)*
