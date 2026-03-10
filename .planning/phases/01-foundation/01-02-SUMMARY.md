---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [jwt, zod, vitest, tdd, middleware, bcrypt, server-only]

# Dependency graph
requires: [01-01]
provides:
  - Strict JWT validation with Zod schema (no role defaulting) in lib/auth.ts
  - Zod schemas for login, register, and token payload in lib/schemas/auth.ts
  - User profile update schemas in lib/schemas/users.ts
  - Unified username+password login API for all roles in app/api/auth/login/route.ts
  - Invite-code registration (from app_config table) in app/api/auth/register/route.ts
  - All-route middleware protecting every page except /login and /register
  - Login page at /login, register page at /register
  - Behavioral tests for login (7) and register (5) routes
affects: [03-video-player, 04-reference-content, 05-presentation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TokenPayloadSchema.safeParse in verifyToken — no field defaulting anywhere
    - LoginSchema/RegisterSchema.safeParse in API routes with structured fieldErrors response
    - server-only mock via vitest alias for testing server-exclusive modules
    - (auth) route group for /login and /register with minimal centered layout

key-files:
  created:
    - lib/schemas/auth.ts
    - lib/schemas/users.ts
    - lib/auth.test.ts
    - app/(auth)/layout.tsx
    - app/(auth)/login/page.tsx
    - app/(auth)/register/page.tsx
    - app/api/auth/login/route.test.ts
    - app/api/auth/register/route.test.ts
    - __mocks__/server-only.ts
  modified:
    - lib/auth.ts
    - vitest.config.ts
    - middleware.ts
    - app/api/auth/login/route.ts
    - app/api/auth/register/route.ts
    - app/api/auth/logout/route.ts
    - app/api/auth/me/route.ts
    - app/dashboard/page.tsx
    - components/DashboardView.tsx
    - app/page.tsx
  deleted:
    - app/dashboard/login/page.tsx
    - app/dashboard/register/page.tsx

key-decisions:
  - "Unified login: all roles (captain/contributor/viewer) use username+password; separate captain password-only flow removed"
  - "Register assigns viewer role (not contributor) — aligns with three-role system from 01-01"
  - "server-only mock via vitest alias — safer than conditional imports; keeps production server boundary enforced"
  - "COOKIE_NAME renamed tf_captain_session to tf_session — reflects multi-role usage"

patterns-established:
  - "Zod safeParse at API route boundary: 400 + {error, details: fieldErrors} on validation failure"
  - "verifyToken strict: TokenPayloadSchema.safeParse, return null on any schema mismatch"
  - "Middleware excludes /api/ routes — they return 401 JSON, not redirects"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-06, INFRA-03]

# Metrics
duration: 14min
completed: 2026-03-10
---

# Phase 1 Plan 02: Auth Rewrite Summary

**Strict Zod-validated JWT auth with unified username+password login for all three roles, invite-code registration from DB, all-route middleware, and 18 behavioral tests covering Zod validation errors, credential checking, and invite code validation**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-03-10T20:16:27Z
- **Completed:** 2026-03-10T20:31:16Z
- **Tasks:** 2
- **Files modified:** 12 (+ 9 created, 2 deleted)

## Accomplishments

- Created `lib/schemas/auth.ts` with `TokenPayloadSchema` (3 roles: captain/contributor/viewer), `LoginSchema`, `RegisterSchema`
- Created `lib/schemas/users.ts` with `UpdateRoleSchema`, `UpdateProfileSchema`, `ResetPasswordSchema`
- Rewrote `lib/auth.ts`: `import 'server-only'` as first line, strict `verifyToken` using `TokenPayloadSchema.safeParse` — no `??` defaulting anywhere, `COOKIE_NAME` renamed to `tf_session`
- Rewrote login route: unified username+password for all roles, Zod `fieldErrors` on 400, `is_active` check, `last_login_at` update, 200 returns `{ user: { id, username, displayName, role } }`
- Rewrote register route: invite code from `app_config` table (not env var), assigns `viewer` role, `is_seed=false`, signs JWT on success
- Rewrote logout route: returns `{ success: true }`, clears `tf_session` cookie
- Updated me route: queries DB for fresh user data, clears stale cookie on 401
- Rewrote middleware: `PUBLIC_PATHS = ['/login', '/register']`, API routes excluded, comprehensive matcher covering all non-asset routes
- Created `app/(auth)` route group with minimal layout, login page at `/login`, register page at `/register` (both with field-level Zod error display)
- Deleted old `app/dashboard/login/` and `app/dashboard/register/` directories
- Added `__mocks__/server-only.ts` + vitest alias to enable testing server-only modules
- 18 tests passing: 6 auth.test.ts + 7 login route + 5 register route

