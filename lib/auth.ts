import 'server-only'

import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { TokenPayloadSchema } from '@/lib/schemas/auth'

export type { TokenPayload } from '@/lib/schemas/auth'
export { TokenPayloadSchema } from '@/lib/schemas/auth'

import type { TokenPayload } from '@/lib/schemas/auth'

export const COOKIE_NAME = 'tf_session'
const EXPIRY = '7d'

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const parsed = TokenPayloadSchema.safeParse(payload)
    if (!parsed.success) return null
    return parsed.data
  } catch {
    return null
  }
}

export async function getTokenPayload(req: NextRequest): Promise<TokenPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}
