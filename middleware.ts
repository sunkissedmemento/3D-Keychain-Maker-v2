import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('availer_session')
  const { pathname } = request.nextUrl

  // Already on login — redirect to home if authed
  if (pathname === '/login') {
    if (session) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  // Protected routes — redirect to login if no session
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login'],
}
