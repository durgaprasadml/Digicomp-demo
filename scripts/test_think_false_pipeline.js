// Tests think:false via the /api/ai/chat endpoint (requires Next.js dev server on :3000)
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
    console.log(`  PRODUCTS (${data.products.length}): ${data.products.map(p => `${p.name} (₹${p.price})`).join(', ')}`);
  }
  return data;
}

async function run() {
  console.log("=== THINK:FALSE PIPELINE TEST ===");

  // THE ORIGINAL FAILING CASE — must NOT return "Here is technical information regarding..."
  await ask("I need to built an 3d printer");

  // Another unseen complex question
  await ask("I found an old DC motor. Can I use it in a 3D printer?");

  // Multi-turn
  const history = [];
  const r1 = await ask("What is an ESP32?");
  if (r1?.answer) {
    history.push({ role: "user", content: "What is an ESP32?" });
    history.push({ role: "assistant", content: r1.answer });
    const r2 = await ask("Can I use it for robotics?", history);
    if (r2?.answer) {
      history.push({ role: "user", content: "Can I use it for robotics?" });
      history.push({ role: "assistant", content: r2.answer });
      await ask("What parts would I need?", history);
    }
  }

  // Price constraint with product search
  await ask("I need an ESP32 under ₹500");

  // General knowledge — should NOT search products
  await ask("Who invented the transistor?");

  // Greeting
  await ask("Hello");

  console.log("\n=== DONE ===");
}

run().catch(console.error);
