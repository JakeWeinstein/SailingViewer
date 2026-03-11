---
phase: 03-core-content
plan: 02
subsystem: article-editor
tags: [articles, block-editor, dnd-kit, image, clip, tdd]
dependency_graph:
  requires: []
  provides: [article-4-block-editor, article-viewer-4-blocks]
  affects: [components/ArticleEditor.tsx, components/ArticleViewer.tsx, lib/types.ts]
tech_stack:
  added: ["@dnd-kit/core@6.3.1", "@dnd-kit/sortable@10.0.0"]
  patterns: ["useSortable + SortableContext drag handles", "stable _id pattern for dnd-kit", "block-type union discriminant switching"]
key_files:
  created: ["components/ArticleEditor.test.tsx"]
  modified:
    - "lib/types.ts — ArticleBlock union expanded to 4 variants (text, video, image, clip); deprecated Drive helpers removed by linter"
    - "components/ArticleEditor.tsx — full redesign: 4 block types, dnd-kit drag handles, stable _id, arrow-button fallback"
    - "components/ArticleViewer.tsx — added ImageBlock + ClipBlock renderers; graceful unknown-type skip"
decisions:
  - "Retained arrow-button keyboard fallback alongside drag handles — accessibility parity"
  - "Stable _id via crypto.randomUUID() on block creation; stripped before API save to avoid DB schema changes"
  - "'drive' removed from video block videoType union — YouTube-only per Phase 2 decision"
  - "act() warnings in tests are non-failing (async useEffect state updates in jsdom); assertions all pass"
metrics:
  duration_minutes: 5
  tasks_completed: 2
  files_modified: 4
  completed_date: "2026-03-10"
requirements: [CONT-06, CONT-07]
---

# Phase 3 Plan 02: Article Editor — 4 Block Types + Drag Reorder Summary

**One-liner:** Block editor redesigned with image, clip, and video (YouTube-only) types plus dnd-kit drag-to-reorder; viewer extended to render all four types with error fallbacks.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Expand ArticleBlock types + install dnd-kit | `60087e1` | lib/types.ts, package.json, package-lock.json |
| 2 (RED) | Write failing RTL tests | `b02e04e` | components/ArticleEditor.test.tsx |
| 2 (GREEN) | Redesign ArticleEditor + ArticleViewer | `145453d` | components/ArticleEditor.tsx, ArticleViewer.tsx, ArticleEditor.test.tsx |

## What Was Built

**ArticleBlock type** — expanded from 2 to 4 variants:
- `text` — unchanged
- `video` — `videoType` narrowed to `'youtube'` only (Drive removed)
- `image` — new: `url`, `alt`, `caption`
- `clip` — new: YouTube `videoRef`, `startSeconds`, optional `endSeconds`, `title`, `caption`

**ArticleEditor.tsx** — complete redesign:
- 4 insertion buttons: "Add text block", "Add video block", "Add image block", "Add clip block"
- Each block wrapped in `SortableBlock` using `useSortable({ id: block._id })`
- `GripVertical` drag handle with `{...listeners}` + `{...attributes}`
- `handleDragEnd` uses `arrayMove` to reorder by matching `_id`
- Arrow-button keyboard fallback retained (accessibility)
- `_id` stripped via destructuring before API POST/PATCH
- Image editor: URL input with `new URL()` client-side validation + preview + alt text
- Clip editor: YouTube URL/ID input + MM:SS start/end time inputs + thumbnail preview

**ArticleViewer.tsx** — extended:
- `ImageBlock`: `<figure>` + `<img onError>` → shows "Image could not be loaded" fallback text
- `ClipBlock`: `?start=X&end=Y` embed URL + formatted timestamp range label
- Unknown block types silently skipped (no crash)

## Test Results

```
Test Files  1 passed (1)
Tests       14 passed (14)
```

Tests cover: all 4 insertion buttons, block add/delete, arrayMove logic, viewer rendering for all 4 types, unknown block type robustness, image error fallback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Auto-fix] Fetch mock needed for ArticleEditor tests**
- **Found during:** Task 2 GREEN phase
- **Issue:** `global.fetch` mocked as `vi.fn()` (returns `undefined`); ArticleEditor's `useEffect` calls `fetch('/api/reference-videos').then(...)` on mount, crashing tests
- **Fix:** Added `mockFetchEmpty()` helper in test file returning `{ ok: true, json: async () => [] }`; called in `beforeEach`
- **Files modified:** `components/ArticleEditor.test.tsx`
- **Commit:** `145453d`

**2. [Rule 1 - Bug] Clip block start-time placeholder didn't match test regex**
- **Found during:** Task 2 GREEN phase test run
- **Issue:** Test asserts `getByPlaceholderText(/start/i)` but placeholder was `"e.g. 1:23"` — no match
- **Fix:** Changed placeholder to `"Start time e.g. 1:23"`
- **Files modified:** `components/ArticleEditor.tsx`
- **Commit:** `145453d`

**3. [Linter - Auto-applied] Deprecated Drive helpers removed from lib/types.ts**
- **Found during:** Task 1 commit
- **Issue:** Project linter/formatter removed `@deprecated` `thumbnailUrl`, `embedUrl`, `extractDriveFileId` functions; added `closed_at`, `is_edited`, `tags` fields to DB types
- **Impact:** Beneficial cleanup; no component imports these deprecated helpers after Phase 2 rewrite
- **Files modified:** `lib/types.ts` (linter)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| components/ArticleEditor.tsx (720 lines, min 150) | FOUND |
| components/ArticleViewer.tsx (177 lines, min 60) | FOUND |
| components/ArticleEditor.test.tsx (220 lines) | FOUND |
| lib/types.ts | FOUND |
| Commit 60087e1 (types + dnd-kit) | FOUND |
| Commit b02e04e (RED tests) | FOUND |
| Commit 145453d (GREEN implementation) | FOUND |
| 14/14 tests passing | PASSED |
| npx tsc --noEmit | CLEAN |
