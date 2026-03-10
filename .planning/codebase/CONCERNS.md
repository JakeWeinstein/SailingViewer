# Codebase Concerns

**Analysis Date:** 2025-03-10

## Security Issues

**Weak password validation for captain login:**
- Issue: Captain password is checked as plain-text environment variable equality in `app/api/auth/login/route.ts` line 53. No complexity requirements, no rate limiting on failed attempts.
- Files: `app/api/auth/login/route.ts`
- Impact: Weak password can be brute-forced. No protection against repeated login attempts.
- Fix approach: Implement rate limiting on login endpoint, add password complexity requirements, consider 2FA for captain role.

**No input sanitization on comment text and note fields:**
- Issue: Comment text, author names, and notes are inserted directly into database without sanitization or length limits in `app/api/comments/route.ts` (lines 95-116).
- Files: `app/api/comments/route.ts`, `components/VideoWatchView.tsx` (user input)
- Impact: Potential XSS or injection attacks if frontend rendering doesn't properly escape. No validation on max field sizes.
- Fix approach: Add server-side validation for comment length limits, sanitize markdown/HTML before storage, implement field size constraints.

**Google Sheets import accepts arbitrary URLs:**
- Issue: `app/api/import-sheet/route.ts` extracts sheet ID and exports as CSV without validating ownership or access control.
- Files: `app/api/import-sheet/route.ts` (lines 40-51)
- Impact: Any authenticated user can extract CSV data from any Google Sheet by guessing/finding the ID. No verification that requester has access rights.
- Fix approach: Validate that user has explicit access to the sheet before importing, add shareable link verification, limit import frequency.

**Missing CSRF protection:**
- Issue: No CSRF token validation on state-changing operations (POST/PATCH requests).
- Files: All API routes (comments, sessions, articles, etc.)
- Impact: Cross-site request forgery attacks possible if user visits malicious site while authenticated.
- Fix approach: Implement CSRF token middleware on all POST/PATCH endpoints.

**Supabase service role key in frontend bundling:**
- Issue: `lib/supabase.ts` uses `SUPABASE_SERVICE_ROLE_KEY` which should never be exposed to client code.
- Files: `lib/supabase.ts` (lines 1-8), `lib/supabase.ts` is imported by client components
- Impact: Service role key has full database access. If bundled in client JS, attackers can access entire database.
- Fix approach: Move all Supabase queries to server-side API routes only. Client should never import supabase client directly.

## Auth & Token Issues

**Token payload type casting is unsafe:**
- Issue: `lib/auth.ts` line 30 uses `as string` type assertion without validation. Attacker could forge token with malformed role.
- Files: `lib/auth.ts` (line 30)
- Impact: Type coercion to 'captain' happens silently on malformed tokens. Defaults to 'captain' when role is missing (line 30: `role === 'contributor'` else 'captain').
- Fix approach: Validate token payload shape strictly before returning, reject malformed tokens instead of defaulting.

**No token revocation mechanism:**
- Issue: Tokens are valid for 7 days with no way to revoke them (even after logout or password change).
- Files: `lib/auth.ts` (EXPIRY = '7d'), `app/api/auth/logout/route.ts`
- Impact: Compromised tokens remain valid for 7 days. User logout doesn't invalidate existing tokens.
- Fix approach: Implement token blacklist/revocation list in Redis or database, check on each request.

**Legacy token fallback creates security gap:**
- Issue: `lib/auth.ts` line 30 defaults missing `role` to 'captain' for backward compatibility with old tokens.
- Files: `lib/auth.ts` (line 30)
- Impact: Old captain tokens without userId are still accepted and treated as captain access.
- Fix approach: Reject tokens without required fields, require token migration with expiry enforcement.

## Tech Debt & Fragile Code

**Dual legacy note formats create complexity:**
- Issue: `VideoWatchView.tsx` and `lib/types.ts` support both single note (`.note`, `.noteTimestamp`) and array format (`.notes`).
- Files: `components/VideoWatchView.tsx` (lines 265-276), `lib/types.ts` (lines 9-13, 21-23)
- Impact: Code has branch handling for both formats (see `resolveNotes` function). Easy to forget to update one format when changing the other.
- Fix approach: Remove legacy single-note fields entirely, migrate all existing data to `.notes` array format.

**YouTube IFrame API script loading race condition:**
- Issue: `VideoWatchView.tsx` checks for existing script and manages callback manually (lines 120-140), but global `window.onYouTubeIframeAPIReady` can be overwritten if multiple components mount simultaneously.
- Files: `components/VideoWatchView.tsx` (lines 111-174)
- Impact: If two VideoWatchView components mount before YouTube API loads, the second will overwrite the first's callback.
- Fix approach: Use a persistent callback queue instead of single callback. Move YouTube API loading to app-level initialization.

