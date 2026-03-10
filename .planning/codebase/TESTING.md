# Testing Patterns

**Analysis Date:** 2026-03-10

## Test Framework

**Status:** Not implemented

**No testing framework detected:**
- ESLint installed but no Jest, Vitest, or other test runner
- No test configuration files (`jest.config.js`, `vitest.config.ts`, etc.)
- No test files in codebase (`.test.ts`, `.spec.ts` not found)
- No `@testing-library/*` or similar dependencies installed

**Note:** This is a development gap. Testing infrastructure has not been established.

## Run Commands

No test commands configured. When testing is implemented, recommended setup:

```bash
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom
npm run test          # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

## Recommendation: Testing Strategy

Given the codebase architecture, recommend implementing tests in this order:

### 1. Unit Tests (Priority: Highest)
**Test location:** Co-located with source (e.g., `lib/types.test.ts` alongside `lib/types.ts`)

**Target files:**
- `lib/types.ts` — URL parsing, timestamp formatting:
  ```typescript
  // Test extractDriveFileId()
  - Valid share URL extraction
  - Direct ID string passthrough
  - Invalid input rejection

  // Test extractYouTubeInfo()
  - Short URL (youtu.be) extraction
  - Full URL (youtube.com/watch) extraction
  - Start time parameter parsing (?t=, ?start=)

  // Test parseTimestamp()
  - "H:MM:SS" format
  - "MM:SS" format
  - Seconds-only format
  - Invalid input handling

  // Test formatTime()
  - Hours/minutes/seconds conversion
  - Leading zero padding
  ```

- `lib/comment-utils.ts` — Utility functions:
  ```typescript
  // Test timeAgo()
  - "just now" for < 1 minute
  - Minutes display (< 60 min)
  - Hours display (< 24 hours)
  - Days display (>= 1 day)

  // Test initials()
  - Single name ("Jake" → "J")
  - Multiple names ("Jake Weinstein" → "JW")
  - Lowercase to uppercase conversion

  // Test avatarColor()
  - Deterministic color selection by name
  - Consistent color for same name
  - All colors used across variety of names
  ```

- `lib/auth.ts` — JWT operations:
  ```typescript
  // Mock jose library for consistency
  // Test signToken()
  - Creates valid JWT with payload
  - Sets expiration to 7 days
  - Uses HS256 algorithm

  // Test verifyToken()
  - Verifies valid token
  - Returns null for invalid token
  - Handles missing AUTH_SECRET gracefully
  - Defaults missing role to 'captain'

  // Test getTokenPayload()
  - Extracts token from request cookies
  - Returns null for missing cookie
  - Delegates to verifyToken()
  ```

### 2. API Route Tests (Priority: High)
**Test location:** Separate test directory (e.g., `__tests__/api/`)

**Setup pattern:**
```typescript
// __tests__/api/auth.test.ts
import { POST } from '@/app/api/auth/login/route'
import { createMocks } from 'node-mocks-http'

describe('POST /api/auth/login', () => {
  it('authenticates captain with correct password', async () => {
    // Mock NextRequest/NextResponse
    // Assert 200 + cookie set + ok:true response
  })

  it('rejects invalid captain password', async () => {
    // Assert 401 + error message
  })

  it('authenticates contributor with username+password', async () => {
    // Mock Supabase user query
    // Mock bcrypt compare
    // Assert 200 + userId + cookie
  })
})
```

**Mock Supabase responses:** Mock `supabase.from().select()` chains with `.single()` to return `{ data, error }`

**Mock bcrypt:** Mock `bcryptjs.compare()` to return true/false for password verification

**Test priority routes:**
- `app/api/auth/login/route.ts` — Captain and contributor flows
- `app/api/auth/register/route.ts` — Invite code validation, username uniqueness
- `app/api/sessions/route.ts` — POST (captain-only), GET (auth-required)
- `app/api/comments/route.ts` — GET with query params, POST validation
- `app/api/articles/route.ts` — GET (published), POST (auth-required)

### 3. Component Tests (Priority: Medium)
**Test location:** Co-located (e.g., `components/VideoWatchView.test.tsx` alongside `VideoWatchView.tsx`)

**Setup with React Testing Library:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import VideoWatchView from '@/components/VideoWatchView'

describe('VideoWatchView', () => {
  const mockProps = {
    video: { id: '123', name: 'Test Video', notes: [] },
    sessionId: 'session-1',
    userName: 'TestUser',
    onClose: vi.fn(),
    onNotesUpdated: vi.fn(),
  }

  it('renders video player iframe', () => {
    render(<VideoWatchView {...mockProps} />)
    expect(screen.getByTitle(/google drive/i)).toBeInTheDocument()
  })
})
```

