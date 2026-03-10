---
phase: 01-foundation
verified: 2026-03-10T15:48:45Z
status: passed
score: 5/5 must-haves verified
gaps: []
human_verification:
  - test: "Register a new account, verify viewer role, then log in as captain and use Team tab to promote that user"
    expected: "New user registers as viewer, captain sees them in Team tab, role change persists, seed captain controls are disabled"
    why_human: "Full browser auth flow, cookie handling, and UI state changes cannot be verified programmatically"
  - test: "Visit any protected page (e.g. /dashboard) without a session cookie"
    expected: "Redirected to /login, not /dashboard/login"
    why_human: "Middleware redirect behavior and browser navigation require manual confirmation"
---

# Phase 1: Foundation Verification Report

**Phase Goal:** Normalized schema, strict auth, role-based access — the infrastructure every later phase depends on.
**Verified:** 2026-03-10T15:48:45Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A viewer can register with invite code and log in; captain can log in; malformed/unsigned tokens rejected with 401 (no silent role defaulting) | VERIFIED | `verifyToken` uses `TokenPayloadSchema.safeParse` — returns null on any schema mismatch; 6 auth tests pass including old-format token rejection; unified login route in place |
| 2 | Captain can view all user accounts and assign roles (Captain / Contributor / Viewer) from the dashboard | VERIFIED | `GET /api/users` + `PATCH /api/users/[id]` implement list and role change; `TeamManager` renders user table with role dropdown wired to API; `DashboardView` shows Team tab for captain only |
| 3 | Videos previously stored as JSONB in sessions.videos exist as rows in normalized session_videos table with proper foreign keys; existing data is preserved | VERIFIED | `supabase-schema-v2.sql` defines `session_videos` with `session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE`; `sessions` table has no videos JSONB column; `scripts/migrate.sql` migrates existing data; `scripts/migrate.ts` generates seed captain INSERT |
| 4 | Every API route validates its inputs with Zod and returns structured errors on invalid payloads | VERIFIED | Login, register, and user management routes all use `.safeParse()` and return `{ error, details: fieldErrors }` on 400; 7 login + 5 register tests explicitly verify Zod error shape |
| 5 | Supabase service role key is unreachable from the browser (import 'server-only' enforced) | VERIFIED | `lib/supabase.ts` line 1 is `import 'server-only'`; all 22 importers are API routes or server page components; zero `'use client'` components import from `lib/supabase`; TypeScript compiles clean |

**Score:** 5/5 truths verified

---

## Required Artifacts

### Plan 01 — Schema, Migration, Server Boundary

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase-schema-v2.sql` | Complete new normalized schema DDL | VERIFIED | 8 tables with proper FKs; `session_videos` with FK to `sessions`; `app_config` with seeded invite code; three-role `users` |
| `scripts/migrate.ts` | One-time migration script (bcrypt helper) | VERIFIED | Generates hashed seed captain INSERT; imports bcryptjs; substantive |
| `scripts/migrate.sql` | DDL migration for existing databases | VERIFIED | Creates `session_videos`, `app_config`; alters `users` table; truncates and migrates data |
| `lib/supabase.ts` | Server-only Supabase client | VERIFIED | `import 'server-only'` as first line; no type exports |
| `vitest.config.ts` | Test framework configuration | VERIFIED | Node environment, `@` alias, react plugin, `server-only` mock alias |

### Plan 02 — Auth Rewrite

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/auth.ts` | Strict JWT auth with Zod validation | VERIFIED | `import 'server-only'`; `TokenPayloadSchema.safeParse` in `verifyToken`; no `??` defaulting; exports `signToken`, `verifyToken`, `getTokenPayload`, `COOKIE_NAME`, `TokenPayload` |
| `lib/schemas/auth.ts` | Login and register Zod schemas | VERIFIED | `TokenPayloadSchema` with 3 roles; `LoginSchema`; `RegisterSchema` |
| `lib/schemas/users.ts` | User update schemas | VERIFIED | `UpdateRoleSchema`, `UpdateProfileSchema`, `ResetPasswordSchema` |
| `middleware.ts` | All-route protection | VERIFIED | `PUBLIC_PATHS = ['/login', '/register']`; API routes excluded; `verifyToken` on all other paths |
| `app/api/auth/login/route.ts` | Unified login endpoint | VERIFIED | `LoginSchema.safeParse`; bcrypt compare; `signToken`; sets `tf_session` cookie |
| `app/api/auth/register/route.ts` | Invite-code registration | VERIFIED | Reads invite code from `app_config` table; assigns `viewer` role; `is_seed=false` |
| `app/(auth)/login/page.tsx` | Login page at /login | VERIFIED | Client component; form submits to `/api/auth/login`; shows Zod field errors |
| `app/(auth)/register/page.tsx` | Register page at /register | VERIFIED | Client component; handles 403/409 distinctly |
| `app/api/auth/login/route.test.ts` | Login route behavioral tests | VERIFIED | 7 tests passing; covers Zod errors, unknown user, wrong password, inactive user |
| `app/api/auth/register/route.test.ts` | Register route behavioral tests | VERIFIED | 5 tests passing; covers field errors, bad invite code, taken username, viewer role assignment |

