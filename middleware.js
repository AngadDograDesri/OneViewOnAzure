import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  if (searchParams.get('pdf') === 'true') {
    console.log('PDF mode detected - bypassing authentication');
    return NextResponse.next();
  }
  
  // Check if user is authenticated
  const authToken = request.cookies.get('authToken')?.value || 
                    request.headers.get('authorization');

  // Public routes that don't require authentication
  const publicRoutes = ['/login'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // If trying to access protected route without auth, redirect to login
  if (!isPublicRoute && !authToken) {
    // Check if there's a token in the request (for client-side)
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // If already authenticated and trying to access login, redirect to home
  if (pathname === '/login' && authToken) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
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
    '/((?!api|_next/static|_next/image|favicon.ico|assets).*)',
  ],
};