import { NextRequest, NextResponse } from 'next/server';
import { get_all_conversations, create_conversation } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const authData = getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to view chat conversations.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('search') || undefined;

    const conversations = get_all_conversations(authData.user.id, query);
    return NextResponse.json(conversations);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch conversations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authData = getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to create conversations.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const id = body.id || `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const title = (body.title || 'New Chat').trim();

    const conversation = create_conversation(id, title, authData.user.id);
    return NextResponse.json(conversation, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create conversation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