**Large component files with mixed concerns:**
- Issue: `VideoWatchView.tsx` is 906 lines combining video player, comments, notes, chapter nav, and reply threads.
- Files: `components/VideoWatchView.tsx`
- Impact: Hard to test individual features. Changes to comments affect video player logic. Risk of bugs when modifying this file.
- Fix approach: Split into smaller components: `<VideoPlayer />`, `<CommentThread />`, `<VideoNotes />`, `<ChapterNav />`.

**Untyped query parameter handling in GET routes:**
- Issue: `app/api/comments/route.ts` extracts query params without validation. No type checking on captainOnly boolean conversion (line 10).
- Files: `app/api/comments/route.ts` (lines 5-12)
- Impact: Malformed query strings (e.g., `captainOnly=invalid`) are silently ignored. Can lead to unexpected behavior.
- Fix approach: Use a validated schema library (zod, valibot) to parse and validate all query/body parameters.

**CSV parsing is fragile:**
- Issue: `app/api/import-sheet/route.ts` parseCSV function is a simple char-by-char parser that doesn't handle edge cases like escaped quotes or CRLF line endings.
- Files: `app/api/import-sheet/route.ts` (lines 9-27)
- Impact: Real-world CSV data with quotes or special characters will parse incorrectly, causing data loss or import failures.
- Fix approach: Use a tested CSV library (papaparse, fast-csv) instead of custom parser.

**Type-unsafe array operations on JSON data:**
- Issue: `app/api/sessions/[id]/route.ts` line 30 uses `(session.videos as SessionVideo[])`. If database returns different structure, cast silently succeeds.
- Files: `app/api/sessions/[id]/route.ts` (line 30), `app/api/sessions/[id]/video-note/route.ts` (line 25)
- Impact: If video shape changes or is malformed, code silently operates on incorrect data.
- Fix approach: Add runtime validation using zod/valibot to parse Supabase responses.

## Test Coverage Gaps

**No tests for auth flow:**
- What's not tested: Login (captain + contributor), registration, token verification, expired tokens
- Files: `lib/auth.ts`, `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`
- Risk: Login breakage would only be caught in production. No validation of edge cases (wrong password, duplicate username, invalid invite code).
- Priority: High

**No tests for comment threading:**
- What's not tested: Reply creation, reply count calculation, thread expansion, reply order
- Files: `app/api/comments/route.ts`, `components/VideoWatchView.tsx` (reply handling)
- Risk: Reply feature is new and untested. Race conditions in reply_count updates possible.
- Priority: High

**No tests for chapter auto-advance:**
- What's not tested: Multi-video chapter detection, YouTube Player API integration, iframe postMessage handling
- Files: `components/VideoWatchView.tsx` (lines 211-248)
- Risk: Auto-advance uses message event from external YouTube API. Can fail silently.
- Priority: Medium

**No tests for reference video chapters:**
- What's not tested: Chapter creation with parent_video_id, timestamp chapters vs multi-video chapters
- Files: `app/api/reference-videos/route.ts`, `components/ChapterEditor.tsx`
- Risk: Two different chapter modes (timestamp-based and multi-video) increase complexity and bug surface.
- Priority: Medium

## Performance Concerns

**Inefficient comment reply count queries:**
- Issue: `app/api/comments/route.ts` makes separate RPC call to `comment_reply_counts` for every comment list (lines 48-54, 75-80).
- Files: `app/api/comments/route.ts`
- Impact: If a session has 100 top-level comments, fetching review queue triggers 100+ database queries.
- Fix approach: Eager-load reply counts in single query using COUNT aggregate in Supabase select.

**Polling for chapter changes on 1-second interval:**
- Issue: `VideoWatchView.tsx` polls YouTube player's `getCurrentTime()` every 1 second (line 206) while video plays.
- Files: `components/VideoWatchView.tsx` (lines 176-209)
- Impact: Continuous polling drains battery on mobile, blocks main thread occasionally.
- Fix approach: Use YouTube Player API events (`onStateChange`, `onPlaying`) instead of polling.

**Missing pagination on comment loads:**
- Issue: `app/api/comments` returns all comments for a video without limit.
- Files: `app/api/comments/route.ts`
- Impact: Videos with hundreds of comments load entire history, causing slow UI and memory bloat.
- Fix approach: Implement cursor-based pagination (limit 20 comments, load more on scroll).

**No image optimization for Drive/YouTube thumbnails:**
- Issue: Thumbnails are loaded directly from external CDNs at full quality without resizing.
- Files: `lib/types.ts` (lines 65-75), used throughout UI
- Impact: Large thumbnail files slow page load, especially on slow connections.
- Fix approach: Serve thumbnails through image optimization service (Vercel Image, Next.js Image component).

