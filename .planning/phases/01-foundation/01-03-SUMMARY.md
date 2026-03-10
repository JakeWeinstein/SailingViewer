---
phase: 01-foundation
plan: 03
subsystem: user-management
tags: [zod, tdd, vitest, bcrypt, captain, team-management, profile, invite-code]

# Dependency graph
requires: [01-02]
provides:
  - Captain-only user list API in app/api/users/route.ts (GET)
  - Self-service profile update API in app/api/users/route.ts (PATCH)
  - Captain user management API in app/api/users/[id]/route.ts (PATCH role/status, DELETE)
  - Captain password reset API in app/api/users/[id]/reset-password/route.ts (POST)
  - Invite code read and rotate API in app/api/settings/invite-code/route.ts (GET, POST)
  - TeamManager UI component with user table, role/status controls, invite code section
  - ProfileEditor UI component with display name and password self-service
  - DashboardView extended with Team tab (captain-only) and Profile tab (all roles)
affects: [02-video-player, 03-reference-content, 04-articles, 05-presentation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - z.union([UpdateRoleSchema, z.object({ is_active: z.boolean() })]) for combined PATCH schema
    - randomUUID() from crypto for invite code rotation (no uuid package needed)
    - Inline reset-password form row in table (TR expansion pattern) for contextual actions
    - ProfileEditor uses local state + PATCH /api/users self-service endpoint

key-files:
  created:
    - app/api/users/route.ts
    - app/api/users/[id]/route.ts
    - app/api/users/[id]/reset-password/route.ts
    - app/api/settings/invite-code/route.ts
    - app/api/users/[id]/route.test.ts
    - components/TeamManager.tsx
    - components/ProfileEditor.tsx
  modified:
    - components/DashboardView.tsx
    - app/dashboard/page.tsx

key-decisions:
  - "Seed captain (is_seed=true) protected from demotion and deletion — checked server-side before any update"
  - "Self-deletion blocked: captain cannot delete their own account via /api/users/[id]"
  - "invite code rotation uses crypto.randomUUID() — no external dependency"
  - "ProfileEditor displayName prop is userName (from token) — actual display_name not fetched separately to avoid extra API round trip"

requirements-completed: [AUTH-04]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 1 Plan 03: User Management Summary

**Captain user management with seed captain protection, role/status/password controls, invite code rotation, team UI, and self-service profile editing — all with Zod validation and behavioral tests**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-10T20:34:08Z
- **Completed:** 2026-03-10T20:38:00Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify)
- **Files modified:** 2 (+ 7 created)

## Accomplishments

- Created `app/api/users/route.ts`: GET (captain-only, user list without password_hash), PATCH (self-service: display name + password with bcrypt verification)
- Created `app/api/users/[id]/route.ts`: PATCH (captain-only: role change or is_active toggle; seed captain blocked from demotion), DELETE (captain-only; seed captain and self-deletion blocked)
- Created `app/api/users/[id]/reset-password/route.ts`: POST (captain-only; bcrypt hash, sets must_change_password=true)
- Created `app/api/settings/invite-code/route.ts`: GET (read current code), POST (rotate via crypto.randomUUID())
- Created `app/api/users/[id]/route.test.ts`: 7 behavioral tests covering all authorization cases — all pass
- Created `components/TeamManager.tsx`: User table with role dropdown, activate/deactivate toggle, inline reset-password form, delete button; invite code section with copy and rotate; seed captain controls disabled
- Created `components/ProfileEditor.tsx`: Display name edit, read-only username and role badge, change password section with confirm-password client-side validation
- Updated `components/DashboardView.tsx`: Added `userId` prop, Team tab (captain-only), Profile tab (all roles), imported TeamManager and ProfileEditor
- Updated `app/dashboard/page.tsx`: Passes `userId={payload.userId}` to DashboardView

## Task Commits

1. **Task 1 RED: Behavioral tests for user management** - `cbbd2b8`
2. **Task 1 GREEN: User management and invite code API routes** - `86bcc5c`
3. **Task 2: Team manager UI, profile editor, dashboard wiring** - `1f5130e`

## Files Created/Modified

- `app/api/users/route.ts` — GET user list (captain-only), PATCH self-service profile
- `app/api/users/[id]/route.ts` — PATCH role/status (captain-only), DELETE (captain-only)
- `app/api/users/[id]/reset-password/route.ts` — POST temp password (captain-only)
- `app/api/settings/invite-code/route.ts` — GET read, POST rotate (captain-only)
- `app/api/users/[id]/route.test.ts` — 7 behavioral tests
- `components/TeamManager.tsx` — Captain team management UI
- `components/ProfileEditor.tsx` — Self-service profile editor
- `components/DashboardView.tsx` — Added userId prop, Team + Profile sidebar tabs
- `app/dashboard/page.tsx` — Passes userId from token payload to DashboardView

## Decisions Made

- Seed captain is_seed=true is the immutable anchor for captain protection — no complex "last captain" counting needed
- Self-deletion blocked with separate 403 ("Cannot delete your own account") for clarity
- invite code rotation uses Node.js built-in `crypto.randomUUID()` — no external package required
- ProfileEditor receives `displayName: userName` (from token) as initial value — avoids extra API round trip on load

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- All Phase 1 foundation APIs are in place
- Task 3 is checkpoint:human-verify — requires human to run migration, start dev server, and test end-to-end flow
- After verification, Phase 1 is complete and Phase 2 can begin

## Self-Check: PASSED

- FOUND: app/api/users/route.ts
- FOUND: app/api/users/[id]/route.ts
- FOUND: app/api/users/[id]/reset-password/route.ts
- FOUND: app/api/settings/invite-code/route.ts
- FOUND: app/api/users/[id]/route.test.ts
- FOUND: components/TeamManager.tsx
- FOUND: components/ProfileEditor.tsx
- COMMIT cbbd2b8: test(01-03): add failing tests for user management [id] route
- COMMIT 86bcc5c: feat(01-03): user management and invite code API routes
- COMMIT 1f5130e: feat(01-03): team manager UI, profile editor, dashboard wiring

---
*Phase: 01-foundation*
*Completed: 2026-03-10*
