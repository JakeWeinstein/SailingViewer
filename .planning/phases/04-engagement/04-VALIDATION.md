---
phase: 4
slug: engagement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react (jsdom) |
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
| 04-01-01 | 01 | 1 | QA-01 | unit | `npx vitest run app/api/comments/route.test.ts -x` | Extend existing | ⬜ pending |
| 04-01-02 | 01 | 1 | QA-02 | unit | `npx vitest run app/api/comments/route.test.ts -x` | Extend existing | ⬜ pending |
| 04-01-03 | 01 | 1 | QA-03 | unit | `npx vitest run app/api/comments/route.test.ts -x` | Existing | ⬜ pending |
| 04-02-01 | 02 | 1 | AUTH-05 | unit | `npx vitest run app/api/notifications/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | COMM-04 | unit | `npx vitest run app/api/notifications/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | COMM-05 | unit | `npx vitest run app/api/notifications/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | VID-06 | unit | `npx vitest run app/api/bookmarks/route.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/api/notifications/route.test.ts` — stubs for AUTH-05, COMM-04, COMM-05
- [ ] `app/api/bookmarks/route.test.ts` — stubs for VID-06
- [ ] `lib/comment-utils.test.ts` — stubs for parseMentions() utility

*Existing `app/api/comments/route.test.ts` covers QA-01/QA-02/QA-03 via extension — no new file needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| @mention autocomplete dropdown appears on `@` keystroke | AUTH-05 | UI interaction timing | Type `@` in comment textarea, verify dropdown renders with user list |
| Notification bell badge count updates visually | COMM-04 | Visual rendering | Create mention, check bell icon shows unread count |
| Bookmark timestamp click navigates to correct video position | VID-06 | Video player integration | Click bookmark, verify video seeks to correct second |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
