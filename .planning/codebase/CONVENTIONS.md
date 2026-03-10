# Coding Conventions

**Analysis Date:** 2026-03-10

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `VideoWatchView.tsx`, `DashboardView.tsx`, `ArticleEditor.tsx`)
- Pages: lowercase with dashes for segments within brackets (e.g., `app/learn/[id]/page.tsx`, `app/dashboard/login/page.tsx`)
- API routes: lowercase descriptive names (e.g., `route.ts` in `app/api/` directories)
- Utilities and libraries: camelCase (e.g., `lib/types.ts`, `lib/supabase.ts`, `lib/comment-utils.ts`)

**Functions:**
- camelCase for all functions (e.g., `signToken()`, `verifyToken()`, `getTokenPayload()`, `formatTime()`, `embedUrl()`, `timeAgo()`)
- Function names are descriptive verbs or getter/setter patterns (e.g., `appendVideos()`, `handleManualAdd()`, `handleSheetFetch()`)
- React component names use PascalCase (e.g., `export default function VideoWatchView()`)

**Variables:**
- camelCase for all variables and state (e.g., `sessionId`, `userName`, `watchTarget`, `selectedSessionId`, `isCaptain`, `isActive`)
- Constants: camelCase (e.g., `COOKIE_NAME`, `EXPIRY`, `NAME_KEY`, `FAV_KEY`, `AVATAR_COLORS`)
- Type/interface variables: follow uppercase for const collections (e.g., `AVATAR_COLORS`)

**Types:**
- PascalCase for types, interfaces, and type aliases (e.g., `TokenPayload`, `SessionVideo`, `ReferenceVideo`, `Article`, `Comment`, `User`)
- Type variant unions use type literals (e.g., `type MainView = 'sessions' | 'reference' | 'learn' | 'qa'`)
- Props interfaces: `Props` or `[ComponentName]Props` (e.g., `VideoWatchViewProps`, `SessionManagerProps`, `ChapterEditorProps`)

## Code Style

**Formatting:**
- Prettier/ESLint: Next.js default config (`eslint-config-next`)
- Indentation: 2 spaces
- Quotes: Single quotes in code, double quotes in JSX attributes
- Line length: No strict limit observed, but lines kept reasonably short

**Linting:**
- ESLint 9 with Next.js configuration (`eslint-config-next` ^15.1.7)
- Type checking: TypeScript strict mode enabled
- Config: `tsconfig.json` with `"strict": true`, `"noEmit": true`, `"esModuleInterop": true`

## Import Organization

**Order:**
1. External framework/library imports: `react`, `next/*`, `jose`, `@supabase/*`, `bcryptjs`
2. Internal imports: `@/lib/*`, `@/components/*`, `@/types/*`
3. Types imported separately: `import type { ... } from '...'` (always use separate type imports)
4. Path aliases: `@/*` maps to project root (configured in `tsconfig.json`)

**Examples:**
```typescript
// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'

// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

// components/VideoWatchView.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ExternalLink, Heart } from 'lucide-react'
import { embedUrl, youtubeEmbedUrl, parseTimestamp, type SessionVideo } from '@/lib/types'
import type { Comment } from '@/lib/supabase'
import clsx from 'clsx'
```

**Barrel imports not used:** Each file imports directly from source; no `index.ts` re-exports for public APIs.

## Error Handling

**Patterns:**
- Errors caught silently with try-catch, return null or default value (e.g., `verifyToken()` returns `null` on error)
- API route errors: return `NextResponse.json({ error: errorMessage }, { status: statusCode })`
- Status codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 409 (conflict), 500 (server error)
- Client-side errors: caught in try-finally blocks, set error state for UI feedback

**Error examples:**
```typescript
// lib/auth.ts - silent catch
catch {
  return null
}

// app/api/auth/register/route.ts - validation errors
if (!inviteCode || inviteCode !== process.env.INVITE_CODE) {
  return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 })
}

// API routes - database errors
if (error) return NextResponse.json({ error: error.message }, { status: 500 })

// Client components - user feedback
catch (err) {
  setSheetError(err instanceof Error ? err.message : 'Import failed')
}
```

