// Direct Ollama test: verify ANSWER: marker + think:false + num_predict:200
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
const MODEL = process.env.AI_MODEL || "gemma3:270m";

const SYSTEM_PROMPT = `You are DigiComp AI, a helpful electronics assistant for DigiComp store.

RESPONSE FORMAT — follow this exactly:
ANSWER: <your 1-3 sentence direct answer here>
SEARCH_PRODUCTS: <search query>

Rules:
- The ANSWER: line must be the very first thing you write.
- Keep the answer to 1-3 sentences maximum. Be concise and direct.
- Do NOT include internal thinking, reasoning steps, or "let me think" monologue.
- Only add SEARCH_PRODUCTS: when relevant (product requests, project builds, pricing).
- Do NOT add SEARCH_PRODUCTS: for greetings or pure general knowledge.

Examples:
User: "What is an ESP32?"
ANSWER: The ESP32 is a low-cost microcontroller with built-in Wi-Fi and Bluetooth, widely used in IoT and robotics projects.
SEARCH_PRODUCTS: ESP32

User: "Who invented the transistor?"
ANSWER: The transistor was invented in 1947 by John Bardeen, Walter Brattain, and William Shockley at Bell Labs.

User: "Hello"
ANSWER: Hello! I'm DigiComp AI. Ask me anything about electronics or components!`;

async function ask(userMessage) {
  console.log(`\n[USER]: "${userMessage}"`);
  const start = Date.now();

  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage }
      ],
      stream: false,
      think: false,
      options: { temperature: 0.3, num_predict: 200 }
    })
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const data = await res.json();
  const raw = data.message?.content || "";
  console.log(`[${elapsed}s] RAW OUTPUT:\n${raw}`);
  return raw;
}

async function run() {
  console.log("=== ANSWER: FORMAT DIRECT TEST ===\n");

  // Critical: must produce a real answer with ANSWER: prefix
  await ask("I need to built an 3d printer");
  await ask("I found an old DC motor. Can I use it in a 3D printer?");
  await ask("What is an ESP32?");
  await ask("Who invented the transistor?");
  await ask("I need an ESP32 under ₹500");
  await ask("Hello");

  console.log("\n=== DONE ===");
}

run().catch(console.error);
