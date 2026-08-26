const assert = require('assert');

// Simulate the logic in AIProcessingIndicator
function classifyQuery(query) {
  if (!query || typeof query !== 'string') return 'general';
  const q = query.toLowerCase().trim();
  if (!q) return 'general';

  const productPricePatterns = [
    /\b(under|below|around|within|budget|price|cost|rate|cheap|cheapest|affordable)\b/i,
    /₹|\brs\.?|\binr\b/i,
    /\b(buy|purchase|order|shop|store|in stock|stock|available|catalog|discount|deal|specs|datasheet)\b/i,
    /\b(i need an?|i want an?|looking for an?|recommend an?|suggest an?|find me an?|search for)\b/i,
  ];

  const projectPatterns = [
    /\b(build|make|create|develop|construct|diy|project|robot|robotics|smart|system|automation|automate|iot|circuit|wiring|schematic|interface|connect|interfacing|line follower|obstacle avoiding|quadcopter|drone|tracker)\b/i,
    /\b(how to build|how to make|how to connect|how to wire|guide to|tutorial for)\b/i,
  ];

  const questionPatterns = [
    /^(hi|hello|hey|greetings|howdy|good (morning|afternoon|evening))\b/i,
    /^(what is|what are|explain|who (is|was|invented)|why (is|are|do|does)|how (does|do|works?)|difference between|compare|tell me about|definition of)\b/i,
    /\?$/,
  ];

  const hasProductIntent = productPricePatterns.some((pattern) => pattern.test(q));
  const hasProjectIntent = projectPatterns.some((pattern) => pattern.test(q));

  if (hasProductIntent && !hasProjectIntent) {
    return 'product';
  }

  if (hasProjectIntent) {
    return 'project';
  }

  if (hasProductIntent) {
    return 'product';
  }

  if (questionPatterns.some((pattern) => pattern.test(q))) {
    return 'question';
  }

  return 'question';
}

function getStatusSteps(category) {
  switch (category) {
    case 'product':
      return [
        'Understanding your requirements...',
        'Checking DigiComp products...',
        'Preparing your recommendations...',
      ];
    case 'project':
      return [
        'Understanding your project...',
        'Finding suitable components...',
        'Preparing your recommendations...',
      ];
    case 'question':
      return [
        'Understanding your question...',
        'Preparing your answer...',
      ];
    case 'general':
    default:
      return [
        'Understanding your request...',
        'Finding relevant information...',
        'Preparing your answer...',
      ];
  }
}

const testCases = [
  {
    query: 'What is ESP32?',
    expectedCategory: 'question',
    expectedSteps: ['Understanding your question...', 'Preparing your answer...'],
    mustNotInclude: ['Checking DigiComp products...'],
  },
  {
    query: 'Who invented the transistor?',
    expectedCategory: 'question',
    expectedSteps: ['Understanding your question...', 'Preparing your answer...'],
    mustNotInclude: ['Checking DigiComp products...'],
  },
  {
    query: 'What is Ohm\'s law?',
    expectedCategory: 'question',
    expectedSteps: ['Understanding your question...', 'Preparing your answer...'],
    mustNotInclude: ['Checking DigiComp products...'],
  },
  {
    query: 'Hello',
    expectedCategory: 'question',
    expectedSteps: ['Understanding your question...', 'Preparing your answer...'],
    mustNotInclude: ['Checking DigiComp products...'],
  },
  {
    query: 'I need an ESP32 under ₹500',
    expectedCategory: 'product',
    expectedSteps: ['Understanding your requirements...', 'Checking DigiComp products...', 'Preparing your recommendations...'],
    mustInclude: ['Checking DigiComp products...'],
  },
  {
    query: 'Price of Arduino Uno',
    expectedCategory: 'product',
    expectedSteps: ['Understanding your requirements...', 'Checking DigiComp products...', 'Preparing your recommendations...'],
    mustInclude: ['Checking DigiComp products...'],
  },
  {
    query: 'I want to build an obstacle avoiding robot',
    expectedCategory: 'project',
    expectedSteps: ['Understanding your project...', 'Finding suitable components...', 'Preparing your recommendations...'],
    mustInclude: ['Finding suitable components...'],
  },
  {
    query: 'How to build a smart home security system',
    expectedCategory: 'project',
    expectedSteps: ['Understanding your project...', 'Finding suitable components...', 'Preparing your recommendations...'],
    mustInclude: ['Finding suitable components...'],
  },
];

console.log('--- Testing Query Intent & Loading Status Progression ---');
let passed = 0;
for (const tc of testCases) {
  const cat = classifyQuery(tc.query);
  const steps = getStatusSteps(cat);
  console.log(`\nQuery: "${tc.query}"`);
  console.log(`  -> Detected Category: ${cat}`);
  console.log(`  -> Steps: ${JSON.stringify(steps)}`);

  assert.strictEqual(cat, tc.expectedCategory, `Failed category match for "${tc.query}"`);
  assert.deepStrictEqual(steps, tc.expectedSteps, `Failed steps match for "${tc.query}"`);

  if (tc.mustNotInclude) {
    for (const notInc of tc.mustNotInclude) {
      assert(!steps.includes(notInc), `Step "${notInc}" should NOT be in steps for "${tc.query}"`);
    }
  }
  if (tc.mustInclude) {
    for (const inc of tc.mustInclude) {
      assert(steps.includes(inc), `Step "${inc}" SHOULD be in steps for "${tc.query}"`);
    }
  }
  passed++;
}

console.log(`\n✅ ALL ${passed}/${testCases.length} loading indicator test cases passed successfully!`);
