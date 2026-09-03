import os
import json
import logging
import re
import urllib.request
import urllib.error

from backend.catalog_client import (
    fetch_live_catalog,
    fetch_single_product_details,
    search_digicomp_catalog,
    find_project_recommendations,
    extract_search_constraints,
)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
MODEL = os.environ.get("AI_MODEL") or os.environ.get("MODEL_NAME") or "qwen3.5:0.8b"

logger = logging.getLogger("digicomp.ai")

SYSTEM_PROMPT = """You are DigiComp AI, a knowledgeable, helpful, and concise engineering assistant for DigiComp (digicomp.local), specializing in electronics, robotics, embedded systems, microcontrollers, and DigiComp catalog products.

Guidelines:
1. When answering general electronics or technical questions (such as concepts, definitions, pinouts, or theory), provide a clear, accurate, and direct explanation (1-3 sentences).
2. When the user asks about DigiComp products, availability, pricing, or recommendations, ground your answer strictly in the real DigiComp catalog.
3. Keep product responses natural and conversational (1-2 sentences). Do NOT output manual lists of prices, bullet points, or specs in the text, as interactive DigiComp product cards are rendered automatically below your message.
4. If no matching products exist in the DigiComp catalog, state clearly and politely that the item or specification is not currently available in the DigiComp catalog. NEVER invent, hallucinate, or assume products that do not exist.
5. Maintain conversational context across follow-up questions.
6. NEVER reveal internal thoughts, reasoning, tool names, planning phrases, parameter names, or raw JSON.
7. Return ONLY the final clean user-facing answer."""


def clean_final_assistant_answer(raw_content: str) -> str:
    """
    Centralized cleaner that strictly removes internal thinking tags, reasoning,
    planning phrases, tool markers, and raw JSON metadata.
    """
    if not raw_content:
        return ""

    cleaned = str(raw_content)

    # 1. Remove thinking / analysis tags
    cleaned = re.sub(r"<(think|thinking|analysis)>.*?(?:</\1>|$)", "", cleaned, flags=re.S).strip()
    cleaned = re.sub(r"</?(think|thinking|analysis)>", "", cleaned, flags=re.I).strip()

    # 2. Remove tool call tags / markers / raw JSON / artifacts
    cleaned = re.sub(r"SEARCH_PRODUCTS:\s*[^\r\n]+", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"search_digicomp_products[^\r\n]*", "", cleaned, flags=re.I).strip()
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

    lines = [l.strip() for l in cleaned.splitlines() if l.strip()]
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
    result = re.sub(r"\s+(?:the|and|or|so|then|maybe|there's|let me know if you|let me know if|let me)\.?$", "", result, flags=re.I).strip()
    return result


def is_answer_complete(answer: str) -> bool:
    """
    Validates whether the assistant answer is meaningful, non-empty, and grammatically complete.
    """
    if not answer or len(answer.strip()) < 8:
        return False
    
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

    last_char = answer.strip()[-1]
    if last_char not in ('.', '!', '?', '"', "'", ')'):
        return False

    return True


def query_ollama(messages: list, num_predict: int = 350, temperature: float = 0.2) -> dict:
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
    timeout_sec = int(os.environ.get("AI_TIMEOUT_SECONDS", "120"))
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        return json.loads(resp.read().decode("utf-8"))


