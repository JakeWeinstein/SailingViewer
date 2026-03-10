import { describe, it, expect, beforeAll } from 'vitest'
import { signToken, verifyToken } from './auth'

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long-for-hs256'
})

describe('verifyToken', () => {
  it('returns null for token with missing role field', async () => {
    // Create a token without a proper role by signing manually with jose
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET)
    const token = await new SignJWT({ userId: '550e8400-e29b-41d4-a716-446655440000', userName: 'Test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret)
    const result = await verifyToken(token)
    expect(result).toBeNull()
  })

  it('returns null for token with role captain but no userId (old format)', async () => {
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET)
    const token = await new SignJWT({ role: 'captain', userName: 'Captain' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret)
    const result = await verifyToken(token)
    expect(result).toBeNull()
  })

  it('returns null for expired token', async () => {
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET)
    const token = await new SignJWT({
      role: 'captain',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      userName: 'Captain',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('-1s')
      .sign(secret)
    const result = await verifyToken(token)
    expect(result).toBeNull()
  })

  it('returns valid TokenPayload for token with role viewer + userId + userName', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440001'
    const token = await signToken({ role: 'viewer', userId, userName: 'Alice' })
    const result = await verifyToken(token)
    expect(result).not.toBeNull()
    expect(result?.role).toBe('viewer')
    expect(result?.userId).toBe(userId)
    expect(result?.userName).toBe('Alice')
  })

  it('returns valid TokenPayload for token with role captain + userId + userName', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440002'
    const token = await signToken({ role: 'captain', userId, userName: 'Captain' })
    const result = await verifyToken(token)
    expect(result).not.toBeNull()
    expect(result?.role).toBe('captain')
    expect(result?.userId).toBe(userId)
    expect(result?.userName).toBe('Captain')
  })

  it('signToken produces a token that verifyToken can decode', async () => {
    const payload = {
      role: 'contributor' as const,
      userId: '550e8400-e29b-41d4-a716-446655440003',
      userName: 'Bob',
    }
    const token = await signToken(payload)
    const result = await verifyToken(token)
    expect(result).toEqual(payload)
  })
})
