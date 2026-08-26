import { NextRequest, NextResponse } from 'next/server';
import { delete_session } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('digicomp_session')?.value;
    if (cookieToken) {
      delete_session(cookieToken);
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.substring(7).trim();
      if (bearerToken) {
        delete_session(bearerToken);
      }
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

    // Clear session cookie
    response.cookies.set('digicomp_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