def classify_user_intent(user_message: str, history: list = None) -> dict:
    """
    Accurately classifies user intent:
    - is_general_question: Pure theory, definition, explanation, greeting -> No catalog search
    - is_product_query: Store availability, price, buying, component filtering
    - is_project_query: Project recommendations (e.g. obstacle avoiding robot)
    - is_follow_up: Contextual refinement (e.g. "Under ₹500", "Only in stock", "Which one is best?")
    - inherited_query: Inferred search term from previous conversation turns
    - inherited_max_price: Inferred price constraint from previous conversation turns
    """
    # Clean text of leading/trailing whitespace and punctuation for classification
    msg_raw = user_message.strip()
    msg_lower = re.sub(r'[^a-zA-Z0-9\s-]', ' ', msg_raw.lower()).strip()
    msg_lower = re.sub(r'\s+', ' ', msg_lower)

    # 1. Greetings
    if msg_lower in ("hello", "hi", "hey", "hyy", "hlo", "good morning", "good evening", "greetings", "thanks", "thank you"):
        return {
            "type": "greeting",
            "is_product_query": False,
            "is_project_query": False,
            "is_follow_up": False,
            "inherited_query": None,
            "inherited_max_price": None,
        }

    # 2. Check for follow-up refinement patterns
    is_price_follow_up = bool(re.search(r'\b(?:under|below|less than|within|max price)\s*(?:rs|inr)?\s*\d+', msg_lower))
    is_stock_follow_up = bool(re.search(r'\b(?:only\s+in\s+stock|in\s+stock|available\s+only|in-stock)\b', msg_lower))
    is_which_best = bool(re.search(r'\b(?:which\s+(?:one|board|product)\s+is\s+best|which\s+is\s+better|which\s+one\s+should|recommend\s+one)\b', msg_lower))
    is_follow_up = is_price_follow_up or is_stock_follow_up or is_which_best

    # Extract previous query context and previous price from history
    inherited_query = None
    inherited_max_price = None

    if history:
        for turn in reversed(history):
            if isinstance(turn, dict) and turn.get("role") == "user":
                prev_text = turn.get("content", "").lower()
                # Check for product keywords
                if not inherited_query:
                    for kw in ("esp32", "rp2040", "rp2350", "ch32", "stm32", "fpga", "sbc", "robot", "sensor", "motor", "microcontroller", "mcu"):
                        if kw in prev_text:
                            inherited_query = kw
                            break
                # Check for previously specified price constraints
                if inherited_max_price is None:
                    p_match = re.search(r'(?:under|below|less than|within|<|<=)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', prev_text)
                    if p_match:
                        try:
                            inherited_max_price = float(p_match.group(1))
                        except ValueError:
                            pass

    # 3. Project recommendation queries
    project_keywords = ("obstacle", "robot", "irrigation", "weather station", "3d printer", "cnc", "build a", "build an")
    is_project_query = any(k in msg_lower for k in project_keywords)

    # 4. Pure general technical definition questions (e.g. "What is an ESP32?", "What is PWM?", "What is Ohm's law?")
    pure_definition_pattern = re.match(r"^(?:what\s+is|what\s+are|how\s+does|explain|what's\s+the\s+difference\s+between)\s+(?:an?|the)?\s*([a-zA-Z0-9\s-]+?)(?:\?|$)", user_message.lower().strip())
    is_store_intent = any(k in msg_lower for k in (
        "do you have", "have you got", "is there", "are there", "price of", "in stock", "available",
        "buy", "purchase", "order", "cost", "under", "below", "less than", "cheap", "show me", "find me",
        "i need", "i want", "recommend", "suggest", "catalog", "store", "product"
    ))

    if pure_definition_pattern and not is_store_intent:
        return {
            "type": "general_technical",
            "is_product_query": False,
            "is_project_query": False,
            "is_follow_up": False,
            "inherited_query": None,
            "inherited_max_price": None,
        }

    # 5. Product catalog intent
    is_product_query = is_store_intent or is_project_query or is_follow_up or any(
        kw in msg_lower for kw in ("esp32", "sensor", "motor", "microcontroller", "sbc", "fpga", "relay", "chassis", "wifi", "bluetooth", "board")
    )

    return {
        "type": "project" if is_project_query else ("follow_up" if is_follow_up else ("product" if is_product_query else "general")),
        "is_product_query": is_product_query,
        "is_project_query": is_project_query,
        "is_follow_up": is_follow_up,
        "is_which_best": is_which_best,
        "inherited_query": inherited_query,
        "inherited_max_price": inherited_max_price,
    }



