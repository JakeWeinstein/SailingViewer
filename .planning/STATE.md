---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed quick task 14
last_updated: "2026-03-11T22:01:55.387Z"
last_activity: "2026-03-11 - Completed quick task 14: Persist UI state across tab switches"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 20
  completed_plans: 20
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Videos play reliably on every device — Drive embeds load, chapters seek correctly, multi-part YouTube videos transition seamlessly
**Current focus:** Phase 4: Engagement — Q&A posts, @mentions, notifications, bookmarks

## Current Position

Phase: 3 of 5 (Core Content) — COMPLETE
Plan: 4 of 4 complete in Phase 3
Status: Phase 3 fully verified — all 13 e2e steps approved by human
Last activity: 2026-03-11 - Completed quick task 16: Fix video viewer overflow, make comments scrollable

Progress: [████████████░░░░] 75% (plans: 11 of ~14 estimated — 3 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-foundation P01 | 4 | 2 tasks | 10 files |
| Phase 01-foundation P02 | 14 | 2 tasks | 21 files |
| Phase 01-foundation P03 | 4 | 2 tasks | 9 files |
| Phase 02-video-playback P01 | 12 | 2 tasks | 5 files |
| Phase 02-video-playback P00 | 5 | 2 tasks | 10 files |
| Phase 02-video-playback P02 | 3 | 2 tasks | 6 files |
| Phase 02-video-playback P02 | 3 | 3 tasks | 6 files |
| Phase 02-video-playback P03 | checkpoint-verified | 3 tasks | 9 files |
| Phase 03-core-content P01 | 4 | 3 tasks | 7 files |
| Phase 03-core-content P02 | 5 | 2 tasks | 4 files |
| Phase 03-core-content P03 | 7 | 3 tasks | 9 files |
| Phase 03-core-content P04 | 9 | 2 tasks | 4 files |
| Phase 04-engagement P01 | 2 | 2 tasks | 11 files |
| Phase 04-engagement P02 | 4 | 2 tasks | 7 files |
| Phase 04-engagement P03 | 6 | 2 tasks | 6 files |
| Phase 05-presentation-and-search P00 | 5 | 2 tasks | 6 files |
| Phase 05-presentation-and-search P01 | 22 | 2 tasks | 10 files |
| Phase 05-presentation-and-search P02 | 25 | 3 tasks | 6 files |
| Phase 05-presentation-and-search P03 | 3 | 1 tasks | 5 files |
| Phase 05-presentation-and-search P04 | 5 | 2 tasks | 0 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Full rewrite over incremental refactor — codebase too bug-ridden to patch
- [Init]: Normalized video storage (no JSONB blobs) — prerequisite for all downstream features
- [Init]: Three-role system (Captain/Contributor/Viewer) — first code change due to active JWT privilege escalation bug
- [Phase 01-foundation]: Kept deprecated Session/Comment/User type aliases in lib/types.ts for backward compat during incremental component rewrite
- [Phase 01-foundation]: Migration split: migrate.sql handles DDL; migrate.ts handles bcrypt hash generation (requires Node.js, not raw SQL)
- [Phase 01-foundation]: Db* prefix convention for normalized schema types to distinguish from legacy UI types
- [Phase 01-foundation]: Unified login: all roles (captain/contributor/viewer) use username+password; separate captain password-only flow removed
- [Phase 01-foundation]: Register assigns viewer role; COOKIE_NAME renamed tf_captain_session->tf_session for multi-role usage
- [Phase 01-foundation]: Seed captain (is_seed=true) is the immutable captain anchor — protected from demotion and deletion server-side
- [Phase 01-foundation]: Invite code rotation uses crypto.randomUUID() — no external uuid package
- [Phase 02-01]: Retained deprecated Drive helpers (thumbnailUrl, embedUrl, extractDriveFileId) with @deprecated JSDoc — components still import them; deletion deferred to Plan 03
- [Phase 02-01]: youtube-api.ts omits Window.YT redeclaration to avoid conflict with VideoWatchView.tsx precise YT type
- [Phase 02-01]: YouTubeTokens type explicitly exported from youtube-oauth.ts for type safety
- [Phase 02-video-playback]: Global test environment is jsdom; window.YT mock guarded by typeof window check for node-env compat
- [Phase 02-video-playback]: test.todo stubs for Plans 01/03/06/07 — allows npx vitest run to exit cleanly in Wave 0
- [Phase 02-02]: prompt=consent on OAuth URL guarantees refresh_token on re-auth (Research Pitfall 1)
- [Phase 02-02]: 15-minute import cooldown stored as Unix timestamp in app_config (quota protection)
- [Phase 02-02]: Deduplication via SELECT + in-memory Set before INSERT — avoids duplicate session_videos without DB constraint
- [Phase 02-02]: Imported sessions created as is_active=false — captain controls visibility to team
- [Phase 02-video-playback]: prompt=consent on OAuth URL generation ensures refresh_token always included, even after prior authorization
- [Phase 02-video-playback]: 15-minute import cooldown enforced server-side via app_config timestamp (quota protection)
- [Phase 02-video-playback]: Deduplication via SELECT + Set before INSERT — avoids duplicate session_videos without DB unique constraint
- [Phase 02-video-playback]: Sessions created as is_active=false by default — captain activates manually to control team visibility
- [Phase 02-video-playback]: YouTubeLoader null-rendering client component used for global IFrame API initialization — keeps onYouTubeIframeAPIReady callback queue in youtube-api.ts as single source of truth
- [Phase 02-video-playback]: playsinline: 1 always (not mobile-conditioned) — avoids iOS fullscreen hijack while allowing Android inline; matches Research Pitfall 3
- [Phase 02-video-playback]: Timestamp auto-capture guarded by getPlayerState() PLAYING(1)/PAUSED(2) — prevents capturing 0 on load or garbage on ENDED/BUFFERING
- [Phase 03-core-content]: author_id comes from JWT payload exclusively — body-injected author_id silently ignored
- [Phase 03-core-content]: Captain role can edit/delete any comment for moderation (isOwner || isCaptain)
- [Phase 03-core-content]: DELETE cascades to replies in application code — no DB cascade constraint needed
- [Phase 03-core-content]: Deprecated Drive helpers removed from lib/types.ts — no remaining imports confirmed
- [Phase 03-core-content]: Google Sheet import dropped entirely per locked Phase 3 decision
- [Phase 03-core-content]: Stable _id via crypto.randomUUID on block creation; stripped before API save — no DB schema changes needed
- [Phase 03-core-content]: Arrow-button keyboard fallback retained alongside dnd-kit drag handles for accessibility parity
- [Phase 03-core-content]: Zod v4 uses .issues[] not .errors[] for validation — fixed in reference-videos and sessions routes
- [Phase 03-core-content]: Session close carries only send_to_captain=true comments forward to new session
- [Phase 03-core-content]: Inline chapter add available to any authenticated user (trust-based, per plan decision)
- [Phase 03-core-content]: effectiveCaptain = isCaptain || userRole='captain' — covers both prop paths without breaking existing callers
- [Phase 03-core-content]: Flagged count in dashboard derived from reviewComments (already fetched) — avoids extra API call
- [Phase 04-engagement]: Fire-and-forget notification creation (.catch(() => {})) — response never fails due to notification errors
- [Phase 04-engagement]: mention-utils.ts NOT server-only — supabase client passed as param so parseMentions importable on client for rendering
- [Phase 04-engagement]: Q&A top-level posts (no video_id AND no parent_id) force send_to_captain=true server-side
- [Phase 04-engagement]: MentionTextarea uses mousedown for dropdown selection to prevent textarea blur before selection registers
- [Phase 04-engagement]: users prop optional on all mention-aware components — empty array default degrades gracefully for unauthenticated visitors
- [Phase 04-engagement]: parseMentions re-exported from comment-utils for single import convenience; ReactMarkdown p/li override for @mention styling in articles
- [Phase 04-engagement]: NotificationBell polls GET /api/notifications every 30s only while dropdown is open — avoids constant background traffic
- [Phase 04-engagement]: Users API non-captain path maps to minimal {id, username, display_name} fields — no sensitive fields (role, is_active) exposed
- [Phase 05-presentation-and-search]: REV-01 filter stubs appended to existing route.test.ts — review-queue filtering co-located with the GET handler under test
- [Phase 05-presentation-and-search]: Dual-schema dispatch in PATCH /api/comments/[id]: EditCommentSchema first, ReviewCommentSchema second — preserves edit flow while adding captain review path
- [Phase 05-presentation-and-search]: search_all RPC uses lateral jsonb subquery for article snippets to extract clean text from blocks (avoids raw JSON noise)
- [Phase 05-presentation-and-search]: Carry-forward adds .eq('is_reviewed', false) filter and resets sort_order=null — only unreviewed items move to new session
- [Phase 05-presentation-and-search]: PresentationQueue renders DndContext per author group; reordered items merged back into full list before PATCH /api/comments/reorder
- [Phase 05-presentation-and-search]: ReferenceSidePanel fetches data on open not mount; own playerRef+div ID per video prevents YT API state conflict with main player
- [Phase 05-presentation-and-search]: Comment type extended with is_reviewed/sort_order/reviewed_at fields in lib/types.ts
- [Phase 05-presentation-and-search]: GlobalSearchBar wrapped in Suspense per-usage-site (not layout.tsx) per Research Option 2
- [Phase 05-presentation-and-search]: Scroll restoration uses sessionStorage key scroll:{pathname}{search} — saved before navigate, restored on mount
- [Phase 05-presentation-and-search]: Human approved all 25 Phase 5 verification steps — presentation mode and search confirmed working end-to-end

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: iOS Safari Drive embed failures are outside app control — must test on a real device before phase sign-off; fallback UX required
- [Phase 5]: Presentation mode drag-reorder + sailor grouping interaction design is novel — validate with captain before Phase 5 planning

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Fix comments not saving to database | 2026-03-11 | 9755c6f | [1-fix-comments-not-saving-to-database](./quick/1-fix-comments-not-saving-to-database/) |
| 2 | Fix presentation view not showing video | 2026-03-11 | b4a8bd0 | [2-fix-presentation-view-not-showing-video](./quick/2-fix-presentation-view-not-showing-video/) |
| 3 | Remove deprecated name selection UI | 2026-03-11 | de123c6 | [3-fix-deprecated-name-selection-ui-on-main](./quick/3-fix-deprecated-name-selection-ui-on-main/) |
| 4 | Fix video player close button overlap and sidebar contrast | 2026-03-11 | 66fa5af | [4-fix-video-player-close-button-overlap-an](./quick/4-fix-video-player-close-button-overlap-an/) |
| 5 | Add browse-all-videos and reference viewing to presentation mode | 2026-03-11 | 5aa359e | [5-add-browse-all-videos-and-reference-vide](./quick/5-add-browse-all-videos-and-reference-vide/) |
| 6 | Reimagine chapter editing UI (add/edit inline in VideoWatchView) | 2026-03-11 | 83e299c | [6-reimagine-chapter-editing-ui-edit-and-ad](./quick/6-reimagine-chapter-editing-ui-edit-and-ad/) |
| 7 | Rethink reference library chapter display (consolidated cards) | 2026-03-11 | 1d50c92 | [7-rethink-reference-library-chapter-displa](./quick/7-rethink-reference-library-chapter-displa/) |
| 8 | Improve search with full-text matching for reference videos and chapters | 2026-03-11 | 8ac4905 | [8-improve-search-with-full-text-matching-a](./quick/8-improve-search-with-full-text-matching-a/) |
| 9 | Fix search results not navigating to reference videos | 2026-03-11 | b39a16e | [9-fix-search-results-not-navigating-to-ref](./quick/9-fix-search-results-not-navigating-to-ref/) |
| 10 | Fix search results not jumping to correct timestamp | 2026-03-11 | cd004d1 | [10-fix-search-results-not-jumping-to-correc](./quick/10-fix-search-results-not-jumping-to-correc/) |
| 11 | Add search bar to presentation mode sidebar | 2026-03-11 | 0322e85 | [11-add-search-bar-to-presentation-view-that](./quick/11-add-search-bar-to-presentation-view-that/) |
| 12 | Fix search result navigation: chapters not selecting correct chapter, comments going to homepage | 2026-03-11 | 3af8770 | [12-fix-search-result-navigation-chapters-no](./quick/12-fix-search-result-navigation-chapters-no/) |
| 13 | Fix search result navigation for chapters and reference video comments | 2026-03-11 | ecb412e | [13-fix-search-result-navigation-for-chapter](./quick/13-fix-search-result-navigation-for-chapter/) |
| 14 | Persist UI state across tab switches (tab + folder open/close) | 2026-03-11 | 43f1223 | [14-persist-ui-state-across-tab-switches-vid](./quick/14-persist-ui-state-across-tab-switches-vid/) |
| 15 | Remove redundant search bar in presentation mode, add chapter support | 2026-03-11 | d41592c | [15-remove-redundant-search-bar-in-presentat](./quick/15-remove-redundant-search-bar-in-presentat/) |
| 16 | Fix video viewer overflow, make comments scrollable | 2026-03-11 | f4bdac5 | [16-fix-video-viewer-overflow-make-comments-](./quick/16-fix-video-viewer-overflow-make-comments-/) |

## Session Continuity

Last session: 2026-03-11T23:57:04Z
Stopped at: Completed quick task 16
Resume file: None
