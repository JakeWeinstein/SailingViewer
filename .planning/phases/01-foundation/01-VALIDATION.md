---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
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
| **Config file** | `vitest.config.ts` — Wave 0 creates this |
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
| 1-01-01 | 01 | 0 | INFRA-01 | unit | `npx vitest run vitest.config.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | AUTH-06 | unit | `npx vitest run lib/auth.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | AUTH-03 | unit | `npx vitest run lib/auth.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | AUTH-01 | unit | `npx vitest run app/api/auth/register/route.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 1 | AUTH-02 | unit | `npx vitest run app/api/auth/login/route.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-03 | 03 | 1 | INFRA-03 | unit | `npx vitest run app/api/auth/login/route.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | AUTH-04 | unit | `npx vitest run app/api/users/route.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-02 | 04 | 2 | AUTH-04 | unit | `npx vitest run app/api/users/[id]/route.test.ts` | ❌ W0 | ⬜ pending |
| 1-05-01 | 05 | 1 | INFRA-04 | unit | `npx vitest run lib/migration.test.ts` | ❌ W0 | ⬜ pending |
| 1-06-01 | 06 | 2 | INFRA-02 | build | `next build` (manual inspection) | manual-only | ⬜ pending |
| 1-06-02 | 06 | 2 | INFRA-03 | unit | `npx vitest run app/api/auth/register/route.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration with jsdom, path aliases
- [ ] `test/setup.ts` — jest-dom matchers, next/navigation mock, fetch mock
- [ ] `lib/auth.test.ts` — stubs for AUTH-06, AUTH-03
- [ ] `app/api/auth/login/route.test.ts` — stubs for AUTH-02, INFRA-03
- [ ] `app/api/auth/register/route.test.ts` — stubs for AUTH-01, INFRA-03
- [ ] `app/api/users/[id]/route.test.ts` — stubs for AUTH-04
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom`

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `lib/supabase.ts` build fails if imported from client component | INFRA-02 | Build-time enforcement via `server-only` package; cannot be unit-tested | Run `next build` and verify no `SUPABASE_SERVICE_ROLE_KEY` in `.next/static/` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