## Missing Critical Features

**No audit logging:**
- Problem: No record of who deleted what or when. Captain edits to notes are not logged.
- Blocks: Cannot debug data loss, cannot track malicious edits, cannot enforce compliance.
- Files: All API routes lack audit logging middleware

**No soft deletes:**
- Problem: Deleting a comment, session, or reference video is permanent.
- Blocks: Accidental deletions cannot be recovered. Users cannot undo actions.
- Fix approach: Add `deleted_at` nullable timestamp to allow restoration.

**No rate limiting:**
- Problem: No protection against spam or DDoS.
- Impact: Users can spam comments, create infinite sessions, flood database.
- Files: All POST/PATCH endpoints
- Fix approach: Implement rate limiting middleware (per user, per IP).

## Fragile Areas

**Supabase service role security model:**
- Files: `lib/supabase.ts`, all API routes using supabase
- Why fragile: Service role key has full database access. All API routes are trusted to validate auth correctly. One bug in an API route = full database compromise.
- Safe modification: Always validate auth payload before any database operation. Use Row-Level Security policies in database as additional defense layer.
- Test coverage: No RLS tests. Cannot verify that unprivileged users cannot access data.

**YouTube embed postMessage communication:**
- Files: `components/VideoWatchView.tsx` (lines 216-240)
- Why fragile: Listening for messages from untrusted external iframe. Manual JSON parsing of iframe messages without strict validation.
- Safe modification: Always validate message origin (line 226 does this). Validate message data structure before using it.
- Test coverage: No E2E tests of iframe communication. Cannot verify message parsing handles malformed data.

**Database schema without foreign key constraints:**
- Issue: `reference_videos.parent_video_id` and `parent_id` in comments are not enforced with database constraints.
- Impact: Orphaned records possible, queries return null values silently, data integrity cannot be guaranteed.
- Fix approach: Add NOT NULL constraints and foreign keys to database schema.

**Comment type system allows conflicting states:**
- Issue: A comment can have both `video_id` and `session_id` null (for Q&A), or both populated. No database constraint prevents this.
- Impact: Different API endpoints interpret null/populated values differently, inconsistent behavior.
- Fix approach: Add database CHECK constraint to enforce valid combinations, update types to reflect possibilities.

## Dependencies at Risk

**jose (JWT library) at 5.9.6:**
- Risk: Not latest version. If security issue found in 5.x, upgrade path unclear.
- Impact: Tokens could be forged/invalidated by undiscovered vulnerabilities.
- Migration plan: Pin to latest 5.x (use caret ^), plan migration to latest major when available.

**bcryptjs at 3.0.3:**
- Risk: Library appears unmaintained (v3 is from 2019). Consider using native Node.js crypto or better-maintained bcrypt.
- Impact: If bcryptjs has vulnerability, patch unlikely.
- Migration plan: Switch to native Node.js crypto module or `@node-rs/bcrypt` (native binding).

**react-markdown at 10.1.0:**
- Risk: Markdown can be used for XSS if not properly sanitized. Library doesn't sanitize HTML by default.
- Impact: User-submitted comments in markdown could execute scripts.
- Migration plan: Add remark/rehype security plugins, or switch to text-only display for comments.

## Scaling Limits

**In-memory Set for expanded replies:**
- Current capacity: Set size grows with number of comments user interacts with
- Limit: Will hold all expanded replies in React state, no cleanup
- Scaling path: Replace with Set<string> stored in URL query params or persist in localStorage with cleanup.

**No database indexes on query patterns:**
- Issue: Comments queried by `video_id`, `session_id`, `parent_id` but no index specifications visible
- Limit: Queries will full-table scan as comment count grows
- Scaling path: Add database indexes on foreign key columns, verify query plans.

## Known Bugs

**Chapter navigation doesn't update URL:**
- Symptoms: Navigating between chapters doesn't update browser URL/history. Refreshing page loses selected chapter context.
- Files: `components/VideoWatchView.tsx` (chapter click handler doesn't update URL)
- Trigger: Click chapter button, refresh page
- Workaround: None - must re-select chapter after refresh

**Reply composer loses focus on text entry:**
- Symptoms: Typing reply text can feel laggy, text selection jumps
- Files: `components/VideoWatchView.tsx` (lines 870-877) - reply input field
- Trigger: Type quickly in reply textarea
- Workaround: None - may be React batching issue

**MultiVideo chapter auto-advance uses postMessage polling:**
- Symptoms: Auto-advance to next video may be delayed or miss transition
- Files: `components/VideoWatchView.tsx` (lines 222-223) - 500ms retry interval
- Trigger: Watch multi-video chapter until end
- Workaround: Manually click next chapter

---

*Concerns audit: 2025-03-10*
