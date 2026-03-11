---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/VideoWatchView.tsx
  - components/ReferenceManager.tsx
  - app/page.tsx
autonomous: true
requirements: [QUICK-6]
must_haves:
  truths:
    - "Any authenticated user can add a chapter while watching a reference video in VideoWatchView"
    - "Any authenticated user can edit an existing chapter title/timestamp from the chapter sidebar in VideoWatchView"
    - "Chapter editing works in both the main app (page.tsx) and the dashboard (ReferenceManager)"
    - "Unauthenticated users see chapters read-only with no edit controls"
  artifacts:
    - path: "components/VideoWatchView.tsx"
      provides: "Inline chapter add/edit UI in the chapter sidebar"
      contains: "Add chapter"
    - path: "components/ReferenceManager.tsx"
      provides: "Chapter editing gated by any auth, not just isCaptain"
    - path: "app/page.tsx"
      provides: "Passes auth state and userId/userRole to VideoWatchView"
  key_links:
    - from: "components/VideoWatchView.tsx"
      to: "/api/reference-videos"
      via: "fetch POST for new chapters, PATCH for edits"
      pattern: "fetch.*api/reference-videos"
    - from: "app/page.tsx"
      to: "components/VideoWatchView.tsx"
      via: "userId and userRole props from authUser state"
      pattern: "userRole.*authUser"
---

<objective>
Add chapter editing (add + edit) directly within VideoWatchView's chapter sidebar, available to any authenticated user. Also fix the main app to pass auth state through to VideoWatchView, and change ReferenceManager's chapter gating from isCaptain-only to any-authenticated-user.

Purpose: Currently chapters can only be created/edited from the ReferenceManager dashboard (captain-only). Users watching a video should be able to add and edit chapters inline while watching, and any logged-in user (not just captain) should have this ability.

Output: Updated VideoWatchView with chapter add/edit UI, updated page.tsx with auth passthrough, updated ReferenceManager with relaxed auth gating.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/VideoWatchView.tsx
@components/ReferenceManager.tsx
@components/ChapterEditor.tsx
@app/page.tsx
@lib/types.ts
</context>

<interfaces>
<!-- Key types and contracts the executor needs -->

From components/VideoWatchView.tsx (props):
```typescript
interface VideoWatchViewProps {
  video: SessionVideo
  sessionId: string
  activeSessionId?: string
  userName: string
  userId?: string
  userRole?: 'captain' | 'contributor' | 'viewer'
  isCaptain?: boolean
  isFavorited?: boolean
  onFavoriteToggle?: () => void
  onClose: () => void
  onNotesUpdated?: (videoId: string, notes: VideoNote[]) => void
  mediaId?: string
  videoType?: 'youtube'
  noteApiPath?: string
  startSeconds?: number
  siblingChapters?: ReferenceVideo[]
  onChapterChange?: (chapter: ReferenceVideo) => void
  onNoteUpdated?: (videoId: string, note: string, noteTimestamp?: number) => void
  users?: MentionUser[]
}
```

From lib/types.ts:
```typescript
interface ReferenceVideo {
  id: string; title: string; type: string; video_ref: string;
  note?: string; note_timestamp?: number; notes?: VideoNote[];
  folder_id?: string; sort_order: number; parent_video_id?: string;
  start_seconds?: number; tags?: string[]; created_at: string;
}
```

API contracts (already auth-gated for any role):
- POST /api/reference-videos — body: { title, type, video_ref, parent_video_id, start_seconds, tags }
- PATCH /api/reference-videos/[id] — body: { title?, start_seconds?, ... }

