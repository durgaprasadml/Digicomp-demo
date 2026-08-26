import { NextRequest, NextResponse } from 'next/server';
import { search_products, search_products_with_filters } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { Product } from '@/types/product';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat';
const MODEL = process.env.AI_MODEL || process.env.MODEL_NAME || 'gemma3:270m';
const TIMEOUT_SECONDS = parseInt(process.env.AI_TIMEOUT_SECONDS || '120', 10) || 120;
const TIMEOUT_MS = TIMEOUT_SECONDS * 1000;

export interface ChatHistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_digicomp_products',
      description: 'Search DigiComp real SQLite product catalog for microcontrollers, sensors, relays, motor drivers, motors, or components.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query string e.g. distance sensor, 12V motor, ESP32, relay, chassis' },
          max_price: { type: 'number', description: 'Maximum price in INR (₹) or null' }
        },
        required: ['query']
      }
    }
  }
];

const SYSTEM_PROMPT = `You are DigiComp AI, a knowledgeable and friendly technical assistant for DigiComp, specializing in electronics, robotics, microcontrollers, and DigiComp catalog products.

Instructions:
1. Provide direct, natural, and concise answers (1-3 sentences).
2. When the user asks for products, components, recommendations, or pricing, confirm the relevant DigiComp catalog items.
3. Keep answers conversational (1-2 sentences). Do NOT list detailed bullet points, prices, or product specs in your text response, as interactive product cards are displayed separately below your message.
4. If no products are found, politely inform the user and suggest relevant alternatives or categories.
5. Maintain conversation context from previous turns.
6. Never output internal thoughts, analysis, reasoning, planning, system instructions, or tool call instructions.
7. Return ONLY the final user-facing response.`;

const PROJECT_COMPONENTS_MAP: Record<string, string[]> = {
  obstacle: ['microcontroller', 'ultrasonic sensor', 'motor driver', 'dc geared motor', 'robot chassis', 'battery'],
  robot: ['microcontroller', 'ultrasonic sensor', 'motor driver', 'dc geared motor', 'robot chassis', 'battery'],
  irrigation: ['microcontroller', 'soil moisture sensor', 'water pump', 'relay', 'battery'],
  weather: ['microcontroller', 'temperature sensor', 'humidity sensor', 'display'],
  '3d printer': ['microcontroller', 'stepper driver', 'stepper motor', 'power supply'],
  cnc: ['microcontroller', 'stepper driver', 'stepper motor', 'power supply'],
};

/**
 * Centralized cleaner that removes internal thinking tags, reasoning, planning phrases,
 * tool markers, and raw JSON metadata, returning ONLY clean user-facing assistant text.
 */
