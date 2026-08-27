const SYSTEM_PROMPT = `You are DigiComp AI, an expert technical assistant for electronics and microcontrollers.
Analyze the user request and return ONLY valid JSON matching this schema:
{
  "answer": "A short 1-3 sentence natural language explanation.",
  "intent": "conversation|general_question|technical_question|product_search|project_request",
  "search_products": true,
  "search_query": "string or null",
  "components": [],
  "filters": { "max_price": null, "in_stock": true, "category": null }
}
`;

async function testFetch(prompt) {
  console.log(`[TEST PROMPT]: "${prompt}"`);
  const start = Date.now();
  try {
    const res = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "qwen3.5:0.8b",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        stream: false,
        format: "json",
        options: { temperature: 0.0, num_predict: 500 }
      })
    });

    console.log(`Status: ${res.status} (${Date.now() - start}ms)`);
    const data = await res.json();
    console.log("Qwen output:", JSON.stringify(data.message));
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

testFetch("What is a sensor?");
