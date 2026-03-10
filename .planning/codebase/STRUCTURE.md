# Codebase Structure

**Analysis Date:** 2025-03-10

## Directory Layout

```
/Users/jakeweinstein/Desktop/Things/TheoryForm/
├── app/                                    # Next.js App Router
│   ├── layout.tsx                          # Root layout wrapper
│   ├── page.tsx                            # Public home (sessions, reference, learn, Q&A)
│   ├── api/                                # Server-side API routes
│   │   ├── auth/
│   │   │   ├── login/route.ts              # POST captain/contributor login
│   │   │   ├── register/route.ts           # POST new user registration
│   │   │   ├── logout/route.ts             # POST clear auth cookie
│   │   │   └── me/route.ts                 # GET current user info
│   │   ├── comments/route.ts               # GET/POST comments + replies + Q&A
│   │   ├── sessions/
│   │   │   ├── route.ts                    # GET (auth) / POST (captain) session management
│   │   │   ├── browse/route.ts             # GET public session list
│   │   │   ├── active/route.ts             # GET/PATCH active session
│   │   │   └── [id]/
│   │   │       ├── route.ts                # GET/PATCH/DELETE specific session
│   │   │       └── video-note/route.ts     # PATCH captain video notes
│   │   ├── reference-videos/
│   │   │   ├── route.ts                    # GET (public) / POST (auth) reference videos
│   │   │   ├── [id]/route.ts               # PATCH/DELETE reference video
│   │   │   └── bulk/route.ts               # POST bulk operations
│   │   ├── reference-folders/
│   │   │   ├── route.ts                    # GET (public) / POST (auth) folders
│   │   │   └── [id]/route.ts               # PATCH/DELETE folder
│   │   ├── articles/
│   │   │   ├── route.ts                    # GET (public published) / POST (auth draft)
│   │   │   └── [id]/route.ts               # GET/PATCH/DELETE articles
│   │   ├── import-sheet/route.ts           # POST import videos from Google Sheets
│   │   ├── videos/                         # Legacy (unused, kept for reference)
│   │   └── submissions/                    # Legacy (unused, kept for reference)
│   ├── dashboard/
│   │   ├── page.tsx                        # Main dashboard (server: auth + session fetch)
│   │   ├── login/page.tsx                  # Login form (Captain/Contributor tabs)
│   │   └── register/page.tsx               # Registration form (invite code + password)
│   └── learn/
│       └── [id]/page.tsx                   # Public article viewer (published only)
├── components/                             # React client components
│   ├── DashboardView.tsx                   # Main dashboard layout (sidebar + main content)
│   ├── SessionManager.tsx                  # Session CRUD (captain only)
│   ├── VideoManager.tsx                    # Video management within session
│   ├── VideoWatchView.tsx                  # Video player + comments + notes + chapter nav
│   ├── VideoUploader.tsx                   # Upload videos to session (sheet/manual tabs)
│   ├── ReferenceManager.tsx                # Reference library browsing + management
│   ├── FolderManager.tsx                   # Two-level folder hierarchy editor
│   ├── ArticleEditor.tsx                   # Block-based article editor (text + video)
│   ├── ArticleViewer.tsx                   # Render published article with ReactMarkdown
│   ├── QATab.tsx                           # Q&A browsing and posting
│   ├── ChapterEditor.tsx                   # Chapter metadata editor (for multi-video chapters)
│   ├── NamePrompt.tsx                      # Prompt for anon visitor name (localStorage)
│   └── [other utility components]
├── lib/                                    # Shared utilities and types
│   ├── types.ts                            # Type definitions: SessionVideo, ReferenceVideo, Article, ArticleBlock, etc.
│   ├── auth.ts                             # JWT signing/verification (jose), TokenPayload, COOKIE_NAME
│   ├── supabase.ts                         # Supabase client + type definitions: Session, Comment, User
│   └── comment-utils.ts                    # Helper functions: timeAgo(), initials(), avatarColor()
├── middleware.ts                           # Route protection for /dashboard/* (except login/register)
├── next.config.ts                          # Next.js configuration
├── tsconfig.json                           # TypeScript configuration
├── tailwind.config.ts                      # Tailwind CSS configuration
├── postcss.config.mjs                      # PostCSS configuration
├── package.json                            # Dependencies
├── supabase-schema.sql                     # Database schema (tables + RPC functions)
├── supabase-migration-qa-replies.sql       # Additional migration for Q&A threading
├── .env.local                              # Environment variables (secrets — never commit)
├── .env.local.example                      # Template for .env.local
├── .mcp.json                               # MCP server configuration
└── [other config files]
```

