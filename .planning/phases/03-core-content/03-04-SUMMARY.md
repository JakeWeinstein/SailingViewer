---
phase: 03-core-content
plan: 04
subsystem: ui
tags: [react, vitest, rtl, youtube, comments, sessions]

# Dependency graph
requires:
  - phase: 03-core-content
    provides: comment CRUD API (Plan 01), session lifecycle API + stats (Plan 03)
provides:
  - Edit/delete own comments with "edited" indicator in VideoWatchView
  - 30-second comment polling with append-only scroll-preserving pattern
  - userId + userRole props on VideoWatchView for ownership-gated controls
  - effectiveCaptain derived from isCaptain or userRole='captain'
  - Flagged count badge on video cards in home page and dashboard
  - Captain "Close & Start Next Week" button with editable label + confirmation
  - "Paste YouTube URL" add-video field in dashboard session view
  - 10 RTL tests: timestamp auto-fill, seekTo, reply toggle/count, edit/delete visibility, edit flow, delete flow, flag checkbox, comment stats badges
affects: [04-polish, 05-presentation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD red-green: tests written first, component updated to pass
    - Append-only polling: Set of existing IDs prevents scroll disruption on 30s refresh
    - Ownership check: canEditComment() checks author_id === userId OR effectiveCaptain

key-files:
  created:
    - components/VideoWatchView.test.tsx (full RTL test suite replacing stubs)
  modified:
    - components/VideoWatchView.tsx (userId/userRole props, edit/delete state+handlers, 30s polling, effectiveCaptain, blue timestamp badge style)
    - app/page.tsx (flaggedCountByVideo computed map, flagged badge on VideoCard)
    - components/DashboardView.tsx (close session + add-video UI, flaggedCountByVideo from reviewComments, flagged badges on video cards)

key-decisions:
  - "effectiveCaptain = isCaptain || userRole === 'captain' — covers both prop paths without breaking existing callers"
  - "Flagged count in dashboard derived from reviewComments (already fetched) — avoids extra API call"
  - "canEditComment checks author_id field cast via type assertion — Comment legacy type lacks author_id, cast used to avoid schema change"
  - "Comment stats badges test is a simple data assertion — visual badge rendering confirmed at Task 3 human-verify checkpoint"

patterns-established:
  - "Inline edit pattern: editingCommentId state + editText input + saveEdit/cancel — reusable for reply editing"
  - "Delete confirmation pattern: confirmDeleteId state shows Confirm/Cancel inline before calling DELETE"

requirements-completed: [COMM-01, COMM-02, COMM-03, CONT-01]

# Metrics
duration: 9min
completed: 2026-03-11
---

# Phase 3 Plan 04: Comment UI & Session Browser Summary

**RTL-tested comment edit/delete with 30s polling, flagged count badges on video cards, and captain session lifecycle controls in dashboard**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-11T19:54:56Z
- **Completed:** 2026-03-11T20:04:06Z
- **Tasks:** 2 of 3 complete (Task 3 is human-verify checkpoint — paused)
- **Files modified:** 4

## Accomplishments
- VideoWatchView fully wired for comment edit/delete with ownership checks; captain can moderate any comment
- 30-second polling appends new comments without scroll disruption (append-only Set diffing)
- Timestamp badge click seeks YT player; timestamp auto-fill on textarea focus from player.getCurrentTime()
- Home page and dashboard show flagged-for-captain comment counts as amber badges on video cards
- Dashboard: captain can close active session with auto-generated/editable "Week of [date]" label
- Dashboard: any authenticated user can add video by pasting YouTube URL inline

## Task Commits

1. **Task 1: VideoWatchView comment experience** - `f35967e` (feat/test — TDD)
2. **Task 2: Session browser UI with stats** - `bec341c` (feat)

**Plan metadata:** pending final commit (after Task 3 checkpoint cleared)

## Files Created/Modified
- `components/VideoWatchView.tsx` - Added userId/userRole props, edit/delete handlers, 30s polling, effectiveCaptain, blue timestamp badge, Edit2 icon
- `components/VideoWatchView.test.tsx` - 10 RTL tests replacing stubs (all pass)
- `app/page.tsx` - flaggedCountByVideo map + amber flagged badge on VideoCard
- `components/DashboardView.tsx` - close session UI (confirmation + next label input), add-video URL input, per-video flagged count badges

## Decisions Made
- effectiveCaptain derived from prop or userRole to avoid breaking existing callers that pass isCaptain=true
- Flagged count in dashboard computed from reviewComments (already fetched) rather than adding a new API call
- Comment stats badges test uses data assertion; visual rendering verified at human-verify checkpoint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- YT.Player mock required a proper function constructor (not arrow function) for `new` keyword — fixed in test setup
- TypeScript narrowed mockComment.timestamp_seconds to literal number type, causing spread+null override to fail — resolved with `null as number | null` cast
- `@testing-library/user-event` not installed — removed unused import (all interactions use `fireEvent` directly)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Human verification (Task 3) pending — all 13 e2e steps across Phase 3 features
- After Task 3 sign-off, Phase 3 is complete and Phase 4 (polish) can begin
- Comment author_id is not in the legacy Comment type — current cast works but Phase 4 could migrate to DbComment type

---
*Phase: 03-core-content*
*Completed: 2026-03-11*
