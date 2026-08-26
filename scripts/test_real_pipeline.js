// Tests the /api/ai/chat endpoint directly (no think:false, 45s timeout, num_predict:500)
async function ask(message, history = []) {
  console.log(`\n[USER]: "${message}"`);
  const start = Date.now();

  const res = await fetch("http://localhost:3000/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history })
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.log(`[${elapsed}s] ERROR ${res.status}:`, err.error || err);
    return null;
  }

  const data = await res.json();
  console.log(`[${elapsed}s] ANSWER: "${data.answer}"`);
  if (data.products?.length > 0) {
    console.log(`  PRODUCTS: ${data.products.map(p => `${p.name} (₹${p.price})`).join(', ')}`);
  }
  return data;
}

async function run() {
  console.log("=== DIGICOMP AI REAL PIPELINE TEST (no templates) ===");
  console.log("Check the Next.js server terminal for full Qwen3 debug logs\n");

  // THE KEY TEST: must NOT produce "Here is technical information regarding..."
  await ask("I need to built an 3d printer");

  // Completely unseen question from user's requirement
  await ask("I found an old DC motor. Can I use it in a 3D printer?");

  // Multi-turn follow-up
  const history = [];
  const r1 = await ask("What is an ESP32?");
  if (r1) {
    history.push({ role: "user", content: "What is an ESP32?" });
    history.push({ role: "assistant", content: r1.answer });
    const r2 = await ask("Can I use it for robotics?", history);
    if (r2) {
      history.push({ role: "user", content: "Can I use it for robotics?" });
      history.push({ role: "assistant", content: r2.answer });
      await ask("What parts would I need?", history);
    }
  }

  // Product search with price constraint
  await ask("I need an ESP32 under ₹500");

  // General knowledge — should NOT search products
  await ask("Who invented the transistor?");

  console.log("\n=== TEST COMPLETE ===");
}

run().catch(console.error);
