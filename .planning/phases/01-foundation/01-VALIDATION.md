---
phase: 1
slug: foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.x |
| **Config file** | `vitest.config.ts` — Plan 01-01 Task 1 creates this |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFRA-01 | infra | `npm run test -- --passWithNoTests` | created by task | pending |
| 1-01-02 | 01 | 1 | INFRA-04 | build | `npx tsc --noEmit` | N/A | pending |
| 1-02-01 | 02 | 2 | AUTH-06, AUTH-03 | unit | `npx vitest run lib/auth.test.ts` | created by task | pending |
| 1-02-02 | 02 | 2 | AUTH-01, AUTH-02, INFRA-03 | unit | `npx vitest run app/api/auth/login/route.test.ts app/api/auth/register/route.test.ts` | created by task | pending |
| 1-03-01 | 03 | 3 | AUTH-04 | unit | `npx vitest run app/api/users/[id]/route.test.ts` | created by task | pending |
| 1-03-02 | 03 | 3 | AUTH-04 | build | `npx tsc --noEmit` | N/A | pending |
| 1-03-03 | 03 | 3 | ALL | e2e | Human verification checkpoint (12 steps) | manual | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `vitest.config.ts` — Vitest configuration with path aliases (Plan 01-01 Task 1)
- [x] `lib/auth.test.ts` — JWT validation tests (Plan 01-02 Task 1)
- [x] `app/api/auth/login/route.test.ts` — Login route behavioral tests (Plan 01-02 Task 2)
- [x] `app/api/auth/register/route.test.ts` — Register route behavioral tests (Plan 01-02 Task 2)
- [x] `app/api/users/[id]/route.test.ts` — User management + seed captain protection tests (Plan 01-03 Task 1)
- [x] Framework install: `npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8` (Plan 01-01 Task 1)

*All test files are created within their respective plan tasks — no separate Wave 0 needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `lib/supabase.ts` build fails if imported from client component | INFRA-02 | Build-time enforcement via `server-only` package; cannot be unit-tested | Run `next build` and verify no `SUPABASE_SERVICE_ROLE_KEY` in `.next/static/` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or test file creation within the task
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] All test files created within plan tasks (no orphan Wave 0 references)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
