---
phase: 04-engagement
verified: 2026-03-10T23:00:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: "Q&A YouTube attachment: log in as any user, go to Q&A tab, paste a YouTube URL in the attachment field"
    expected: "Embed preview appears below the input before posting; after posting, the embedded video renders in the Q&A list"
    why_human: "iframe rendering and visual embed preview cannot be verified programmatically"
  - test: "@mention autocomplete in Q&A: type @ in the Q&A post composer while logged in"
    expected: "Dropdown of team members appears; arrow keys navigate; Enter/Tab inserts @username into text"
    why_human: "Keyboard interaction with dropdown, DOM focus behavior, and visual rendering require browser"
  - test: "@mention autocomplete in video comments: type @ in the comment composer while watching a video"
    expected: "Dropdown of team members appears and functions identically to Q&A"
    why_human: "Same as above — requires browser"
  - test: "@mention autocomplete in article text blocks: go to Dashboard > Articles, edit a text block, type @"
    expected: "Dropdown appears; user selected; @username inserted into article text"
    why_human: "Requires browser interaction with dashboard editor"
  - test: "@mention rendering in displayed posts: post a comment containing @username"
    expected: "@username renders as bold blue text in QATab posts, VideoWatchView comments, and published article text blocks"
    why_human: "Visual styling must be confirmed in browser"
  - test: "Notification bell unread badge: after posting a comment @mentioning another user, log in as that user"
    expected: "Red badge with count appears on the bell icon in the top nav header"
    why_human: "Requires two-user flow and database row creation via Supabase migration already run"
  - test: "Notification bell in dashboard sidebar: log into dashboard as the mentioned user"
    expected: "Bell icon with the same unread count visible in the dashboard sidebar"
    why_human: "Requires browser verification of DashboardView sidebar rendering"
  - test: "Notification dropdown: click the bell"
    expected: "Dropdown opens showing notification with preview text, author avatar, time-ago, and unread styling (blue left border)"
    why_human: "Visual rendering and data enrichment from deep-link query requires live database"
  - test: "Notification deep-link navigation: click a notification"
    expected: "Page navigates to the relevant video/comment or Q&A post; notification marked read; badge count decrements"
    why_human: "Requires live navigation and database write"
  - test: "Mark all as read: click the 'Mark all as read' button in the notification dropdown"
    expected: "Badge disappears; all notifications lose unread styling"
    why_human: "Requires browser state + PATCH API call to live database"
  - test: "Captain response notification: as contributor, flag a comment (send_to_captain); as captain, save a video note on that video; log back in as contributor"
    expected: "captain_response notification appears in the bell dropdown for the contributor"
    why_human: "Requires two-user flow, captain login, video note save, and database notification row"
  - test: "Bookmark capture: play a practice video for a few seconds, click the bookmark icon in player controls"
    expected: "'Saved!' flash message appears briefly; no crash"
    why_human: "Requires YouTube IFrame API player state (PLAYING=1) to be readable — cannot verify without live player"
  - test: "Duplicate bookmark: click the bookmark icon again at the same timestamp"
    expected: "'Already bookmarked' feedback shown; no 500 error"
    why_human: "Requires live 409 response from duplicate unique constraint"
  - test: "Bookmarks in profile: go to Dashboard > Profile section"
    expected: "'Saved Bookmarks' section lists the bookmark with video title, formatted timestamp (e.g. 0:05), time-ago, and a delete button"
    why_human: "Requires live database and visual rendering confirmation"
  - test: "Bookmark deep-link: click a saved bookmark"
    expected: "Navigates to /?video=...&session=... which triggers the deep-link handler and opens the video player"
    why_human: "Requires browser navigation + deep-link URL param handling"
  - test: "Database migration applied: run supabase-migration-phase4.sql if not already done"
    expected: "notifications and bookmarks tables exist; comments.youtube_attachment column exists"
    why_human: "Migration file is present and syntactically correct but must be run against actual Supabase instance"
---

# Phase 4: Engagement Verification Report

