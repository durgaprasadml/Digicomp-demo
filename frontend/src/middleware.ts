import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Protect /ai routes
  if (pathname.startsWith('/ai')) {
    const sessionCookie = request.cookies.get('digicomp_session')?.value;

    if (!sessionCookie) {
      const fullPath = pathname + search;
      const loginUrl = new URL(`/login?redirect=${encodeURIComponent(fullPath)}`, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/ai/:path*', '/ai'],
};