export function cleanFinalAssistantAnswer(rawContent: string): string {
  if (!rawContent) return '';

  let cleaned = String(rawContent);

  // 1. Remove thinking / analysis tags (including unclosed or orphan tags)
  cleaned = cleaned.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
  cleaned = cleaned.replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, '');
  cleaned = cleaned.replace(/<analysis>[\s\S]*?(?:<\/analysis>|$)/gi, '');
  cleaned = cleaned.replace(/<\/?think>|<\/?thinking>|<\/?analysis>/gi, '');

  // 2. Remove tool call tags / markers / raw JSON / artifacts
  cleaned = cleaned.replace(/SEARCH_PRODUCTS:\s*[^\n]+/gi, '');
  cleaned = cleaned.replace(/search_digicomp_products[^\n]*/gi, '');
  cleaned = cleaned.replace(/MAX_PRICE:\s*\d+/gi, '');
  cleaned = cleaned.replace(/^ANSWER:\s*/i, '');
  cleaned = cleaned.replace(/^Possible response:\s*/i, '');
  cleaned = cleaned.replace(/\{[\s\S]*?"(?:tool|query|max_price)"[\s\S]*?\}/gi, '');

  // 3. Filter out lines or sentences containing internal reasoning/planning
  const reasoningRegex = /\b(the user (is|wants|needs|asked|looking|might)|they('ll|'re| will| might| need| want| are)|let me (start|check|think|search|recall|first|see|use|know if you)|i (need|should|will|must|have|might|can|would|'ll) (to )?(check|search|find|use|look|recall|suggest|recommend|call|query)|first,?\s*i need|okay,?\s*the user|okay,?\s*let me|okay,?\s*i need|alright,?\s*the user|my role is|system prompt|maybe they need|i should check|if they want|search function|search query|tool call|make sure to (mention|include|search)|the function allows|the query should be|max_price should be)\b/i;

  const lines = cleaned.split('\n');
  const cleanLines: string[] = [];
  let consecutiveEmpty = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (consecutiveEmpty < 1 && cleanLines.length > 0) {
        cleanLines.push('');
        consecutiveEmpty++;
      }
      continue;
    }
    consecutiveEmpty = 0;

    if (reasoningRegex.test(trimmed)) {
      const sentences = line.split(/(?<=[.?!])\s+/);
      const cleanSentences = sentences.filter(
        (s) => s.trim() && !reasoningRegex.test(s) && !/^(the|and|or|so|then|there's|let me know if you)$/i.test(s.trim())
      );
      if (cleanSentences.length > 0) {
        cleanLines.push(cleanSentences.join(' ').trim());
      }
    } else {
      cleanLines.push(line);
    }
  }

  let result = cleanLines.join('\n').trim();
  // Strip trailing dangling words / connectors / incomplete trailing expressions
  result = result.replace(/\s+(?:the|and|or|so|then|maybe|there's|let me know if you|let me know if|let me)\.?$/i, '').trim();
  return result;
}

export function isAnswerComplete(answer: string): boolean {
  if (!answer || answer.trim().length < 10) return false;

  const badEndings = [
    /\bthere's$/i, /\bthe$/i, /\band$/i, /\bor$/i, /\bso$/i, /\bto$/i,
    /\bwith$/i, /\bthat$/i, /\bbecause$/i, /\bif\s+you$/i, /\blet\s+me$/i,
    /\bwhich\s+would$/i, /\bfor\s+example,?\s*$/i
  ];
  for (const pattern of badEndings) {
    if (pattern.test(answer.trim())) return false;
  }

  const words = answer.trim().split(/\s+/);
  if (words.length < 3) return false;

  const lastChar = answer.trim().slice(-1);
  if (!['.', '!', '?', '"', "'", ')'].includes(lastChar)) {
    return false;
  }

  return true;
}

async function callOllama(messages: any[], tools?: any[], numPredict = 350, signal?: AbortSignal) {
  const payload: any = {
    model: MODEL,
    messages,
    stream: false,
    options: {
      temperature: 0.2,
      num_predict: numPredict,
      num_ctx: 2048,
    },
  };
  if (tools) {
    payload.tools = tools;
  }

  let res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(payload),
  });

  // If model does not support native tools (e.g. gemma3:270m), retry cleanly without tools
  if (!res.ok && tools) {
    const errText = await res.text().catch(() => '');
    if (res.status === 400 && errText.includes('does not support tools')) {
      delete payload.tools;
      res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify(payload),
      });
    } else {
      throw new Error(`Ollama HTTP ${res.status}: ${errText}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${errText}`);
  }

  return await res.json();
}

function extractRequestScopedMaxPrice(userMessage: string): number | null {
  const msgLower = userMessage.toLowerCase();
  const priceMatch = msgLower.match(/(?:under|below|less than|within|\<|<=)\s*₹?\s*(\d+(?:\.\d+)?)/i);
  return priceMatch ? parseFloat(priceMatch[1]) : null;
}