From app/page.tsx auth state:
```typescript
const [authUser, setAuthUser] = useState<{ role: string; userName?: string } | null | undefined>(undefined)
// Set via GET /api/auth/me
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add chapter editing UI to VideoWatchView and pass auth from main app</name>
  <files>components/VideoWatchView.tsx, app/page.tsx</files>
  <action>
**VideoWatchView.tsx changes:**

1. Add new prop `isAuthenticated?: boolean` to VideoWatchViewProps. Derive it: `const canEditChapters = isAuthenticated || isCaptain || !!userId`

2. Add new prop `onChaptersChanged?: () => void` — callback to refresh parent's chapter/video list after add/edit.

3. Add state for inline chapter editing in the component body (near other state declarations):
   - `addingChapter` (boolean) — toggling the add form
   - `newChapterTitle` (string)
   - `newChapterTimestamp` (string)
   - `chapterSaving` (boolean)
   - `editingChapterId` (string | null) — which chapter is being edited
   - `editChapterTitle` (string)
   - `editChapterTimestamp` (string)
   - `chapterError` (string)

4. Add `handleAddChapter` async function:
   - Validates title is non-empty, timestamp parses if provided (use parseTimestamp from lib/types)
   - Determines parent_video_id: if `siblingChapters` exist and first chapter has `parent_video_id`, use that. Otherwise use the current video id (from props `video.id`).
   - POST to `/api/reference-videos` with `{ title, type: 'youtube', video_ref: '', parent_video_id, start_seconds, tags: [] }`
   - On success: call `onChaptersChanged?.()` to let parent refresh, reset form state
   - On error: set chapterError

5. Add `handleEditChapter` async function:
   - PATCH to `/api/reference-videos/${editingChapterId}` with `{ title, start_seconds }`
   - On success: call `onChaptersChanged?.()`, clear editing state
   - On error: set chapterError

6. Modify the chapter sidebar section (lines ~606-640). After the existing chapter list and ONLY when `canEditChapters` is true:

   a. Add an "Add chapter" button below the chapter list (purple styled, small, with Plus icon). Clicking toggles `addingChapter`.

   b. When `addingChapter` is true, show a compact form below the button:
      - Title input (text, placeholder "Chapter title", auto-focus)
      - Timestamp input (text, placeholder "MM:SS", smaller)
      - "Use current time" button that reads `playerRef.current?.getCurrentTime()` and formats it, pre-filling the timestamp field
      - Error message if chapterError is set
      - Save + Cancel buttons row
      - Style: purple-50 bg, purple borders, matching existing chapter sidebar aesthetic

   c. For each chapter button in the list, when `canEditChapters` is true, add a small edit icon (Edit2 or Pencil, 3x3, opacity-0 group-hover:opacity-100) on the right side. Clicking sets `editingChapterId` to that chapter's id and populates `editChapterTitle` and `editChapterTimestamp` from the chapter data.

   d. When `editingChapterId` matches a chapter, render that chapter's row as an inline edit form (title + timestamp inputs + save/cancel) instead of the normal button. Same compact style as add form.

7. Also show the "Add chapter" button even when `siblingChapters` is empty/undefined BUT the video is a reference video (detect: `mediaId` prop is set or `noteApiPath` is set). In this case, show a smaller "Add first chapter" prompt. The parent_video_id for new chapters should be the video.id from props.

8. Import `Edit2` (or `Pencil`) from lucide-react (add to existing import). Import `parseTimestamp` if not already imported (it is already imported on line 6).

**app/page.tsx changes:**

9. In the `watchTarget && userName` block (line ~556-568), pass additional props to VideoWatchView:
   - `userId={authUser?.userId}` — note: need to check if authUser from /api/auth/me includes userId. Looking at the auth state shape `{ role: string; userName?: string }`, it may not include userId. Check what /api/auth/me returns. If it does not include userId, that is fine — `canEditChapters` will fall back to `isAuthenticated`.
   - `userRole={authUser?.role as 'captain' | 'contributor' | 'viewer' | undefined}`
   - `isAuthenticated={!!authUser}`
   - This ensures authenticated users on the main app see chapter edit controls when watching reference videos.

10. For the main app page, note that watchTarget is `{ video: SessionVideo; sessionId: string }` — session videos do NOT have chapters. Chapter editing in VideoWatchView should only appear when `siblingChapters` prop is provided OR `mediaId` is set (reference video context). The main app's session video watching will naturally not show chapter controls since it passes neither `siblingChapters` nor `mediaId`. No extra gating needed.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <done>
    - VideoWatchView chapter sidebar shows "Add chapter" button and per-chapter edit icons for authenticated users
    - Add form includes title, timestamp, and "Use current time" button
    - Edit form replaces chapter row inline with editable fields
    - Main app passes auth state to VideoWatchView
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Change ReferenceManager chapter gating from captain-only to any-authenticated</name>
  <files>components/ReferenceManager.tsx, app/page.tsx</files>
  <action>
**ReferenceManager.tsx changes:**

1. The "Captain actions" block (line ~546) currently gates ALL of: chapter creation buttons, inline chapter add, and delete button behind `isCaptain`. Split this into two concerns:

   a. Chapter actions (Chapters button for ChapterEditor modal, Plus quick-add button, inline chapter form) should be visible to any authenticated user. Add a derived boolean: `const isAuthenticated = isCaptain || !!userName && userName !== 'Visitor'`. Actually, this is fragile. Better approach: add a new optional prop `isAuthenticated?: boolean` to the Props interface. Default to `isCaptain` for backward compat: `isAuthenticated = false`.

   b. Delete button should remain captain-only (dangerous action).

2. Change the gating at line ~546 from:
   ```
   {isCaptain && (
     <div className="px-3 pb-2.5 ...">
       {/* chapters + delete */}
     </div>
   )}
   ```
   To:
   ```
   {(isCaptain || isAuthenticated) && (
     <div className="px-3 pb-2.5 ...">
       {/* Chapter buttons — visible to any authenticated user */}
       {!isChapter && (
         <div>... Chapters + Add buttons ...</div>
       )}
       {isChapter && <span />}
       {/* Delete — captain only */}
       {isCaptain && (
         <button onClick={() => handleDelete(video.id)} ...>
           <Trash2 />
         </button>
       )}
     </div>
   )}
   ```

3. The inline chapter add form (lines ~580-616) is already outside the isCaptain gate (it renders when `showInlineChapterForm` is true), so it will work for any user who can click the "Add" button. No change needed there.

4. The drag-and-drop on VideoCard (line ~492-493) should remain captain-only. No change needed.

5. Also pass `isAuthenticated` when ReferenceManager renders VideoWatchView (line ~1016-1018): add `isAuthenticated={isAuthenticated || isCaptain}` prop.

**app/page.tsx changes:**

6. Where ReferenceManager is rendered (line ~356-361), pass `isAuthenticated={!!authUser}`:
   ```
   <ReferenceManager
     isCaptain={false}
     isAuthenticated={!!authUser}
     userName={userName ?? 'Visitor'}
     activeSessionId={activeSession?.id}
   />
   ```
   This allows any logged-in user on the main app to add chapters in the reference library view.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <done>
    - ReferenceManager shows chapter add/edit buttons for any authenticated user, not just captain
    - Delete button remains captain-only
    - Main app passes isAuthenticated to ReferenceManager based on authUser state
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `npx tsc --noEmit`
2. Dev server starts: `npm run dev` — no runtime errors
3. Manual: Log in as contributor, navigate to reference library, verify chapter add buttons visible
4. Manual: Watch a reference video with chapters, verify edit icons appear on hover, add chapter form works
5. Manual: Log out, verify chapter controls are hidden
</verification>

<success_criteria>
- Any authenticated user (captain OR contributor OR viewer) can add and edit chapters from VideoWatchView's chapter sidebar
- "Use current time" button captures the current player position for chapter timestamp
- ReferenceManager chapter controls visible to any authenticated user, delete remains captain-only
- Main app (page.tsx) passes auth state to both VideoWatchView and ReferenceManager
- Unauthenticated users see chapters read-only
</success_criteria>

<output>
After completion, create `.planning/quick/6-reimagine-chapter-editing-ui-edit-and-ad/6-SUMMARY.md`
</output>
