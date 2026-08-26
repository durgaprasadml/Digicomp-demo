// Directly tests Ollama with think:false to confirm message.content is always populated
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
const MODEL = process.env.AI_MODEL || "gemma3:270m";

const SYSTEM_PROMPT = `/no_think
You are DigiComp AI, a helpful conversational assistant for DigiComp — an electronics and microcontroller e-commerce store.
Answer any user question naturally and conversationally.
Keep answers concise. When relevant, call search_digicomp_products.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_digicomp_products",
      description: "Search DigiComp's real product catalog for electronics components.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term e.g. stepper motor, ESP32" },
          max_price: { type: "number", description: "Max price in INR" }
        },
        required: ["query"]
      }
    }
  }
];

async function ask(userMessage, history = []) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage }
  ];

  console.log(`\n[USER]: "${userMessage}"`);
  const start = Date.now();

  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      stream: false,
      think: false,
      options: { temperature: 0.3, num_predict: 400 }
    })
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const data = await res.json();
  const msg = data.message || {};

  console.log(`[${elapsed}s] content: "${(msg.content || "").substring(0, 200)}"`);
  if (msg.tool_calls?.length > 0) {
    console.log(`[TOOL CALLS]:`, JSON.stringify(msg.tool_calls, null, 2));
  }
  if (msg.thinking) {
    console.log(`[WARNING] model still produced thinking despite think:false`);
  }
  return msg;
}

async function run() {
  console.log("=== DIGICOMP AI: think:false VERIFICATION TEST ===");

  // Test 1: Arbitrary unseen question — must NOT produce "Here is technical information regarding"
  await ask("I need to built an 3d printer");

  // Test 2: Another completely new unseen question
  await ask("I found an old DC motor. Can I use it in a 3D printer?");

  // Test 3: Follow-up — model must use context
  const history = [];
  const r1 = await ask("What is an ESP32?");
  history.push({ role: "user", content: "What is an ESP32?" });
  history.push({ role: "assistant", content: r1.content || "" });
  await ask("Can I use it for robotics?", history);

  // Test 4: General question — should NOT search products
  await ask("Who invented the transistor?");

  // Test 5: Product search should trigger tool call
  await ask("I need an ESP32 under ₹500");

  console.log("\n=== TEST COMPLETE ===");
}

run().catch(console.error);
