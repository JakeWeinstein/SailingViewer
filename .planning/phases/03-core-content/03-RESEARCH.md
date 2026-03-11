# Phase 3: Core Content - Research

**Researched:** 2026-03-10
**Domain:** Comments, Session lifecycle, Reference tags/chapters, Article editor redesign
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Comment Experience**
- Auto-fill timestamp from YouTube player's current time into comment composer; user can clear or manually edit
- Clicking a comment's timestamp badge seeks the player to that moment
- Single-level threaded replies (no sub-replies) — replies collapse under parent with count badge, tap to expand
- Users can edit and delete their own comments; edited comments show an "edited" indicator
- Poll every 30 seconds for new comments while watching a video; new comments slide in without disrupting scroll
- "Flag for captain review" is a checkbox/toggle in the comment composer (send_to_captain boolean)
- Comments sorted chronologically by post time (oldest first, newest at bottom)

**Session & Import Pipeline**
- YouTube auto-import only — Google Sheet import is dropped entirely
- Captain can also manually paste a YouTube video URL to add to the current session
- Sessions are weekly containers: one active session at a time
- Videos are automatically added to the active session when imported (auto-import or manual paste)
- Captain manually closes a session when the weekly review is done; a new session auto-creates for the next week
- Unreviewed flagged comments carry forward to the next session's review queue when a session is closed
- All past sessions remain browsable — current session is prominent, past sessions accessible in a list
- Each video in the session list shows total comment count and flagged-for-review count

**Reference Tags & Chapters**
- Freeform tag system with autocomplete suggestions from existing tags — no predefined tag set
- Filter chips at the top of the reference library view; tapping a tag filters across all folders (AND logic for multiple tags)
- Inline chapter adding while watching: "+ Add chapter" button captures current timestamp, user enters title + optional description
- Collaborative chapter permissions: any logged-in user can edit or delete any chapter (trust-based, matches article collaborative model)

**Article Editor (Full Redesign)**
- Four block types: Text (markdown), YouTube video embed, Image (URL-based), Timestamped video clip (start/end timestamps)
- Timestamped video clips: embed a specific moment from a video — reader sees it cued to that section
- Drag-to-reorder blocks (needs drag library like dnd-kit or @hello-pangea/dnd)
- Text blocks: textarea with live markdown preview (current react-markdown approach, not WYSIWYG)
- Draft/publish visibility: drafts visible to logged-in users, published visible to all logged-in users (per Phase 1 auth decision)

### Claude's Discretion
- Polling implementation details (debouncing, error retry for comment refresh)
- Exact tag autocomplete UI treatment (dropdown vs inline chips)
- Session auto-naming format when auto-created
- Drag-to-reorder library choice (dnd-kit vs @hello-pangea/dnd vs other)
- Article editor layout and block insertion UX
- Video clip block: how start/end timestamps are set (manual entry vs player controls)
- Loading states and error handling throughout

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMM-01 | User can leave timestamped comments on practice videos | Existing VideoWatchView.tsx has YT IFrame API + comment composer; needs author_id wiring, edit/delete, 30s polling |
| COMM-02 | User can reply to comments in threaded conversations | Existing reply UI in VideoWatchView.tsx + comments API parentId support; needs edit/delete parity with parent comments |
| COMM-03 | User can flag a comment with "send to captain for review" | send_to_captain boolean already in DB schema and API; carry-forward logic needed on session close |
| CONT-01 | Captain can create sessions (weekly practice groupings) | Sessions API POST exists; needs lifecycle (close/activate), auto-naming, session stats (comment count + flagged count) |
| CONT-02 | Captain can import practice videos from Google Sheet containing Drive links | LOCKED DECISION: This is YouTube auto-import only — `app/api/import-sheet/route.ts` to be deleted; YouTube OAuth from Phase 2 drives this |
| CONT-03 | Reference videos organized in folder hierarchy | Two-level folder tree fully implemented; no changes needed |
| CONT-04 | Reference videos can be tagged for cross-cutting topics | New `tags` JSONB column on reference_videos + tag filter UI; autocomplete from existing tags |
| CONT-05 | Anyone logged in can add chapters to reference videos | Chapter add/edit/delete while watching — extends existing chapter data model (parent_video_id, start_seconds) |
| CONT-06 | Block-based article editor with text and video embed blocks | ArticleEditor.tsx redesign: add Image + Timestamped clip blocks, replace arrow buttons with dnd-kit drag-to-reorder |
| CONT-07 | Articles have published/draft visibility | Already implemented; draft→logged-in, published→all-logged-in confirmed |
</phase_requirements>