### Plan 03 — User Management

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/users/route.ts` | User list (GET captain-only) + self-service PATCH | VERIFIED | GET returns users without `password_hash`; PATCH handles `UpdateProfileSchema` |
| `app/api/users/[id]/route.ts` | PATCH role/status, DELETE | VERIFIED | Seed captain protected from demotion and deletion; self-deletion blocked; `UserUpdateSchema` union |
| `app/api/users/[id]/reset-password/route.ts` | Captain sets temporary password | VERIFIED | POST; bcrypt hash; sets `must_change_password=true` |
| `app/api/settings/invite-code/route.ts` | Invite code read + rotate | VERIFIED | GET reads `app_config`; POST rotates via `crypto.randomUUID()` |
| `app/api/users/[id]/route.test.ts` | Behavioral tests for user management | VERIFIED | 7 tests passing; covers all authorization cases including seed captain protection |
| `components/TeamManager.tsx` | Captain team management UI | VERIFIED | Fetches `GET /api/users`; role dropdown, activate/deactivate, reset-password inline form, delete; invite code section; seed captain controls disabled |
| `components/ProfileEditor.tsx` | Self-service profile editing | VERIFIED | Display name + password change; PATCH to `/api/users` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/supabase.ts` | `server-only` | `import 'server-only'` at line 1 | WIRED | Confirmed first line of file |
| `app/api/auth/login/route.ts` | `lib/schemas/auth.ts` | `LoginSchema.safeParse` | WIRED | Line 19: `const parsed = LoginSchema.safeParse(body)` |
| `app/api/auth/login/route.ts` | `lib/auth.ts` | `signToken` after bcrypt verify | WIRED | Line 47: `const token = await signToken({...})` |
| `app/api/auth/register/route.ts` | `app_config` table | Supabase query for invite code | WIRED | Lines 30-37: queries `app_config` `.eq('key', 'invite_code')` |
| `middleware.ts` | `lib/auth.ts` | `verifyToken` on every request | WIRED | Line 21: `!(await verifyToken(token))` |
| `lib/auth.ts` | `lib/schemas/auth.ts` | `TokenPayloadSchema.safeParse` in `verifyToken` | WIRED | Line 32: `const parsed = TokenPayloadSchema.safeParse(payload)` |
| `app/api/users/[id]/route.ts` | `users.is_seed` | Check before role change or delete | WIRED | Line 43: `if ('role' in parsed.data && target.is_seed && ...)` |
| `components/TeamManager.tsx` | `/api/users` | Fetch user list and manage | WIRED | Line 59: `fetch('/api/users')`; lines 86, 100, 115, 132 for management calls |
| `components/DashboardView.tsx` | `components/TeamManager.tsx` | Team tab in sidebar | WIRED | Line 14: `import TeamManager`; line 428: `<TeamManager />` rendered when `sidebarView === 'team' && isCaptain` |
| `app/api/settings/invite-code/route.ts` | `app_config` | Read/write invite_code | WIRED | GET line 14; POST line 33: both query `app_config` with `.eq('key', 'invite_code')` |
| `app/dashboard/page.tsx` | `components/DashboardView.tsx` | Passes `userId` from token payload | WIRED | Line 31: `userId={payload.userId}` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | 01-01 | Normalized database schema (no JSONB blobs for video storage) | SATISFIED | `session_videos` table with FK replaces `sessions.videos JSONB`; confirmed in `supabase-schema-v2.sql` |
| INFRA-02 | 01-01 | Supabase client isolated to server-side only | SATISFIED | `import 'server-only'` in `lib/supabase.ts`; 0 client components import it |
| INFRA-03 | 01-02 | Zod validation at every API boundary | SATISFIED | Login, register, user management routes all use `safeParse` with structured `fieldErrors`; verified by 12 tests |
| INFRA-04 | 01-01 | Data migration from existing schema preserving current content | SATISFIED | `scripts/migrate.sql` preserves reference_folders, reference_videos, articles; truncates only sessions/comments/users |
| AUTH-01 | 01-02 | User can register with invite code, username, display name, and password | SATISFIED | `POST /api/auth/register` with `RegisterSchema`; invite code from `app_config` |
| AUTH-02 | 01-02 | User can log in with username and password | SATISFIED | `POST /api/auth/login` with `LoginSchema`; unified for all roles |
| AUTH-03 | 01-02 | Three roles exist: Captain, Contributor, Viewer | SATISFIED | `TokenPayloadSchema` enforces `z.enum(['captain', 'contributor', 'viewer'])`; schema DDL `CHECK (role IN ('captain','contributor','viewer'))` |
| AUTH-04 | 01-03 | Captain can view and manage all user accounts and assign roles | SATISFIED | Full API + `TeamManager` UI; role change, deactivate, delete, reset-password, invite code rotation |
| AUTH-06 | 01-02 | JWT auth with secure token validation (reject malformed tokens, no role defaulting) | SATISFIED | `verifyToken` uses `TokenPayloadSchema.safeParse`; 3 tests explicitly verify rejection of malformed/expired/old-format tokens; no `??` defaulting anywhere |

