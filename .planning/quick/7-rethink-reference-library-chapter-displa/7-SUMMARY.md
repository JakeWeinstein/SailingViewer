---
phase: quick-7
plan: 1
subsystem: reference-library
tags: [ui, reference-library, chapters, grid-layout]
dependency_graph:
  requires: []
  provides: [consolidated-chapter-cards]
  affects: [reference-library-display]
tech_stack:
  added: []
  patterns: [expandable-dropdown, grouped-card-display]
key_files:
  created: []
  modified:
    - components/ReferenceManager.tsx
decisions:
  - Per-card useState for chapter expansion (simpler than Set at VideoGrid level)
  - Single flat grid container instead of per-group grid wrappers
  - Purple accent theme maintained for chapter-related UI elements
metrics:
  duration_seconds: 153
  completed: "2026-03-11T20:09:32Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 7: Rethink Reference Library Chapter Display Summary

Consolidated chapter video cards into single source-video card with expandable purple-themed chapter dropdown, eliminating duplicate thumbnails from the reference library grid.

## What Changed

### VideoCard (components/ReferenceManager.tsx)
- Added optional `chapters` prop to accept chapter videos
- When chapters present: renders expandable toggle ("N chapters" with ChevronDown icon)
- Expanded state shows compact chapter list with purple left border, timestamp badges, and click-to-watch
- Changed Tailwind group modifier from `group` to `group/card` to avoid conflicts with nested interactive elements

### VideoGrid (components/ReferenceManager.tsx)
- Replaced per-group grid containers and standalone single-item grids with one flat grid
- Group items render single `VideoCard` with chapters passed as prop (no separate chapter cards)
- Removed group header dividers ("Video Title -- N chapters" with purple lines)
- Standalone videos render unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles without errors (`npx tsc --noEmit`)
- Human verified: consolidated cards display correctly, chapter dropdown works, standalone videos unchanged

## Commits

| Hash | Message |
|------|---------|
| 1d50c92 | feat(quick-7): consolidate chapter cards into single card with expandable dropdown |

## Self-Check: PASSED
