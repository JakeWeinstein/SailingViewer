# Requirements: TheoryForm

**Defined:** 2026-03-10
**Core Value:** Videos play reliably on every device — Drive embeds load, chapters seek correctly, multi-part YouTube videos transition seamlessly.

## v1 Requirements

### Video & Playback

- [ ] **VID-01**: User can watch Google Drive embedded videos with reliable playback on mobile and desktop
- [ ] **VID-02**: User can watch YouTube embedded videos with reliable playback on mobile and desktop
- [ ] **VID-03**: User can navigate chapters (timestamp markers) on reference videos to jump to specific moments
- [ ] **VID-04**: Multi-part YouTube videos transition seamlessly between parts within a chapter sequence
- [ ] **VID-05**: Video player displays properly on mobile (sizing, fullscreen, controls)
- [ ] **VID-06**: User can bookmark specific timestamps in videos for personal reference

### Auth & Users

- [ ] **AUTH-01**: User can register with invite code, username, display name, and password
- [ ] **AUTH-02**: User can log in with username and password
- [ ] **AUTH-03**: Three roles exist: Captain (admin), Contributor (edit reference/articles), Viewer (watch/comment)
- [ ] **AUTH-04**: Captain can view and manage all user accounts and assign roles
- [ ] **AUTH-05**: User can @mention other users in comments, articles, and Q&A posts
- [ ] **AUTH-06**: JWT auth with secure token validation (reject malformed tokens, no role defaulting)

### Comments & Interaction

- [ ] **COMM-01**: User can leave timestamped comments on practice videos
- [ ] **COMM-02**: User can reply to comments in threaded conversations
- [ ] **COMM-03**: User can flag a comment with "send to captain for review"
- [ ] **COMM-04**: User receives in-app notifications for @mentions and captain responses
- [ ] **COMM-05**: Notification bell shows unread count badge

### Review & Presentation

- [ ] **REV-01**: Captain can view review queue of all flagged comments and Q&A posts
- [ ] **REV-02**: Captain can filter/group review queue by individual sailor
- [ ] **REV-03**: Captain can respond to flagged comments and Q&A items
- [ ] **REV-04**: Presentation mode displays review queue on big screen, grouped by person
- [ ] **REV-05**: Captain can reorder items in the presentation queue
- [ ] **REV-06**: Captain can pull up reference videos during presentation mode
- [ ] **REV-07**: Captain can mark review items as "reviewed" to clear from active queue

### Q&A

- [ ] **QA-01**: User can create Q&A posts with rich text and link/image/video attachments
- [ ] **QA-02**: Q&A posts appear in captain's review queue alongside flagged comments
- [ ] **QA-03**: Users can reply to Q&A posts in threads

### Content & Reference

- [ ] **CONT-01**: Captain can create sessions (weekly practice groupings)
- [ ] **CONT-02**: Captain can import practice videos from Google Sheet containing Drive links
- [ ] **CONT-03**: Reference videos organized in folder hierarchy
- [ ] **CONT-04**: Reference videos can be tagged for cross-cutting topics
- [ ] **CONT-05**: Anyone logged in can add chapters to reference videos
- [ ] **CONT-06**: Block-based article editor with text and video embed blocks
- [ ] **CONT-07**: Articles have published/draft visibility
- [ ] **CONT-08**: Full-text search across videos, comments, articles, and Q&A

### Infrastructure

- [ ] **INFRA-01**: Normalized database schema (no JSONB blobs for video storage)
- [ ] **INFRA-02**: Supabase client isolated to server-side only (service role key not exposed)
- [ ] **INFRA-03**: Zod validation at every API boundary
- [ ] **INFRA-04**: Data migration from existing schema preserving current content

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
| (Populated during roadmap creation) | | |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 0
- Unmapped: 33

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after initial definition*
