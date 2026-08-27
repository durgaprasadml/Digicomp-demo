import os
import sys
import json
import urllib.request
import re
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.db import search_products, search_products_with_filters, init_db, seed_products
from backend.products import PRODUCTS

init_db()
seed_products(PRODUCTS)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
MODEL = os.environ.get("AI_MODEL") or "qwen3.5:0.8b"

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_digicomp_products",
            "description": "Search DigiComp product catalog for microcontrollers, sensors, relays, motor drivers, motors, or components.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword e.g. distance sensor, 12V motor, ESP32, relay, chassis"},
                    "max_price": {"type": "number", "description": "Maximum price in INR (₹) or null"}
                },
                "required": ["query"]
            }
        }
    }
]

SYSTEM_PROMPT = """You are DigiComp AI, a knowledgeable and friendly technical assistant for DigiComp, specializing in electronics, robotics, microcontrollers, and DigiComp catalog products.

Instructions:
1. Provide direct, natural, and concise answers (1-3 sentences).
2. When the user asks for products, components, recommendations, or pricing, call the `search_digicomp_products` tool.
3. When matching products are found by the tool, confirm the matching DigiComp items naturally in 1-2 conversational sentences. Do NOT list detailed bullet points, prices, or product specs in your text response, as interactive product cards are displayed separately below your message.
4. If no products are found, politely inform the user and suggest relevant alternatives or categories.
5. Never output internal thoughts, analysis, reasoning, planning, or tool call instructions.
6. Return ONLY the final user-facing response."""

def clean_final_assistant_answer(raw_content: str) -> str:
    if not raw_content:
        return ""
    
    cleaned = str(raw_content)
    
    # 1. Remove thinking / analysis tags
    cleaned = re.sub(r"<(think|thinking|analysis)>.*?(?:</\1>|$)", "", cleaned, flags=re.S).strip()
    cleaned = re.sub(r"</?(think|thinking|analysis)>", "", cleaned, flags=re.I).strip()
    
    # 2. Remove tool call tags / markers / raw JSON
    cleaned = re.sub(r"SEARCH_PRODUCTS:\s*[^\n]+", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"search_digicomp_products[^\n]*", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"MAX_PRICE:\s*\d+", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"^ANSWER:\s*", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"^Possible response:\s*", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r'\{.*?"(?:tool|query|max_price)".*?\}', "", cleaned, flags=re.S).strip()
    
    # 3. Filter out lines or sentences containing internal reasoning/planning
    reasoning_pattern = re.compile(
        r"\b(the user (is|wants|needs|asked|looking|might)|they('ll|'re| will| might| need| want| are)|"
        r"let me (start|check|think|search|recall|first|see|use)|"
        r"i (need|should|will|must|have|might|can|would|'ll) (to )?(check|search|find|use|look|recall|suggest|recommend|call|query)|"
        r"first,?\s*i need|okay,?\s*the user|okay,?\s*let me|okay,?\s*i need|alright,?\s*the user|"
        r"my role is|system prompt|maybe they need|i should check|if they want|search function|search query|"
        r"tool call|make sure to (mention|include|search)|the function allows|the query should be|max_price should be)\b",
        re.I
    )
    
    lines = [l.strip() for l in cleaned.split("\n") if l.strip()]
    clean_lines = []
    for line in lines:
        if reasoning_pattern.search(line):
            sentences = re.split(r"(?<=[.?!])\s+", line)
            clean_sentences = [
                s.strip() for s in sentences
                if s.strip() and not reasoning_pattern.search(s) and not re.match(r"^(the|and|or|so|then|there's)$", s.strip(), re.I)
            ]
            if clean_sentences:
                clean_lines.append(" ".join(clean_sentences).strip())
        else:
            clean_lines.append(line)
            
    result = "\n".join(clean_lines).strip()
    result = re.sub(r"\s+(?:the|and|or|so|then|maybe|there's)\.?$", "", result, flags=re.I).strip()
    return result

