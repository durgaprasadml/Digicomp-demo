const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
const MODEL = process.env.AI_MODEL || "qwen3.5:0.8b";

const SYSTEM_PROMPT = `You are DigiComp AI, an expert conversational assistant for DigiComp, an electronics and microcontroller distributor.
Answer user questions naturally, conversationally, and concisely.
Maintain full conversation context across multi-turn messages.

If the user is looking for DigiComp products, components for a project, pricing, or recommendations, specify a tool request in your response or return JSON:
{"tool": "search_digicomp_products", "query": "search query", "max_price": null}

If no products are needed (e.g. general questions like "Hello", "Who invented the transistor?", "What is Ohm's law?"), answer directly with text.`;

function parseQwenResponse(msg, userQuery) {
  const content = (msg.content || "").trim();
  const thinking = (msg.thinking || "").trim();
  const fullText = content ? content : thinking;

  console.log(`\n--- RAW MODEL OUTPUT ---`);
  console.log(`Content: "${content}"`);
  console.log(`Thinking preview: "${thinking.substring(0, 150)}..."`);

  // Check if tool call requested in JSON
  const jsonMatch = fullText.match(/\{[\s\S]*?\}/);
  let toolQuery = null;
  let maxPrice = null;

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.tool === "search_digicomp_products" || parsed.query) {
        toolQuery = parsed.query;
        maxPrice = parsed.max_price;
      }
    } catch { }
  }

  // Regex tool detection from thinking
  if (!toolQuery) {
    const searchMatch = thinking.match(/(?:search|query|product|find)[^"']*["']([^"']+)["']/i);
    if (searchMatch && !userQuery.toLowerCase().includes("hello") && !userQuery.toLowerCase().includes("invented")) {
      toolQuery = searchMatch[1];
    }
  }

  // Extract clean text answer
  let textAnswer = content;
  if (!textAnswer) {
    // Extract last 1-3 sentences from thinking or summary
    const cleanThinking = thinking.replace(/Okay, user|Let me think|I should|First, I need/gi, "").trim();
    textAnswer = cleanThinking.substring(0, 250);
  }

  return {
    textAnswer,
    toolQuery,
    maxPrice
  };
}

async function testQuery(prompt) {
  console.log(`\n==========================================`);
  console.log(`[USER]: "${prompt}"`);
  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        stream: false,
        options: { temperature: 0.1, num_predict: 250 }
      })
    });
    const data = await res.json();
    const result = parseQwenResponse(data.message || {}, prompt);
    console.log(`[PARSED ANSWER]: "${result.textAnswer}"`);
    console.log(`[TOOL QUERY]: ${result.toolQuery}`);
    console.log(`[MAX PRICE]: ${result.maxPrice}`);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

async function run() {
  await testQuery("Hello");
  await testQuery("Who invented the transistor?");
  await testQuery("What is an ESP32?");
  await testQuery("I need an ESP32 under ₹500");
}

run();
