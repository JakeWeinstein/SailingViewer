---
phase: quick-3
plan: 01
subsystem: ui
tags: [react, auth, name-prompt]

requires:
  - phase: 01-foundation
    provides: Auth token with userName field
provides:
  - Removed deprecated NamePrompt UI from main page
  - Public access to Reference and Q&A tabs without name entry
affects: [app/page.tsx]

tech-stack:
  added: []
  patterns: [auth-token-driven-identity]

key-files:
  created: []
  modified: [app/page.tsx]

key-decisions:
  - "Removed NamePrompt entirely rather than deferring — auth is the identity source"
  - "Fallback values for unauthenticated users: 'Visitor' for Reference, 'Anonymous' for Q&A"
  - "Kept VideoWatchView userName guard — video interaction should require auth context"

patterns-established:
  - "Auth token is single source of userName — no separate name entry flow"

requirements-completed: [QUICK-3]

duration: 3min
completed: 2026-03-11
---

# Quick Task 3: Fix Deprecated Name Selection UI Summary

**Removed NamePrompt modal and name-change button; userName now auto-populated from auth token with fallback defaults for public tabs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T18:33:43Z
- **Completed:** 2026-03-11T18:36:50Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed NamePrompt import, state, rendering, and handler function from main page
- Removed name-change button (ChevronDown) from header
- Auto-set userName from auth token on mount via /api/auth/me response
- Removed userName guard from Reference tab (fallback 'Visitor') and Q&A tab (fallback 'Anonymous')
- Unauthenticated visitors can now browse Reference and Q&A tabs without entering a name

## Task Commits

1. **Task 1: Remove deprecated name selection UI** - `de123c6` (fix)

## Files Created/Modified
- `app/page.tsx` - Removed NamePrompt, name-change button, userName guards on public tabs; added auth-token userName auto-population

## Decisions Made
- Removed NamePrompt entirely rather than deferring it — authenticated users get identity from JWT, unauthenticated users get fallback defaults
- Kept VideoWatchView userName guard (line 572) intact — video playback and commenting should require auth context
- Used 'Visitor' fallback for Reference and 'Anonymous' for Q&A to distinguish context

## Deviations from Plan

None - executed exactly as specified in the reduced scope instructions.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Main page name handling is now auth-driven
- NamePrompt component file still exists but is no longer imported from page.tsx (can be deleted in future cleanup)

---
*Phase: quick-3*
*Completed: 2026-03-11*
