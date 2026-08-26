const assert = require('assert');

// Simulate classifyQuery
function classifyQuery(query) {
  if (!query || typeof query !== 'string') return 'general';
  const q = query.toLowerCase().trim();
  if (!q) return 'general';

  // 1. Project / Build intent
  const projectPatterns = [
    /\b(build|make|create|develop|construct|diy|project|robot|robotics|smart|system|automation|automate|iot|circuit|wiring|schematic|interfac(e|ing)|connect(ing)?|line follower|obstacle avoid(ing|er)?|quadcopter|drone|tracker|transmitter|receiver)\b/i,
    /\b(how to build|how to make|how to connect|how to wire|guide to|tutorial for|components? for)\b/i,
  ];

  // 2. Product / Price / Buy intent
  const productPricePatterns = [
    /\b(under|below|around|within|budget|price|cost|rate|cheap|cheapest|affordable)\b/i,
    /₹|\brs\.?|\binr\b/i,
    /\b(buy|purchase|order|shop|store|in stock|stock|available|catalog|discount|deal|specs|datasheet)\b/i,
    /\b(i need|i want|looking for|recommend|suggest|find me|search for|give me)\b/i,
  ];

  // 3. Conceptual question / Definition intent
  const questionPatterns = [
    /^(hi|hello|hey|greetings|howdy|good (morning|afternoon|evening))\b/i,
    /^(what is|what are|what's|explain|who (is|was|invented)|why (is|are|do|does)|how (does|do|works?)|difference between|compare|tell me about|definition of|can you explain)\b/i,
    /\?$/,
  ];

  const hasProjectIntent = projectPatterns.some((pattern) => pattern.test(q));
  if (hasProjectIntent) {
    return 'project';
  }

  const hasProductIntent = productPricePatterns.some((pattern) => pattern.test(q));
  if (hasProductIntent) {
    return 'product';
  }

  const hasQuestionIntent = questionPatterns.some((pattern) => pattern.test(q));
  if (hasQuestionIntent) {
    return 'question';
  }

  return 'general';
}

function getStatusSteps(category) {
  switch (category) {
    case 'question':
      return [
        { text: 'Understanding your question...', icon: 'sparkles' },
        { text: 'Analyzing the topic...', icon: 'cpu' },
        { text: 'Preparing an explanation...', icon: 'layers' },
        { text: 'Finalizing your answer...', icon: 'ready' },
      ];
    case 'product':
      return [
        { text: 'Understanding your requirements...', icon: 'sparkles' },
        { text: 'Searching DigiComp products...', icon: 'search' },
        { text: 'Checking availability...', icon: 'layers' },
        { text: 'Matching your budget...', icon: 'cpu' },
        { text: 'Preparing your recommendations...', icon: 'ready' },
      ];
    case 'project':
      return [
        { text: 'Understanding your project...', icon: 'sparkles' },
        { text: 'Identifying required components...', icon: 'cpu' },
        { text: 'Finding suitable DigiComp products...', icon: 'search' },
        { text: 'Checking availability...', icon: 'layers' },
        { text: 'Preparing your recommendations...', icon: 'ready' },
      ];
    case 'general':
    default:
      return [
        { text: 'Understanding your request...', icon: 'sparkles' },
        { text: 'Analyzing your requirements...', icon: 'cpu' },
        { text: 'Finding relevant information...', icon: 'search' },
        { text: 'Checking DigiComp products...', icon: 'search' },
        { text: 'Matching available components...', icon: 'layers' },
        { text: 'Preparing your recommendations...', icon: 'ready' },
        { text: 'Finalizing your answer...', icon: 'sparkles' },
      ];
  }
}

console.log('=== Testing Category Classification ===');

const testCases = [
  { q: 'What is ESP32?', expected: 'question' },
  { q: 'Explain how ultrasound sensor works', expected: 'question' },
  { q: 'I need an ESP32 under ₹500', expected: 'product' },
  { q: 'Buy Arduino Uno board', expected: 'product' },
  { q: 'I want to build an obstacle avoiding robot', expected: 'project' },
  { q: 'How to build IoT temperature monitor', expected: 'project' },
  { q: 'something random', expected: 'general' },
];

testCases.forEach(({ q, expected }) => {
  const result = classifyQuery(q);
  console.log(`Query: "${q}" => Category: ${result} (Expected: ${expected})`);
  assert.strictEqual(result, expected);
});

console.log('\n=== Testing Status Steps & Indefinite Loop Simulation ===');

['question', 'product', 'project', 'general'].forEach((cat) => {
  const steps = getStatusSteps(cat);
  console.log(`\nCategory: ${cat} (${steps.length} steps):`);
  steps.forEach((s, idx) => console.log(`  [${idx}] ${s.text}`));

  // Simulate 3 full loops (e.g. 15-20 iterations)
  const totalTicks = steps.length * 3;
  let index = 0;
  const sequence = [];
  for (let tick = 0; tick < totalTicks; tick++) {
    sequence.push(steps[index].text);
    index = (index + 1) % steps.length;
  }

  // Ensure index wraps back to 0
  assert.strictEqual(sequence[0], steps[0].text);
  assert.strictEqual(sequence[steps.length], steps[0].text);
  assert.strictEqual(sequence[steps.length * 2], steps[0].text);
  console.log(`  -> Successfully verified 3 full continuous loops (${totalTicks} transitions)!`);
});

console.log('\nAll tests passed successfully!');
