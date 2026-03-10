import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/register']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // API routes handle their own auth — return 401 JSON, not redirect
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow public paths through without auth check
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value

  if (!token || !(await verifyToken(token))) {
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
