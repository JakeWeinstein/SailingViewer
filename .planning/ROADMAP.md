# Roadmap: TheoryForm

## Overview

TheoryForm is a rewrite of an existing sailing team video review platform. The build order is driven by hard dependencies: a normalized schema and secure auth must be in place before any features can be built correctly, a reliable video player must exist before social features layer on top, and the capstone presentation mode only makes sense once the entire stack underneath it is solid. Five phases deliver a complete, rewritten platform from clean foundation to the unique group-review workflow that no competitor offers.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Normalize database schema, secure auth, and enforce server boundaries (completed 2026-03-10)
- [x] **Phase 2: Video Playback** - YouTube-only playback on mobile and desktop with chapter navigation and auto-import (completed 2026-03-10)
- [ ] **Phase 3: Core Content** - Comments, sessions, reference library tags/chapters, and article editor redesign
- [ ] **Phase 4: Engagement** - Q&A posts, @mentions, notifications, and personal bookmarks
- [ ] **Phase 5: Presentation and Search** - Review queue, presentation mode, and full-text search

## Phase Details

### Phase 1: Foundation
**Goal**: The database is normalized, auth is secure, and the server boundary is enforced — every subsequent feature is built on solid ground
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-06
**Success Criteria** (what must be TRUE):
  1. A viewer can register with an invite code and log in; a captain can log in; malformed or unsigned tokens are rejected with 401 (no silent role defaulting)
  2. The captain can view all user accounts and assign roles (Captain / Contributor / Viewer) from the dashboard
  3. Videos previously stored as JSONB in sessions.videos exist as rows in a normalized session_videos table with proper foreign keys; existing data is preserved
  4. Every API route validates its inputs with Zod and returns structured errors on invalid payloads
  5. The Supabase service role key is unreachable from the browser (import 'server-only' enforced; confirmed via bundle inspection)
**Plans:** 3/3 plans complete
Plans:
- [x] 01-01-PLAN.md — Schema normalization, migration script, server-only enforcement, test infrastructure
- [x] 01-02-PLAN.md — Auth rewrite (JWT, Zod schemas, login/register, middleware)
- [x] 01-03-PLAN.md — User management API + Team tab UI + profile editing

### Phase 2: Video Playback
**Goal**: Videos play reliably on every device — all content is YouTube-only, chapters seek correctly, multi-part videos auto-advance, and the captain can import videos from the team YouTube channel via OAuth
**Depends on**: Phase 1
**Requirements**: VID-01, VID-02, VID-03, VID-04, VID-05
**Success Criteria** (what must be TRUE):
  1. A team member on any device (including iPhone Safari) can watch a YouTube-embedded practice video reliably
  2. A YouTube reference video with chapter markers allows clicking any chapter to seek to that timestamp
  3. A multi-part YouTube chapter sequence transitions automatically from one video to the next at the chapter boundary without user action
  4. The video player controls and video sizing display correctly on a 375px mobile viewport with no horizontal overflow
**Plans:** 4/4 plans complete
Plans:
- [ ] 02-00-PLAN.md — Vitest infrastructure + test stubs (Wave 0)
- [ ] 02-01-PLAN.md — Schema migration (Drive to YouTube), type updates, YouTube API libraries
- [ ] 02-02-PLAN.md — YouTube OAuth flow + auto-import pipeline + dashboard UI
- [ ] 02-03-PLAN.md — Video player rewrite (YT.Player, chapter list, auto-advance, mobile, Drive cleanup)

### Phase 3: Core Content
**Goal**: Team members can leave timestamped comments on practice videos, and the captain can manage sessions via YouTube auto-import, and contributors maintain the reference library (tags, chapters) and write block-based articles
**Depends on**: Phase 2
**Requirements**: COMM-01, COMM-02, COMM-03, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CONT-07
**Success Criteria** (what must be TRUE):
  1. A team member can leave a timestamped comment on a practice video and flag it for captain review; clicking the timestamp in the comment list seeks the player to that moment
  2. A team member can reply to an existing comment and the thread displays in nested form
  3. The captain can create a session, paste a Google Sheet URL, and the practice videos from that sheet appear in the session
  4. A contributor can organize reference videos in a two-level folder hierarchy, add tags to videos, and add chapter markers
  5. A contributor can write and publish a block-based article containing text and embedded video blocks; drafts are visible only to logged-in users
**Plans:** 3/4 plans executed
Plans:
- [ ] 03-01-PLAN.md — Schema migration, Zod schemas, comment API rewrite, import-sheet deletion
- [ ] 03-02-PLAN.md — Article editor redesign (4 block types, dnd-kit drag-to-reorder)
- [ ] 03-03-PLAN.md — Reference tags/chapters API + session lifecycle + reference manager UI
- [ ] 03-04-PLAN.md — Comment UI in VideoWatchView + session browser UI + end-to-end checkpoint

### Phase 4: Engagement
**Goal**: Team members can ask questions via Q&A posts, receive notifications when @mentioned or responded to, and bookmark timestamps for personal reference
**Depends on**: Phase 3
**Requirements**: QA-01, QA-02, QA-03, AUTH-05, COMM-04, COMM-05, VID-06
**Success Criteria** (what must be TRUE):
  1. A team member can create a Q&A post with rich text and an image, video, or link attachment; the post appears in the captain's review queue alongside flagged comments
  2. A user @mentioned in a comment or Q&A reply receives an in-app notification that links directly to the comment or post
  3. The notification bell displays an unread badge count and the count clears when notifications are viewed
  4. A team member can bookmark a specific timestamp in a video and return to their saved bookmarks list from their profile
**Plans**: TBD

### Phase 5: Presentation and Search
**Goal**: The captain can run a theory session on a big screen — walking through flagged items grouped by sailor, reordering on the fly, pulling up reference videos — and any user can search across the entire platform
**Depends on**: Phase 4
**Requirements**: REV-01, REV-02, REV-03, REV-04, REV-05, REV-06, REV-07, CONT-08
**Success Criteria** (what must be TRUE):
  1. The captain can enter presentation mode and see all flagged comments and Q&A posts grouped by sailor, with the current item URL-addressable (shareable link)
  2. The captain can drag items within the presentation queue to reorder them and the order persists across page reloads
  3. The captain can mark an item as "reviewed" and it disappears from the active queue but remains accessible in an archived view
  4. During presentation mode, the captain can open a reference video in a side panel without leaving the queue
  5. Any user can type a search query and see results across videos, comments, articles, and Q&A posts ranked by relevance
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-03-10 |
| 2. Video Playback | 4/4 | Complete   | 2026-03-10 |
| 3. Core Content | 3/4 | In Progress|  |
| 4. Engagement | 0/TBD | Not started | - |
| 5. Presentation and Search | 0/TBD | Not started | - |
