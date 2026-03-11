---
phase: 3
slug: core-content
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` (exists) |
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
| 03-01-01 | 01 | 1 | COMM-01 | unit | `npx vitest run app/api/comments/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | COMM-01 | unit | `npx vitest run components/VideoWatchView.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | COMM-02 | unit | `npx vitest run app/api/comments/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | COMM-02 | unit | `npx vitest run components/VideoWatchView.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | COMM-03 | unit | `npx vitest run app/api/comments/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | CONT-01 | unit | `npx vitest run app/api/sessions/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | CONT-02 | smoke | manual verify | N/A | ⬜ pending |
| 03-02-03 | 02 | 1 | CONT-03 | manual | visual check | N/A | ⬜ pending |
| 03-03-01 | 03 | 2 | CONT-04 | unit | `npx vitest run app/api/reference-videos/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | CONT-05 | unit | `npx vitest run app/api/reference-videos/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | CONT-06 | unit | `npx vitest run components/ArticleEditor.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 2 | CONT-06 | unit | `npx vitest run components/ArticleEditor.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-04-03 | 04 | 2 | CONT-07 | unit | `npx vitest run app/api/articles/route.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/api/comments/route.test.ts` — stubs for COMM-01, COMM-02, COMM-03 (auth, reply, send_to_captain)
- [ ] `app/api/comments/[id]/route.test.ts` — comment edit/delete ownership
- [ ] `app/api/sessions/route.test.ts` — CONT-01 session close + carry-forward
- [ ] `app/api/reference-videos/route.test.ts` — CONT-04 tag filter, CONT-05 chapter creation
- [ ] `app/api/articles/route.test.ts` — CONT-07 published/draft visibility
- [ ] `components/VideoWatchView.test.tsx` — COMM-01 timestamp capture, COMM-02 reply toggle
- [ ] `components/ArticleEditor.test.tsx` — CONT-06 block types + dnd-kit arrayMove

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| import-sheet route deleted — returns 404 | CONT-02 | Route removal confirmation | `curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/import-sheet` returns 404 |
| Reference folder hierarchy renders correctly | CONT-03 | Visual/DOM structure | Open reference library, verify 2-level tree with expand/collapse |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
