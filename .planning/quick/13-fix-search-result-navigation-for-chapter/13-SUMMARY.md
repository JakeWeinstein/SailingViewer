---
phase: quick-13
plan: 01
subsystem: search-navigation
tags: [search, chapters, comments, deep-link, sql]
dependency_graph:
  requires: [search_all SQL function, VideoWatchView chapter props]
  provides: [correct chapter selection, reference video comment navigation]
  affects: [SearchResults, PresentationMode, page.tsx, VideoWatchView]
tech_stack:
  patterns: [null-safe url_hint parsing, sessionless WatchTarget deep-link]
key_files:
  created:
    - supabase-migration-quick13.sql
  modified:
    - components/VideoWatchView.tsx
    - components/SearchResults.tsx
    - app/page.tsx
decisions:
  - PresentationMode already had null-safe url_hint handling; no changes needed
  - SessionVideo cast with minimal {id, name} is safe since VideoWatchView uses effectiveVideoId for fetching
metrics:
  duration_minutes: 2
  completed: "2026-03-11T21:44:37Z"
---

# Quick Task 13: Fix Search Result Navigation for Chapters and Comments

Fixed three root causes preventing search result navigation from working for chapters and reference video comments. COALESCE fix in SQL, UUID-based chapter matching, and sessionless deep-link support.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix SQL url_hint and chapter index initialization | 7527c74 | supabase-migration-quick13.sql, components/VideoWatchView.tsx |
| 2 | Fix comment deep-link for reference videos | ecb412e | components/SearchResults.tsx, app/page.tsx |

## What Changed

### Task 1: SQL url_hint + Chapter Index

**SQL fix:** Changed `c.session_id::text || '|' || COALESCE(c.video_id::text, '')` to `COALESCE(c.session_id::text, '') || '|' || COALESCE(c.video_id::text, '')` in the search_all function. PostgreSQL `||` returns NULL when any operand is NULL, so reference video comments (which have NULL session_id) were getting NULL url_hint.

**Chapter index fix:** Changed `ch.video_ref === effectiveVideoId` to `ch.id === video.id` in VideoWatchView's activeChapterIndex initializer. All sibling chapters share the same `video_ref` (parent YouTube video ID), so findIndex always returned 0. Matching by UUID correctly identifies the selected chapter.

### Task 2: Sessionless Comment Deep-Links

**SearchResults:** Made url_hint parsing null-safe with `(result.url_hint || '').split('|')`. When sessionId is empty but videoId is truthy (reference video comment), generates `/?video=X&t=Y` URL.

**page.tsx:** Added `else if (videoParam && !sessionParam)` branch that constructs a minimal WatchTarget `{ video: { id: videoParam, name: 'Video' }, sessionId: '', startSeconds }`. VideoWatchView fetches comments by effectiveVideoId, not sessionId.

**PresentationMode:** Already had null-safe handling -- no changes needed.

## Deviations from Plan

### Minor Deviation

**PresentationMode.tsx:** Plan called for changes but the component already had correct null-safe handling at line 290: `(result.url_hint || '').split('|')` with an `if (videoId)` guard. No modification was necessary.

## Action Required

**SQL migration must be applied to live Supabase database.** The migration file `supabase-migration-quick13.sql` has been created and committed, but the `mcp__supabase__execute_sql` tool was not available in this session. Run the SQL in the Supabase SQL editor or via the MCP tool to update the `search_all` function.

## Verification

- TypeScript compiles without errors: PASSED
- SQL migration file contains COALESCE fix: PASSED
- Chapter index matches by UUID (ch.id === video.id): PASSED
- SearchResults handles null url_hint: PASSED
- page.tsx handles sessionless video param: PASSED