---

## Summary

Phase 3 builds on a substantial existing codebase. The comment system, session model, reference hierarchy, and article editor all exist in working form — this phase completes them by adding missing behaviors (edit/delete comments, polling, session lifecycle, tags, chapters-while-watching, two new article block types, drag-to-reorder).

The biggest new surface is the **database schema**: `comments` table needs `author_id` wired in (currently using legacy `author_name`), a new `updated_at` + `is_edited` flag, and an `edit_count` or similar. `reference_videos` needs a `tags` JSONB column. The session lifecycle needs a `closed_at` timestamp and carry-forward logic for unreviewed flagged comments.

The biggest new dependency is a **drag-and-drop library** for article block reordering. Both candidate libraries (`@dnd-kit/core + @dnd-kit/sortable` and `@hello-pangea/dnd`) support React 19. The recommendation is `@dnd-kit/sortable` — it requires no peer peer constraint workarounds, has broader capability for future use, and its sortable preset covers the article block list pattern exactly.

**Primary recommendation:** Treat Phase 3 as targeted incremental completion — the architectural shell is already right, the work is wiring up what's missing in comments, extending the DB schema for tags, adding the chapter-while-watching UI, and redesigning the article editor.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^15.5.12 | App Router, API routes | Project foundation |
| @supabase/supabase-js | ^2.47.10 | Database queries | Project foundation |
| zod | ^4.3.6 | API validation | Already mandated by INFRA-03 |
| react-markdown | ^10.1.0 | Article text block preview | Already in use |
| lucide-react | ^0.471.0 | Icons | Already in use |

### New Dependency
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.3.1 | Drag-and-drop primitives | React >=16.8 peer dep, React 19 compatible |
| @dnd-kit/sortable | ^10.0.0 | Sortable list preset | Wraps useDraggable + useDroppable for sorted lists |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/sortable | @hello-pangea/dnd | @hello-pangea/dnd v18.0.1 has `^18 || ^19` peer dep so it is React 19 compatible, but it was last published ~1 year ago with limited recent activity; dnd-kit is more actively maintained and more flexible for future phases |
| @dnd-kit/sortable | Arrow button swap (current) | Arrow buttons already work — drag-to-reorder is a UX improvement, not a correctness requirement. If dnd-kit integration proves complex, keep arrow buttons as fallback |

---

## Architecture Patterns

### Database Changes Needed (Phase 3 Migration)

```sql
-- 1. Wire comments to user accounts
ALTER TABLE comments
  ADD COLUMN is_edited   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN updated_at  TIMESTAMPTZ DEFAULT NOW();

-- author_id column already exists in schema-v2 but comments API
-- currently inserts author_name; migration must ensure author_id is
-- populated for all new inserts.

-- 2. Reference video tags (JSONB, simplest approach)
ALTER TABLE reference_videos
  ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX reference_videos_tags_idx ON reference_videos USING gin(tags);

-- 3. Session lifecycle
ALTER TABLE sessions
  ADD COLUMN closed_at TIMESTAMPTZ;

-- 4. Comment carry-forward: unreviewed flagged comments get new session_id
-- when captain closes a session. Handled in API logic, not schema.
```

**Why JSONB/array for tags (not junction table):** Team of ~50, freeform tags, AND-filter query. Array with GIN index is appropriate for this scale. A junction table adds complexity with no benefit until full-text search (Phase 5).

### Recommended Project Structure (additions only)

```
app/api/
├── comments/
│   ├── route.ts          # extend: require auth, add author_id, Zod validation
│   └── [id]/
│       └── route.ts      # NEW: PATCH (edit), DELETE (own comment)
├── sessions/
│   ├── route.ts          # extend: add comment/flagged counts to GET response
│   └── [id]/
│       └── route.ts      # extend: POST /close action, carry-forward logic
├── reference-videos/
│   └── route.ts          # extend: tags column on POST/PATCH; GET tag filter
└── (remove) import-sheet/ # DELETE — Google Sheet import dropped

components/
├── VideoWatchView.tsx    # extend: polling, edit/delete, inline chapter add
├── ArticleEditor.tsx     # redesign: 4 block types, dnd-kit sortable
├── ArticleViewer.tsx     # extend: Image block, Timestamped clip iframes
└── ReferenceManager.tsx  # extend: tag chips, filter, autocomplete

scripts/
└── migrate-phase3.sql    # NEW: tags column, is_edited, updated_at, closed_at
```

