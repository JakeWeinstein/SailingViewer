---
phase: 01-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, zod, vitest, server-only, schema, migration]

# Dependency graph
requires: []
provides:
  - Normalized PostgreSQL schema DDL (8 tables, proper FKs) in supabase-schema-v2.sql
  - One-time migration script (SQL + TS) for v1-to-v2 upgrade
  - Server-only Supabase client (lib/supabase.ts blocked from client import)
  - DbUser/DbSession/DbSessionVideo/DbComment/DbAppConfig types in lib/types.ts
  - Vitest test infrastructure with @ alias
affects: [02-auth, 03-video-player, 04-reference-content, 05-presentation]

# Tech tracking
tech-stack:
  added: [zod, server-only, vitest, @vitejs/plugin-react, @vitest/coverage-v8]
  patterns:
    - server-only import at top of lib/supabase.ts enforces server boundary
    - Db* prefix for raw DB row types, legacy types deprecated with JSDoc
    - Migration separated into SQL (DDL ops) + TS (bcrypt-dependent ops)

key-files:
  created:
    - supabase-schema-v2.sql
    - scripts/migrate.sql
    - scripts/migrate.ts
    - vitest.config.ts
  modified:
    - lib/supabase.ts
    - lib/types.ts
    - package.json
    - app/page.tsx
    - components/DashboardView.tsx
    - components/QATab.tsx
    - components/VideoUploader.tsx
    - components/VideoWatchView.tsx

key-decisions:
  - "Kept deprecated Session/Comment/User type aliases in lib/types.ts for backward compat — avoids breaking existing components before they are rewritten in later plans"
  - "Migration split: migrate.sql handles DDL and data ops; migrate.ts handles bcrypt hash generation (pure JS, can't run in raw SQL without pgcrypto)"
  - "Db* prefix convention for normalized schema types distinguishes them from legacy UI types"

patterns-established:
  - "Server boundary: import 'server-only' as first line of any server-exclusive module"
  - "Type naming: Db* prefix for raw database row types; legacy types annotated @deprecated"
  - "Migration approach: SQL file for DDL + TS script for password hashing"

requirements-completed: [INFRA-01, INFRA-02, INFRA-04]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 1 Plan 01: Foundation Infrastructure Summary

**Normalized 8-table PostgreSQL schema with session_videos, app_config, and three-role users; server-only Supabase client; vitest test infrastructure ready**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-10T20:09:47Z
- **Completed:** 2026-03-10T20:13:49Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created `supabase-schema-v2.sql` with all 8 normalized tables: users (3-role + is_active/is_seed/must_change_password), sessions (no JSONB blob), session_videos (proper FK), comments (author_id FK + parent_id threading), reference_folders, reference_videos, articles (folder_id added), app_config (invite code in DB)
- Created `scripts/migrate.sql` (DDL migration for existing databases) and `scripts/migrate.ts` (generates bcrypt-hashed seed captain INSERT statement)
- Enforced server-only boundary on `lib/supabase.ts` — `import 'server-only'` as first line, removed old type exports
- Added `DbUser`, `DbSession`, `DbSessionVideo`, `DbComment`, `DbAppConfig` types to `lib/types.ts`
- Installed zod, server-only, vitest; configured vitest with node environment and @ path alias

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and set up test infrastructure** - `16af450` (chore)
2. **Task 2: Create normalized schema DDL and migration script** - `5bb207b` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `supabase-schema-v2.sql` — Complete fresh-setup DDL for v2 schema (8 tables)
- `scripts/migrate.sql` — One-time migration from v1 to v2, preserves reference data
- `scripts/migrate.ts` — Generates bcrypt-hashed seed captain INSERT statement
- `vitest.config.ts` — Test framework config with node env, @ alias, react plugin
- `lib/supabase.ts` — Server-only enforced; stripped old type exports
- `lib/types.ts` — Added Db* types for v2 schema + deprecated legacy type aliases
- `package.json` — Added zod, server-only, vitest; added "test" script
- `app/page.tsx`, `components/DashboardView.tsx`, `components/QATab.tsx`, `components/VideoUploader.tsx`, `components/VideoWatchView.tsx` — Updated imports from lib/supabase to lib/types

## Decisions Made
- Kept deprecated `Session`/`Comment`/`User` type aliases in `lib/types.ts` (not lib/supabase.ts) so existing components continue to compile before they are rewritten in Phase 1 Plans 2-3
- Migration split into SQL + TS because bcrypt hashing requires Node.js; pure SQL migration would need pgcrypto which is not enabled by default on Supabase

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated client component imports after removing types from lib/supabase.ts**
- **Found during:** Task 2 (updating lib/supabase.ts)
- **Issue:** Five client components imported `Session`, `Comment`, or `User` from `lib/supabase.ts`. Removing those exports broke TypeScript compilation (`tsc --noEmit` output: 7 errors across 5 files).
- **Fix:** Added backward-compat deprecated type aliases to `lib/types.ts`; updated all five component imports to point to `lib/types` instead of `lib/supabase`.
- **Files modified:** `lib/types.ts`, `app/page.tsx`, `components/DashboardView.tsx`, `components/QATab.tsx`, `components/VideoUploader.tsx`, `components/VideoWatchView.tsx`
- **Verification:** `npx tsc --noEmit` exits clean with no errors.
- **Committed in:** `5bb207b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking issue)
**Impact on plan:** Necessary to keep existing components compilable during incremental rewrite. No scope creep — no behavior changes, types-only.

## Issues Encountered
None beyond the auto-fixed import deviation above.

## User Setup Required
None — no external service configuration required for this plan. Schema must be applied manually when deploying (run `supabase-schema-v2.sql` for fresh setup or `scripts/migrate.sql` for existing database, then run `scripts/migrate.ts` for seed captain).

## Next Phase Readiness
- Schema DDL ready to apply to Supabase
- Migration script ready for existing databases
- Server boundary enforced — `lib/supabase.ts` will fail to import in client components (Next.js enforces `server-only`)
- All Db* types available for use in Phase 1 Plans 2 and 3 (auth rewrite, API routes)
- Vitest configured and ready for TDD tasks in subsequent plans

---
*Phase: 01-foundation*
*Completed: 2026-03-10*
