import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock supabase before importing route
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}))

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long-for-hs256'
})

// Helper to build a mock NextRequest
function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 with fieldErrors for empty body', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({})
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toBe('Invalid input')
    expect(data.details).toBeDefined()
    expect(data.details.username).toBeDefined()
    expect(data.details.password).toBeDefined()
  })

  it('returns 400 with fieldErrors when username missing', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ password: 'secret' })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.details.username).toBeDefined()
  })

  it('returns 401 for unknown username', async () => {
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      }),
    } as never)

    const { POST } = await import('./route')
    const req = makeRequest({ username: 'unknown', password: 'password' })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data.error).toBe('Invalid credentials')
  })

  it('returns 401 for wrong password', async () => {
    const { supabase } = await import('@/lib/supabase')
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-1',
              username: 'captain',
              display_name: 'Captain',
              password_hash: '$2a$12$hash',
              role: 'captain',
              is_active: true,
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as never)

    const { POST } = await import('./route')
    const req = makeRequest({ username: 'captain', password: 'wrongpassword' })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data.error).toBe('Invalid credentials')
  })

  it('returns 401 for inactive user', async () => {
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-2',
              username: 'inactive',
              display_name: 'Inactive User',
              password_hash: '$2a$12$hash',
              role: 'viewer',
              is_active: false,
            },
            error: null,
          }),
        }),
      }),
    } as never)

    const { POST } = await import('./route')
    const req = makeRequest({ username: 'inactive', password: 'password123' })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data.error).toBe('Invalid credentials')
  })

  it('returns 200 with user object and sets tf_session cookie on valid credentials', async () => {
    const { supabase } = await import('@/lib/supabase')
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: '550e8400-e29b-41d4-a716-446655440001',
              username: 'captain',
              display_name: 'Captain',
              password_hash: '$2a$12$hash',
              role: 'captain',
              is_active: true,
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as never)

    const { POST } = await import('./route')
    const req = makeRequest({ username: 'captain', password: 'correct-password' })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.user).toBeDefined()
    expect(data.user.role).toBe('captain')
    expect(data.user.username).toBe('captain')
    // Check cookie was set
    const cookies = res.headers.getSetCookie()
    expect(cookies.some((c: string) => c.startsWith('tf_session='))).toBe(true)
  })

  it('returns structured Zod fieldErrors on validation failure (INFRA-03)', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ username: '', password: '' })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.details).toBeDefined()
    expect(typeof data.details).toBe('object')
  })
})
