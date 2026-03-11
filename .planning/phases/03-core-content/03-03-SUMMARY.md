---
phase: 03-core-content
plan: "03"
subsystem: reference-library
tags: [tags, filtering, session-lifecycle, chapters, ui]
one_liner: "Reference video tag filtering with AND logic, session close + carry-forward lifecycle, inline chapter add for any logged-in user"

dependency_graph:
  requires: [03-01]
  provides: [tag-filter-api, session-close-api, reference-manager-tag-ui]
  affects: [ReferenceManager, sessions, reference_videos]

tech_stack:
  added: []
  patterns:
    - Zod v4 with .issues[] instead of .errors[]
    - Supabase .contains() for array AND-logic filter
    - JS fallback for tag aggregation when RPC unavailable
    - generateNextWeekLabel helper for session auto-naming
    - Inline tag editor with autocomplete dropdown

key_files:
  created:
    - lib/schemas/reference-videos.ts
    - lib/schemas/sessions.ts
    - app/api/reference-videos/reference-videos.test.ts
    - app/api/sessions/sessions.test.ts
  modified:
    - app/api/reference-videos/route.ts
    - app/api/reference-videos/[id]/route.ts
    - app/api/sessions/route.ts
    - app/api/sessions/[id]/route.ts
    - components/ReferenceManager.tsx

key_decisions:
  - "Zod v4 uses .issues[] not .errors[] for validation error access — fixed in both route files"
  - "Tag autocomplete fallback: JS aggregation from all reference_videos.tags when RPC unavailable"
  - "Session close carries only send_to_captain=true comments forward — not all comments"
  - "generateNextWeekLabel computes next Monday; if today IS Monday, uses following Monday"
  - "Inline chapter form available to all authenticated users (trust-based, per plan decision)"
  - "Tag filter re-fetches from API on change to ensure server-side AND logic is applied"

metrics:
  duration_minutes: 7
  tasks_completed: 3
  files_created: 4
  files_modified: 5
  tests_added: 30
  completed_date: "2026-03-11"
---

# Phase 03 Plan 03: Tags, Session Lifecycle, and Chapter UI Summary

Reference video tag filtering with AND logic, session close + carry-forward lifecycle, inline chapter add for any logged-in user.

## What Was Built

### Task 1: Reference Videos Tags + Chapters API (TDD)

**`lib/schemas/reference-videos.ts`** — Zod v4 schemas:
- `CreateReferenceVideoSchema`: title (min 1), type ('youtube'), video_ref (min 1), tags (string[], default []), optional: note_timestamp, folder_id (uuid), parent_video_id (uuid), start_seconds (nonneg)
- `UpdateReferenceVideoSchema`: all fields optional, includes tags
- `TagFilterSchema`: tags (comma-separated string), allTags ("true" flag)

**`app/api/reference-videos/route.ts`** extended:
- GET `?tags=upwind,tacking`: AND-logic via Supabase `.contains('tags', selectedTags)` (uses GIN index)
- GET `?allTags=true`: returns sorted unique tags via RPC or JS fallback aggregation
- POST: validates with Zod, normalizes tags to lowercase/trimmed before insert

**`app/api/reference-videos/[id]/route.ts`** extended:
- PATCH: accepts `tags` field, normalizes before update

**14 tests** cover schema validation, tag filtering AND logic, auth guards, PATCH behavior.

### Task 2: Session Lifecycle API + Stats (TDD)

**`lib/schemas/sessions.ts`**:
- `CreateSessionSchema`: label (min 1, max 200)
- `CloseSessionSchema`: next_label (optional string)
- `AddVideoSchema`: youtube_url (min 1)

**`app/api/sessions/[id]/route.ts`** — new POST handler:
- `action: 'close'` (captain-only): sets `closed_at = now`, `is_active = false`; creates next session with auto-generated "Week of [next Monday]" label; carries forward `send_to_captain=true` comments to new session
- `action: 'add-video'` (any auth): parses YouTube URL, inserts session_video with position tracking

**`app/api/sessions/route.ts`**: POST now uses Zod validation (`CreateSessionSchema`)

**`generateNextWeekLabel()`** helper: computes next Monday, skips to following Monday if today IS Monday.

**16 tests** cover schemas, close/add-video actions, auth (captain-only vs any-auth), validation.

### Task 3: Reference Manager UI — Tags + Chapters

**`components/ReferenceManager.tsx`** extended with:

**Tag filter UI:**
- All unique tags fetched on mount via `GET /api/reference-videos?allTags=true`
- Filter chips at top of library; click to toggle active; active = blue filled style
- Multiple active chips = AND filter (re-fetches from API with `?tags=x,y`)
- "Clear filters" button appears when filters active

**Per-video tag editing:**
- Current tags shown as removable chips (`bg-blue-100 text-blue-800 rounded-full`)
- "Add tags" / "Edit tags" button opens input with live autocomplete
- Autocomplete dropdown: `bg-white shadow-lg rounded border` absolute-positioned, max-h-40 scrollable
- Enter key or click to add; Escape to dismiss; new tags accepted (freeform)
- PATCH on change; tags normalized to lowercase

**Inline chapter add (any logged-in user):**
- "+ Add" button on each source video card (alongside existing "Chapters" button)
- Inline form with title input + MM:SS timestamp input (using `parseTimestamp()`)
- POST `parent_video_id` to inherit type + video_ref from parent
- Error display for invalid timestamp format
- Cancel button closes form

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 uses `.issues[]` not `.errors[]`**
- **Found during:** Task 1 GREEN phase — test "validates with Zod — rejects missing video_ref" failed
- **Issue:** Zod v4 moved validation errors to `.issues[]`, not `.errors[]`. `parseResult.error.errors[0]` threw `TypeError: Cannot read properties of undefined`
- **Fix:** Changed all error access to `parseResult.error.issues?.[0]?.message` in both reference-videos route files
- **Files modified:** `app/api/reference-videos/route.ts`, `app/api/reference-videos/[id]/route.ts`
- **Commit:** 9abf4a9

**2. [Rule 3 - Blocking] Test mock type error in reference-videos.test.ts**
- **Found during:** Task 1 — TypeScript check after GREEN phase
- **Issue:** `fromChain as ReturnType<typeof supabase.from>` type cast failed — `Record<string, unknown>` doesn't overlap with Supabase query builder type
- **Fix:** Changed to `as unknown as ReturnType<typeof supabase.from>` double cast
- **Files modified:** `app/api/reference-videos/reference-videos.test.ts`
- **Commit:** 9abf4a9 (same commit)

## Self-Check: PASSED

All created files found on disk. All task commits verified:
- `9abf4a9` — feat(03-03): reference videos tags + chapters API
- `702558c` — feat(03-03): session lifecycle API + stats
- `c421f18` — feat(03-03): Reference Manager UI — tags + inline chapter add
