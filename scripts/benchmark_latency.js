const testQueries = [
  "Hello",
  "What is a sensor?",
  "What is an ESP32?",
  "I need an ESP32 under ₹500",
  "I want to build an obstacle avoiding robot",
  "I need to build a 3D printer",
  "Who invented the transistor?",
  "Can ESP32 control motors?"
];

async function runBenchmark() {
  console.log("==========================================================================================");
  console.log("DIGICOMP AI ASSISTANT — PIPELINE LATENCY & PERFORMANCE BENCHMARK");
  console.log("==========================================================================================\n");

  const results = [];

  for (let i = 0; i < testQueries.length; i++) {
    const q = testQueries[i];
    console.log(`[TEST ${i + 1}/${testQueries.length}] Request: "${q}"...`);

    const start = Date.now();
    try {
      const res = await fetch("http://localhost:3000/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, stream: false })
      });

      const totalElapsed = Date.now() - start;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.log(`❌ ERROR ${res.status} (${totalElapsed}ms):`, errJson);
        results.push({
          query: q,
          totalMs: totalElapsed,
          qwenMs: 0,
          toolMs: 0,
          productsCount: 0,
          status: `Error ${res.status}`
        });
        continue;
      }

      const data = await res.json();
      const timing = data.timing || {};
      const qwenMs = timing.qwenMs || totalElapsed;
      const toolMs = timing.toolMs || 0;
      const productsCount = (data.products || []).length;

      console.log(`   ✓ Completed in ${totalElapsed} ms (Qwen: ${qwenMs} ms | DB/Cache Tool: ${toolMs} ms)`);
      console.log(`   ✓ Answer: "${(data.answer || '').substring(0, 100)}..."`);
      console.log(`   ✓ Catalog Products Found: ${productsCount}\n`);

      results.push({
        query: q,
        totalMs: totalElapsed,
        qwenMs: qwenMs,
        toolMs: toolMs,
        productsCount: productsCount,
        status: "OK"
      });
    } catch (err) {
      console.error(`❌ EXCEPTION: ${err.message}\n`);
      results.push({
        query: q,
        totalMs: 0,
        qwenMs: 0,
        toolMs: 0,
        productsCount: 0,
        status: `Error: ${err.message}`
      });
    }

    // Short gap between queries to settle local hardware
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n==========================================================================================");
  console.log("FINAL BENCHMARK RESULTS SUMMARY TABLE");
  console.log("==========================================================================================");
  console.table(
    results.map((r) => ({
      Query: r.query,
      'Total Latency (ms)': r.totalMs,
      'Qwen Time (ms)': r.qwenMs,
      'DB/Cache Tool (ms)': r.toolMs,
      'Products Found': r.productsCount,
      Status: r.status
    }))
  );

  const validRuns = results.filter((r) => r.status === 'OK');
  if (validRuns.length > 0) {
    const avgTotal = Math.round(validRuns.reduce((a, b) => a + b.totalMs, 0) / validRuns.length);
    const avgQwen = Math.round(validRuns.reduce((a, b) => a + b.qwenMs, 0) / validRuns.length);
    const avgTool = Math.round(validRuns.reduce((a, b) => a + b.toolMs, 0) / validRuns.length);

    console.log(`\n📊 AVERAGE METRICS OVER ${validRuns.length} QUERIES:`);
    console.log(`   - Average Total Latency: ${avgTotal} ms`);
    console.log(`   - Average Qwen Inference Time: ${avgQwen} ms`);
    console.log(`   - Average DB/Cache Search Time: ${avgTool} ms (< 2ms for indexed local SQLite/cache)`);
  }
  console.log("==========================================================================================\n");
}

runBenchmark();
