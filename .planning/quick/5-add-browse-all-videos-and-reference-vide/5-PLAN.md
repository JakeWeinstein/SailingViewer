---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/PresentationMode.tsx
autonomous: false
requirements: [QUICK-5]

must_haves:
  truths:
    - "Captain can browse all videos from selected session in presentation mode"
    - "Captain can switch between sessions and see that session's videos"
    - "Captain can select any session video and it displays in the large main area"
    - "Captain can write new comments on any video viewed this way"
    - "Captain can browse and view reference library videos in the same large format"
  artifacts:
    - path: "components/PresentationMode.tsx"
      provides: "Extended presentation mode with browse-videos and reference tabs"
  key_links:
    - from: "components/PresentationMode.tsx"
      to: "/api/sessions"
      via: "fetch session list with videos JSONB"
      pattern: "fetch.*api/sessions"
    - from: "components/PresentationMode.tsx"
      to: "/api/comments"
      via: "POST new comment on browsed video"
      pattern: "fetch.*api/comments.*POST"
    - from: "components/PresentationMode.tsx"
      to: "/api/reference-videos"
      via: "fetch reference library for browsing"
      pattern: "fetch.*api/reference-videos"
---

<objective>
Add browse-all-videos and reference video viewing to presentation mode.

Purpose: Currently presentation mode only shows flagged-for-review comments. The captain needs to browse and watch ANY video from any session, plus reference library videos, in the same large presentation format — with the ability to comment on them.

Output: Enhanced PresentationMode component with three sidebar modes: Review Queue (existing), Browse Videos (new), and Reference Library (new).
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/PresentationMode.tsx
@components/PresentationQueue.tsx
@components/ReferenceSidePanel.tsx
@lib/types.ts
@app/api/sessions/route.ts
@app/api/sessions/[id]/route.ts
@app/dashboard/present/page.tsx

<interfaces>
<!-- Sessions are passed as BriefSession[] (id, label, is_active, created_at) from the server page.
     But to get videos, we need to fetch full session data which includes videos JSONB. -->

From lib/types.ts:
```typescript
export type SessionVideo = {
  id: string          // YouTube video ID
  name: string
  note?: string
  noteTimestamp?: number
  notes?: VideoNote[]
}

export type ReferenceVideo = {
  id: string           // DB UUID
  title: string
  type: 'youtube'
  video_ref: string    // YouTube video ID
  note?: string
  note_timestamp?: number
  notes?: VideoNote[]
  folder_id?: string | null
  parent_video_id?: string | null
  start_seconds?: number | null
  tags: string[]
  created_at: string
}

export type ReferenceFolder = {
  id: string
  name: string
  description?: string | null
  parent_id?: string | null
  sort_order: number
  created_at: string
}
```

From app/api/sessions/route.ts:
- GET /api/sessions returns full session objects including `videos` JSONB field
- Already auth-required

From PresentationMode.tsx:
- Currently uses BriefSession (id, label, is_active, created_at) — no videos field
- Fetches only captainOnly=true comments for review queue
- Has session picker dropdown, active/archived toggle, reply box
- ReferenceSidePanel slides in from right side
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add sidebar mode tabs and video browsing to PresentationMode</name>
  <files>components/PresentationMode.tsx</files>
  <action>
Extend PresentationMode.tsx to support three sidebar modes: "queue" (existing review queue), "videos" (browse session videos), and "reference" (browse reference library). The main detail area adapts to show either a review item (existing) or a browsed video.

**1. Add sidebar mode state and types:**
- Add type `SidebarMode = 'queue' | 'videos' | 'reference'`
- Add state: `sidebarMode` (default 'queue')
- Add state: `sessionVideos: SessionVideo[]` for the selected session's videos
- Add state: `selectedBrowseVideo: { youtubeId: string; title: string; source: 'session' | 'reference'; startSeconds?: number } | null`
- Add state: `refVideos: ReferenceVideo[]`, `refFolders: ReferenceFolder[]`, `refFetched: boolean`
- Import `SessionVideo, ReferenceVideo, ReferenceFolder, youtubeThumbnailUrl` from `@/lib/types`

**2. Fetch session videos when session changes:**
- When `selectedSessionId` changes, also fetch that session's full data via GET `/api/sessions` (already fetched on load), or fetch individual session. Since sessions are already passed as props but without videos, fetch from `/api/sessions` endpoint once and cache the full sessions list (with videos JSONB). Store in state.
- Extract `videos` array from the selected session for display.

**3. Add sidebar mode tabs** below the session picker (between session picker and active/archived toggle):
- Three horizontal tab buttons: "Review" (list icon), "Videos" (film icon), "Reference" (book icon)
- Style like the existing active/archived toggle: selected tab gets `bg-blue-600 text-white`, others `text-gray-400 hover:bg-gray-800`
- When "queue" is selected, show existing PresentationQueue and active/archived toggle below
- When switching modes, clear the active item / browse video selection from the other mode

