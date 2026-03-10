# Feature Research

**Domain:** Team sports coaching video review platform
**Researched:** 2026-03-10
**Confidence:** MEDIUM — sports coaching platforms (Hudl, Coach Logic, Veo, Dartfish) well-documented; sailing-specific workflows inferred from analogous team sports; TheoryForm's specific workflows validated against PROJECT.md

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that every video review platform has. Missing these means the product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Reliable video playback across devices | Unusable without it — mobile is primary usage mode | HIGH | Drive embeds and YouTube Player API both have quirks; mobile sizing and fullscreen are the #1 pain point in current app |
| Timestamped comments | Core interaction model for team review — marks the exact moment for discussion | MEDIUM | Already exists; rewrite should normalize storage (not JSONB) |
| Threaded replies on comments | Users expect conversation, not parallel monologues | LOW | Already exists; carry forward |
| Video organized by session/grouping | Team needs to find "last Tuesday's practice" instantly | LOW | Session concept already exists; schema normalization is the issue |
| Mobile-first watch + comment experience | Most team members watch on phones between practices | HIGH | Current app broken on mobile; must be solved in rewrite foundation |
| User identity on comments | "Who said this?" is essential for captain's review workflow | LOW | Username display already exists |
| Captain/admin role with elevated permissions | Someone has to control what gets imported and reviewed | LOW | Already exists; extending to three-role system |
| Video import workflow | Without a way to get videos in, there's no content | MEDIUM | Google Sheet → Drive links is the hard constraint; needs to be reliable and clear |
| Chapter / timestamp navigation on long videos | Reference library videos are multi-hour livestream replays — unusable without jumping to moments | HIGH | Currently broken on multi-part YouTube; this is explicitly called out as core value in PROJECT.md |
| Search across content | Team of 50 asking "where was that video about tacking?" needs an answer | MEDIUM | Full-text search across videos, comments, articles, Q&A |
| Content visibility control (published vs draft) | Articles and content in progress shouldn't be exposed prematurely | LOW | Already exists for articles; extend to Q&A and other content |

### Differentiators (Competitive Advantage)

Features that set TheoryForm apart from generic video review tools or Hudl. These match the actual captain-led theory session workflow.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Presentation mode with reorderable review queue | Captain runs weekly theory session on big screen, walking through flagged items in chosen order — no other tool is built for this exact workflow | HIGH | Core differentiator; queue grouped by sailor, reorderable, markable as reviewed; needs to pull up reference videos inline |
| "Send to captain" flag on comments | Lets team members signal "I want this discussed" without spamming the whole team | LOW | Already exists; carry forward |
| Review queue filtered/grouped by sailor | Captain builds agenda for each person — "here's what we're covering for Jake" | MEDIUM | Grouping by sailor during presentation is the unique workflow; Hudl does per-player playlists but not this session-agenda framing |
| Q&A posts (not tied to specific video) | Team members ask tactical questions, captain answers in theory session — not every question belongs on a video timestamp | MEDIUM | Feeds into same review queue as flagged video comments |
| Reference library with folder hierarchy + tags | Long-form technique library organized for browsing and cross-referencing (e.g., "all downwind clips") | MEDIUM | Folders for hierarchy, tags for cross-cutting topics; both roles can contribute |
| Captain can pull reference videos during presentation | Mid-session: "let me show you the reference on tacking technique" — inline without leaving presentation mode | MEDIUM | Requires reference library to be searchable/browsable within the queue UI |
| @mentions in comments and articles | Direct a specific sailor to a moment ("@alice watch this tack") — actionable, not passive | MEDIUM | Drives notification system; without mentions, comments lack addressability |
| In-app notification bell | Team members learn to check the app when the captain responds to their flag | MEDIUM | @mention triggers; in-app only (no email per PROJECT.md) |
| Block-based article editor (text + video embeds) | Captain writes theory content mixing explanation and video evidence — replaces external docs | MEDIUM | Already exists; carry forward and refine |
| Bookmark timestamps (personal) | Each team member marks moments they want to re-watch — doesn't clutter the shared comment feed | LOW | Lightweight; stored per-user |
| Three-role system: Captain / Contributor / Viewer | Clear permissions matching actual usage: Viewers only watch/comment, Contributors edit reference/articles, Captain manages everything | LOW | Schema and middleware work; conceptually simple |

### Anti-Features (Commonly Requested, Often Problematic)

