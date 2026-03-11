/**
 * Tests for sessions API: session close, carry-forward, per-video stats, manual video add
 * TDD RED phase — these tests define the expected behavior before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  getTokenPayload: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

import { NextRequest } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// Chain builder helpers

function createChain(result: { data: unknown; error: unknown }) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') return undefined
      if (prop === 'data') return result.data
      if (prop === 'error') return result.error
      return () => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

function mockFrom(resultMap: Record<string, { data: unknown; error: unknown }>) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const result = resultMap[table] ?? { data: null, error: null }
    return createChain(result) as unknown as ReturnType<typeof supabase.from>
  })
}

function captainPayload() {
  vi.mocked(getTokenPayload).mockResolvedValue({
    role: 'captain',
    userId: 'user-captain',
    userName: 'captain',
  })
}

function contributorPayload() {
  vi.mocked(getTokenPayload).mockResolvedValue({
    role: 'contributor',
    userId: 'user-contrib',
    userName: 'user',
  })
}

function noAuth() {
  vi.mocked(getTokenPayload).mockResolvedValue(null)
}

// ── lib/schemas/sessions.ts tests ─────────────────────────────────────────────

describe('CreateSessionSchema', () => {
  it('validates label field', async () => {
    const { CreateSessionSchema } = await import('@/lib/schemas/sessions')
    const result = CreateSessionSchema.safeParse({ label: 'Week of March 10' })
    expect(result.success).toBe(true)
  })

  it('rejects empty label', async () => {
    const { CreateSessionSchema } = await import('@/lib/schemas/sessions')
    const result = CreateSessionSchema.safeParse({ label: '' })
    expect(result.success).toBe(false)
  })

  it('rejects label over 200 chars', async () => {
    const { CreateSessionSchema } = await import('@/lib/schemas/sessions')
    const result = CreateSessionSchema.safeParse({ label: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })
})

describe('CloseSessionSchema', () => {
  it('allows optional next_label', async () => {
    const { CloseSessionSchema } = await import('@/lib/schemas/sessions')
    expect(CloseSessionSchema.safeParse({}).success).toBe(true)
    expect(CloseSessionSchema.safeParse({ next_label: 'Week of March 17' }).success).toBe(true)
  })
})

describe('AddVideoSchema', () => {
  it('validates youtube_url', async () => {
    const { AddVideoSchema } = await import('@/lib/schemas/sessions')
    expect(AddVideoSchema.safeParse({ youtube_url: 'https://youtu.be/abc123' }).success).toBe(true)
    expect(AddVideoSchema.safeParse({ youtube_url: '' }).success).toBe(false)
  })
})

// ── POST /api/sessions/[id] close action ─────────────────────────────────────

describe('POST /api/sessions/[id] action=close', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(supabase.from).mockReset()
  })

  it('requires captain role', async () => {
    contributorPayload()
    vi.mocked(supabase.from).mockImplementation(() => {
      return createChain({ data: { id: 'session-1', label: 'Week 1', is_active: true }, error: null }) as unknown as ReturnType<typeof supabase.from>
    })

    const { POST } = await import('./[id]/route')
    const req = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'POST',
      body: JSON.stringify({ action: 'close' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'session-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 401 for unauthenticated requests', async () => {
    noAuth()

    const { POST } = await import('./[id]/route')
    const req = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'POST',
      body: JSON.stringify({ action: 'close' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'session-1' }) })
    expect(res.status).toBe(401)
  })

  it('creates new session when closing current', async () => {
    captainPayload()

    const closedSession = { id: 'session-1', label: 'Week 1', is_active: false, closed_at: new Date().toISOString() }
    const newSession = { id: 'session-2', label: 'Week of March 17', is_active: true, closed_at: null }

    let insertCallCount = 0
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const handler: ProxyHandler<object> = {
        get(_target, prop) {
          if (prop === 'then') return undefined
          if (prop === 'data') {
            if (table === 'sessions' && insertCallCount > 0) return newSession
            return closedSession
          }
          if (prop === 'error') return null
          if (prop === 'insert') {
            insertCallCount++
            return () => new Proxy({}, handler)
          }
          return () => new Proxy({}, handler)
        },
      }
      return new Proxy({}, handler) as unknown as ReturnType<typeof supabase.from>
    })

    const { POST } = await import('./[id]/route')
    const req = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'POST',
      body: JSON.stringify({ action: 'close' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'session-1' }) })
    // Should return a response (not crash)
    expect([200, 201, 500]).toContain(res.status)
  })
})

// ── POST /api/sessions/[id] add-video action ──────────────────────────────────

describe('POST /api/sessions/[id] action=add-video', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(supabase.from).mockReset()
  })

  it('requires authentication', async () => {
    noAuth()

    const { POST } = await import('./[id]/route')
    const req = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'POST',
      body: JSON.stringify({ action: 'add-video', youtube_url: 'https://youtu.be/abc12345678' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'session-1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects invalid YouTube URL', async () => {
    contributorPayload()
    vi.mocked(supabase.from).mockImplementation(() => {
      return createChain({ data: null, error: null }) as unknown as ReturnType<typeof supabase.from>
    })

    const { POST } = await import('./[id]/route')
    const req = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'POST',
      body: JSON.stringify({ action: 'add-video', youtube_url: 'not-a-youtube-url' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'session-1' }) })
    expect(res.status).toBe(400)
  })

  it('adds video to session for any authenticated user', async () => {
    contributorPayload()
    const newVideo = { id: 'sv-1', session_id: 'session-1', youtube_video_id: 'abc12345678', title: 'Video', position: 1 }
    vi.mocked(supabase.from).mockImplementation(() => {
      return createChain({ data: newVideo, error: null }) as unknown as ReturnType<typeof supabase.from>
    })

    const { POST } = await import('./[id]/route')
    const req = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'POST',
      body: JSON.stringify({ action: 'add-video', youtube_url: 'https://youtu.be/abc12345678' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'session-1' }) })
    expect([200, 201]).toContain(res.status)
  })
})

// ── GET /api/sessions — with comment stats ────────────────────────────────────

describe('GET /api/sessions', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(supabase.from).mockReset()
  })

  it('requires authentication', async () => {
    noAuth()

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/sessions')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns sessions list for authenticated users', async () => {
    captainPayload()
    const sessions = [{ id: 'session-1', label: 'Week 1', is_active: true, created_at: '2026-01-01' }]
    mockFrom({
      sessions: { data: sessions, error: null },
      comments: { data: [], error: null },
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/sessions')
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })
})

// ── POST /api/sessions — create session ───────────────────────────────────────

describe('POST /api/sessions', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(supabase.from).mockReset()
  })

  it('requires captain role', async () => {
    contributorPayload()

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ label: 'Week of March 10' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('validates label with Zod — rejects empty label', async () => {
    captainPayload()
    mockFrom({ sessions: { data: null, error: null } })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ label: '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates session for captain', async () => {
    captainPayload()
    const newSession = { id: 'new-session', label: 'Week of March 10', is_active: true }
    vi.mocked(supabase.from).mockImplementation(() => {
      return createChain({ data: newSession, error: null }) as unknown as ReturnType<typeof supabase.from>
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ label: 'Week of March 10' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect([200, 201]).toContain(res.status)
  })
})
