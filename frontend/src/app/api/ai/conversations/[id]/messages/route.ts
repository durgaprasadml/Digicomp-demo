import { NextRequest, NextResponse } from 'next/server';
import { save_chat_message } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authData = getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to save chat messages.' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const body = await request.json();
    const messageId = body.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const role = body.role === 'user' ? 'user' : 'assistant';
    const content = (body.content || body.text || '').trim();
    const productIds = Array.isArray(body.product_ids)
      ? body.product_ids
      : (Array.isArray(body.products) ? body.products.map((p: { id: number }) => p.id) : undefined);
    const createdAt = body.created_at || new Date().toISOString();

    if (!content && (!productIds || productIds.length === 0)) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const savedMsg = save_chat_message({
      id: messageId,
      conversation_id: resolvedParams.id,
      role,
      content,
      product_ids: productIds,
      created_at: createdAt,
      user_id: authData.user.id,
    });

    return NextResponse.json(savedMsg, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