### Pattern 1: Comment Polling (30-second interval)
**What:** setInterval that re-fetches comments while video is open, appends only genuinely new ones.
**When to use:** While VideoWatchView is mounted and comments are expanded.

```typescript
// Source: React docs — useEffect cleanup pattern
useEffect(() => {
  if (!commentsExpanded) return
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/comments?videoId=${effectiveVideoId}`)
      if (!res.ok) return  // silent fail — don't disrupt UX
      const fresh = await res.json()
      if (!Array.isArray(fresh)) return
      setComments((prev) => {
        const existingIds = new Set(prev.map((c) => c.id))
        const newOnes = fresh.filter((c: Comment) => !existingIds.has(c.id))
        if (newOnes.length === 0) return prev  // no re-render if nothing changed
        return [...prev, ...newOnes]  // append only new — preserves scroll
      })
    } catch { /* network error — silent */ }
  }, 30_000)
  return () => clearInterval(interval)
}, [effectiveVideoId, commentsExpanded])
```

### Pattern 2: dnd-kit Sortable Blocks (Article Editor)
**What:** Wraps article blocks in SortableContext; each block uses useSortable hook.
**When to use:** Article editor block list.

```typescript
// Source: dnd-kit official docs — sortable preset pattern
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// In ArticleEditor:
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return
  setBlocks((prev) => {
    const oldIndex = prev.findIndex((_, i) => String(i) === active.id)
    const newIndex = prev.findIndex((_, i) => String(i) === over.id)
    return arrayMove(prev, oldIndex, newIndex)
  })
}

// Each block:
function SortableBlock({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div {...listeners} className="cursor-grab active:cursor-grabbing">
        {/* drag handle icon */}
      </div>
      {children}
    </div>
  )
}
```

### Pattern 3: Tag Autocomplete (No New Library)
**What:** Local state with filtered list from existing tags; no external autocomplete library needed.
**When to use:** Reference video tag input.

```typescript
// Source: project pattern — useState + computed filter
const [tagInput, setTagInput] = useState('')
const [allTags, setAllTags] = useState<string[]>([])  // fetch once on mount

