import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  return NextResponse.json({ role: payload.role, userName: payload.userName })
}
