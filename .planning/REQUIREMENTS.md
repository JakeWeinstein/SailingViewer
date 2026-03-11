# Requirements: TheoryForm

**Defined:** 2026-03-10
**Core Value:** Videos play reliably on every device — Drive embeds load, chapters seek correctly, multi-part YouTube videos transition seamlessly.

## v1 Requirements

### Video & Playback

- [x] **VID-01**: User can watch Google Drive embedded videos with reliable playback on mobile and desktop
- [x] **VID-02**: User can watch YouTube embedded videos with reliable playback on mobile and desktop
- [x] **VID-03**: User can navigate chapters (timestamp markers) on reference videos to jump to specific moments
- [x] **VID-04**: Multi-part YouTube videos transition seamlessly between parts within a chapter sequence
- [x] **VID-05**: Video player displays properly on mobile (sizing, fullscreen, controls)
- [x] **VID-06**: User can bookmark specific timestamps in videos for personal reference

### Auth & Users

- [x] **AUTH-01**: User can register with invite code, username, display name, and password
- [x] **AUTH-02**: User can log in with username and password
- [x] **AUTH-03**: Three roles exist: Captain (admin), Contributor (edit reference/articles), Viewer (watch/comment)
- [x] **AUTH-04**: Captain can view and manage all user accounts and assign roles
- [x] **AUTH-05**: User can @mention other users in comments, articles, and Q&A posts
- [x] **AUTH-06**: JWT auth with secure token validation (reject malformed tokens, no role defaulting)

### Comments & Interaction

- [x] **COMM-01**: User can leave timestamped comments on practice videos
- [x] **COMM-02**: User can reply to comments in threaded conversations
- [x] **COMM-03**: User can flag a comment with "send to captain for review"
- [x] **COMM-04**: User receives in-app notifications for @mentions and captain responses
- [x] **COMM-05**: Notification bell shows unread count badge

### Review & Presentation

- [ ] **REV-01**: Captain can view review queue of all flagged comments and Q&A posts
- [ ] **REV-02**: Captain can filter/group review queue by individual sailor
- [ ] **REV-03**: Captain can respond to flagged comments and Q&A items
- [ ] **REV-04**: Presentation mode displays review queue on big screen, grouped by person
- [ ] **REV-05**: Captain can reorder items in the presentation queue
- [ ] **REV-06**: Captain can pull up reference videos during presentation mode
- [ ] **REV-07**: Captain can mark review items as "reviewed" to clear from active queue

### Q&A

- [x] **QA-01**: User can create Q&A posts with rich text and link/image/video attachments
- [x] **QA-02**: Q&A posts appear in captain's review queue alongside flagged comments
- [x] **QA-03**: Users can reply to Q&A posts in threads

### Content & Reference

- [x] **CONT-01**: Captain can create sessions (weekly practice groupings)
- [x] **CONT-02**: Captain can import practice videos from Google Sheet containing Drive links
- [x] **CONT-03**: Reference videos organized in folder hierarchy
- [x] **CONT-04**: Reference videos can be tagged for cross-cutting topics
- [x] **CONT-05**: Anyone logged in can add chapters to reference videos
- [x] **CONT-06**: Block-based article editor with text and video embed blocks
- [x] **CONT-07**: Articles have published/draft visibility
- [ ] **CONT-08**: Full-text search across videos, comments, articles, and Q&A

### Infrastructure

- [x] **INFRA-01**: Normalized database schema (no JSONB blobs for video storage)
- [x] **INFRA-02**: Supabase client isolated to server-side only (service role key not exposed)
- [x] **INFRA-03**: Zod validation at every API boundary
- [x] **INFRA-04**: Data migration from existing schema preserving current content

## v2 Requirements

### Notifications

- **NOTF-01**: Push notifications via PWA service worker
- **NOTF-02**: Configurable notification preferences per user

### Personal

- **PERS-01**: Private notes on videos (visible only to note author)
- **PERS-02**: Personal video watch history

### Moderation

- **MODR-01**: Captain can delete or hide inappropriate comments
- **MODR-02**: Captain can deactivate user accounts

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native iOS/Android app | Web-first; team of ~50 doesn't justify native development cost |
| Google Drive API integration | Prohibited by organization providing unlimited storage |
| Real-time chat / messaging | Async comments are the communication model; adds complexity |
| Video hosting / transcoding | Drive + YouTube handle storage; free-tier budget constraint |
| OAuth / social login | Invite-only team of ~50; username/password is sufficient |
| Email notifications | Adds service cost/complexity; in-app bell is sufficient |
| AI auto-tagging / summaries | No access to video stream data from Drive/YouTube embeds |
| Per-video access control | Session-level visibility sufficient; team trust model |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| VID-01 | Phase 2 | Complete |
| VID-02 | Phase 2 | Complete |
| VID-03 | Phase 2 | Complete |
| VID-04 | Phase 2 | Complete |
| VID-05 | Phase 2 | Complete |
| COMM-01 | Phase 3 | Complete |
| COMM-02 | Phase 3 | Complete |
| COMM-03 | Phase 3 | Complete |
| CONT-01 | Phase 3 | Complete |
| CONT-02 | Phase 3 | Complete |
| CONT-03 | Phase 3 | Complete |
| CONT-04 | Phase 3 | Complete |
| CONT-05 | Phase 3 | Complete |
| CONT-06 | Phase 3 | Complete |
| CONT-07 | Phase 3 | Complete |
| QA-01 | Phase 4 | Complete |
| QA-02 | Phase 4 | Complete |
| QA-03 | Phase 4 | Complete |
| AUTH-05 | Phase 4 | Complete |
| COMM-04 | Phase 4 | Complete |
| COMM-05 | Phase 4 | Complete |
| VID-06 | Phase 4 | Complete |
| REV-01 | Phase 5 | Pending |
| REV-02 | Phase 5 | Pending |
| REV-03 | Phase 5 | Pending |
| REV-04 | Phase 5 | Pending |
| REV-05 | Phase 5 | Pending |
| REV-06 | Phase 5 | Pending |
| REV-07 | Phase 5 | Pending |
| CONT-08 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after roadmap creation — traceability complete*
