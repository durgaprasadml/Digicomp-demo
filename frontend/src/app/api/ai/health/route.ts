import { NextResponse } from 'next/server';

const OLLAMA_TAGS_URL = process.env.OLLAMA_TAGS_URL || 'http://127.0.0.1:11434/api/tags';
const TARGET_MODEL = process.env.AI_MODEL || process.env.MODEL_NAME || 'qwen3.5:0.8b';

export async function GET() {
  try {
    const res = await fetch(OLLAMA_TAGS_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          backend: 'ok',
          ollama: 'error',
          model: TARGET_MODEL,
          ready: false,
          error: `Ollama returned HTTP ${res.status}`,
        },
        { status: 503 }
      );
    }

    const data = await res.json();
    const models: Array<{ name?: string; model?: string }> = Array.isArray(data?.models) ? data.models : [];
    const hasModel = models.some(
      (m) => m.name === TARGET_MODEL || m.model === TARGET_MODEL || (m.name && m.name.startsWith(TARGET_MODEL))
    );

    if (!hasModel) {
      return NextResponse.json(
        {
          backend: 'ok',
          ollama: 'ok',
          model: TARGET_MODEL,
          ready: false,
          error: `Model ${TARGET_MODEL} not found in Ollama tags`,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      backend: 'ok',
      ollama: 'ok',
      model: TARGET_MODEL,
      ready: true,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unable to connect to Ollama';
    return NextResponse.json(
      {
        backend: 'ok',
        ollama: 'unreachable',
        model: TARGET_MODEL,
        ready: false,
        error: errorMsg,
      },
      { status: 503 }
    );
  }
}
