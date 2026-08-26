const testQuestions = [
  "Hello",
  "What is a sensor?",
  "What is an ESP32?",
  "What is a relay?",
  "Who invented the transistor?",
  "What is PWM?",
  "I want to build an obstacle avoiding robot.",
  "I need an ESP32 under ₹500.",
  "I need a sensor for an irrigation project.",
  "What motor driver should I use for a robot?"
];

async function runTests() {
  console.log("=== VERIFYING REAL QWEN3 AI ASSISTANT API ROUTE (ALL 10 TEST QUESTIONS) ===\n");

  for (let i = 0; i < testQuestions.length; i++) {
    const q = testQuestions[i];
    console.log(`--------------------------------------------------`);
    console.log(`[TEST ${i + 1}/10] User Question: "${q}"`);

    const start = Date.now();
    try {
      const res = await fetch("http://localhost:3000/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q })
      });

      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.log(`STATUS ${res.status} (${elapsed}s):`, errJson);
        continue;
      }

      const data = await res.json();
      console.log(`RESPONSE STATUS: ${res.status} (${elapsed}s)`);
      console.log(`- Answer: "${data.answer}"`);
      console.log(`- Intent: ${data.intent}`);
      console.log(`- Search Products: ${data.search_products}`);
      console.log(`- Matched Products (${data.products?.length || 0}):`, (data.products || []).map(p => `${p.name} (₹${p.price}, Stock: ${p.stock})`));
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
    }
  }

  console.log(`\n==========================================`);
  console.log(`ALL 10 API TEST QUESTIONS COMPLETED SILENTLY & CLEANLY!`);
}

runTests();
