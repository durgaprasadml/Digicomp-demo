import { NextRequest, NextResponse } from 'next/server';
import { get_conversation_by_id, update_conversation_title, delete_conversation } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authData = getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to view this conversation.' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const conversation = get_conversation_by_id(resolvedParams.id, authData.user.id);

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch conversation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authData = getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to edit this conversation.' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const body = await request.json();
    const title = (body.title || '').trim();

    if (!title) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }

    const success = update_conversation_title(resolvedParams.id, title, authData.user.id);
    if (!success) {
      return NextResponse.json({ error: 'Conversation not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: resolvedParams.id, title });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update conversation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authData = getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to delete this conversation.' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const success = delete_conversation(resolvedParams.id, authData.user.id);

    if (!success) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: resolvedParams.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete conversation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