**All 9 required IDs accounted for. No orphaned requirements.**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/TeamManager.tsx` | 317 | `placeholder="Min 8 characters"` | Info | HTML input placeholder attribute — not a stub, correct usage |
| `lib/auth.ts` | 33, 36, 42 | `return null` | Info | Correct rejection returns in `verifyToken`/`getTokenPayload` — not stubs, intended behavior |

No blocker or warning anti-patterns found.

---

## Human Verification Required

### 1. End-to-end auth and team management flow

**Test:** Register a new user at `/register` with the invite code from the DB, then log in as the seed captain and open the Team tab in the dashboard.
**Expected:** New user appears in the user table with role "Viewer"; captain can promote them to Contributor; the seed captain row has disabled role/deactivate/delete controls; rotating the invite code changes the displayed code.
**Why human:** Browser cookie handling, form submission, redirect behavior, and UI state updates cannot be verified without a running browser session.

### 2. Unauthenticated redirect

**Test:** Clear cookies and visit `/dashboard` directly in the browser.
**Expected:** Redirected to `/login` (not `/dashboard/login`, which no longer exists).
**Why human:** Middleware redirect behavior requires a live Next.js dev server.

### 3. Server boundary enforcement via bundle inspection

**Test:** Run `next build` and inspect the browser bundle (Network tab or `.next/static/chunks/`) for the string `SUPABASE_SERVICE_ROLE_KEY`.
**Expected:** The string does not appear in any client-delivered bundle.
**Why human:** Static analysis confirms `server-only` is in place, but the success criterion explicitly calls for bundle inspection confirmation.

---

## Summary

Phase 1 goal is fully achieved. All five success criteria are met:

- Schema normalization is real: `session_videos` table with FK replaces the JSONB blob; `app_config` stores the invite code; all 8 DDL tables confirmed in `supabase-schema-v2.sql`.
- Auth is strict: `verifyToken` uses `TokenPayloadSchema.safeParse` with no field defaulting; 6 behavioral tests confirm rejection of old-format, expired, and schema-mismatched tokens.
- Role-based access is enforced: Three roles in JWT schema, DB, and middleware; seed captain is immutably protected server-side.
- Server boundary is enforced: `import 'server-only'` on `lib/supabase.ts`; all 22 importers are server-side files.
- Zod validation at every API boundary: 12 tests verify structured `fieldErrors` responses.

All 25 tests pass. TypeScript compiles without errors. Three items remain for human confirmation (auth flow in browser, redirect behavior, bundle inspection).

---

_Verified: 2026-03-10T15:48:45Z_
_Verifier: Claude (gsd-verifier)_
