---
phase: 2
slug: video-playback
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (not yet installed — Wave 0) |
| **Config file** | `vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `npx vitest run lib/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run lib/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | VID-* | setup | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | VID-02 | unit | `npx vitest run lib/types.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | VID-02 | unit | `npx vitest run lib/types.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | VID-03 | unit | `npx vitest run components/VideoWatchView.test.tsx` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | VID-04 | unit | `npx vitest run components/VideoWatchView.test.tsx` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 1 | VID-05 | unit | `npx vitest run components/VideoWatchView.test.tsx` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 1 | VID-01/02 | unit | `npx vitest run __tests__/api/sessions.test.ts` | ❌ W0 | ⬜ pending |
| 02-07-01 | 07 | 2 | import | unit | `npx vitest run __tests__/api/youtube-import.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework config with React plugin
- [ ] `test/setup.ts` — mock `next/navigation`, global fetch, `window.YT`
- [ ] `lib/types.test.ts` — covers `youtubeEmbedUrl()`, `extractYouTubeInfo()`, `formatTime()`, `parseTimestamp()`
- [ ] `lib/youtube-oauth.test.ts` — covers uploads playlist ID derivation, token storage helpers
- [ ] `components/VideoWatchView.test.tsx` — smoke render + chapter interaction + auto-advance callback
- [ ] `__tests__/api/youtube-import.test.ts` — auth guard, mock googleapis response
- [ ] `__tests__/api/sessions.test.ts` — session video API routes return `youtube_video_id` field
- [ ] Framework install: `npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @vitejs/plugin-react`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drive embed loads on iPhone Safari | VID-01 | Browser-specific iframe behavior | Open session video on iPhone Safari with default privacy settings; verify video plays or fallback link appears |
| YouTube fullscreen on mobile | VID-05 | Native OS fullscreen behavior | On iPhone, tap YouTube fullscreen button; verify native fullscreen activates |
| Multi-part chapter auto-transition UX | VID-04 | Requires visual confirmation of seamless playback | Play a multi-part chapter video; verify next video loads automatically at chapter boundary |
| Video sizing on 375px viewport | VID-05 | CSS responsive behavior | Open Chrome DevTools at 375px width; verify no horizontal overflow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