const suggestions = allTags.filter(
  (t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !currentTags.includes(t)
)
// Render dropdown of suggestions; on click: add to currentTags, clear tagInput
```

### Pattern 4: Comment Edit/Delete (Own Comment Only)
**What:** PATCH and DELETE on `/api/comments/[id]`; server verifies `author_id === payload.userId`.

```typescript
// API route: app/api/comments/[id]/route.ts
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getTokenPayload(req)
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { comment_text } = await req.json()
  // Zod validate comment_text

  // Verify ownership
  const { data: existing } = await supabase
    .from('comments').select('author_id').eq('id', params.id).single()
  if (existing?.author_id !== payload.userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('comments')
    .update({ comment_text, is_edited: true, updated_at: new Date().toISOString() })
    .eq('id', params.id).select().single()
  // ...
}
```

### Anti-Patterns to Avoid

- **Re-fetching all comments on every poll tick:** Use the append-only pattern above. Full replace on each poll wipes scroll position and flashes UI.
- **Storing tags as a junction table at this scale:** Over-engineered for 50-person team with ~hundreds of reference videos. JSONB array + GIN index is correct here.
- **Block IDs as array indices in dnd-kit:** Array indices change on reorder, breaking drag. Use stable IDs — either block UUIDs or generate stable IDs on block creation.
- **Allowing `author_name` freeform string in new comment POSTs:** The schema has `author_id` FK. Phase 3 must require auth on POST /api/comments and derive author_name from JWT, not accept it from the request body.
- **Google Sheet import route cleanup being skipped:** `app/api/import-sheet/route.ts` must be deleted; leaving it creates dead code confusion.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Block drag-to-reorder | Custom mousedown/touchstart event tracking | @dnd-kit/sortable | Cross-browser, accessible, touch-friendly out of the box |
| Markdown rendering | Custom parser | react-markdown (already installed) | CommonMark compliant, XSS-safe, proven |
| Tag deduplication | Custom normalization | Lowercase comparison at insert time + SQL unique check | Simple constraint, not a library problem |

**Key insight:** The existing codebase already made the right calls on the big complexity problems (YouTube IFrame API, JWT auth, Supabase queries). Phase 3 work is additive, not architectural.

---

## Common Pitfalls

### Pitfall 1: comment.author_id vs author_name Disconnect
**What goes wrong:** New comments POST without auth; `author_name` is taken from request body (current behavior). The `author_id` column exists in the v2 schema but the comments API was preserved from the legacy pre-auth implementation.
**Why it happens:** The API was written before the three-role auth system.
**How to avoid:** Phase 3 MUST require authentication on POST `/api/comments`. Derive `author_name` from `payload.userName`; reject unauthenticated posts. This is a breaking change from current component behavior where `author_name` is passed as a prop.
**Warning signs:** `author_id` is null in `comments` table rows after posting.

### Pitfall 2: dnd-kit Stable IDs
**What goes wrong:** Using array index as the `id` prop in `SortableContext.items` and `useSortable({ id })`. When a drag reorder happens, indices shift, causing wrong items to receive drag events.
**Why it happens:** The current `blocks` array has no stable `id` field — they're typed as `ArticleBlock` union with no id.
**How to avoid:** Add a `_id` field to each block on creation: `{ ...block, _id: crypto.randomUUID() }`. Strip `_id` before saving to DB. Use `_id` as the dnd-kit sort key.
**Warning signs:** Dragging one block causes a different block to move, or the dragged block "jumps" back.

### Pitfall 3: Polling + React StrictMode Double-Invocation
**What goes wrong:** In development (StrictMode), `useEffect` fires twice, creating two polling intervals simultaneously. Comments appear duplicated at double the rate.
**Why it happens:** React 18+ StrictMode mounts/unmounts components twice in dev to detect side-effect bugs.
**How to avoid:** The `return () => clearInterval(interval)` cleanup handles this correctly — StrictMode will fire the cleanup before the second mount. The append-only Set check also prevents duplication even if two intervals fire simultaneously.
**Warning signs:** Comments double in dev but not production.

### Pitfall 4: Session Carry-Forward Race Condition
**What goes wrong:** Captain closes session A while users are actively commenting. A new session B auto-creates. Comments posted at the moment of close could be attached to either session.
**Why it happens:** The close-and-create is two operations.
**How to avoid:** Make session close atomic — single transaction: mark session A `closed_at`, create session B, carry-forward unreviewed flagged comments in one DB call (or use a Supabase RPC). Do not expose a "partially closed" state to the UI.
**Warning signs:** Flagged comments appearing in both sessions after a close.

### Pitfall 5: Article Block Image URL Validation
**What goes wrong:** Users paste arbitrary URLs in the Image block field; broken images show as broken img elements.
**Why it happens:** URL-only image hosting has no server-side validation.
**How to avoid:** Validate URL format client-side (URL constructor); use `onError` handler on `<img>` to show a placeholder. Do not attempt to proxy or validate image existence server-side — adds latency and complexity.
**Warning signs:** Empty image blocks visible in published articles.

### Pitfall 6: Reference Video Tag Filter — "AND" vs "OR" Logic
**What goes wrong:** User selects two tag chips expecting AND (videos with BOTH tags) but gets OR (videos with EITHER tag). Confuses team members.
**Why it happens:** SQL `@>` operator checks array containment (AND); `&&` checks overlap (OR). Choosing wrong operator.
**How to avoid:** Use `@>` containment: `WHERE tags @> ARRAY['tag1', 'tag2']`. This returns rows whose tags array contains ALL selected filter tags.
**Warning signs:** Filtering by "upwind" AND "mark rounding" returns videos that only have one of those tags.

---

## Code Examples

### Session Stats Query (comment count + flagged count per video)
```typescript
// Source: Supabase .rpc() pattern — computed at query time
// Add to GET /api/sessions response
const { data: sessions } = await supabase
  .from('sessions')
  .select(`
    id, label, is_active, created_at, closed_at,
    session_videos (
      id, title, youtube_video_id, position
    )
  `)
  .order('created_at', { ascending: false })

// Per video, fetch comment counts in a batch RPC (or compute in JS):
// SELECT video_id, COUNT(*) as total, SUM(CASE WHEN send_to_captain THEN 1 ELSE 0 END) as flagged
// FROM comments WHERE session_id = $1 GROUP BY video_id
```

### Tag Filter Query
```typescript
// Source: Supabase PostgREST filter docs — array containment
// GET /api/reference-videos?tags=upwind,mark-rounding
const selectedTags = searchParams.get('tags')?.split(',').filter(Boolean) ?? []

let query = supabase.from('reference_videos').select('*')
if (selectedTags.length > 0) {
  query = query.contains('tags', selectedTags)  // AND logic: all selected tags must be present
}
```

### Session Close + Carry-Forward
```typescript
// Source: project pattern — sequential Supabase calls (no true transaction needed for this scale)
// POST /api/sessions/[id]/close
const now = new Date().toISOString()

// 1. Close this session
await supabase.from('sessions').update({ is_active: false, closed_at: now }).eq('id', sessionId)

// 2. Create next session
const nextLabel = `Week of ${formatWeekLabel(new Date())}`
const { data: nextSession } = await supabase
  .from('sessions').insert({ label: nextLabel, is_active: true }).select().single()

// 3. Carry forward unreviewed flagged comments
await supabase
  .from('comments')
  .update({ session_id: nextSession.id })
  .eq('session_id', sessionId)
  .eq('send_to_captain', true)
  // Only carry forward if not yet reviewed (no reviewed_at column yet — use presence in queue)
```

### dnd-kit Block IDs (stable on creation)
```typescript
// Source: project pattern — stable block IDs to avoid index-based dnd-kit bugs
type ArticleBlockWithId = ArticleBlock & { _id: string }

function addBlock(type: 'text' | 'video' | 'image' | 'clip') {
  const base = { _id: crypto.randomUUID() }
  setBlocks((prev) => [...prev, { ...emptyBlock(type), ...base }] as ArticleBlockWithId[])
}

// Strip _id before saving to DB:
const blocksForDB = blocks.map(({ _id: _, ...rest }) => rest)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Sheet CSV import | YouTube auto-import via OAuth | Phase 3 (this phase) | Delete `app/api/import-sheet/route.ts` |
| author_name freeform string in comments | author_id FK to users | Phase 3 (this phase) | Require auth on POST /api/comments |
| Arrow buttons for block reorder | dnd-kit drag handles | Phase 3 (this phase) | Better UX; arrow buttons can remain as fallback |
| Two block types (text, video) | Four block types (text, video, image, clip) | Phase 3 (this phase) | ArticleBlock type union expands |

**Deprecated/outdated to remove in this phase:**
- `app/api/import-sheet/route.ts`: Google Sheet import route — drop entirely
- `thumbnailUrl()` and `embedUrl()` Drive helpers in `lib/types.ts`: marked `@deprecated` since Phase 2; clean up if no remaining usages
- Legacy `author_name` as accepted POST body field in `/api/comments`

---

## Open Questions

1. **Session auto-naming format**
   - What we know: "Week of [date]" is the natural format; sessions are weekly
   - What's unclear: Should the label be "Week of March 10" (Monday) or "2026-W10" or free-form? The existing session creation UI accepts a label input from the captain.
   - Recommendation: Auto-generate "Week of [Monday-date]" as the default label when the captain clicks "Close & Start Next Week" — captain can edit before confirming. This is Claude's discretion.

2. **Comments on reference videos vs session videos**
   - What we know: The current `comments` table has `video_id UUID REFERENCES session_videos(id)`. Reference videos have their own ID space.
   - What's unclear: CONT-05 (chapters on reference videos) is clearly specified. But can users comment on reference videos? The requirements (COMM-01) say "practice videos" — this may be intentional.
   - Recommendation: Phase 3 comments are session video only. Reference video chapters are a separate feature from comments. Do not extend comments to reference videos in this phase.

3. **Timestamped video clip block — end timestamp**
   - What we know: The CONTEXT.md specifies "start/end timestamps." The current ArticleEditor has a `startSeconds` field only.
   - What's unclear: YouTube IFrame API does not have a built-in "stop at timestamp" feature. Implementing end-time requires either (a) an `onStateChange` listener in the viewer, or (b) using YouTube's `end` parameter in the embed URL.
   - Recommendation: Use YouTube embed URL `?start=X&end=Y` parameter for the article viewer (renders as iframe, not JS player). This works for display but doesn't seek interactively. Document this constraint.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMM-01 | POST /api/comments requires auth, stores author_id | unit | `npx vitest run app/api/comments/route.test.ts -x` | ❌ Wave 0 |
| COMM-01 | handleCommentFocus captures YT player timestamp | unit | `npx vitest run components/VideoWatchView.test.tsx -x` | ❌ Wave 0 |
| COMM-02 | POST /api/comments with parent_id creates reply | unit | `npx vitest run app/api/comments/route.test.ts -x` | ❌ Wave 0 |
| COMM-02 | toggleReplies fetches and displays replies | unit | `npx vitest run components/VideoWatchView.test.tsx -x` | ❌ Wave 0 |
| COMM-03 | send_to_captain=true saved correctly | unit | `npx vitest run app/api/comments/route.test.ts -x` | ❌ Wave 0 |
| CONT-01 | POST /api/sessions/[id]/close sets closed_at, creates next session | unit | `npx vitest run app/api/sessions/route.test.ts -x` | ❌ Wave 0 |
| CONT-02 | import-sheet route deleted — 404 response | smoke | manual verify | N/A |
| CONT-03 | Reference folder hierarchy renders correctly | manual | visual check | N/A |
| CONT-04 | GET /api/reference-videos?tags=X filters by containment | unit | `npx vitest run app/api/reference-videos/route.test.ts -x` | ❌ Wave 0 |
| CONT-05 | POST /api/reference-videos with parent_video_id creates chapter | unit | `npx vitest run app/api/reference-videos/route.test.ts -x` | ❌ Wave 0 |
| CONT-06 | ArticleEditor renders all 4 block types | unit | `npx vitest run components/ArticleEditor.test.tsx -x` | ❌ Wave 0 |
| CONT-06 | arrayMove produces correct block order after drag | unit | `npx vitest run components/ArticleEditor.test.tsx -x` | ❌ Wave 0 |
| CONT-07 | GET /api/articles without auth returns published only | unit | `npx vitest run app/api/articles/route.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `app/api/comments/route.test.ts` — covers COMM-01, COMM-02, COMM-03 (auth requirement, author_id storage, reply creation, send_to_captain)
- [ ] `app/api/comments/[id]/route.test.ts` — covers comment edit (PATCH) and delete ownership check
- [ ] `app/api/sessions/route.test.ts` — covers CONT-01 session close + carry-forward
- [ ] `app/api/reference-videos/route.test.ts` — covers CONT-04 tag filter, CONT-05 chapter creation
- [ ] `app/api/articles/route.test.ts` — covers CONT-07 published/draft visibility
- [ ] `components/VideoWatchView.test.tsx` — covers COMM-01 timestamp auto-capture, COMM-02 reply toggle
- [ ] `components/ArticleEditor.test.tsx` — covers CONT-06 block types + dnd-kit arrayMove

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `supabase-schema-v2.sql`, `lib/types.ts`, `lib/supabase.ts`, `app/api/comments/route.ts`, `app/api/sessions/route.ts`, `app/api/reference-videos/route.ts`, `app/api/articles/route.ts`
- Codebase direct read — `components/VideoWatchView.tsx`, `components/ArticleEditor.tsx`, `lib/comment-utils.ts`
- `package.json` — confirmed installed versions (next 15, react 19, zod 4, react-markdown 10, vitest 4)
- `npm info @dnd-kit/core` — version 6.3.1, peerDeps `react >=16.8.0`
- `npm info @dnd-kit/sortable` — version 10.0.0, peerDeps `react >=16.8.0`
- `npm info @hello-pangea/dnd` — version 18.0.1, peerDeps `react ^18 || ^19`

### Secondary (MEDIUM confidence)
- dnd-kit GitHub issue #1511 — React 19 compatibility discussion; @dnd-kit/core peerDeps confirmed `>=16.8.0` (no upper bound) via npm registry
- Supabase PostgREST docs — `.contains()` for array containment (AND logic)

### Tertiary (LOW confidence)
- YouTube embed URL `?start=X&end=Y` — documented behavior for iframe embeds; the `end` parameter causes the player to stop, confirmed by YouTube IFrame API docs pattern; functional for article viewer static embeds

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry; codebase read directly
- Architecture: HIGH — based on direct codebase inspection; no assumptions about unread code
- Pitfalls: HIGH — pitfalls 1, 2, 4 discovered via direct code inspection of current comment API and block editor; pitfalls 3, 5, 6 are well-known React/SQL patterns

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable ecosystem; dnd-kit and @hello-pangea/dnd versions unlikely to change significantly)