def handle_product_specific_chat(user_message: str, history: list, product_context: dict) -> dict:
    p_name = str(product_context.get("name", "")).strip()
    p_id = product_context.get("id")
    p_sku = str(product_context.get("sku", "")).strip()
    p_cat = str(product_context.get("category", "")).strip()
    if not p_cat and product_context.get("categories"):
        p_cat = ", ".join(product_context["categories"])
    
    try:
        p_price = float(product_context.get("price", 0))
    except (ValueError, TypeError):
        p_price = 0.0

    try:
        p_reg_price = float(product_context.get("regPrice", p_price))
    except (ValueError, TypeError):
        p_reg_price = p_price

    p_stock = str(product_context.get("stock", "instock")).lower()
    p_is_instock = p_stock in ("instock", "in_stock", "available")
    p_stock_qty = product_context.get("stockQty") or product_context.get("stock_quantity") or 0

    p_desc_raw = product_context.get("description") or product_context.get("excerpt") or ""
    p_desc = re.sub(r'<[^>]+>', ' ', p_desc_raw).strip()
    p_desc = re.sub(r'\s+', ' ', p_desc)

    p_attrs = product_context.get("attributes") or {}
    attrs_list = []
    if isinstance(p_attrs, dict):
        for k, v in p_attrs.items():
            val_str = ", ".join(v) if isinstance(v, list) else str(v)
            attrs_list.append(f"{k}: {val_str}")
    attrs_formatted = "; ".join(attrs_list) if attrs_list else "None specified"

    msg_lower = user_message.lower().strip()

    # Sub-case 1: Cheaper Alternatives / Other Alternatives
    is_cheaper = bool(re.search(r'\b(cheaper|cheapest|lower price|less expensive|budget|more affordable)\b', msg_lower))
    is_alternative = bool(re.search(r'\b(alternative|alternatives|other options?|similar (?:boards?|products?|items?)|substitute|other (?:mcu|board|boards|fpga|sbc))\b', msg_lower))
    if is_cheaper or is_alternative:
        matched_products = []
        max_p = (p_price - 1) if (is_cheaper and p_price > 0) else None
        
        search_terms = []
        if p_cat and p_cat.lower() not in ("hardware", "uncategorized"):
            search_terms.append(p_cat)
        for kw in ("esp32", "rp2040", "mcu", "microcontroller", "fpga", "sbc", "sensor", "motor"):
            if kw in p_name.lower():
                search_terms.append(kw)
                break

        query_term = search_terms[0] if search_terms else ""
        raw_candidates = search_digicomp_catalog(query=query_term, max_price=max_p, limit=8)
        
        # Exclude current product
        matched_products = [
            p for p in raw_candidates 
            if p.get("id") != p_id and p.get("name", "").lower() != p_name.lower()
        ][:4]

        if is_cheaper and not matched_products and max_p and max_p > 0:
            broader = search_digicomp_catalog(query="", max_price=max_p, limit=6)
            matched_products = [
                p for p in broader 
                if p.get("id") != p_id and p.get("name", "").lower() != p_name.lower()
            ][:4]

        if matched_products:
            names = ", ".join(f"{p['name']} (₹{p['price']:.0f})" for p in matched_products[:3])
            if is_cheaper:
                answer = f"Here are cheaper alternatives from the DigiComp catalog: {names}."
            else:
                answer = f"Here are relevant alternative products from the DigiComp catalog: {names}."
        else:
            if is_cheaper:
                answer = f"I couldn't find any cheaper alternatives in the current DigiComp catalog for {p_name}."
            else:
                answer = f"I couldn't find other alternative products currently available in the DigiComp catalog for this category."

        return {
            "answer": answer,
            "tool_call": None,
            "products": matched_products,
        }

    # Sub-case 2: Price / Cost Query
    is_price_q = bool(re.search(r'\b(price|cost|how much|how expensive|rate|mrp|discount)\b', msg_lower)) and not any(k in msg_lower for k in ("cheaper", "alternative"))
    if is_price_q:
        if p_reg_price > p_price and p_price > 0:
            answer = f"The {p_name} is priced at ₹{p_price:.0f} (discounted from the regular price of ₹{p_reg_price:.0f}) on DigiComp."
        elif p_price > 0:
            answer = f"The {p_name} is priced at ₹{p_price:.0f} on DigiComp."
        else:
            answer = f"The price for {p_name} is available on the product page."
        return {
            "answer": answer,
            "tool_call": None,
            "products": [],
        }

    # Sub-case 3: Stock / Inventory Status
    is_stock_q = bool(re.search(r'\b(in stock|out of stock|available|availability|units? available|stock status|ready to ship)\b', msg_lower))
    if is_stock_q:
        if p_is_instock:
            qty_text = f" ({p_stock_qty} items in stock)" if p_stock_qty else " and ready to ship"
            answer = f"Yes, the {p_name} is currently in stock{qty_text} from DigiComp."
        else:
            answer = f"The {p_name} is currently out of stock in the DigiComp store."
        return {
            "answer": answer,
            "tool_call": None,
            "products": [],
        }

    # Sub-case 4: Specific Missing Specification Query
    missing_spec_keywords = {
        "weight": "weight",
        "dimensions": "dimensions",
        "dimension": "dimensions",
        "size": "dimensions",
        "color": "color",
        "temperature range": "temperature range",
        "operating temperature": "operating temperature",
        "ethernet": "Ethernet",
        "battery": "battery",
        "warranty": "warranty",
    }
    asked_missing_spec = None
    all_known_text = (p_name + " " + p_desc + " " + attrs_formatted).lower()
    for kw, label in missing_spec_keywords.items():
        if re.search(r'\b' + re.escape(kw) + r'\b', msg_lower):
            if kw not in all_known_text:
                asked_missing_spec = label
                break

    # Sub-case 5: Technical Specifications, Overview, Applications, Compatibility, Project Suitability
    prompt_content = f"""You are DigiComp AI, answering questions specifically about this DigiComp product:
Product: {p_name} (SKU: {p_sku})
Category: {p_cat}
Price: ₹{p_price:.0f}
Stock: {'In Stock' if p_is_instock else 'Out of Stock'}
Overview: {p_desc}
Technical Specifications: {attrs_formatted}

User Question: {user_message}

Rules:
1. 'this', 'it', 'the product', 'the board' refer strictly to {p_name}.
2. Ground your answer strictly in the DigiComp product information provided above.
3. If the user asks for a specific specification that is not listed in the product information, state: "I couldn't find that specification in the DigiComp product information." Do not guess or hallucinate.
4. Keep the answer clear, helpful, and concise (1-3 sentences).
5. Output ONLY the clean answer with NO thinking tags, NO reasoning, and NO tool calls."""

    data = query_ollama([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt_content}
    ], num_predict=220)
    raw_ans = data.get("message", {}).get("content", "")
    answer = clean_final_assistant_answer(raw_ans)

    if asked_missing_spec and (not is_answer_complete(answer) or "couldn't find that specification" not in answer.lower()):
        answer = "I couldn't find that specification in the DigiComp product information."

    if not is_answer_complete(answer):
        if "what is" in msg_lower or "tell me about" in msg_lower:
            answer = f"The {p_name} is a {p_cat} available from DigiComp. {p_desc}"
        elif "spec" in msg_lower:
            answer = f"The specifications for {p_name} include: {attrs_formatted}."
        elif "robot" in msg_lower:
            answer = f"Yes, the {p_name} can be used for robotics projects requiring {attrs_formatted or 'microcontroller control'}."
        elif "cnc" in msg_lower:
            answer = f"The {p_name} can be used in CNC controller designs depending on your motor driver and firmware requirements."
        elif "beginner" in msg_lower:
            answer = f"The {p_name} is suitable for developers and hobbyists looking to build projects with {p_cat} hardware."
        else:
            answer = f"The {p_name} is a {p_cat} from DigiComp ({p_desc or 'ready for embedded and electronics applications'})."

    return {
        "answer": answer,
        "tool_call": None,
        "products": [],
    }


