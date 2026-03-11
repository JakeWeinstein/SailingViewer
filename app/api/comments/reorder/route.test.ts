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

const SESSION_ID = '550e8400-e29b-41d4-a716-446655440020'
const COMMENT_A = '550e8400-e29b-41d4-a716-446655440030'
const COMMENT_B = '550e8400-e29b-41d4-a716-446655440031'
const CAPTAIN_ID = '550e8400-e29b-41d4-a716-446655440003'
const CONTRIBUTOR_ID = '550e8400-e29b-41d4-a716-446655440001'

function makePatchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/comments/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/comments/reorder (REV-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates sort_order for multiple comments in one request', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockEq2 = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as never)

    const { PATCH } = await import('./route')
    const req = makePatchRequest({
      session_id: SESSION_ID,
      order: [
        { id: COMMENT_A, sort_order: 0 },
        { id: COMMENT_B, sort_order: 1 },
      ],
    })
    const res = await PATCH(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    // Should have called update twice (once per comment)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('validates session_id ownership by scoping updates to session_id', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockEq2 = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as never)

    const { PATCH } = await import('./route')
    const req = makePatchRequest({
      session_id: SESSION_ID,
      order: [{ id: COMMENT_A, sort_order: 0 }],
    })
    await PATCH(req)

    // Verify session_id filter is applied (second eq call)
    expect(mockEq1).toHaveBeenCalledWith('id', COMMENT_A)
    expect(mockEq2).toHaveBeenCalledWith('session_id', SESSION_ID)
  })

  it('rejects non-captain with 403', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: CONTRIBUTOR_ID,
      userName: 'user1',
    })

    const { PATCH } = await import('./route')
    const req = makePatchRequest({
      session_id: SESSION_ID,
      order: [{ id: COMMENT_A, sort_order: 0 }],
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 for empty order array', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { PATCH } = await import('./route')
    const req = makePatchRequest({
      session_id: SESSION_ID,
      order: [],
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue(null)

    const { PATCH } = await import('./route')
    const req = makePatchRequest({
      session_id: SESSION_ID,
      order: [{ id: COMMENT_A, sort_order: 0 }],
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })
})