**Phase Goal:** Team members can ask questions via Q&A posts, receive notifications when @mentioned or responded to, and bookmark timestamps for personal reference
**Verified:** 2026-03-10T23:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All truths derived from the combined must_haves across plans 04-01, 04-02, and 04-03.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Authenticated users can query their notifications and bookmarks via API | VERIFIED | `app/api/notifications/route.ts` (GET+PATCH, 124 lines) and `app/api/bookmarks/route.ts` (GET+POST, 62 lines) both authenticate via `getTokenPayload` and query Supabase |
| 2 | POST /api/comments accepts youtube_attachment and forces send_to_captain=true for Q&A posts | VERIFIED | Line 116: `const effectiveSendToCaptain = (!video_id && !parent_id) ? true : send_to_captain`; `youtube_attachment` in schema and insert at line 129 |
| 3 | POST /api/comments creates mention and reply notification rows server-side | VERIFIED | Lines 138-141: `createMentionNotifications` and `createReplyNotification` called fire-and-forget after insert |
| 4 | Captain saving a video note creates captain_response notifications | VERIFIED | `app/api/sessions/[id]/video-note/route.ts` line 43: `createCaptainResponseNotifications(id, videoId, supabase).catch(() => {})` |
| 5 | GET /api/notifications returns unread count and enriched full list | VERIFIED | countOnly mode returns `{ unread: count }` (lines 18-27); full list enriched with source comment deep-link data (lines 40-86) |
| 6 | PATCH /api/notifications marks single or all notifications as read | VERIFIED | Lines 105-121: separate branches for `id` vs `markAll` both write `is_read: true` with ownership check |
| 7 | GET/POST /api/bookmarks and DELETE /api/bookmarks/[id] work with ownership | VERIFIED | GET returns user's bookmarks; POST returns 409 on duplicate (error code 23505); DELETE fetches bookmark, checks `user_id === payload.userId`, returns 403 or 204 |
| 8 | parseMentions correctly splits text into mention/text segments with test coverage | VERIFIED | `lib/mention-utils.ts` (148 lines); 8 behavioral tests in `lib/__tests__/mention-utils.test.ts`; TypeScript compiles clean (`npx tsc --noEmit` returned no output) |
| 9 | Typing @ in a comment or Q&A textarea opens a filtered dropdown of team members | VERIFIED | `components/MentionTextarea.tsx` (164 lines): `handleChange` looks backward from caret for `/@(\w*)$/`, sets `mentionSearch`, renders absolute dropdown with filtered users |
| 10 | Bell icon with unread badge wired into both public header and dashboard sidebar | VERIFIED | `app/page.tsx` line 318: `{authUser && <NotificationBell />}`; `components/DashboardView.tsx` line 391: `<NotificationBell />` unconditional in sidebar |
| 11 | Users list fetched and passed to QATab, VideoWatchView, and ArticleEditor for @mention autocomplete | VERIFIED | `app/page.tsx`: `mentionUsers` state set from GET /api/users, passed to QATab (line 434) and VideoWatchView (line 578); `DashboardView.tsx`: same pattern, passed to ArticleEditor (line 574) |

