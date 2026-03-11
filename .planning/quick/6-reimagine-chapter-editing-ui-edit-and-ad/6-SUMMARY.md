---
phase: quick-6
plan: 01
subsystem: ui
tags: [react, chapters, reference-videos, auth-gating]

requires:
  - phase: 03-core-content
    provides: "Chapter model with parent_video_id, reference-videos API"
provides:
  - "Inline chapter add/edit UI in VideoWatchView chapter sidebar"
  - "Auth-gated chapter editing for any authenticated user"
  - "ReferenceManager chapter controls relaxed from captain-only to any-auth"
affects: [reference-library, video-watch, presentation-mode]

tech-stack:
  added: []
  patterns: ["canEditChapters derived from isAuthenticated || effectiveCaptain || userId"]

key-files:
  created: []
  modified:
    - components/VideoWatchView.tsx
    - components/ReferenceManager.tsx
    - app/page.tsx

key-decisions:
  - "canEditChapters OR-chain: isAuthenticated || effectiveCaptain || userId -- any truthy path grants chapter edit access"
  - "Delete button remains captain-only in ReferenceManager for safety"
  - "onChaptersChanged callback triggers full re-fetch of reference videos to keep sibling list in sync"

requirements-completed: [QUICK-6]

duration: 4min
completed: 2026-03-11
---

# Quick Task 6: Reimagine Chapter Editing UI Summary

**Inline chapter add/edit UI in VideoWatchView sidebar with auth-gated access for any logged-in user, plus relaxed ReferenceManager chapter controls**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T19:07:45Z
- **Completed:** 2026-03-11T19:12:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added inline chapter add/edit forms to VideoWatchView's chapter sidebar with title, timestamp, and "Use current time" button
- Added per-chapter edit icon (pencil) on hover for authenticated users
- Added "Add first chapter" prompt for reference videos without existing chapters
- Relaxed ReferenceManager chapter gating from captain-only to any authenticated user
- Main app page now passes auth state (isAuthenticated, userRole) to both VideoWatchView and ReferenceManager

## Task Commits

Each task was committed atomically:

1. **Task 1: Add chapter editing UI to VideoWatchView and pass auth from main app** - `773c51e` (feat)
2. **Task 2: Change ReferenceManager chapter gating from captain-only to any-authenticated** - `83e299c` (feat)

## Files Created/Modified
- `components/VideoWatchView.tsx` - Added isAuthenticated/onChaptersChanged props, chapter editing state, add/edit handlers, inline forms in chapter sidebar, edit icons on chapter rows
- `components/ReferenceManager.tsx` - Added isAuthenticated prop, relaxed chapter button gating to any-auth, kept delete captain-only, passed isAuthenticated and onChaptersChanged to VideoWatchView
- `app/page.tsx` - Passes isAuthenticated and userRole to VideoWatchView, passes isAuthenticated to ReferenceManager

## Decisions Made
- Used `canEditChapters = isAuthenticated || effectiveCaptain || !!userId` as the OR-chain for chapter edit access -- any truthy path grants access
- Delete button in ReferenceManager remains captain-only (dangerous destructive action)
- onChaptersChanged triggers a full re-fetch of `/api/reference-videos` to keep the sidebar chapter list in sync after add/edit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Quick task: 6*
*Completed: 2026-03-11*