## Task Commits

1. **Task 1: Zod schemas + lib/auth.ts rewrite** - `d247fc0` (feat)
2. **Task 2: API routes, middleware, pages, tests** - `abd694f` (feat)
3. **Auto-fix: navigation links** - `87737dd` (fix)

## Files Created/Modified

- `lib/schemas/auth.ts` — TokenPayloadSchema, LoginSchema, RegisterSchema
- `lib/schemas/users.ts` — UpdateRoleSchema, UpdateProfileSchema, ResetPasswordSchema
- `lib/auth.ts` — server-only, strict verifyToken, COOKIE_NAME=tf_session
- `lib/auth.test.ts` — 6 behavioral tests for signToken/verifyToken
- `__mocks__/server-only.ts` — no-op mock for test environment
- `vitest.config.ts` — server-only alias added
- `app/api/auth/login/route.ts` — unified login, Zod validation, structured errors
- `app/api/auth/login/route.test.ts` — 7 behavioral tests
- `app/api/auth/register/route.ts` — DB invite code, viewer role, Zod validation
- `app/api/auth/register/route.test.ts` — 5 behavioral tests
- `app/api/auth/logout/route.ts` — clears tf_session cookie
- `app/api/auth/me/route.ts` — fresh DB lookup, stale cookie clearing
- `middleware.ts` — all-route protection, PUBLIC_PATHS, API excluded
- `app/(auth)/layout.tsx` — minimal centered auth layout
- `app/(auth)/login/page.tsx` — login form at /login with Zod field errors
- `app/(auth)/register/page.tsx` — register form at /register with distinct error states
- `app/dashboard/page.tsx` — redirect to /login (was /dashboard/login)
- `components/DashboardView.tsx` — userRole now accepts viewer, logout -> /login
- `app/page.tsx` — Login link -> /login

## Decisions Made

- All roles use unified username+password login — the old captain password-only flow with no username is gone
- Registration assigns `viewer` role (matching the three-role system established in Plan 01)
- COOKIE_NAME changed from `tf_captain_session` to `tf_session` to reflect multi-role usage
- `server-only` mocked in test environment via vitest alias — no conditional exports needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added server-only mock to vitest config**
- **Found during:** Task 1 (running auth.test.ts)
- **Issue:** `import 'server-only'` in `lib/auth.ts` throws `Error: This module cannot be imported from a Client Component module` in vitest node environment
- **Fix:** Created `__mocks__/server-only.ts` (no-op export) and added vitest resolve alias `server-only -> __mocks__/server-only.ts`
- **Files modified:** `vitest.config.ts`, `__mocks__/server-only.ts`
- **Verification:** All 6 auth tests pass after fix

**2. [Rule 1 - Bug] Fixed DashboardView.tsx to accept viewer role**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** `DashboardView` typed `userRole: 'captain' | 'contributor'` — missing viewer role from new three-role system; caused TypeScript error `Type '"viewer"' is not assignable to type '"captain" | "contributor"'`
- **Fix:** Updated prop type to `'captain' | 'contributor' | 'viewer'`
- **Files modified:** `components/DashboardView.tsx`
- **Verification:** `npx tsc --noEmit` exits clean

**3. [Rule 1 - Bug] Fixed stale /dashboard/login navigation links**
- **Found during:** Post-Task 2 verification (grep for old paths)
- **Issue:** `app/page.tsx` and `components/DashboardView.tsx` still linked to `/dashboard/login` which was deleted; users clicking Login or logging out would hit 404
- **Fix:** Updated both files to reference `/login`
- **Files modified:** `app/page.tsx`, `components/DashboardView.tsx`
- **Verification:** No remaining `dashboard/login` references in app/ or components/

---

**Total deviations:** 3 auto-fixed (1 Rule 3, 2 Rule 1)
**Impact on plan:** All necessary for correctness and compilation. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Next Phase Readiness

- JWT auth is strict — all tokens require valid UUID userId; old captain-only tokens rejected
- Three roles fully supported in auth layer
- All API routes can use `getTokenPayload(req)` for role-based auth
- Middleware protects all pages; API routes return 401 JSON (not redirects)
- Test infrastructure validated: server-only mock pattern reusable for future API route tests

---
*Phase: 01-foundation*
*Completed: 2026-03-10*
