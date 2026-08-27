// Test script for verifying qwen3.5:0.8b integration across Next.js and Ollama
const http = require('http');

const MODEL = process.env.AI_MODEL || 'qwen3.5:0.8b';

async function queryChatRouteDirectly(userMessage, history = []) {
  // Direct test of the Next.js chat route logic
  const payload = JSON.stringify({
    message: userMessage,
    history: history,
    conversationId: `test-qwen-${Date.now()}`,
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      'http://localhost:3000/api/ai/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          // Provide mock session cookie for route auth
          'Cookie': 'digicomp_session=demo-session-token',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function testOllamaDirect(prompt) {
  const payload = JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are DigiComp AI. Keep answers concise (1-2 sentences).' },
      { role: 'user', content: prompt },
    ],
    stream: false,
    options: { temperature: 0.2, num_predict: 150 },
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      'http://127.0.0.1:11434/api/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ raw: body });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log(`=================================================`);
  console.log(`VERIFYING GEMMA 3 270M MODEL INTEGRATION`);
  console.log(`Target Model: ${MODEL}`);
  console.log(`=================================================\n`);

  // 1. Direct Ollama ping
  console.log(`1. Testing direct Ollama chat with ${MODEL}...`);
  const t0 = Date.now();
  const directRes = await testOllamaDirect('Hello! Who are you?');
  const elapsed = (Date.now() - t0) / 1000;
  console.log(`   Response (${elapsed.toFixed(2)}s): "${directRes.message?.content?.trim()}"\n`);

  // 2. Test python backend processing
  console.log(`2. Testing backend python process_chat_message with ${MODEL}...`);
  const { execSync } = require('child_process');
  try {
    const out = execSync(`python3 -c "
import os
os.environ['AI_MODEL'] = '${MODEL}'
from backend.ai import process_chat_message
res = process_chat_message('I want to build an obstacle avoiding robot')
print('Answer:', res['answer'])
print('Products count:', len(res['products']))
"`, { encoding: 'utf-8' });
    console.log(out);
  } catch (err) {
    console.error('Python backend test failed:', err.message);
  }

  console.log(`\n=================================================`);
  console.log(`ALL GEMMA 3 270M VERIFICATIONS COMPLETED!`);
  console.log(`=================================================`);
}

runTests().catch(console.error);
