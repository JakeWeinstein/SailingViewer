// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  getTokenPayload: vi.fn(),
  COOKIE_NAME: 'tf_session',
}))

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long-for-hs256'
})

const AUTHOR_ID = '550e8400-e29b-41d4-a716-446655440001'
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440002'
const CAPTAIN_ID = '550e8400-e29b-41d4-a716-446655440003'
const VIDEO_ID = '550e8400-e29b-41d4-a716-446655440010'
const SESSION_ID = '550e8400-e29b-41d4-a716-446655440020'
const COMMENT_ID = '550e8400-e29b-41d4-a716-446655440030'
const PARENT_ID = '550e8400-e29b-41d4-a716-446655440040'

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/comments')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString(), { method: 'GET' })
}

function makePatchRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/comments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(id: string) {
  return new NextRequest(`http://localhost/api/comments/${id}`, {
    method: 'DELETE',
  })
}

// ── POST /api/comments ──────────────────────────────────────────────────────

describe('POST /api/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue(null)

    const { POST } = await import('./route')
    const req = makePostRequest({ comment_text: 'Hello', video_id: VIDEO_ID })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 with Zod field errors for empty comment_text', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: AUTHOR_ID,
      userName: 'user1',
    })

    const { POST } = await import('./route')
    const req = makePostRequest({ comment_text: '', video_id: VIDEO_ID })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.details).toBeDefined()
  })

  it('stores author_id from JWT, not from request body', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: AUTHOR_ID,
      userName: 'user1',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: COMMENT_ID,
            author_id: AUTHOR_ID,
            comment_text: 'Hello world',
            video_id: VIDEO_ID,
            send_to_captain: false,
            parent_id: null,
            created_at: '2026-03-11T00:00:00Z',
          },
          error: null,
        }),
      }),
    })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as never)

    const { POST } = await import('./route')
    // Try to inject a fake author_id via body — should be ignored
    const req = makePostRequest({
      comment_text: 'Hello world',
      video_id: VIDEO_ID,
      author_id: 'fake-author-id',
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(201)

    const insertCall = mockInsert.mock.calls[0][0]
    expect(insertCall.author_id).toBe(AUTHOR_ID)
    expect(insertCall.author_id).not.toBe('fake-author-id')
  })

  it('creates reply with parent_id when provided', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: AUTHOR_ID,
      userName: 'user1',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: COMMENT_ID,
            author_id: AUTHOR_ID,
            comment_text: 'Reply here',
            video_id: VIDEO_ID,
            parent_id: PARENT_ID,
            send_to_captain: false,
            created_at: '2026-03-11T00:00:00Z',
          },
          error: null,
        }),
      }),
    })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as never)

    const { POST } = await import('./route')
    const req = makePostRequest({
      comment_text: 'Reply here',
      video_id: VIDEO_ID,
      parent_id: PARENT_ID,
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(201)

    const insertCall = mockInsert.mock.calls[0][0]
    expect(insertCall.parent_id).toBe(PARENT_ID)
  })

  it('stores send_to_captain flag when true', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: AUTHOR_ID,
      userName: 'user1',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: COMMENT_ID,
            author_id: AUTHOR_ID,
            comment_text: 'Captain note',
            video_id: VIDEO_ID,
            send_to_captain: true,
            parent_id: null,
            created_at: '2026-03-11T00:00:00Z',
          },
          error: null,
        }),
      }),
    })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as never)

    const { POST } = await import('./route')
    const req = makePostRequest({
      comment_text: 'Captain note',
      video_id: VIDEO_ID,
      send_to_captain: true,
    })
    const res = await POST(req)
    expect(res.status).toBe(201)

    const insertCall = mockInsert.mock.calls[0][0]
    expect(insertCall.send_to_captain).toBe(true)
  })
})

// ── GET /api/comments ───────────────────────────────────────────────────────