Features to deliberately avoid, with rationale.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time chat / messaging | "We should be able to talk about videos in real-time" | Async commenting is the actual usage model; real-time chat requires persistent connections, websockets, and scales poorly for a 50-person team app on Vercel free tier | Threaded comment replies with @mentions cover the async collaboration need |
| Email notifications | "I missed the captain's response" | Additional service (Resend, Postmark) adds cost and complexity; the team checks the app regularly; adds compliance surface (unsubscribe, GDPR) | In-app notification badge is sufficient for a small invite-only team |
| Google Drive API integration | "Automate video discovery from Drive" | Explicitly prohibited by the organization providing unlimited storage — not a preference, a hard constraint | Google Sheet import with reliable parsing; clear UX for sheet formatting |
| Video hosting / transcoding | "Upload videos directly to the app" | Storage costs, CDN costs, and transcoding complexity are prohibitive on a free-tier budget; Drive and YouTube already handle this reliably | Drive + YouTube as storage; import links only |
| OAuth / social login | "Let people sign in with Google" | Scope creep; invite-only team of ~50 doesn't need it; adds OAuth configuration surface and token management | Invite code + username/password is sufficient and already implemented |
| Native iOS / Android app | "It would be better as an app" | Development cost is disproportionate for a ~50 person team; doubles the surface to maintain | PWA-quality mobile web with proper responsive design and viewport handling |
| Private notes visible only to the note author stored per-video | "I want to jot personal notes on videos" | Overlaps with bookmarks; low-value for a team review tool focused on shared discussion | Personal timestamp bookmarks cover the "save for later" need; captain has session-level notes |
| AI-generated clip summaries or auto-tagging | "AI could tag moments automatically" | Current video sources are Drive embeds and YouTube iframes — no access to video data stream for ML processing; would require video transcription API costs | Manual timestamped comments and captain-curated playlists are the actual workflow |
| Per-video access control / private videos | "Some videos should only be visible to certain sailors" | Adds permission complexity that doesn't match team's usage model; captain already controls what gets imported | Session-level visibility (active/inactive sessions) is sufficient |

---

## Feature Dependencies

```
Video Playback (reliable, mobile-first)
    └──required by──> Timestamped Comments
    └──required by──> Chapter Navigation
    └──required by──> Presentation Mode

Session / Video Storage (normalized schema)
    └──required by──> Review Queue
    └──required by──> Timestamped Comments
    └──required by──> Video Import Pipeline

User Identity (three-role auth)
    └──required by──> @Mentions
    └──required by──> Review Queue (filter by sailor)
    └──required by──> Notification System
    └──required by──> Q&A Posts (author attribution)

@Mentions
    └──required by──> Notification System (bell/badge)

Timestamped Comments + "Send to Captain" Flag
    └──feeds into──> Review Queue

Q&A Posts
    └──feeds into──> Review Queue

Review Queue (with sailor grouping)
    └──required by──> Presentation Mode

Reference Library (folders + tags)
    └──enhances──> Presentation Mode (pull up reference inline)
    └──enhanced by──> Chapter Navigation

Full-text Search
    └──enhances──> Reference Library (find clips by topic)
    └──enhances──> Review Queue (find specific moments)

Block-based Articles
    └──requires──> Reference Library (video embed picker)
    └──enhanced by──> @Mentions
```

### Dependency Notes

- **Video playback requires mobile-first design:** The entire commenting and review workflow depends on team members actually watching video. If mobile doesn't work, most users can't participate.
- **Normalized schema required before everything else:** Current JSONB blob storage for videos in sessions is the root cause of most current bugs. The rewrite must fix this first — it's a prerequisite for the review queue, comments, and import pipeline to work correctly.
- **Auth / three-role system gates several features:** @mentions need user identity to resolve; review queue filtering needs known user IDs; notification system needs recipients. Auth must be solid before building on top of it.
- **Review queue is the captain's primary workflow:** Every upstream feature (timestamped flags, Q&A posts, send-to-captain) is only valuable if the review queue aggregates and surfaces them correctly.
- **Presentation mode is the end-to-end test:** It exercises the entire stack — video playback, review queue, reference library access, chapter navigation — simultaneously. If all dependencies are solid, presentation mode becomes straightforward assembly.

---

## MVP Definition

This is a rewrite of an existing app used by a real team. The MVP isn't concept validation — it's "restore existing functionality correctly, then add the missing pieces the team needs."

### Launch With (v1) — Rewrite Foundation

- [ ] **Normalized database schema** — videos as proper rows, not JSONB blobs; clean foreign keys
- [ ] **Reliable video playback on mobile** — Drive embeds sized correctly, YouTube Player API chapters seek accurately, multi-part videos transition
- [ ] **Google Sheet import pipeline** — parses Drive share links, assigns to sessions, handles errors gracefully
- [ ] **Session management** — captain creates sessions, both roles import videos
- [ ] **Timestamped comments with send-to-captain flag** — core team interaction model
- [ ] **Threaded replies** — restore existing functionality correctly
- [ ] **Three-role auth** — Captain / Contributor / Viewer with clean middleware
- [ ] **Reference library with folders and chapter navigation** — restore existing functionality correctly
- [ ] **Captain review queue** — aggregates flagged items, filterable by sailor

### Add After Foundation Is Stable (v1.x)

