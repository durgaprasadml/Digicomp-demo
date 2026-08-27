const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
const MODEL = process.env.AI_MODEL || "qwen3.5:0.8b";

const SYSTEM_PROMPT = `You are DigiComp AI, an expert conversational assistant for DigiComp, an electronics and microcontroller distributor.
Answer user questions naturally, conversationally, and concisely.
Maintain full conversation context.
You have access to a tool \`search_digicomp_products\` to query DigiComp's product catalog.
Only use the tool when product recommendations, component shopping, or pricing/stock is relevant.
Never invent prices, stock, or store links.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_digicomp_products",
      description: "Search DigiComp's real SQLite product database for microcontrollers, sensors, relays, motor drivers, or components.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query string e.g. ESP32, sensor, relay" },
          max_price: { type: "number", description: "Max price in INR (₹) or null" }
        },
        required: ["query"]
      }
    }
  }
];

async function testConversation(messagesHistory) {
  const fullMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messagesHistory
  ];

  console.log(`\n==========================================`);
  console.log(`[USER LATEST]: "${messagesHistory[messagesHistory.length - 1].content}"`);
  console.log(`[TOTAL MESSAGES IN HISTORY]: ${fullMessages.length}`);

  const start = Date.now();
  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: fullMessages,
        tools: TOOLS,
        stream: false,
        options: { temperature: 0.2, num_predict: 250 }
      })
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    if (!res.ok) {
      console.log(`Ollama Status Error: ${res.status}`);
      return;
    }

    const data = await res.json();
    const msg = data.message || {};
    console.log(`Ollama Response (${elapsed}s):`);
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      console.log(`- TOOL CALL DETECTED:`, JSON.stringify(msg.tool_calls, null, 2));
    }
    console.log(`- Content: "${(msg.content || '').trim()}"`);
    return msg;
  } catch (err) {
    console.error("Test Error:", err.message);
  }
}

async function runMultiTurnTest() {
  console.log(`=== TESTING MULTI-TURN CONVERSATION WITH REAL ${MODEL.toUpperCase()} ===`);

  // Turn 1
  const history = [{ role: "user", content: "What is an ESP32?" }];
  const resp1 = await testConversation(history);

  // Turn 2
  if (resp1) {
    history.push({ role: "assistant", content: resp1.content || "ESP32 is a microcontroller family with built-in Wi-Fi and Bluetooth." });
    history.push({ role: "user", content: "Can I use it for robotics?" });
    const resp2 = await testConversation(history);

    // Turn 3
    if (resp2) {
      history.push({ role: "assistant", content: resp2.content || "Yes, ESP32 can be used as the main controller for many robot projects." });
      history.push({ role: "user", content: "Which DigiComp product would you recommend?" });
      await testConversation(history);
    }
  }
}

runMultiTurnTest();
