// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  getTokenPayload: vi.fn(),
  COOKIE_NAME: 'tf_session',
}))

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long-for-hs256'
})

const COMMENT_ID = '550e8400-e29b-41d4-a716-446655440030'
const AUTHOR_ID = '550e8400-e29b-41d4-a716-446655440001'
const CAPTAIN_ID = '550e8400-e29b-41d4-a716-446655440003'
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440002'

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

// ── PATCH /api/comments/[id] — review lifecycle ──────────────────────────────

describe('PATCH /api/comments/[id] — review lifecycle (REV-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks comment as reviewed with is_reviewed=true, sets reviewed_at', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: COMMENT_ID,
        is_reviewed: true,
        reviewed_at: '2026-03-11T00:00:00Z',
      },
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as never)

    const { PATCH } = await import('./route')
    const req = makePatchRequest(COMMENT_ID, { is_reviewed: true })
    const res = await PATCH(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.is_reviewed).toBe(true)
    expect(data.reviewed_at).toBeTruthy()

    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.is_reviewed).toBe(true)
    expect(updateCall.reviewed_at).toBeTruthy()
  })

  it('restores comment with is_reviewed=false, clears reviewed_at', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: COMMENT_ID,
        is_reviewed: false,
        reviewed_at: null,
      },
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as never)

    const { PATCH } = await import('./route')
    const req = makePatchRequest(COMMENT_ID, { is_reviewed: false })
    const res = await PATCH(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.is_reviewed).toBe(false)
    expect(data.reviewed_at).toBeNull()

    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.is_reviewed).toBe(false)
    expect(updateCall.reviewed_at).toBeNull()
  })

  it('rejects non-captain with 403 for review marking', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: AUTHOR_ID,
      userName: 'user1',
    })

    const { PATCH } = await import('./route')
    const req = makePatchRequest(COMMENT_ID, { is_reviewed: true })
    const res = await PATCH(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid body (not is_reviewed boolean or comment_text string)', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { PATCH } = await import('./route')
    const req = makePatchRequest(COMMENT_ID, { totally_unknown_field: 42 })
    const res = await PATCH(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue(null)

    const { PATCH } = await import('./route')
    const req = makePatchRequest(COMMENT_ID, { comment_text: 'Updated' })
    const res = await PATCH(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when non-owner tries to edit comment text', async () => {
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

    const { PATCH } = await import('./route')
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
    vi.mocked(supabase.from)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: COMMENT_ID, author_id: AUTHOR_ID, comment_text: 'Original' },
              error: null,
            }),
          }),
        }),
      } as never)
      .mockReturnValueOnce({ update: mockUpdate } as never)

    const { PATCH } = await import('./route')
    const req = makePatchRequest(COMMENT_ID, { comment_text: 'Updated text' })
    const res = await PATCH(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.is_edited).toBe(true)
  })

  it('allows captain to edit any comment text', async () => {
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
    vi.mocked(supabase.from)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: COMMENT_ID, author_id: AUTHOR_ID, comment_text: 'Original' },
              error: null,
            }),
          }),
        }),
      } as never)
      .mockReturnValueOnce({ update: mockUpdate } as never)

    const { PATCH } = await import('./route')
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

    const { DELETE } = await import('./route')
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
    vi.mocked(supabase.from)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: COMMENT_ID, author_id: AUTHOR_ID },
              error: null,
            }),
          }),
        }),
      } as never)
      .mockReturnValueOnce({ delete: mockDelete } as never)
      .mockReturnValueOnce({ delete: mockDelete } as never)

    const { DELETE } = await import('./route')
    const req = makeDeleteRequest(COMMENT_ID)
    const res = await DELETE(req, { params: Promise.resolve({ id: COMMENT_ID }) })
    expect(res.status).toBe(204)
  })
})