**Score:** 11/11 truths verified

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `supabase-migration-phase4.sql` | VERIFIED | Contains CREATE TABLE notifications, CREATE TABLE bookmarks with unique index, ALTER TABLE comments ADD COLUMN youtube_attachment — all syntactically correct |
| `lib/schemas/notifications.ts` | VERIFIED | Exports `MarkReadSchema` with `.refine(data => data.id \|\| data.markAll)` |
| `lib/schemas/bookmarks.ts` | VERIFIED | Exports `CreateBookmarkSchema` with video_id, session_id, timestamp_seconds, video_title |
| `lib/mention-utils.ts` | VERIFIED | 148 lines; exports `parseMentions`, `createMentionNotifications`, `createReplyNotification`, `createCaptainResponseNotifications` — all substantive implementations |
| `lib/__tests__/mention-utils.test.ts` | VERIFIED | 8 tests covering: empty string, no mentions, bare @mention, inline mention, multiple mentions, adjacent mentions, email edge case, underscores/numbers |
| `app/api/notifications/route.ts` | VERIFIED | 124 lines; GET (countOnly + full enriched list) + PATCH (markOne/markAll) — both with auth guard |
| `app/api/bookmarks/route.ts` | VERIFIED | 62 lines; GET + POST with 409 on unique constraint violation |
| `app/api/bookmarks/[id]/route.ts` | VERIFIED | 33 lines; DELETE with ownership fetch + 403/204 |
| `components/MentionTextarea.tsx` | VERIFIED | 164 lines (exceeds min_lines: 80); forwardRef, keyboard nav (ArrowUp/Down/Enter/Tab/Escape), autoResize, selectUser with caret replacement |
| `components/NotificationBell.tsx` | VERIFIED | 179 lines (exceeds min_lines: 60); self-contained fetch, poll-on-open (30s), mark-all-read, per-notification mark-read, click-outside close |
| `components/ProfileEditor.tsx` (bookmarks section) | VERIFIED | Fetches GET /api/bookmarks on mount; renders "Saved Bookmarks" section with video_title, timestamp, timeAgo, delete, and deep-link navigation |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/comments/route.ts` | `lib/mention-utils.ts` | `createMentionNotifications` + `createReplyNotification` | WIRED | Lines 5, 138-141: imported and called after insert |
| `app/api/sessions/[id]/video-note/route.ts` | `lib/mention-utils.ts` | `createCaptainResponseNotifications` | WIRED | Lines 5, 43: imported and called after successful update |
| `app/api/notifications/route.ts` | notifications table | `supabase.from('notifications')` | WIRED | Lines 19, 31: two distinct queries against notifications table |
| `app/api/bookmarks/route.ts` | bookmarks table | `supabase.from('bookmarks')` | WIRED | Lines 14, 42: GET and POST both query bookmarks table |
| `app/page.tsx` | `/api/users` | `fetch('/api/users')` when authUser set | WIRED | Line 79: fetch on auth resolve; result mapped to mentionUsers |
| `components/DashboardView.tsx` | `/api/users` | `fetch('/api/users')` on mount | WIRED | Line 133: fetch on mount; result passed as users to ArticleEditor |
| `components/MentionTextarea.tsx` | users prop | receives MentionUser array | WIRED | Props interface includes `users: MentionUser[]`; dropdown filtered from this prop |
| `components/QATab.tsx` | `MentionTextarea` | import and render for post/reply composers | WIRED | Line 8: import; lines 168 and 331: rendered with users prop |
| `components/VideoWatchView.tsx` | `MentionTextarea` | import and render for comment/reply composers | WIRED | Line 9: import; lines 790 and 1016: rendered |
| `components/ArticleEditor.tsx` | `MentionTextarea` | import and render for text block editing | WIRED | Line 27: import; line 117: rendered in TextBlockEditor |
| `components/ArticleViewer.tsx` | `lib/mention-utils.ts` | `parseMentions` for @mention rendering in article text | WIRED | Line 7: import; line 12: called inside ReactMarkdown components override |
| `app/page.tsx` | URL query params | `URLSearchParams` deep-link on mount | WIRED | Lines 99-128: reads video/session/view params, navigates, then clears URL |
| `app/page.tsx` | `NotificationBell` | render in header when authUser set | WIRED | Line 10: import; line 318: conditional render |
| `components/DashboardView.tsx` | `NotificationBell` | render in dashboard sidebar | WIRED | Line 17: import; line 391: render in sidebar |
| `components/NotificationBell.tsx` | `/api/notifications` | fetch count on mount, list on open | WIRED | Lines 28-32: countOnly fetch; lines 41-53: full list fetch when isOpen |
| `components/ProfileEditor.tsx` | `/api/bookmarks` | fetch list and delete | WIRED | Lines 54, 63: GET and DELETE calls |
| `components/VideoWatchView.tsx` | `/api/bookmarks` | POST bookmark on handleBookmark | WIRED | Line 506: POST call inside handleBookmark |

---

## Requirements Coverage

| Requirement | Description | Plans | Status | Evidence |
|-------------|-------------|-------|--------|----------|
| QA-01 | User can create Q&A posts with rich text and link/image/video attachments | 04-01, 04-02 | SATISFIED | youtube_attachment field in CreateCommentSchema; QATab has YouTube URL input with extractYouTubeInfo validation and iframe embed preview |
| QA-02 | Q&A posts appear in captain's review queue alongside flagged comments | 04-01 | SATISFIED | Server forces `send_to_captain=true` for Q&A top-level posts (no video_id, no parent_id) at line 116 of comments route; GET /api/comments?type=qa&captainOnly=true query path exists |
| QA-03 | Users can reply to Q&A posts in threads | 04-01, 04-02 | SATISFIED | comments route supports `parent_id`; QATab has reply composer with MentionTextarea; reply notifications created server-side |
| AUTH-05 | User can @mention other users in comments, articles, and Q&A posts | 04-01, 04-02, 04-03 | SATISFIED | MentionTextarea in QATab, VideoWatchView, ArticleEditor; parseMentions rendering in all display surfaces including ArticleViewer |
| COMM-04 | User receives in-app notifications for @mentions and captain responses | 04-01 | SATISFIED | `createMentionNotifications` wired to POST /api/comments; `createCaptainResponseNotifications` wired to PATCH /api/sessions/[id]/video-note |
| COMM-05 | Notification bell shows unread count badge | 04-03 | SATISFIED | NotificationBell fetches countOnly on mount; renders red badge when unreadCount > 0; wired into both app/page.tsx and DashboardView.tsx |
| VID-06 | User can bookmark specific timestamps in videos for personal reference | 04-01, 04-03 | SATISFIED | Full CRUD bookmark API with ownership + 409 duplicate prevention; VideoWatchView bookmark button with player state guard; ProfileEditor bookmarks list with deep-link navigation |

No orphaned requirements found — all 7 requirement IDs declared across the plans appear in REQUIREMENTS.md and are mapped to Phase 4.

---

## Anti-Patterns Found

No blockers or warnings found. Scanning all phase-4 files:

- No `TODO`, `FIXME`, `XXX`, `HACK`, or `PLACEHOLDER` comments in any created/modified file
- No stub implementations (`return null`, `return {}`, `return []`, `=> {}`)
- No fire-and-forget handlers that only `console.log` — notification calls use `.catch(() => {})` which is intentional per design decision
- `npx tsc --noEmit` produces zero errors (verified at runtime)

---

## Human Verification Required

All automated checks pass. The following flows require browser and live database verification. The database migration (`supabase-migration-phase4.sql`) must be applied to the Supabase instance before testing engagement features.

### 1. Migration Applied

**Test:** Run `supabase-migration-phase4.sql` against the Supabase database if not already done.
**Expected:** `notifications` and `bookmarks` tables exist; `comments.youtube_attachment` column exists.
**Why human:** SQL file is syntactically verified but application to the actual Supabase instance cannot be confirmed programmatically from this environment.

### 2. Q&A YouTube Attachment

**Test:** Log in as any user, go to Q&A tab, type a question, paste a YouTube URL in the attachment field, submit.
**Expected:** Embed preview renders below the URL input before posting; after posting, the embedded video appears in the Q&A list.
**Why human:** iframe rendering and live embed preview require browser.

### 3. @Mention Autocomplete (Q&A, Comments, Articles)

**Test:** Type `@` in the Q&A post composer, a video comment composer, and an article text block (Dashboard > Articles).
**Expected:** Dropdown of team members appears; arrow keys navigate; Enter/Tab inserts `@username` into text; Escape dismisses; `@username` renders as bold blue text in displayed output.
**Why human:** Keyboard interaction, dropdown focus management, and visual styling require browser.

### 4. Notification Bell — Unread Badge

**Test:** As user A, post a comment mentioning `@userB`. Log in as user B.
**Expected:** Red badge with count visible on bell icon in the top nav header AND in the dashboard sidebar.
**Why human:** Requires two-user flow and database notification row created by the trigger.

### 5. Notification Dropdown and Deep-link

**Test:** As user B, click the bell. Click a notification.
**Expected:** Dropdown shows notification with preview text, author avatar (initials), time-ago. Clicking navigates to the relevant video/comment or Q&A post and marks the notification read.
**Why human:** Requires live database rows and browser navigation.

### 6. Mark All as Read

**Test:** Click "Mark all as read" in the dropdown.
**Expected:** Badge disappears; all notifications lose unread styling (blue left border).
**Why human:** Requires browser state update after PATCH API call.

### 7. Captain Response Notification

**Test:** As contributor, flag a comment (send_to_captain). As captain, save a video note on that video. Log back in as contributor, check bell.
**Expected:** `captain_response` notification appears in the dropdown.
**Why human:** Requires two-user flow through two separate login sessions.

### 8. Bookmark Capture and Duplicate Prevention

**Test:** Play a practice video for a few seconds, click the bookmark icon.
**Expected:** "Saved!" feedback appears briefly. Clicking again at the same timestamp shows "Already bookmarked."
**Why human:** Requires YouTube IFrame API player state (PLAYING/PAUSED check) and live 409 response from unique constraint.

### 9. Bookmarks in Profile

**Test:** Go to Dashboard > Profile section.
**Expected:** "Saved Bookmarks" section shows the bookmark with video title, formatted timestamp (e.g., `0:05`), time-ago, and a delete button. Clicking navigates to the video.
**Why human:** Requires live database rows and visual rendering confirmation.

---

## Gaps Summary

No gaps. All automated checks passed. Every artifact is substantive (not a stub), every key link is wired, and TypeScript compiles clean. The 16 human verification items above are required because the engagement features depend on live browser interaction, a live Supabase instance, and multi-user test flows — none of which can be verified programmatically from the file system.

---

_Verified: 2026-03-10T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
