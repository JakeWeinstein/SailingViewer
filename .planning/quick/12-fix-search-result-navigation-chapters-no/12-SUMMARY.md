---
phase: quick-12
plan: 01
subsystem: search-navigation
tags: [bugfix, search, deep-link, chapters]
dependency_graph:
  requires: [search_all RPC, reference_videos table]
  provides: [correct chapter navigation from search, reliable comment deep-links]
  affects: [PresentationMode, SearchResults, page.tsx]
tech_stack:
  patterns: [ref-based deferred resolution, URL param forwarding]
key_files:
  modified:
    - components/PresentationMode.tsx
    - components/SearchResults.tsx
    - app/page.tsx
decisions:
  - "Chapter lookup uses result.id (chapter's own UUID) not result.url_hint (parent UUID)"
  - "Deep-link resolution uses useRef instead of setTimeout to eliminate race condition"
  - "Chapter URL includes both ref (parent) and chapter (child) params for context"
  - "No ReferenceManager changes needed -- existing initialVideoId handles chapters"
metrics:
  duration_minutes: 1
  completed: "2026-03-11T21:13:29Z"
---

# Quick Task 12: Fix Search Result Navigation for Chapters Summary

Fixed three search navigation bugs: chapter results playing parent video instead of chapter, chapter URLs missing chapter context, and comment deep-links racing against session loading.

## One-liner

Chapter search results now find the correct chapter record by ID and comment deep-links resolve reliably after sessions load.

## What Was Done

### Task 1: Fix chapter lookup in PresentationMode and SearchResults URL
**Commit:** 11e6da0

**PresentationMode.tsx:** Simplified chapter lookup from a complex conditional (`result.url_hint` matching parent) to direct `result.id` lookup. The chapter record itself contains the correct `video_ref` and `start_seconds`.

**SearchResults.tsx:** Added `&chapter=${result.id}` param to chapter result URLs so the receiving page knows to open the chapter, not the parent.

### Task 2: Fix comment deep-link race condition and add chapter param handling
**Commit:** 969f325

**app/page.tsx:**
- Replaced `setTimeout(checkAndOpen, 500)` race condition with a `useRef`-based pending deep-link that resolves inside the sessions fetch `.then()` callback -- guarantees sessions are loaded before attempting video lookup.
- Added `chapter` URL param reading in the reference view deep-link handler, passing `chapterParam || refParam` as `initialRefId`.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compiles without errors (both tasks verified)
- Manual verification deferred to user: chapter search in PresentationMode, chapter search on /search page, comment deep-link on slow connection

## Self-Check: PASSED