## Directory Purposes

**app/:**
- Purpose: Next.js 15 App Router pages and API routes
- Contains: Server components (pages), API handlers, authentication flows
- Key subdirectories: `api/` (REST endpoints), `dashboard/` (protected routes), `learn/` (public articles)

**components/:**
- Purpose: Reusable React client components (`'use client'`)
- Contains: UI components for browsing, video playback, commenting, content management
- Key subdirectories: None (flat structure, one component per file)

**lib/:**
- Purpose: Shared utility modules and type definitions
- Contains: Authentication logic, Supabase client, TypeScript type definitions, helper functions
- Key files: `types.ts` (contracts), `auth.ts` (JWT), `supabase.ts` (DB client)

**public/:** (implicit, not shown in tree — Next.js default)
- Static assets (if any) — currently minimal use

## Key File Locations

**Entry Points:**

- `app/page.tsx` — Public home page (main browsing interface)
- `app/dashboard/page.tsx` — Authenticated dashboard (session/reference/upload/articles management)
- `app/dashboard/login/page.tsx` — Login interface (Captain/Contributor tabs)
- `app/dashboard/register/page.tsx` — Registration interface (invite code flow)
- `app/learn/[id]/page.tsx` — Public article viewer (published articles only)

**Configuration:**

- `middleware.ts` — JWT validation for /dashboard/* routes
- `.env.local` — Runtime secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CAPTAIN_PASSWORD, AUTH_SECRET, INVITE_CODE)
- `next.config.ts` — Next.js build settings
- `tsconfig.json` — TypeScript compiler settings (includes `@/*` path alias)

**Core Logic:**

- `lib/auth.ts` — JWT signing/verification with 7-day expiry; TokenPayload type
- `lib/supabase.ts` — Supabase service role client initialization; Session/Comment/User types
- `lib/types.ts` — Video types (SessionVideo, ReferenceVideo), Article types, URL helpers (thumbnailUrl, embedUrl, etc.)
- `lib/comment-utils.ts` — Utility functions: `timeAgo()`, `initials()`, `avatarColor()`

**API Routes (organized by resource):**

- `app/api/auth/login/route.ts` — POST captain (password) + contributor (username+password) login
- `app/api/auth/register/route.ts` — POST user registration (invite code + bcrypt hash)
- `app/api/sessions/route.ts` — GET (auth) all sessions, POST (captain) create new session
- `app/api/sessions/browse/route.ts` — GET public session list
- `app/api/sessions/[id]/video-note/route.ts` — PATCH captain video notes
- `app/api/comments/route.ts` — GET/POST video comments + replies + Q&A
- `app/api/reference-videos/route.ts` — GET (public) / POST (auth) reference videos
- `app/api/reference-folders/route.ts` — GET (public) / POST (auth) folder management
- `app/api/articles/route.ts` — GET (published) / POST (auth draft) articles
- `app/api/articles/[id]/route.ts` — GET/PATCH/DELETE specific article

**Components:**

- `components/DashboardView.tsx` — Layout for authenticated users (sidebar + main content)
- `components/VideoWatchView.tsx` — Video player with comments, notes, chapter navigation
- `components/ReferenceManager.tsx` — Reference library UI (folders + videos)
- `components/VideoUploader.tsx` — Upload videos to sessions (Google Sheets + manual)
- `components/ArticleEditor.tsx` — Block-based article editor (text + video blocks)
- `components/ArticleViewer.tsx` — Render published articles with ReactMarkdown

**Testing:**

- No dedicated test files in structure (testing framework not implemented)

## Naming Conventions

**Files:**

- **Page components:** `page.tsx` (Next.js convention)
- **API routes:** `route.ts` (Next.js convention)
- **React components:** PascalCase, match component name (e.g., `VideoWatchView.tsx`)
- **Utilities:** camelCase (e.g., `comment-utils.ts`)
- **Types:** Defined in `.ts` files with `export type` keyword (e.g., `types.ts`)

**Directories:**

- **Dynamic routes:** Square brackets for parameters (e.g., `[id]`, `[id].tsx`)
- **API grouping:** By resource name (e.g., `sessions/`, `reference-videos/`)
- **Logical grouping:** By feature or layer (`api/`, `components/`, `lib/`)

**Variables & Functions:**

- **Components:** PascalCase (e.g., `DashboardView`, `VideoWatchView`)
- **Functions:** camelCase (e.g., `signToken()`, `verifyToken()`, `getTokenPayload()`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `COOKIE_NAME`, `EXPIRY`, `NAME_KEY`)
- **React Hooks:** Prefixed with `use` (e.g., `useState()`, `useEffect()`, `useCallback()`)
- **Local component state:** Lowercase (e.g., `sessions`, `comments`, `mainTab`)

**Types:**

- **Type definitions:** PascalCase (e.g., `SessionVideo`, `ReferenceVideo`, `TokenPayload`)
- **Function types:** Descriptive nouns or verb phrases (e.g., `Comment`, `ArticleBlock`, `WatchTarget`)

## Where to Add New Code

**New Feature (e.g., new content type):**
- **Primary code:** Create API route in `app/api/[resource]/route.ts` (GET/POST/PATCH/DELETE)
- **Tests:** Create alongside API route as `route.test.ts` (when testing framework added)
- **Component:** Add UI component in `components/[ResourceManager].tsx`
- **Types:** Update `lib/types.ts` with new type definitions
- **Database:** Add migration file (conventionally in project root), apply via Supabase MCP or CLI

**New Component/Module:**
- **Implementation:** `components/[ComponentName].tsx` for UI, `lib/[utility-name].ts` for logic
- **Props:** If reusable, define `Props` interface near component top
- **Client vs. Server:** Use `'use client'` for client components; omit for server components (Next.js 15 default)

**Utilities & Helpers:**
- **Shared functions:** `lib/[function-area].ts` (e.g., `lib/comment-utils.ts`)
- **Date/time:** Use existing `timeAgo()` from `lib/comment-utils.ts` or add new helper there
- **URL parsing:** Add to `lib/types.ts` alongside existing URL helpers (`thumbnailUrl()`, `embedUrl()`)

**API Route Pattern:**
```typescript
// app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Query database, return JSON
  const { data, error } = await supabase.from('table').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('table').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Component Pattern:**
```typescript
// components/[ComponentName].tsx
'use client'

import { useState, useEffect } from 'react'
import { useCallbackRef } from '@/lib/hooks' // if custom hook needed

interface Props {
  // Define props
}

export default function ComponentName({ prop1, prop2 }: Props) {
  const [state, setState] = useState(initialValue)

  useEffect(() => {
    // Fetch or setup
  }, [dependencies])

  return <div>{/* Render JSX */}</div>
}
```

## Special Directories

**app/api/:**
- Purpose: Server-side route handlers (Edge Runtime, server-only environment)
- Generated: No
- Committed: Yes
- Pattern: One route per file (`route.ts`), organized by resource

**lib/:**
- Purpose: Shared utilities, type definitions, configuration
- Generated: No
- Committed: Yes
- Pattern: One export per file or logical grouping (e.g., all auth in `auth.ts`)

**.planning/codebase/:**
- Purpose: GSD codebase analysis documents (this directory)
- Generated: Yes (by GSD map-codebase command)
- Committed: Yes
- Pattern: One markdown file per focus area (ARCHITECTURE.md, STRUCTURE.md, etc.)

**.next/:**
- Purpose: Next.js build output (generated during `npm run build`)
- Generated: Yes
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in .gitignore)

---

*Structure analysis: 2025-03-10*
