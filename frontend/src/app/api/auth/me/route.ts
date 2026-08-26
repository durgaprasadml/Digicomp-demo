import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const authData = getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    return NextResponse.json({
      user: authData.user,
      expires_at: authData.session.expires_at,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Authentication check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