def is_answer_complete(answer: str) -> bool:
    if not answer or len(answer.strip()) < 15:
        return False
    bad_endings = [r"\bthere's$", r"\bthe$", r"\band$", r"\bor$", r"\bso$", r"\bto$", r"\bwith$", r"\bthat$", r"\bbecause$", r"\*\*\d+V\s+Mini$"]
    for pattern in bad_endings:
        if re.search(pattern, answer.strip(), re.I):
            return False
    words = answer.strip().split()
    if len(words) < 4:
        return False
    return True

def query_ollama(messages, tools=None, num_predict=350):
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": num_predict,
            "num_ctx": 2048
        }
    }
    if tools:
        payload["tools"] = tools
    
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))

def execute_digicomp_chat(user_message: str, history: list = None) -> dict:
    start_time = time.time()
    
    # 1. Clean history (ensure only user and assistant final messages, no internal reasoning)
    clean_history = []
    if isinstance(history, list):
        for h in history[-6:]:
            if isinstance(h, dict) and h.get("content"):
                role = h.get("role")
                if role in ("user", "assistant"):
                    clean_history.append({
                        "role": role,
                        "content": clean_final_assistant_answer(str(h["content"]))[:300]
                    })
                    
    # Request-scoped max_price extraction from user message
    user_price_match = re.search(r'(?:under|below|less than|within|\<|<=)\s*₹?\s*(\d+(?:\.\d+)?)', user_message, re.I)
    request_scoped_max_price = float(user_price_match.group(1)) if user_price_match else None
    
    # 2. Turn 1: Send user message with tool definitions
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + clean_history + [{"role": "user", "content": user_message}]
    
    data1 = query_ollama(messages, tools=TOOLS)
    msg1 = data1.get("message", {})
    
    tool_calls = msg1.get("tool_calls", [])
    raw_content1 = msg1.get("content", "")
    
    matched_products = []
    
    # Fallback tool-call extraction from content if Ollama didn't structure it
    if not tool_calls:
        json_match = re.search(r'\{.*?"(?:tool|query)".*?\}', raw_content1, re.S)
        if json_match:
            try:
                parsed_call = json.loads(json_match.group(0))
                if parsed_call.get("query"):
                    tool_calls = [{
                        "id": "call_manual_1",
                        "function": {
                            "name": "search_digicomp_products",
                            "arguments": {
                                "query": parsed_call["query"],
                                "max_price": parsed_call.get("max_price")
                            }
                        }
                    }]
            except Exception:
                pass
                
    # If a tool call occurred
    if tool_calls:
        tool_call = tool_calls[0]
        fn = tool_call.get("function", {})
        args = fn.get("arguments", {})
        query = args.get("query") or user_message
        
        # Priority for max_price: request-scoped explicit constraint from user prompt, else tool argument
        max_price = request_scoped_max_price
        if max_price is None and args.get("max_price") is not None:
            try:
                max_price = float(args["max_price"])
            except (ValueError, TypeError):
                max_price = None
                
        # Perform DB search
        if max_price is not None:
            db_results = search_products_with_filters(query=query, max_price=max_price, limit=6)
        else:
            db_results = search_products(query, limit=6)
            
        # If no results with query, try a broader keyword search
        if not db_results and len(query.split()) > 1:
            for word in query.split():
                if len(word) > 2 and word.lower() not in ("what", "with", "have", "need", "want", "find", "show", "build", "project"):
                    db_results = search_products(word, limit=4)
                    if db_results:
                        break
                        
        matched_products = db_results
        
        # Format tool result summary for Qwen
        product_names = [p["name"] for p in matched_products[:4]]
        tool_content = f"Found {len(matched_products)} matching products in DigiComp catalog: {', '.join(product_names)}." if matched_products else "No matching products found in DigiComp catalog."
        
        # Turn 2: Send tool results to Qwen for final answer generation
        turn2_messages = messages + [
            msg1,
            {
                "role": "tool",
                "content": tool_content
            }
        ]
        
        data2 = query_ollama(turn2_messages, tools=None, num_predict=250)
        raw_content2 = data2.get("message", {}).get("content", "")
        answer = clean_final_assistant_answer(raw_content2)
        
        # Incomplete answer validation & fallback regeneration
        if not is_answer_complete(answer):
            # Prompt Qwen specifically for direct 1-2 sentence response using products
            regen_prompt = (
                f"User asked: '{user_message}'. "
                f"Matching DigiComp products: {', '.join(p['name'] for p in matched_products[:3]) if matched_products else 'None'}. "
                "Provide a direct, natural 1-2 sentence final answer to the user. Do not explain reasoning or list specs."
            )
            regen_data = query_ollama([
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": regen_prompt}
            ], num_predict=150)
            answer = clean_final_assistant_answer(regen_data.get("message", {}).get("content", ""))
            
        # If still incomplete, use deterministic grounded response
        if not is_answer_complete(answer):
            if matched_products:
                names = ", ".join(p["name"] for p in matched_products[:2])
                answer = f"I found matching products in the DigiComp catalog, including the {names}."
            else:
                answer = f"I searched the DigiComp catalog for '{query}' but did not find any matching products currently in stock."
    else:
        # No tool call made
        answer = clean_final_assistant_answer(raw_content1)
        
        # Check if user message directly mentions catalog items (e.g. sensor, ESP32, 12V motor, robot)
        msg_lower = user_message.lower()
        if any(k in msg_lower for k in ["esp32", "arduino", "sensor", "relay", "motor", "robot", "chassis", "pump"]):
            # Perform passive search for relevant products
            p_res = search_products(user_message, limit=4)
            if request_scoped_max_price is not None:
                p_res = [p for p in p_res if p["price"] <= request_scoped_max_price]
            matched_products = p_res
            
        if not is_answer_complete(answer):
            regen_data = query_ollama([
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Answer directly in 1-2 sentences: {user_message}"}
            ], num_predict=150)
            answer = clean_final_assistant_answer(regen_data.get("message", {}).get("content", ""))
            
        if not is_answer_complete(answer):
            answer = f"Here is information regarding your request: {user_message}"

    elapsed = time.time() - start_time
    return {
        "answer": answer,
        "products": matched_products,
        "elapsed": elapsed
    }