def process_chat_message(user_message: str, history: list = None, product_context: dict = None) -> dict:
    import datetime, time
    start_req = time.time()

    # 1. Clean history
    clean_history = []
    if isinstance(history, list):
        for h in history[-6:]:
            if isinstance(h, dict) and h.get("content"):
                role = h.get("role")
                if role in ("user", "assistant"):
                    clean_content = clean_final_assistant_answer(str(h["content"]))[:300]
                    if clean_content:
                        clean_history.append({"role": role, "content": clean_content})

    # Handle product-specific chat when product_context is provided
    if product_context and isinstance(product_context, dict) and product_context.get("name"):
        print(f"-> Handling as Product-Specific Chat for: {product_context.get('name')}")
        return handle_product_specific_chat(user_message, clean_history, product_context)

    # 2. Classify intent
    intent = classify_user_intent(user_message, history=clean_history)
    print(f"\n[USER INTENT]: {intent['type']} | is_product={intent['is_product_query']} | is_project={intent['is_project_query']}")

    matched_products = []
    answer = ""

    # Case A: Pure General / Technical Question or Greeting (NO catalog retrieval)
    if not intent["is_product_query"]:
        print("-> Handling as General Technical Question (No catalog search)")
        ollama_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + clean_history + [{"role": "user", "content": user_message}]
        data = query_ollama(ollama_messages, num_predict=250)
        raw_ans = data.get("message", {}).get("content", "")
        answer = clean_final_assistant_answer(raw_ans)

        if not is_answer_complete(answer):
            msg_clean = user_message.lower().strip()
            if msg_clean in ("hello", "hi", "hey", "greetings"):
                answer = "Hello! How can I assist you with electronics and DigiComp products today?"
            elif "esp32" in msg_clean:
                answer = "The ESP32 is a low-cost, low-power microcontroller with built-in Wi-Fi and dual-mode Bluetooth, commonly used for IoT and embedded projects."
            elif "pwm" in msg_clean:
                answer = "Pulse Width Modulation (PWM) is a technique used to control analog circuits with digital outputs by varying the duty cycle of a square wave signal."
            elif "ohm" in msg_clean:
                answer = "Ohm's law states that the current through a conductor between two points is directly proportional to the voltage across the two points (V = I * R)."
            else:
                answer = f"Here is information regarding {user_message}: it is a fundamental electronics concept used in embedded systems design."

        return {
            "answer": answer,
            "tool_call": None,
            "products": [],
        }

    # Case B: Which one is best / Comparison follow-up
    if intent.get("is_which_best") and intent.get("inherited_query"):
        print("-> Handling as Product Comparison / Recommendation Follow-up")
        target_kw = intent["inherited_query"]
        comp_products = search_digicomp_catalog(query=target_kw, limit=4)
        matched_products = comp_products

        product_summaries = [f"{p['name']} (₹{p['price']:.0f}, {p['excerpt']})" for p in comp_products]
        comp_prompt = (
            f"The user previously asked about {target_kw}, and now asks: '{user_message}'.\n"
            f"Available DigiComp items are: {'; '.join(product_summaries)}.\n"
            f"Provide a clear, direct engineering comparison in 2-3 sentences explaining which one is best suited for their need (e.g. for robotics, standard ESP32 offers great value with dual-core and Wi-Fi/BLE at ₹359, while ESP32-S3 adds USB OTG and advanced vector instructions at ₹659)."
        )
        data = query_ollama([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": comp_prompt}
        ], num_predict=220)
        raw_ans = data.get("message", {}).get("content", "")
        answer = clean_final_assistant_answer(raw_ans)

        if not is_answer_complete(answer):
            if comp_products:
                answer = f"For a robot project, the standard ESP32 at ₹359 is typically the best choice because it provides dual-core processing, PWM for motor control, and wireless capabilities at an affordable price."
            else:
                answer = "Both boards are excellent choices depending on your specific processing and I/O requirements."

        return {
            "answer": answer,
            "tool_call": None,
            "products": matched_products,
        }

    # Case C: Project Recommendation Query (e.g. "I want to build an obstacle avoiding robot")
    if intent["is_project_query"]:
        print("-> Handling as Project Recommendation Query")
        constraints = extract_search_constraints(user_message)
        matched_products = find_project_recommendations(user_message, max_price=constraints["max_price"])

        product_names = [p["name"] for p in matched_products]
        if matched_products:
            prompt_content = (
                f"The user asked: '{user_message}'.\n"
                f"Explain the essential components required for this project in 1-2 clear sentences (e.g. microcontroller, distance sensor, motor driver, motors, chassis).\n"
                f"Mention that DigiComp has {', '.join(product_names)} available in our catalog for the brain/controller of the build. Keep it conversational."
            )
        else:
            prompt_content = (
                f"The user asked: '{user_message}'.\n"
                f"Explain the essential components needed in 1-2 sentences. Mention that while DigiComp offers development microcontrollers, the specific project kit is not currently in stock."
            )

        data = query_ollama([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt_content}
        ], num_predict=220)
        raw_ans = data.get("message", {}).get("content", "")
        answer = clean_final_assistant_answer(raw_ans)

        if not is_answer_complete(answer):
            if matched_products:
                names = ", ".join(product_names)
                answer = f"An obstacle-avoiding robot typically needs a microcontroller, distance sensor, motor driver, motors, and a chassis. DigiComp currently has {names} available for the controller."
            else:
                answer = "An obstacle-avoiding robot typically needs a microcontroller, distance sensor, motor driver, motors, and a chassis."

        return {
            "answer": answer,
            "tool_call": None,
            "products": matched_products,
        }

    # Case D: Product Catalog Inquiry / Search / Follow-up Filter
    print("-> Handling as DigiComp Product Catalog Inquiry")
    constraints = extract_search_constraints(user_message)
    effective_query = constraints["clean_query"]
    
    # If follow-up with empty query or constraint words, use inherited query from previous turn
    is_empty_or_fluff = (not effective_query) or (effective_query in (
        "products", "items", "components", "only in stock", "in stock", "stock", "only", "available"
    ))
    if is_empty_or_fluff and intent["inherited_query"]:
        effective_query = intent["inherited_query"]

    # Inherit max_price if not explicitly specified in this follow-up turn
    effective_max_price = constraints["max_price"]
    if effective_max_price is None and intent["inherited_max_price"] is not None:
        effective_max_price = intent["inherited_max_price"]

    # If user asked about Wi-Fi + Bluetooth
    msg_low = user_message.lower()
    if ("wifi" in msg_low or "wi-fi" in msg_low) and "bluetooth" in msg_low:
        if not effective_query or effective_query in ("board", "boards"):
            effective_query = "wifi bluetooth"

    matched_products = search_digicomp_catalog(
        query=effective_query,
        max_price=effective_max_price,
        min_price=constraints["min_price"],
        stock_only=constraints["stock_only"],
        limit=6,
    )

    print(f"Catalog search result count: {len(matched_products)} for query='{effective_query}', max_price={effective_max_price}, stock_only={constraints['stock_only']}")

    if matched_products:
        product_names = [f"{p['name']} (₹{p['price']:.0f})" for p in matched_products[:3]]
        confirm_prompt = (
            f"The user asked: '{user_message}'.\n"
            f"From the live DigiComp catalog, we found {len(matched_products)} matching items: {', '.join(product_names)}.\n"
            f"Confirm the available products in 1-2 friendly, conversational sentences. Do not list detailed specs or bullets as product cards appear below."
        )
        data = query_ollama([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": confirm_prompt}
        ], num_predict=180)
        raw_ans = data.get("message", {}).get("content", "")
        answer = clean_final_assistant_answer(raw_ans)

        if not is_answer_complete(answer):
            if len(matched_products) == 1:
                answer = f"I found the {matched_products[0]['name']} in the DigiComp catalog matching your request."
            else:
                names = ", ".join(p['name'] for p in matched_products[:3])
                answer = f"I found {len(matched_products)} matching products in the DigiComp catalog, including {names}."
    else:
        no_match_prompt = (
            f"The user asked: '{user_message}'.\n"
            f"We searched the live DigiComp catalog for '{effective_query or user_message}' with constraint max_price={effective_max_price} but found 0 matching products.\n"
            f"State clearly and politely in 1 sentence that DigiComp does not currently have this item in stock or in the catalog. Do NOT invent fake products."
        )
        data = query_ollama([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": no_match_prompt}
        ], num_predict=150)
        raw_ans = data.get("message", {}).get("content", "")
        answer = clean_final_assistant_answer(raw_ans)

        if not is_answer_complete(answer):
            if effective_max_price:
                answer = f"I couldn't find any matching products under ₹{effective_max_price:.0f} in the current DigiComp catalog."
            elif effective_query:
                answer = f"I couldn't find any {effective_query} in the current DigiComp catalog."
            else:
                answer = "I couldn't find a matching product in the current DigiComp catalog."

    elapsed = time.time() - start_req
    print(f"Request complete in {elapsed:.2f}s | Answer: {answer[:60]}... | Products: {len(matched_products)}")

    return {
        "answer": answer,
        "tool_call": None,
        "products": matched_products,
    }
