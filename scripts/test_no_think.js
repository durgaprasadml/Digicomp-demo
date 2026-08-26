const MODEL = process.env.AI_MODEL || "gemma3:270m";

const SYSTEM_PROMPT = `You are DigiComp AI, a helpful conversational assistant for DigiComp — an electronics and microcontroller store.

Answer any user question naturally and conversationally. Maintain full conversation context.

PRODUCT SEARCH RULE:
When relevant, append exactly one line at end of response:
SEARCH_PRODUCTS: <search query>
or: SEARCH_PRODUCTS: <search query> MAX_PRICE: <number>`;

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
        { role: "user", content: `/no_think ${userMessage}` }
      ],
      stream: false,
      options: { temperature: 0.3, num_predict: 512 }
    })
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const data = await res.json();
  const msg = data.message || {};
  console.log(`[${elapsed}s] thinking: ${(msg.thinking || "").length} chars`);
  console.log(`[${elapsed}s] content: "${(msg.content || "").substring(0, 300)}"`);
  return msg;
}

async function run() {
  console.log("=== /no_think SPEED TEST ===");
  await ask("I need to built an 3d printer");
  await ask("I found an old DC motor. Can I use it in a 3D printer?");
  await ask("Hello");
  await ask("Who invented the transistor?");
  console.log("\n=== DONE ===");
}

run().catch(console.error);