describe('GET /api/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns comments for videoId, sorted oldest first, with reply counts', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue(null)

    const { supabase } = await import('@/lib/supabase')
    const comments = [
      { id: COMMENT_ID, comment_text: 'First', author_id: AUTHOR_ID, video_id: VIDEO_ID, parent_id: null, created_at: '2026-01-01' },
    ]
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: comments, error: null }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: [{ parent_id: COMMENT_ID, count: 2 }], error: null }),
    } as never)

    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ parent_id: COMMENT_ID, count: 2 }], error: null } as never)

    const { GET } = await import('./route')
    const req = makeGetRequest({ videoId: VIDEO_ID })
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })

  it('returns replies for parentId', async () => {
    const { supabase } = await import('@/lib/supabase')
    const replies = [
      { id: COMMENT_ID, parent_id: PARENT_ID, comment_text: 'Reply', author_id: AUTHOR_ID },
    ]
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: replies, error: null }),
        }),
      }),
    } as never)

    const { GET } = await import('./route')
    const req = makeGetRequest({ parentId: PARENT_ID })
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data[0].parent_id).toBe(PARENT_ID)
  })

  it('returns 401 for captainOnly=true without auth', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue(null)

    const { GET } = await import('./route')
    const req = makeGetRequest({ captainOnly: 'true' })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})

// ── PATCH /api/comments/[id] ────────────────────────────────────────────────

describe('PATCH /api/comments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue(null)

    const { PATCH } = await import('./[id]/route')
    const req = makePatchRequest(COMMENT_ID, { comment_text: 'Updated' })
    const res = await PATCH(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when non-owner tries to edit', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: OTHER_USER_ID,
      userName: 'other',
    })

    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: COMMENT_ID, author_id: AUTHOR_ID, comment_text: 'Original' },
            error: null,
          }),
        }),
      }),
    } as never)

    const { PATCH } = await import('./[id]/route')
    const req = makePatchRequest(COMMENT_ID, { comment_text: 'Hacked' })
    const res = await PATCH(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    expect(res.status).toBe(403)
  })

  it('updates text and sets is_edited=true for owner', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: AUTHOR_ID,
      userName: 'user1',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: COMMENT_ID,
              author_id: AUTHOR_ID,
              comment_text: 'Updated text',
              is_edited: true,
              updated_at: '2026-03-11T00:00:00Z',
            },
            error: null,
          }),
        }),
      }),
    })
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: COMMENT_ID, author_id: AUTHOR_ID, comment_text: 'Original' },
            error: null,
          }),
        }),
      }),
    } as never).mockReturnValueOnce({
      update: mockUpdate,
    } as never)

    const { PATCH } = await import('./[id]/route')
    const req = makePatchRequest(COMMENT_ID, { comment_text: 'Updated text' })
    const res = await PATCH(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.is_edited).toBe(true)
  })

  it('allows captain to edit any comment', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: COMMENT_ID,
              author_id: AUTHOR_ID,
              comment_text: 'Captain edited',
              is_edited: true,
              updated_at: '2026-03-11T00:00:00Z',
            },
            error: null,
          }),
        }),
      }),
    })
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: COMMENT_ID, author_id: AUTHOR_ID, comment_text: 'Original' },
            error: null,
          }),
        }),
      }),
    } as never).mockReturnValueOnce({
      update: mockUpdate,
    } as never)

    const { PATCH } = await import('./[id]/route')
    const req = makePatchRequest(COMMENT_ID, { comment_text: 'Captain edited' })
    const res = await PATCH(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    expect(res.status).toBe(200)
  })
})

// ── DELETE /api/comments/[id] ───────────────────────────────────────────────

describe('DELETE /api/comments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when non-owner tries to delete', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: OTHER_USER_ID,
      userName: 'other',
    })

    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: COMMENT_ID, author_id: AUTHOR_ID },
            error: null,
          }),
        }),
      }),
    } as never)

    const { DELETE } = await import('./[id]/route')
    const req = makeDeleteRequest(COMMENT_ID)
    const res = await DELETE(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    expect(res.status).toBe(403)
  })

  it('returns 204 when owner deletes comment', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: AUTHOR_ID,
      userName: 'user1',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: COMMENT_ID, author_id: AUTHOR_ID },
            error: null,
          }),
        }),
      }),
    } as never).mockReturnValueOnce({
      delete: mockDelete,
    } as never)

    const { DELETE } = await import('./[id]/route')
    const req = makeDeleteRequest(COMMENT_ID)
    const res = await DELETE(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    expect(res.status).toBe(204)
  })

  it('returns 204 when captain deletes any comment', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: COMMENT_ID, author_id: AUTHOR_ID },
            error: null,
          }),
        }),
      }),
    } as never).mockReturnValueOnce({
      delete: mockDelete,
    } as never)

    const { DELETE } = await import('./[id]/route')
    const req = makeDeleteRequest(COMMENT_ID)
    const res = await DELETE(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    expect(res.status).toBe(204)
  })
})
