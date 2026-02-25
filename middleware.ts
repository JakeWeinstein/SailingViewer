import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

export const config = {
  matcher: ['/dashboard/:path*'],
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow the login page through
  if (pathname === '/dashboard/login') return NextResponse.next()

  const token = req.cookies.get(COOKIE_NAME)?.value

  if (!token || !(await verifyToken(token))) {
    const loginUrl = new URL('/dashboard/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}
