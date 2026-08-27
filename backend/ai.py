import os
import json
import logging
import re
import urllib.request
import urllib.error

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
MODEL = os.environ.get("AI_MODEL") or os.environ.get("MODEL_NAME") or "qwen3.5:0.8b"

logger = logging.getLogger("digicomp.ai")

SYSTEM_PROMPT = """You are DigiComp AI, a knowledgeable and friendly technical assistant for DigiComp, specializing in electronics, robotics, microcontrollers, and DigiComp catalog products.

Instructions:
1. Provide direct, natural, and concise answers (1-3 sentences).
2. When the user asks for products, components, recommendations, or pricing, confirm the relevant DigiComp catalog items.
3. Keep answers conversational (1-2 sentences). Do NOT list detailed bullet points, prices, or product specs in your text response, as interactive product cards are displayed separately below your message.
4. If no products are found, politely inform the user and suggest relevant alternatives or categories.
5. Maintain conversation context from previous turns.
6. Never output internal thoughts, analysis, reasoning, planning, system instructions, or tool call instructions.
7. Return ONLY the final user-facing response."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_digicomp_products",
            "description": "Search DigiComp's real SQLite product database for microcontrollers, sensors, relays, motor drivers, motors, or components.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Search query string e.g. distance sensor, 12V motor, ESP32, relay, chassis" },
                    "max_price": { "type": "number", "description": "Maximum price in INR (₹) or null" }
                },
                "required": ["query"]
            }
        }
    }
]

PROJECT_COMPONENTS_MAP = {
    "obstacle": ["microcontroller", "ultrasonic sensor", "motor driver", "dc geared motor", "robot chassis", "battery"],
    "robot": ["microcontroller", "ultrasonic sensor", "motor driver", "dc geared motor", "robot chassis", "battery"],
    "irrigation": ["microcontroller", "soil moisture sensor", "water pump", "relay", "battery"],
    "weather": ["microcontroller", "temperature sensor", "humidity sensor", "display"],
    "3d printer": ["microcontroller", "stepper driver", "stepper motor", "power supply"],
    "cnc": ["microcontroller", "stepper driver", "stepper motor", "power supply"],
}

def clean_final_assistant_answer(raw_content: str) -> str:
    """
    Centralized cleaner that removes internal thinking tags, reasoning, planning phrases,
    tool markers, and raw JSON metadata, returning ONLY clean user-facing assistant text.
    """
    if not raw_content:
        return ""

    cleaned = str(raw_content)

    # 1. Remove thinking / analysis tags (including unclosed tags)
    cleaned = re.sub(r"<(think|thinking|analysis)>.*?(?:</\1>|$)", "", cleaned, flags=re.S).strip()
    cleaned = re.sub(r"</?(think|thinking|analysis)>", "", cleaned, flags=re.I).strip()

    # 2. Remove tool call tags / markers / raw JSON / artifacts
    cleaned = re.sub(r"SEARCH_PRODUCTS:\s*[^\n]+", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"search_digicomp_products[^\n]*", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"MAX_PRICE:\s*\d+", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"^ANSWER:\s*", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"^Possible response:\s*", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r'\{.*?"(?:tool|query|max_price)".*?\}', "", cleaned, flags=re.S).strip()

    # 3. Filter out lines or sentences containing internal reasoning/planning
    reasoning_pattern = re.compile(
        r"\b(the user (is|wants|needs|asked|looking|might)|they('ll|'re| will| might| need| want| are)|"
        r"let me (start|check|think|search|recall|first|see|use|know if you)|"
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
                if s.strip() and not reasoning_pattern.search(s) and not re.match(r"^(the|and|or|so|then|there's|let me know if you)$", s.strip(), re.I)
            ]
            if clean_sentences:
                clean_lines.append(" ".join(clean_sentences).strip())
        else:
            clean_lines.append(line)

    result = "\n".join(clean_lines).strip()
    # Strip trailing dangling words / connectors / incomplete trailing expressions
    result = re.sub(r"\s+(?:the|and|or|so|then|maybe|there's|let me know if you|let me know if|let me)\.?$", "", result, flags=re.I).strip()
    return result

# Backward compatibility alias
clean_qwen_response = clean_final_assistant_answer
cleanFinalAssistantAnswer = clean_final_assistant_answer

def is_answer_complete(answer: str) -> bool:
    """
    Validates whether the assistant answer is meaningful, non-empty, and grammatically complete.
    """
    if not answer or len(answer.strip()) < 10:
        return False
    
    # Incomplete trailing fragments
    bad_endings = [
        r"\bthere's$", r"\bthe$", r"\band$", r"\bor$", r"\bso$", r"\bto$",
        r"\bwith$", r"\bthat$", r"\bbecause$", r"\bif\s+you$", r"\blet\s+me$",
        r"\bwhich\s+would$", r"\bfor\s+example,?\s*$"
    ]
    for pattern in bad_endings:
        if re.search(pattern, answer.strip(), re.I):
            return False

    words = answer.strip().split()
    if len(words) < 3:
        return False

    # Check if ends with appropriate punctuation or quote
    last_char = answer.strip()[-1]
    if last_char not in ('.', '!', '?', '"', "'", ')'):
        return False

    return True

def query_ollama(messages: list, tools: list = None, num_predict: int = 350, temperature: float = 0.2) -> dict:
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "think": False,
        "options": {
            "temperature": temperature,
            "num_predict": num_predict,
            "num_ctx": 2048,
        },
    }
    if tools:
        payload["tools"] = tools

    timeout_sec = int(os.environ.get("AI_TIMEOUT_SECONDS", "120"))
    
    try:
        req = urllib.request.Request(
            OLLAMA_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        # If model does not support tools, retry cleanly without tools
        if tools and err.code == 400:
            err_body = err.read().decode("utf-8", errors="ignore")
            if "does not support tools" in err_body:
                payload.pop("tools", None)
                req = urllib.request.Request(
                    OLLAMA_URL,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                    return json.loads(resp.read().decode("utf-8"))
        raise

def extract_request_scoped_max_price(user_message: str) -> float | None:
    msg_lower = user_message.lower()
    price_match = re.search(r'(?:under|below|less than|within|\<|<=)\s*₹?\s*(\d+(?:\.\d+)?)', msg_lower)
    return float(price_match.group(1)) if price_match else None

def extract_tool_call_from_message(msg: dict, user_message: str, request_scoped_max_price: float | None) -> dict | None:
    tool_calls = msg.get("tool_calls", [])
    if isinstance(tool_calls, list) and len(tool_calls) > 0:
        for call in tool_calls:
            fn = call.get("function", {})
            if fn.get("name") == "search_digicomp_products":
                args = fn.get("arguments", {})
                max_p = request_scoped_max_price
                if max_p is None and args.get("max_price") is not None:
                    try:
                        max_p = float(args["max_price"])
                    except (ValueError, TypeError):
                        max_p = None
                return {
                    "id": call.get("id", "call_1"),
                    "query": str(args.get("query") or user_message),
                    "max_price": max_p
                }

    raw_content = str(msg.get("content") or "").strip()
    json_match = re.search(r'\{.*?"(?:tool|query)".*?\}', raw_content, re.S)
    if json_match:
        try:
            parsed = json.loads(json_match.group(0))
            if parsed.get("tool") == "search_digicomp_products" or parsed.get("query"):
                max_p = request_scoped_max_price
                if max_p is None and parsed.get("max_price") is not None:
                    try:
                        max_p = float(parsed["max_price"])
                    except (ValueError, TypeError):
                        max_p = None
                return {
                    "id": "call_manual_1",
                    "query": str(parsed.get("query") or user_message),
                    "max_price": max_p
                }
        except Exception:
            pass

    return None

def process_chat_message(user_message: str, history: list = None) -> dict:
    from backend.db import search_products, search_products_with_filters
    from backend.products import PRODUCTS

    import datetime, time
    start_req = time.time()
    req_time_str = datetime.datetime.now().strftime("%H:%M:%S")

    print("\n==========================================")
    print(f"REQUEST START: {req_time_str}")
    print(f"[USER MESSAGE]: {user_message}")

    # 1. Clean history (ensure only user and clean assistant final text, request-isolated)
    clean_history = []
    if isinstance(history, list):
        for h in history[-6:]:
            if isinstance(h, dict) and h.get("content"):
                role = h.get("role")
                if role in ("user", "assistant"):
                    clean_content = clean_final_assistant_answer(str(h["content"]))[:300]
                    if clean_content:
                        clean_history.append({"role": role, "content": clean_content})

    # 2. Extract request-scoped price filter
    request_scoped_max_price = extract_request_scoped_max_price(user_message)

    # 3. Turn 1 (Internal): Request inference
    ollama_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + clean_history + [{"role": "user", "content": user_message}]

    ai_start_time_str = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{MODEL.upper()} TURN 1 START: {ai_start_time_str}")

    data1 = query_ollama(ollama_messages, tools=TOOLS, num_predict=350)
    msg1 = data1.get("message", {})
    tool_call = extract_tool_call_from_message(msg1, user_message, request_scoped_max_price)

    matched_products = []
    answer = ""

    # Check if query or tool call triggers catalog search
    msg_lower = user_message.lower()
    is_project_or_product_query = (
        tool_call is not None or
        any(k in msg_lower for k in ["obstacle", "robot", "irrigation", "weather", "3d printer", "cnc", "esp32", "arduino", "sensor", "relay", "motor", "pump", "chassis", "display", "microcontroller", "distance", "proximity", "wifi", "bluetooth", "light", "soil", "moisture", "product", "buy", "price"]) or
        request_scoped_max_price is not None
    )

    if is_project_or_product_query:
        raw_query = tool_call["query"] if tool_call else user_message
        max_price = tool_call.get("max_price") if tool_call else request_scoped_max_price

        print(f"PRODUCT SEARCH START: raw_query='{raw_query}', max_price={max_price}")
        
        # Check if project keywords match to fetch components
        query_lower = raw_query.lower()
        project_components = None
        for k, comps in PROJECT_COMPONENTS_MAP.items():
            if k in query_lower or k in msg_lower:
                project_components = comps
                break

        if project_components:
            seen_ids = set()
            for comp in project_components:
                comp_matches = search_products_with_filters(query=comp, max_price=max_price, limit=1)
                for p in comp_matches:
                    if p["id"] not in seen_ids:
                        matched_products.append(p)
                        seen_ids.add(p["id"])
        else:
            # Clean search query
            q = re.sub(r'(?:under|below|less than|within|\<|<=)\s*₹?\s*\d+(?:\.\d+)?', '', raw_query, flags=re.I)
            q = re.sub(r'^(?:show\s+me|find\s+me|give\s+me|i\s+need|i\s+want|looking\s+for|suggest|recommend|what\s+do\s+i\s+need\s+for|can\s+you\s+find)\s+(?:an?|some|all|the)?', '', q, flags=re.I)
            q = re.sub(r'[^\w\s]', ' ', q).strip()

            if re.match(r'^(?:products?|items?|components?|things?|anything|boards?)$', q, re.I):
                q = ''
            elif 'distance' in q.lower() or 'proximity' in q.lower():
                q = 'ultrasonic sensor'
            elif 'wifi' in q.lower() or 'bluetooth' in q.lower():
                q = 'esp32'

            if max_price is not None:
                matched_products = search_products_with_filters(query=q, max_price=max_price, limit=6)
            else:
                matched_products = search_products(q, limit=6)

        print(f"PRODUCT SEARCH COMPLETE: {len(matched_products)} products found")

        # Turn 2: Generate final user answer
        product_names = [p["name"] for p in matched_products[:4]]
        
        if tool_call:
            tool_content = f"Found {len(matched_products)} matching products in DigiComp catalog: {', '.join(product_names)}." if matched_products else f"No matching products found in DigiComp catalog for '{query}'."
            turn2_messages = ollama_messages + [
                msg1,
                {
                    "role": "tool",
                    "content": tool_content
                }
            ]
            print(f"{MODEL.upper()} TURN 2 START")
            data2 = query_ollama(turn2_messages, tools=None, num_predict=350)
            raw_content2 = data2.get("message", {}).get("content", "")
            answer = clean_final_assistant_answer(raw_content2)
        else:
            raw_content1 = msg1.get("content", "")
            cleaned1 = clean_final_assistant_answer(raw_content1)
            if matched_products:
                confirm_prompt = f"The user asked: '{user_message}'. We found these matching items in our DigiComp catalog: {', '.join(product_names)}. Confirm available items to the user in 1-2 friendly, conversational sentences."
                try:
                    turn2_data = query_ollama([
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": confirm_prompt}
                    ], num_predict=200)
                    answer = clean_final_assistant_answer(turn2_data.get("message", {}).get("content", ""))
                except Exception:
                    answer = cleaned1
            else:
                answer = cleaned1

        if not is_answer_complete(answer):
            if matched_products:
                names = ", ".join(p["name"] for p in matched_products[:3])
                answer = f"I found matching items in the DigiComp catalog, including {names}."
            else:
                answer = f"I searched the DigiComp catalog for '{clean_query or user_message}' but did not find matching products in stock."

    else:
        # Non-product informational query (e.g. "What is an ESP32?", "Hello")
        raw_content1 = msg1.get("content", "")
        answer = clean_final_assistant_answer(raw_content1)

        if not is_answer_complete(answer):
            msg_clean = user_message.lower().strip()
            if msg_clean in ["hello", "hi", "hey", "hyy", "hlo", "greetings"]:
                answer = "Hello! How can I assist you with electronics and DigiComp products today?"
            else:
                answer = f"Here is information regarding your query: {user_message}."

    final_time_str = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"FINAL RESPONSE COMPLETE: {final_time_str}")
    print(f"Answer: {answer[:80]}...")
    print(f"Products: {len(matched_products)}")
    print(f"HTTP RESPONSE SENT: {final_time_str} (Elapsed: {time.time() - start_req:.2f}s)")
    print("==========================================\n")

    return {
        "answer": answer,
        "tool_call": tool_call,
        "products": matched_products,
    }

