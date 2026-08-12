import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't need auth
  const publicRoutes = ['/', '/login']
  
  // Check if route is public
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    // Get auth token from cookie
    const token = request.cookies.get('auth_token')?.value
    const userRole = request.cookies.get('user_role')?.value

    if (!token) {
      // Not authenticated, redirect to login
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Role-based access control
    if (pathname.startsWith('/dashboard/coach') && userRole === 'parent') {
      return NextResponse.redirect(new URL('/dashboard/parent', request.url))
    }

    if (pathname.startsWith('/dashboard/parent') && ['coach', 'coach_admin'].includes(userRole || '')) {
      return NextResponse.redirect(new URL('/dashboard/coach', request.url))
    }

    // Restrict /dashboard/coach/users to coach_admin only
    if (pathname.startsWith('/dashboard/coach/users') && userRole !== 'coach_admin') {
      return NextResponse.redirect(new URL('/dashboard/coach', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