**Mock strategy:**
- Mock external YouTube IFrame API with window.YT stub
- Mock fetch() calls for comments and notes
- Use `vi.fn()` for callback props (Vitest)

**What NOT to mock:** Tailwind CSS class rendering, lucide-react icons (render as SVG)

### 4. Integration Tests (Priority: Medium)
**Test location:** `__tests__/integration/`

**Scope:** Full flow from user action to UI update

Example:
```typescript
describe('Comment submission flow', () => {
  it('submits comment and updates UI', async () => {
    render(<VideoWatchView {...mockProps} />)

    // User types comment
    const input = screen.getByPlaceholderText(/add comment/i)
    fireEvent.change(input, { target: { value: 'Test comment' } })

    // Mock API response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'comment-1', comment_text: 'Test comment' })
    }))

    // User submits
    fireEvent.click(screen.getByText('Send'))

    // Assert comment appears
    expect(await screen.findByText('Test comment')).toBeInTheDocument()
  })
})
```

## Recommended Testing Tools

**Vitest configuration:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

**Test setup file (`test/setup.ts`):**
```typescript
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}))

// Setup global fetch mock
global.fetch = vi.fn()
```

## Coverage Targets

**Recommended minimums (when tests added):**
- Utility functions: 80%+ (types.ts, comment-utils.ts, auth.ts)
- API routes: 70%+ (focus on auth, validation, error paths)
- Components: 50%+ (smoke tests for rendering + key interactions)
- Overall: 60%+

## What Should Be Tested (Priority Order)

### High Priority
1. **Authentication flows** (`lib/auth.ts`, `app/api/auth/*`)
   - Token generation and verification
   - Cookie handling
   - Role-based access control

2. **Data validation** (API routes)
   - Input validation (required fields, format checks)
   - Uniqueness constraints (username, invite codes)
   - Authorization checks (captain-only endpoints)

3. **Utility functions** (`lib/types.ts`, `lib/comment-utils.ts`)
   - URL parsing and formatting
   - Timestamp parsing and formatting
   - Avatar color generation

### Medium Priority
4. **Component rendering** (VideoWatchView, VideoUploader, ArticleEditor)
   - Props correctly passed and rendered
   - State management and updates
   - Error states displayed

5. **API integration** (fetch calls, Supabase queries)
   - Correct endpoints called with correct params
   - Response handling (success and error cases)
   - Retry logic (if implemented)

### Low Priority
6. **UI interactions** (click handlers, form submissions)
   - User typing, scrolling, expanding sections
   - Complex multi-step flows
   - Edge cases in chapter navigation

## What Should NOT Be Tested

- **Tailwind CSS classes** — Don't assert on class names; test visual output instead
- **Third-party libraries** — Don't test lucide-react, Supabase SDK, jose (assume they work)
- **Browser APIs** — Don't test localStorage, sessionStorage directly
- **Next.js internals** — Don't test Next.js routing, server component streaming

---

*Testing analysis: 2026-03-10*

**Status:** Testing infrastructure not yet implemented. Recommendation: Start with unit tests for utilities, then add API route tests, then component tests.