# Execute the 10 exact test cases!
test_cases = [
    ("1. What is a sensor?", "What is a sensor?", []),
    ("2. Do you have a 12V motor?", "Do you have a 12V motor?", []),
    ("3. Show me sensors under ₹200.", "Show me sensors under ₹200.", []),
    ("4. I want something that can detect distance.", "I want something that can detect distance.", []),
    ("5. I need a board that has WiFi and Bluetooth.", "I need a board that has WiFi and Bluetooth.", []),
    ("6. I want to build an obstacle avoiding robot.", "I want to build an obstacle avoiding robot.", []),
    ("7. Show me products under ₹100.", "Show me products under ₹100.", []),
    ("8. What is a Raspberry Pi?", "What is a Raspberry Pi?", []),
    ("9. What did we discuss earlier?", "What did we discuss earlier?", [
        {"role": "user", "content": "I am looking for an ESP32 board."},
        {"role": "assistant", "content": "The ESP32 DevKit V1 is available in the DigiComp catalog."}
    ]),
    ("10. Brand new unseen question", "Can you explain the difference between SPI and I2C communication protocols?", [])
]

print("=== RUNNING ALL 10 TESTS AGAINST DIGICOMP PIPELINE ===")
for title, q, hist in test_cases:
    print(f"\n--- TEST: {title} ---")
    print(f"User: {q}")
    res = execute_digicomp_chat(q, hist)
    print(f"Elapsed: {res['elapsed']:.2f}s")
    print(f"Answer: {res['answer']}")
    print(f"Products ({len(res['products'])}): {[p['name'] + ' (₹' + str(p['price']) + ')' for p in res['products']]}")
