async function sendReq(message, history = []) {
  const start = Date.now();
  const res = await fetch("http://localhost:3000/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history })
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.log(`STATUS ${res.status} (${elapsed}s):`, err);
    return null;
  }

  const data = await res.json();
  console.log(`STATUS ${res.status} (${elapsed}s)`);
  console.log(`- Answer: "${data.answer}"`);
  console.log(`- Products (${data.products?.length || 0}):`, (data.products || []).map(p => `${p.name} (₹${p.price})`));
  return data;
}

async function runAcceptanceTests() {
  console.log("=== EXECUTING DIGICOMP AI ASSISTANT ACCEPTANCE TESTS (SECTION 21) ===\n");

  console.log("--- TEST 1: Hello ---");
  await sendReq("Hello");

  console.log("\n--- TEST 2: Who invented the transistor? ---");
  await sendReq("Who invented the transistor?");

  console.log("\n--- TEST 3: What is a sensor? ---");
  await sendReq("What is a sensor?");

  console.log("\n--- TEST 4: What is an ESP32? ---");
  await sendReq("What is an ESP32?");

  console.log("\n--- TEST 5: I want to build an obstacle avoiding robot. ---");
  await sendReq("I want to build an obstacle avoiding robot.");

  console.log("\n--- TEST 6: I need an ESP32 under ₹500. ---");
  await sendReq("I need an ESP32 under ₹500.");

  console.log("\n--- TEST 7: Multi-Turn Follow-Up Questions ---");
  const history7 = [];
  console.log("Turn 7.1: 'What is an ESP32?'");
  const r1 = await sendReq("What is an ESP32?", history7);
  if (r1) {
    history7.push({ role: "user", content: "What is an ESP32?" });
    history7.push({ role: "assistant", content: r1.answer });
  }

  console.log("Turn 7.2: 'Can I use it for robotics?'");
  const r2 = await sendReq("Can I use it for robotics?", history7);
  if (r2) {
    history7.push({ role: "user", content: "Can I use it for robotics?" });
    history7.push({ role: "assistant", content: r2.answer });
  }

  console.log("Turn 7.3: 'Which DigiComp motor driver would work with it?'");
  await sendReq("Which DigiComp motor driver would work with it?", history7);

  console.log("\n--- TEST 8: Arbitrary Unseen Question: 'What is a capacitor?' ---");
  await sendReq("What is a capacitor?");

  console.log("\n=== ALL 8 ACCEPTANCE TESTS EXECUTED ===");
}

runAcceptanceTests();