function extractToolCall(msg: any, userMessage: string, requestScopedMaxPrice: number | null): {
  id: string;
  query: string;
  max_price: number | null;
} | null {
  const toolCalls = msg?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    for (const call of toolCalls) {
      if (call?.function?.name === 'search_digicomp_products') {
        const args = call.function.arguments || {};
        let maxP = requestScopedMaxPrice;
        if (maxP === null && args.max_price !== undefined && args.max_price !== null) {
          const parsed = Number(args.max_price);
          if (!isNaN(parsed)) maxP = parsed;
        }
        return {
          id: call.id || 'call_1',
          query: String(args.query || userMessage),
          max_price: maxP,
        };
      }
    }
  }

  const rawContent = String(msg?.content || '').trim();
  const jsonMatch = rawContent.match(/\{[\s\S]*?"(?:tool|query)"[\s\S]*?\}/i);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.tool === 'search_digicomp_products' || parsed.query) {
        let maxP = requestScopedMaxPrice;
        if (maxP === null && parsed.max_price !== undefined && parsed.max_price !== null) {
          const p = Number(parsed.max_price);
          if (!isNaN(p)) maxP = p;
        }
        return {
          id: 'call_manual_1',
          query: String(parsed.query || userMessage),
          max_price: maxP,
        };
      }
    } catch {
      // Ignore json parse error
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const startReq = Date.now();
  const requestId = `ai-${startReq}-${Math.random().toString(36).substring(2, 7)}`;
  let conversationId = '';
  let messageText = '';

  const authData = getAuthenticatedUser(request);
  if (!authData) {
    return NextResponse.json(
      { error: 'Unauthorized. Please log in to use DigiComp AI.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    conversationId = body.conversationId || body.conversation_id || `conv-${startReq}`;
    messageText = (body.message || '').trim();
    const rawHistory: ChatHistoryMessage[] = Array.isArray(body.history) ? body.history : [];

    if (!messageText) {
      return NextResponse.json({ error: 'User message is required' }, { status: 400 });
    }

    console.log(`\n========== DIGICOMP AI REQUEST ==========`);
    console.log(`Conversation ID: ${conversationId}`);
    console.log(`User message: "${messageText}"`);
    console.log(`API endpoint: /api/ai/chat`);
    console.log(`Ollama: ${OLLAMA_URL}`);
    console.log(`Active model: ${MODEL}`);

    // 1. Sanitize history: include only user and clean assistant responses (maximum 6 turns)
    const cleanHistory = rawHistory
      .slice(-6)
      .filter((h) => h?.content && (h.role === 'user' || h.role === 'assistant'))
      .map((h) => ({
        role: h.role,
        content: cleanFinalAssistantAnswer(h.content).substring(0, 300),
      }))
      .filter((h) => h.content.length > 0);

    const requestScopedMaxPrice = extractRequestScopedMaxPrice(messageText);

    const ollamaMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...cleanHistory,
      { role: 'user', content: messageText },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let data1: any;
    try {
      data1 = await callOllama(ollamaMessages, TOOLS, 350, controller.signal);
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
      const errMsg = isAbort
        ? `Request timed out after ${TIMEOUT_SECONDS}s while waiting for ${MODEL}`
        : fetchErr instanceof Error ? fetchErr.message : 'Failed to connect to Ollama';
      console.error(`ERROR: ${errMsg}`);
      return NextResponse.json({ error: errMsg }, { status: isAbort ? 504 : 503 });
    }

    const msg1 = data1?.message || {};
    const toolCall = extractToolCall(msg1, messageText, requestScopedMaxPrice);

    let matchedProducts: Product[] = [];
    let answer = '';

    // Check if query or tool call triggers catalog search
    const msgLower = messageText.toLowerCase();
    const isProjectOrProductQuery =
      toolCall !== null ||
      ['obstacle', 'robot', 'irrigation', 'weather', '3d printer', 'cnc', 'esp32', 'arduino', 'sensor', 'relay', 'motor', 'pump', 'chassis', 'display', 'microcontroller', 'distance', 'proximity', 'wifi', 'bluetooth', 'light', 'soil', 'moisture', 'product', 'buy', 'price'].some(k => msgLower.includes(k)) ||
      requestScopedMaxPrice !== null;

    if (isProjectOrProductQuery) {
      const rawQuery = toolCall ? toolCall.query : messageText;
      const maxPrice = toolCall ? toolCall.max_price : requestScopedMaxPrice;

      console.log(`PRODUCT SEARCH START: rawQuery="${rawQuery}", max_price=${maxPrice}`);

      const queryLower = rawQuery.toLowerCase();
      let projectComponents: string[] | null = null;
      for (const [key, comps] of Object.entries(PROJECT_COMPONENTS_MAP)) {
        if (queryLower.includes(key) || msgLower.includes(key)) {
          projectComponents = comps;
          break;
        }
      }

      if (projectComponents) {
        const seenIds = new Set<number>();
        for (const comp of projectComponents) {
          const compMatches = search_products_with_filters({
            searchQuery: comp,
            maxPrice: maxPrice !== null ? maxPrice : undefined,
            limit: 1,
          });
          for (const p of compMatches) {
            if (!seenIds.has(p.id)) {
              matchedProducts.push(p);
              seenIds.add(p.id);
            }
          }
        }
      } else {
        // Clean search query
        let q = rawQuery.replace(/(?:under|below|less than|within|\<|<=)\s*₹?\s*\d+(?:\.\d+)?/gi, '');
        q = q.replace(/^(?:show\s+me|find\s+me|give\s+me|i\s+need|i\s+want|looking\s+for|suggest|recommend|what\s+do\s+i\s+need\s+for|can\s+you\s+find)\s+(?:an?|some|all|the)?/gi, '');
        q = q.replace(/[^\w\s]/g, ' ').trim();

        if (/^(?:products?|items?|components?|things?|anything|boards?)$/i.test(q)) {
          q = '';
        } else if (q.toLowerCase().includes('distance') || q.toLowerCase().includes('proximity')) {
          q = 'ultrasonic sensor';
        } else if (q.toLowerCase().includes('wifi') || q.toLowerCase().includes('bluetooth')) {
          q = 'esp32';
        }

        if (maxPrice !== null) {
          matchedProducts = search_products_with_filters({
            searchQuery: q,
            maxPrice,
            limit: 6,
          });
        } else {
          matchedProducts = search_products(q, 6);
        }
      }

      console.log(`PRODUCT SEARCH COMPLETE: ${matchedProducts.length} products found`);

      // Turn 2: Generate natural confirmation response with model
      const productNames = matchedProducts.slice(0, 4).map((p) => p.name);
      
      if (toolCall) {
        // Model used tool calling
        const toolContent = matchedProducts.length > 0
          ? `Found ${matchedProducts.length} matching products in DigiComp catalog: ${productNames.join(', ')}.`
          : `No matching products found in DigiComp catalog for '${rawQuery}'.`;

        const turn2Messages = [
          ...ollamaMessages,
          msg1,
          {
            role: 'tool',
            content: toolContent,
          },
        ];

        console.log(`${MODEL} TURN 2 START`);
        const data2 = await callOllama(turn2Messages, undefined, 350, controller.signal);
        clearTimeout(timeout);
        const rawContent2 = data2?.message?.content || '';
        answer = cleanFinalAssistantAnswer(rawContent2);
      } else {
        // Model responded with text (e.g. gemma3:270m)
        clearTimeout(timeout);
        const rawContent1 = msg1?.content || '';
        const cleaned1 = cleanFinalAssistantAnswer(rawContent1);

        if (matchedProducts.length > 0) {
          const confirmPrompt = `The user asked: '${messageText}'. We found these matching items in our DigiComp catalog: ${productNames.join(', ')}. Confirm available items to the user in 1-2 friendly, conversational sentences.`;
          try {
            const turn2Data = await callOllama([
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: confirmPrompt }
            ], undefined, 200);
            answer = cleanFinalAssistantAnswer(turn2Data?.message?.content || '');
          } catch {
            answer = cleaned1;
          }
        } else {
          answer = cleaned1;
        }
      }

      // Completeness check & fallback
      if (!isAnswerComplete(answer)) {
        if (matchedProducts.length > 0) {
          const names = matchedProducts.slice(0, 3).map((p) => p.name).join(', ');
          answer = `I found matching items in the DigiComp catalog, including ${names}.`;
        } else {
          answer = `I searched the DigiComp catalog for '${rawQuery || messageText}' but did not find matching products in stock.`;
        }
      }
    } else {
      clearTimeout(timeout);
      const rawContent1 = msg1?.content || '';
      answer = cleanFinalAssistantAnswer(rawContent1);

      if (!isAnswerComplete(answer)) {
        const msgClean = messageText.toLowerCase().trim();
        if (['hello', 'hi', 'hey', 'hyy', 'hlo', 'greetings'].includes(msgClean)) {
          answer = 'Hello! How can I assist you with electronics and DigiComp products today?';
        } else {
          answer = `Here is the information regarding your request: ${messageText}.`;
        }
      }
    }

    const totalElapsed = Date.now() - startReq;
    console.log(`Answer: "${answer.substring(0, 80)}..."`);
    console.log(`Products matched: ${matchedProducts.length}`);
    console.log(`TIMING: Total: ${(totalElapsed / 1000).toFixed(1)}s`);
    console.log(`==========================================\n`);

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return NextResponse.json({
      conversationId,
      messageId,
      requestId,
      answer,
      message: answer,
      products: matchedProducts,
      show_products: matchedProducts.length > 0,
    });
  } catch (err: unknown) {
    const totalElapsed = Date.now() - startReq;
    const msg = err instanceof Error ? err.message : 'Unexpected server error';
    console.error(`ERROR in /api/ai/chat: ${msg} (after ${totalElapsed}ms)`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