**4. Videos browser (when sidebarMode='videos'):**
- Replace the queue list area with a scrollable list of videos from the selected session
- Each video row shows: YouTube thumbnail (small, 80x45px using `youtubeThumbnailUrl(v.id)`), video name, and is clickable
- Selected video highlighted with `bg-blue-900/40 ring-1 ring-blue-400`
- Clicking a video sets `selectedBrowseVideo` with that video's YouTube ID, name, and source='session'
- Show count of videos next to the "Videos" tab label

**5. Reference browser (when sidebarMode='reference'):**
- Fetch reference videos and folders from `/api/reference-videos` and `/api/reference-folders` on first switch to 'reference' mode (lazy load, cache with refFetched boolean)
- Display folder structure similar to ReferenceSidePanel: collapsible folders with videos inside
- Add search input at top (filter by title)
- Each video clickable, sets `selectedBrowseVideo` with `video_ref` as youtubeId, title, source='reference', and start_seconds if present
- Filter out chapter entries (parent_video_id != null) from the top-level list — they appear under their parent

**6. Main area adaptation for browsed videos:**
- When `selectedBrowseVideo` is set (and sidebarMode is not 'queue'), render in the main detail area:
  - Video title as heading (text-xl font-semibold text-white)
  - Large YouTube iframe embed (same `aspect-video rounded-xl` style as review items), using `youtubeEmbedUrl(youtubeId, startSeconds)`
  - New comment form below the video: textarea + send button, posts to `/api/comments` with `session_id` (current selected session), `video_id` (youtube ID), `video_title` (name), `comment_text`, `author_name` (userName), `send_to_captain: true`. This is a top-level comment, not a reply (no parent_id).
  - After successful comment post, show green "Comment saved" confirmation briefly (use existing replySuccess pattern)
- When switching back to 'queue' mode and selecting a review item, clear `selectedBrowseVideo`
- When in 'queue' mode and activeItem is set, show existing review item detail (unchanged)

**7. Remove or keep ReferenceSidePanel:**
- Keep the existing Reference button in the toolbar header BUT have it switch sidebar mode to 'reference' instead of opening the slide-out panel. Remove the ReferenceSidePanel component import and rendering. The reference browsing now lives in the sidebar + main area.

**8. Empty states:**
- Videos tab with no videos: "No videos in this session"
- Reference tab with no videos: "No reference videos"
- Main area when no item/video selected: existing empty state message, adjust text to mention browsing videos too

**Important implementation notes:**
- When `sidebarMode` changes, clear the other mode's selection (e.g., switching from queue to videos clears `activeItemId`; switching from videos to queue clears `selectedBrowseVideo`)
- The comment form for browsed videos is separate from the reply form for review items. The reply form replies to a specific comment (parent_id). The browse comment form creates a new top-level comment.
- Keyboard nav (arrow up/down) only applies in queue mode, not in videos/reference modes
- Session picker remains visible in all modes
- Hide the active/archived toggle when sidebarMode is not 'queue'
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- Presentation mode has three sidebar tabs: Review, Videos, Reference
- Selecting a session video shows it in the large main area with comment form
- Selecting a reference video shows it in the large main area with comment form
- New comments can be posted on any browsed video
- Existing review queue functionality unchanged
- Reference button in header switches to reference sidebar mode
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify presentation mode browse and reference features</name>
  <files>components/PresentationMode.tsx</files>
  <action>Human verification of the browse-all-videos and reference video viewing features in presentation mode.</action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -10</automated>
  </verify>
  <done>User confirms all 10 verification steps pass</done>
  <what-built>Browse-all-videos and reference video viewing in presentation mode. Three sidebar tabs (Review/Videos/Reference), session videos browsable with large player, reference library browsable with large player, comment form on any video.</what-built>
  <how-to-verify>
    1. Go to /dashboard, click the Presentation mode button
    2. Verify the sidebar now shows three tabs: Review, Videos, Reference
    3. Click "Videos" tab — see all videos from the current session listed with thumbnails
    4. Click a video — verify it plays in the large main area
    5. Write a comment on the video and submit — verify "Comment saved" confirmation
    6. Switch to a different session via the dropdown — verify videos update
    7. Click "Reference" tab — verify reference library folders and videos appear
    8. Click a reference video — verify it plays in the large main area
    9. Click "Review" tab — verify the existing review queue still works (flagged items, mark reviewed, reply)
    10. Click the "Reference" button in the top toolbar — verify it switches to reference sidebar mode
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes
- All three sidebar modes render and switch correctly
- Session videos display in main area with comment capability
- Reference videos display in main area with comment capability
- Existing review queue is unaffected
</verification>

<success_criteria>
- Captain can browse and view all session videos in presentation format
- Captain can switch sessions to see other sessions' videos
- Captain can browse and view reference library videos in presentation format
- Captain can comment on any video viewed through browse modes
- Review queue functionality remains unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/5-add-browse-all-videos-and-reference-vide/5-SUMMARY.md`
</output>
