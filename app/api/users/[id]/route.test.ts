import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock supabase before importing route
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// Mock lib/auth to control token payloads
vi.mock('@/lib/auth', () => ({
  getTokenPayload: vi.fn(),
  COOKIE_NAME: 'tf_session',
}))

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long-for-hs256'
})

const CAPTAIN_ID = '550e8400-e29b-41d4-a716-446655440001'
const REGULAR_USER_ID = '550e8400-e29b-41d4-a716-446655440002'
const SEED_USER_ID = '550e8400-e29b-41d4-a716-446655440003'

function makePatchRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(id: string) {
  return new NextRequest(`http://localhost/api/users/${id}`, {
    method: 'DELETE',
  })
}

describe('PATCH /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for non-captain user', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'contributor',
      userId: REGULAR_USER_ID,
      userName: 'contributor1',
    })

    const { PATCH } = await import('./route')
    const req = makePatchRequest(REGULAR_USER_ID, { role: 'viewer' })
    const res = await PATCH(req, { params: Promise.resolve({ id: REGULAR_USER_ID }) })
    expect(res.status).toBe(403)
  })

  it('returns 403 with "Cannot demote the seed captain" when changing is_seed user role', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: SEED_USER_ID, role: 'captain', is_seed: true },
            error: null,
          }),
        }),
      }),
    } as never)

    const { PATCH } = await import('./route')
    const req = makePatchRequest(SEED_USER_ID, { role: 'contributor' })
    const res = await PATCH(req, { params: Promise.resolve({ id: SEED_USER_ID }) })
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.error).toBe('Cannot demote the seed captain')
  })

  it('returns 200 for captain changing regular user role', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: REGULAR_USER_ID, role: 'viewer', is_seed: false },
            error: null,
          }),
        }),
      }),
      update: mockUpdate,
    } as never)

    const { PATCH } = await import('./route')
    const req = makePatchRequest(REGULAR_USER_ID, { role: 'contributor' })
    const res = await PATCH(req, { params: Promise.resolve({ id: REGULAR_USER_ID }) })
    expect(res.status).toBe(200)
  })

  it('returns 200 for captain deactivating a user (is_active: false)', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: REGULAR_USER_ID, role: 'viewer', is_seed: false, is_active: true },
            error: null,
          }),
        }),
      }),
      update: mockUpdate,
    } as never)

    const { PATCH } = await import('./route')
    const req = makePatchRequest(REGULAR_USER_ID, { is_active: false })
    const res = await PATCH(req, { params: Promise.resolve({ id: REGULAR_USER_ID }) })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when deleting seed captain', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: SEED_USER_ID, is_seed: true },
            error: null,
          }),
        }),
      }),
    } as never)

    const { DELETE } = await import('./route')
    const req = makeDeleteRequest(SEED_USER_ID)
    const res = await DELETE(req, { params: Promise.resolve({ id: SEED_USER_ID }) })
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.error).toBe('Cannot delete the seed captain')
  })

  it('returns 403 when captain tries to delete themselves', async () => {
    const { getTokenPayload } = await import('@/lib/auth')
    vi.mocked(getTokenPayload).mockResolvedValue({
      role: 'captain',
      userId: CAPTAIN_ID,
      userName: 'captain',
    })

    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: CAPTAIN_ID, is_seed: false },
            error: null,
          }),
        }),
      }),
    } as never)

    const { DELETE } = await import('./route')
    const req = makeDeleteRequest(CAPTAIN_ID)
    const res = await DELETE(req, { params: Promise.resolve({ id: CAPTAIN_ID }) })
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.error).toBe('Cannot delete your own account')
  })

  it('returns 200 for captain deleting a regular user', async () => {
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
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: REGULAR_USER_ID, is_seed: false },
            error: null,
          }),
        }),
      }),
      delete: mockDelete,
    } as never)

    const { DELETE } = await import('./route')
    const req = makeDeleteRequest(REGULAR_USER_ID)
    const res = await DELETE(req, { params: Promise.resolve({ id: REGULAR_USER_ID }) })
    expect(res.status).toBe(200)
  })
})
