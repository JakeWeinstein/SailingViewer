---
phase: 04-engagement
plan: "03"
subsystem: engagement-ui
tags: [notifications, bookmarks, deep-links, mention-autocomplete]
dependency_graph:
  requires: [04-01]
  provides: [notification-bell-ui, bookmark-capture-ui, deep-link-navigation, mention-user-list]
  affects: [app/page.tsx, components/DashboardView.tsx, components/VideoWatchView.tsx, components/ProfileEditor.tsx]
tech_stack:
  added: []
  patterns: [poll-on-open, flash-feedback, deep-link-url-params, role-scoped-api-response]
key_files:
  created:
    - components/NotificationBell.tsx
  modified:
    - app/api/users/route.ts
    - app/page.tsx
    - components/DashboardView.tsx
    - components/VideoWatchView.tsx
    - components/ProfileEditor.tsx
decisions:
  - "NotificationBell polls GET /api/notifications every 30s only while dropdown is open — avoids constant background traffic"
  - "Bookmark flash state uses string enum ('saved'|'duplicate'|'play-first') rather than boolean — three distinct feedback messages"
  - "Deep-link handler uses setTimeout(500) before looking up session/video — allows sessions state to load first"
  - "Users API non-captain path maps to minimal {id, username, display_name} — no sensitive fields (role, is_active, etc.)"
metrics:
  duration: "6m"
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_modified: 6
---

# Phase 4 Plan 03: Notification Bell, Bookmarks, Deep-links, and Mention Users Summary

**One-liner:** NotificationBell with unread badge and mark-all-read wired into header and dashboard sidebar, bookmark capture in YouTube player with ProfileEditor list, and URL-param deep-link navigation for notifications and bookmarks.

## Tasks Completed

### Task 1: NotificationBell + users endpoint + app/page.tsx + DashboardView wiring
**Commit:** cd1f8e4

- Created `components/NotificationBell.tsx` — self-contained client component; fetches unread count on mount; fetches full list when dropdown opens; polls every 30s while open; mark-all-read and per-notification mark-read via PATCH /api/notifications; click-outside closes dropdown
- Updated `app/api/users/route.ts` — GET now allows any authenticated role (not just captain); non-captains receive `{id, username, display_name}` only; captains retain full details
- Updated `app/page.tsx` — imports NotificationBell; renders bell in header when authUser is set; adds mentionUsers state fetched from /api/users after auth resolves; passes users to QATab and VideoWatchView; adds deep-link useEffect that reads video/session/view URL params on mount then clears URL
- Updated `components/DashboardView.tsx` — imports NotificationBell; renders bell in sidebar header flex row; adds mentionUsers fetch on mount; passes users to ArticleEditor

### Task 2: Bookmark button + bookmarks list in profile
**Commit:** 2fa9d49

- Updated `components/VideoWatchView.tsx` — added Bookmark icon import; added bookmarkFlash state (string enum); added handleBookmark() that guards on PLAYING(1)/PAUSED(2) player state before capturing timestamp; POST /api/bookmarks on click; flash messages for 'saved', 'duplicate', 'play-first'; bookmark button visible in player controls only when userId is set
- Updated `components/ProfileEditor.tsx` — added SavedBookmark type; added bookmarks state and loadingBookmarks; fetches GET /api/bookmarks on mount; renders "Saved Bookmarks" section with Bookmark icon header; each item shows video_title, formatted timestamp, timeAgo, delete button; clicking navigates via deep-link URL params (/?video=...&session=...)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` — passes with 0 errors (2 pre-existing QATab errors unrelated to this plan's changes)
- `npx vitest run` — 121 tests pass, 11 test files pass, 0 failures

## Self-Check: PASSED

All 6 files found on disk. Both commits (cd1f8e4, 2fa9d49) exist in git log.