## Logging

**Framework:** `console` object only (no logger library)

**Patterns:**
- NO console logging observed in codebase — no `console.log()`, `console.error()`, or `console.warn()` calls
- Errors handled via return values and error states instead of logging
- In development, use browser DevTools for debugging

## Comments

**When to Comment:**
- Minimal commenting; code is self-explanatory where possible
- Comments for non-obvious logic or API design decisions

**Comment Style:**
- Inline comments: `/* comment */` for multi-line context (e.g., `/* ── YouTube IFrame API type declarations ── */`)
- Section dividers: decorative separators with em-dashes (e.g., `// ── [Section Name] ──`)
- JSDoc/TSDoc: NOT used; type annotations via TypeScript instead

**Example from codebase:**
```typescript
// VideoWatchView.tsx
/* ── YouTube IFrame API type declarations ── */

// Deactivate all sessions first
await supabase.from('sessions').update({ is_active: false }).neq('id', '...')
```

## Function Design

**Size:** Functions kept concise; complex logic split into helper functions (e.g., `handleSheetFetch()`, `appendVideos()`, `handleManualAdd()` in VideoUploader)

**Parameters:**
- Single object parameter for multiple options (common in components with Props interfaces)
- Example: `VideoWatchView({ video, sessionId, userName, ... })`
- Destructuring in function signature preferred

**Return Values:**
- Functions return data or null on error (no exceptions thrown in normal flow)
- Async functions return Promise<T | null> or Promise<void>
- React hooks return state setters and derived values via destructuring

## Module Design

**Exports:**
- Named exports for utility functions: `export function formatTime()`, `export function embedUrl()`
- Default exports for React components: `export default function ComponentName()`
- Type/interface exports: `export type TypeName = ...`
- Re-export pattern in `lib/auth.ts`: `export { COOKIE_NAME }` to expose constants

**Example:**
```typescript
// lib/types.ts — all named exports for utilities and types
export type SessionVideo = { ... }
export function embedUrl(id: string) { ... }
export function parseTimestamp(input: string): number | null { ... }

// components/VideoWatchView.tsx — default export for component
export default function VideoWatchView({ ... }: VideoWatchViewProps) { ... }

// lib/auth.ts — mix of exports
export type TokenPayload = { ... }
export async function signToken(payload: TokenPayload): Promise<string> { ... }
export { COOKIE_NAME }
```

**Barrel files:** Not used; clients import directly from source files.

## Styling Conventions

**CSS Framework:** Tailwind CSS (v3.4.1)

**Class naming:** BEM-like patterns avoided; Tailwind class composition preferred (e.g., `className="p-4 bg-gray-100 rounded-lg"`)

**Utility library:** `clsx` for conditional class composition

**Example:**
```typescript
import clsx from 'clsx'

className={clsx(
  'p-2 rounded transition',
  isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'
)}
```

**Custom colors:** Extended in `tailwind.config.ts` under `theme.extend.colors` (e.g., `navy` color palette defined)

## React Patterns

**Client components:** Marked with `'use client'` at top of file for interactivity (e.g., `components/*.tsx`)

**Server components:** Used for page layouts and data fetching (e.g., `app/page.tsx`, `app/dashboard/page.tsx`)

**State management:** React `useState()` and `useCallback()` for local component state; no global state library (Redux, Zustand, etc.)

**Hooks pattern:**
```typescript
const [state, setState] = useState<Type>(initialValue)
const callback = useCallback(async () => { ... }, [dependencies])
const computed = useMemo(() => { ... }, [dependencies])
```

**Props destructuring:**
```typescript
export default function Component({ prop1, prop2 }: Props) { ... }
```

---

*Convention analysis: 2026-03-10*