- [ ] **Q&A posts** — trigger: review queue is working and team wants more ways to submit questions
- [ ] **@mentions + notification bell** — trigger: team is actively using comments and needs addressability
- [ ] **Presentation mode** — trigger: review queue is solid and captain needs the big-screen experience
- [ ] **Tags on reference videos** — trigger: folder structure alone isn't enough to cross-reference topics
- [ ] **Full-text search** — trigger: content volume is large enough that browsing alone doesn't work
- [ ] **Personal timestamp bookmarks** — trigger: team members request a way to save moments without commenting

### Future Consideration (v2+)

- [ ] **Block-based articles** — currently exists; restore in v1 but further refinement is v2
- [ ] **Presentation mode: pull up reference videos inline** — requires presentation mode to be stable first
- [ ] **Contributor-managed reference library** — role expansion after core is stable

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Reliable mobile video playback | HIGH | HIGH | P1 |
| Normalized schema (no JSONB blobs) | HIGH | MEDIUM | P1 |
| Google Sheet import pipeline | HIGH | MEDIUM | P1 |
| Timestamped comments + send-to-captain | HIGH | LOW | P1 |
| Three-role auth system | HIGH | LOW | P1 |
| Captain review queue (filtered by sailor) | HIGH | MEDIUM | P1 |
| Chapter navigation (Drive + YouTube) | HIGH | HIGH | P1 |
| Reference library with folders | MEDIUM | LOW | P1 |
| Threaded replies | MEDIUM | LOW | P1 |
| Q&A posts (feed into review queue) | HIGH | MEDIUM | P2 |
| @mentions in comments | MEDIUM | MEDIUM | P2 |
| In-app notification bell | MEDIUM | MEDIUM | P2 |
| Presentation mode with reorder | HIGH | HIGH | P2 |
| Tags on reference videos | MEDIUM | LOW | P2 |
| Full-text search | MEDIUM | MEDIUM | P2 |
| Personal timestamp bookmarks | LOW | LOW | P2 |
| Block-based article editor | MEDIUM | MEDIUM | P2 |
| Reference videos inline in presentation | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for rewrite launch (restores and fixes existing; core workflow)
- P2: Should have; add once foundation is solid
- P3: Nice to have; future iteration

---

## Competitor Feature Analysis

Reviewed: Hudl, Coach Logic, Veo, Dartfish, Frame.io/Wipster (for annotation patterns)

| Feature | Hudl | Coach Logic | Veo | TheoryForm Approach |
|---------|------|-------------|-----|---------------------|
| Video storage | Own CDN / upload | Own CDN / upload | Own camera system | Google Drive + YouTube embeds (hard constraint) |
| Timestamped comments | Yes | Yes | Yes, with drawing | Yes — text only, no drawing (appropriate for sailing review) |
| Team-filtered playlists | Yes (per-player clips) | Yes (by position/group) | Yes | Review queue filtered by sailor — same concept, different framing |
| Presentation / session mode | Playlist playback | Collaborative review | Clip sequence | Dedicated presentation mode with reorderable queue — more structured than playlist |
| Reference library | Not a focus | Not a focus | Not a focus | Core feature — long-form sailing reference videos with chapter navigation |
| Q&A / discussion | Basic messaging | Feed-based sharing | Not a focus | Q&A posts that feed the review queue — unique to the theory session model |
| Mobile | Dedicated app | Mobile web | Dedicated app | Mobile-responsive web (sufficient for team size) |
| Auth | Full SSO / OAuth | Team-based | Team-based | Invite code + password (appropriate for ~50 person team) |
| AI features | Auto-tagging, highlights | Emerging | Auto-tracking, AI analysis | None (no access to video stream data) |

**Key differentiator vs all competitors:** The weekly theory session workflow — a captain presenting flagged items on a big screen, grouped by sailor, with ability to pull up reference videos — is not a feature any of these platforms is built around. They all solve "distribute video to players for individual review." TheoryForm solves "run a structured group review session with the whole team."

---

## Sources

- [A Coach's Guide to Video Analysis Software: Hudl, Dartfish & Alternatives](https://blog.callplaybook.com/blog/coach-video-review-software-hudl-dartfish-alternatives) — MEDIUM confidence (single blog source, but well-researched)
- [Hudl — Watch and Review Video](https://www.hudl.com/support/hudl/v3/an-athletes-guide-to-hudl/video-playback) — HIGH confidence (official docs)
- [Coach Logic — Player Engagement Strategies](https://www.coach-logic.com/blog/top-strategies-to-increase-player-engagement-using-video-analysis) — MEDIUM confidence
- [Veo — Coach Features](https://www.veo.co/en-us/personas/coach) — MEDIUM confidence (official product page)
- [Evercast — Collaborative Video Annotation Tools 2025](https://www.evercast.us/blog/collaborative-video-annotation) — LOW confidence (overview article)
- [Filestage — Best Video Annotation Tools 2025](https://filestage.io/blog/video-annotation/) — LOW confidence (vendor blog)
- PROJECT.md — HIGH confidence (ground truth for this project's constraints and requirements)

---

*Feature research for: TheoryForm — sailing team video review platform*
*Researched: 2026-03-10*
