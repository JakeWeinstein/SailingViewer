---
phase: 5
slug: presentation-and-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | REV-01 | unit (API route) | `npx vitest run app/api/comments/route.test.ts -t "review queue"` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | REV-03 | unit (API route) | `npx vitest run app/api/comments/[id]/route.test.ts -t "is_reviewed"` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | REV-05 | unit (API route) | `npx vitest run app/api/comments/reorder/route.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | REV-02, REV-04, REV-06, REV-07 | component test | `npx vitest run components/PresentationMode.test.tsx` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | CONT-08 | unit (API route) | `npx vitest run app/api/search/route.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 1 | CONT-08 | component test | `npx vitest run components/SearchResults.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/api/comments/reorder/route.test.ts` — stubs for REV-05
- [ ] `app/api/search/route.test.ts` — stubs for CONT-08
- [ ] `components/PresentationMode.test.tsx` — stubs for REV-02/04/06/07
- [ ] `components/SearchResults.test.tsx` — stubs for CONT-08 UI
- [ ] `app/api/comments/[id]/route.test.ts` — stubs for REV-03/07

Existing test files that will need extensions:
- [ ] `app/api/comments/route.test.ts` — extend to cover `is_reviewed` filter (REV-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-to-reorder visual behavior | REV-05 | Pointer/touch interaction cannot be fully automated | 1. Open presentation mode 2. Drag item in queue 3. Verify order updates 4. Reload — verify persistence |
| Dual video playback | REV-06 | YouTube IFrame API interaction requires live browser | 1. Open reference panel during presentation 2. Play both videos 3. Verify independent controls |
| Keyboard shortcuts | REV-04 | Browser keyboard event routing | 1. Enter presentation mode 2. Press arrow keys, R, Escape 3. Verify navigation, review, exit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
