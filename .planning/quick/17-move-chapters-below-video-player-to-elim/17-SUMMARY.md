---
phase: quick-17
plan: 01
subsystem: video-viewer
tags: [layout, chapters, ui]
dependency_graph:
  requires: []
  provides: [chapters-below-video]
  affects: [VideoWatchView]
tech_stack:
  added: []
  patterns: [left-column-chapters]
key_files:
  modified:
    - components/VideoWatchView.tsx
decisions:
  - Applied bg-black only to aspect-video div instead of full left column
  - Used sm:overflow-y-auto on left column for desktop scroll with natural growth on mobile
metrics:
  duration: 97s
  completed: "2026-03-12T00:09:29Z"
---

# Quick Task 17: Move Chapters Below Video Player Summary

Relocated chapters section from right panel to left column below title bar, eliminating black space gap.

## What Changed

### Task 1: Relocate chapters from right panel to left column below title bar
**Commit:** ad64129

Restructured the VideoWatchView modal layout:

1. **Left column container** (`w-full sm:w-[65%]`): Removed `bg-black` from the outer container. Added `sm:overflow-y-auto` so chapters scroll within the left column on desktop while growing naturally on mobile.

2. **Video area**: Applied `bg-black` directly to the `aspect-video` div so only the video player area has a black background.

3. **Chapters moved**: Cut the entire chapters block (multi-chapter navigation with edit forms, add chapter button/form, and the "add first chapter" block) from the top of the right panel and placed it in the left column immediately after the gray-900 title bar.

4. **Right panel**: Now starts directly with captain notes section followed by comments. No other changes to the right panel structure.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Build passes cleanly with no errors
- Chapters render below video title bar in left column
- No black space below title bar (bg-black only on aspect-video)
- Right panel contains only captain notes and comments
- All chapter handlers (handleChapterClick, startEditingChapter, handleEditChapter, handleAddChapter) unchanged

## Self-Check: PASSED
