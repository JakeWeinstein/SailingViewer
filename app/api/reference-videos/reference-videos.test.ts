/**
 * Tests for reference-videos API: tag filtering, tag storage, autocomplete endpoint
 * TDD RED phase — these tests define the expected behavior before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  getTokenPayload: vi.fn(),
}))

vi.mock('@/lib/supabase', () => {
  const buildQuery = () => {
    const q: Record<string, unknown> = {}
    const chain = new Proxy(q, {
      get(_target, prop) {
        if (prop === 'then') return undefined
        if (prop === 'data') return q.data ?? []
        if (prop === 'error') return q.error ?? null
        return (...args: unknown[]) => {
          q[prop as string] = args
          if (prop === 'select' || prop === 'insert' || prop === 'update' || prop === 'delete' ||
              prop === 'order' || prop === 'eq' || prop === 'contains' || prop === 'single' ||
              prop === 'neq' || prop === 'limit') {
            return chain
          }
          return chain
        }
      },
    })
    return chain
  }

  return {
    supabase: {
      from: vi.fn(() => buildQuery()),
      rpc: vi.fn(),
    },
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

import { NextRequest } from 'next/server'
import { getTokenPayload } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

function makeRequest(
  method: string,
  url: string,
  body?: unknown,
  authenticated = true
): NextRequest {
  const req = new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
  if (authenticated) {
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: 'user-1',
      userName: 'testuser',
    })
  } else {
    vi.mocked(getTokenPayload).mockResolvedValue(null)
  }
  return req
}

// ── lib/schemas/reference-videos.ts tests ────────────────────────────────────

describe('CreateReferenceVideoSchema', () => {
  it('validates required fields', async () => {
    const { CreateReferenceVideoSchema } = await import('@/lib/schemas/reference-videos')
    const result = CreateReferenceVideoSchema.safeParse({
      title: 'Upwind technique',
      type: 'youtube',
      video_ref: 'dQw4w9WgXcQ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tags).toEqual([]) // default empty array
    }
  })

  it('validates tags array', async () => {
    const { CreateReferenceVideoSchema } = await import('@/lib/schemas/reference-videos')
    const result = CreateReferenceVideoSchema.safeParse({
      title: 'Starts',
      type: 'youtube',
      video_ref: 'abc123',
      tags: ['upwind', 'starts'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tags).toEqual(['upwind', 'starts'])
    }
  })

  it('rejects empty title', async () => {
    const { CreateReferenceVideoSchema } = await import('@/lib/schemas/reference-videos')
    const result = CreateReferenceVideoSchema.safeParse({
      title: '',
      type: 'youtube',
      video_ref: 'abc123',
    })
    expect(result.success).toBe(false)
  })

  it('validates optional parent_video_id as uuid', async () => {
    const { CreateReferenceVideoSchema } = await import('@/lib/schemas/reference-videos')
    const result = CreateReferenceVideoSchema.safeParse({
      title: 'Chapter 1',
      type: 'youtube',
      video_ref: 'abc123',
      parent_video_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('validates start_seconds as non-negative', async () => {
    const { CreateReferenceVideoSchema } = await import('@/lib/schemas/reference-videos')
    const result = CreateReferenceVideoSchema.safeParse({
      title: 'Chapter 1',
      type: 'youtube',
      video_ref: 'abc123',
      start_seconds: -5,
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateReferenceVideoSchema', () => {
  it('allows partial updates', async () => {
    const { UpdateReferenceVideoSchema } = await import('@/lib/schemas/reference-videos')
    const result = UpdateReferenceVideoSchema.safeParse({
      tags: ['tacking', 'mark-rounding'],
    })
    expect(result.success).toBe(true)
  })

  it('allows empty update (all optional)', async () => {
    const { UpdateReferenceVideoSchema } = await import('@/lib/schemas/reference-videos')
    const result = UpdateReferenceVideoSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

// ── GET /api/reference-videos route tests ─────────────────────────────────────

describe('GET /api/reference-videos', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(supabase.from).mockReset()
  })

  it('returns all videos when no tag filter', async () => {
    const mockVideos = [
      { id: '1', title: 'Video 1', tags: ['upwind'] },
      { id: '2', title: 'Video 2', tags: ['downwind'] },
    ]
    const chainResult = {
      data: mockVideos,
      error: null,
    }

    vi.mocked(supabase.from).mockImplementation(() => {
      return createChain(chainResult) as unknown as ReturnType<typeof supabase.from>
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/reference-videos')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })

  it('filters by tags using AND logic when ?tags= provided', async () => {
    const mockVideos = [{ id: '1', title: 'Video 1', tags: ['upwind', 'tacking'] }]
    let containsCalledWith: unknown

    vi.mocked(supabase.from).mockImplementation(() => {
      return createChainWithContainsSpy(
        { data: mockVideos, error: null },
        (col, val) => { containsCalledWith = { col, val } }
      ) as ReturnType<typeof supabase.from>
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/reference-videos?tags=upwind,tacking')
    const res = await GET(req)

    expect(res.status).toBe(200)
    // Verify .contains() was called with tags array
    expect(containsCalledWith).toBeDefined()
  })

  it('returns unique tags when ?allTags=true', async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      return createChain({ data: null, error: null }) as ReturnType<typeof supabase.from>
    })
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ tag: 'upwind' }, { tag: 'tacking' }, { tag: 'starts' }],
      error: null,
    } as ReturnType<typeof supabase.rpc> extends Promise<infer T> ? T : never)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/reference-videos?allTags=true')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })
})

describe('POST /api/reference-videos', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(supabase.from).mockReset()
  })

  it('requires auth', async () => {
    vi.mocked(getTokenPayload).mockResolvedValue(null)
    const { POST } = await import('./route')
    const req = makeRequest('POST', 'http://localhost/api/reference-videos', {
      title: 'Test',
      type: 'youtube',
      video_ref: 'abc123',
    }, false)
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('stores tags as lowercase trimmed array', async () => {
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: 'user-1',
      userName: 'testuser',
    })

    let insertedData: unknown
    vi.mocked(supabase.from).mockImplementation(() => {
      return createInsertChain(
        { data: { id: 'new-id', title: 'Test', tags: ['upwind', 'starts'] }, error: null },
        (data) => { insertedData = data }
      ) as ReturnType<typeof supabase.from>
    })

    const { POST } = await import('./route')
    const req = makeRequest('POST', 'http://localhost/api/reference-videos', {
      title: 'Test Video',
      type: 'youtube',
      video_ref: 'abc123',
      tags: ['  UPWIND  ', 'Starts'],
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('validates with Zod — rejects missing video_ref', async () => {
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: 'user-1',
      userName: 'testuser',
    })

    const { POST } = await import('./route')
    const req = makeRequest('POST', 'http://localhost/api/reference-videos', {
      title: 'Test',
      type: 'youtube',
      // missing video_ref
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/reference-videos/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(supabase.from).mockReset()
  })

  it('accepts tags update', async () => {
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: 'user-1',
      userName: 'captain',
    })

    vi.mocked(supabase.from).mockImplementation(() => {
      return createChain({ data: { id: 'vid-1', tags: ['tacking'] }, error: null }) as ReturnType<typeof supabase.from>
    })

    const { PATCH } = await import('./[id]/route')
    const req = makeRequest('PATCH', 'http://localhost/api/reference-videos/vid-1', {
      tags: ['tacking'],
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'vid-1' }) })
    expect(res.status).toBe(200)
  })
})

// ── Chain builder helpers ─────────────────────────────────────────────────────

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

function createChainWithContainsSpy(
  result: { data: unknown; error: unknown },
  onContains: (col: string, val: unknown) => void
) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') return undefined
      if (prop === 'data') return result.data
      if (prop === 'error') return result.error
      if (prop === 'contains') {
        return (col: string, val: unknown) => {
          onContains(col, val)
          return new Proxy({}, handler)
        }
      }
      return () => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

function createInsertChain(
  result: { data: unknown; error: unknown },
  onInsert: (data: unknown) => void
) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') return undefined
      if (prop === 'data') return result.data
      if (prop === 'error') return result.error
      if (prop === 'insert') {
        return (data: unknown) => {
          onInsert(data)
          return new Proxy({}, handler)
        }
      }
      return () => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}
