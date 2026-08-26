/**
 * Comprehensive End-to-End Test for DigiComp AI Assistant
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING DIGICOMP AI END-TO-END VERIFICATION');
  console.log(`Target: ${BASE_URL}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      console.log(`▶ Testing: ${name}...`);
      await fn();
      console.log(`✅ PASSED: ${name}\n`);
      passed++;
    } catch (err) {
      console.error(`❌ FAILED: ${name}`);
      console.error(err);
      console.log('');
      failed++;
    }
  }

  // 1. Health Check
  await test('AI Health Endpoint (/api/ai/health)', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('Health response:', data);
    if (!data.ready || data.ollama !== 'ok') {
      throw new Error(`Health not ready: ${JSON.stringify(data)}`);
    }
  });

  // 2. Test "Hello"
  await test('Prompt 1: "Hello"', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    console.log('Answer:', data.answer);
    console.log('Products count:', data.products?.length);
    if (!data.answer || data.answer.includes('<think>')) {
      throw new Error('Invalid answer received');
    }
  });

  // 3. Test "What is an ESP32?"
  await test('Prompt 2: "What is an ESP32?"', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is an ESP32?' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    console.log('Answer:', data.answer);
    console.log('Products:', data.products?.map((p) => `${p.name} (₹${p.price})`));
    if (!data.answer || !data.products || data.products.length === 0) {
      throw new Error('Expected answer and ESP32 products');
    }
  });

  // 4. Test "What is a relay?"
  await test('Prompt 3: "What is a relay?"', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is a relay?' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    console.log('Answer:', data.answer);
    console.log('Products:', data.products?.map((p) => `${p.name} (₹${p.price})`));
    if (!data.answer || !data.products || data.products.length === 0) {
      throw new Error('Expected answer and relay products');
    }
  });

  // 5. Test "I want to build an obstacle avoiding robot."
  await test('Prompt 4: "I want to build an obstacle avoiding robot."', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'I want to build an obstacle avoiding robot.' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    console.log('Answer:', data.answer);
    console.log('Products:', data.products?.map((p) => `${p.name} (₹${p.price})`));
    if (!data.answer || !data.products || data.products.length === 0) {
      throw new Error('Expected answer and robotics products');
    }
  });

  // 6. Test "I need an ESP32 under ₹500."
  await test('Prompt 5: "I need an ESP32 under ₹500."', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'I need an ESP32 under ₹500.' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    console.log('Answer:', data.answer);
    console.log('Products:', data.products?.map((p) => `${p.name} (₹${p.price})`));
    if (!data.products || data.products.length === 0) {
      throw new Error('Expected products under ₹500');
    }
    const overPriced = data.products.filter((p) => p.price > 500);
    if (overPriced.length > 0) {
      throw new Error(`Found products over ₹500: ${JSON.stringify(overPriced)}`);
    }
  });

  // 7. Full Conversation History & Follow-Up Lifecycle Test
  await test('Conversation History Lifecycle & Context Retention', async () => {
    const testConvId = `conv-test-${Date.now()}`;
    const userMsgId1 = `msg-u1-${Date.now()}`;
    const aiMsgId1 = `msg-a1-${Date.now()}`;

    // A. User sends message 1: "What is an ESP32?"
    console.log('   Step A: User asks "What is an ESP32?"...');
    const chatRes1 = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: testConvId,
        message: 'What is an ESP32?',
        history: [],
      }),
    });
    if (!chatRes1.ok) throw new Error(`Chat 1 failed: HTTP ${chatRes1.status}`);
    const chatData1 = await chatRes1.json();

    // B. Save User & Assistant messages
    console.log('   Step B: Saving messages to conversation...');
    await fetch(`${BASE_URL}/api/ai/conversations/${testConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: userMsgId1,
        role: 'user',
        content: 'What is an ESP32?',
      }),
    });

    await fetch(`${BASE_URL}/api/ai/conversations/${testConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: aiMsgId1,
        role: 'assistant',
        content: chatData1.answer,
        product_ids: chatData1.products?.map((p) => p.id),
      }),
    });

    // C. Re-fetch conversation from SQLite & verify persistence
    console.log('   Step C: Fetching conversation from SQLite...');
    const convRes = await fetch(`${BASE_URL}/api/ai/conversations/${testConvId}`);
    if (!convRes.ok) throw new Error(`Failed to fetch conversation: HTTP ${convRes.status}`);
    const convData = await convRes.json();
    if (convData.messages.length !== 2) {
      throw new Error(`Expected 2 messages, got ${convData.messages.length}`);
    }
    console.log(`   Hydrated messages count: ${convData.messages.length}`);
    console.log(`   Hydrated assistant products: ${convData.messages[1].products?.length}`);

    // D. Follow-up query with context: "Can I use it for robotics?"
    console.log('   Step D: Asking follow-up "Can I use it for robotics?" with conversation history...');
    const history = convData.messages.map((m) => ({
      role: m.sender || m.role,
      content: m.text || m.content,
    }));

    const chatRes2 = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: testConvId,
        message: 'Can I use it for robotics?',
        history,
      }),
    });
    if (!chatRes2.ok) throw new Error(`Chat 2 failed: HTTP ${chatRes2.status}`);
    const chatData2 = await chatRes2.json();
    console.log('   Follow-up Answer:', chatData2.answer);
    console.log('   Follow-up Products:', chatData2.products?.map((p) => p.name));

    // E. Search conversations list
    console.log('   Step E: Searching conversations list...');
    const listRes = await fetch(`${BASE_URL}/api/ai/conversations?q=ESP32`);
    if (!listRes.ok) throw new Error(`List search failed: HTTP ${listRes.status}`);
    const listData = await listRes.json();
    const found = listData.some((c) => c.id === testConvId);
    if (!found) throw new Error(`Conversation ${testConvId} not found in search results`);

    // F. Rename conversation
    console.log('   Step F: Renaming conversation...');
    const renameRes = await fetch(`${BASE_URL}/api/ai/conversations/${testConvId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'ESP32 Robotics Guide' }),
    });
    if (!renameRes.ok) throw new Error(`Rename failed: HTTP ${renameRes.status}`);

    // G. Clean up test conversation
    console.log('   Step G: Deleting test conversation...');
    const delRes = await fetch(`${BASE_URL}/api/ai/conversations/${testConvId}`, {
      method: 'DELETE',
    });
    if (!delRes.ok) throw new Error(`Delete failed: HTTP ${delRes.status}`);
  });

  console.log('====================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

runTests();
