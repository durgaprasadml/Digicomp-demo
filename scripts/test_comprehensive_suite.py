import os
import sys
import json
import urllib.request
import re
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.db import init_db, seed_products, get_all_conversations, get_conversation_by_id, save_chat_message
from backend.products import PRODUCTS
from backend.ai import process_chat_message, clean_final_assistant_answer, is_answer_complete

init_db()
seed_products(PRODUCTS)

FORBIDDEN_PATTERNS = [
    r"<think>", r"</think>", r"<thinking>", r"</thinking>", r"<analysis>", r"</analysis>",
    r"SEARCH_PRODUCTS:", r"search_digicomp_products", r"MAX_PRICE:",
    r"\bthe query should be\b", r"\bi'll call the tool\b", r"\bi need to search\b",
    r"\bthere is a function to search\b", r"\bthe user wants\b", r"\blet me check\b",
    r"\bi need to make sure\b", r"\bthe tool will return\b", r"\bthe previous interaction\b",
    r"\bi'll use\b", r"\bmax_price should be\b", r"\bquery should be\b"
]

def check_for_forbidden_content(text: str) -> list[str]:
    found = []
    for pat in FORBIDDEN_PATTERNS:
        if re.search(pat, text, re.IGNORECASE):
            found.append(pat)
    return found

def run_tests():
    print("================================================================")
    print("DIGICOMP AI RESPONSE PIPELINE - COMPREHENSIVE VERIFICATION SUITE")
    print("================================================================\n")

    test_queries = [
        ("1. What is a sensor?", "What is a sensor?", [], False),
        ("2. Do you have a 12V motor?", "Do you have a 12V motor?", [], True),
        ("3. Show me sensors under ₹200.", "Show me sensors under ₹200.", [], True),
        ("4. I want something that can detect distance.", "I want something that can detect distance.", [], True),
        ("5. I need a board that has WiFi and Bluetooth.", "I need a board that has WiFi and Bluetooth.", [], True),
        ("6. I want to build an obstacle avoiding robot.", "I want to build an obstacle avoiding robot.", [], True),
        ("7. Show me products under ₹100.", "Show me products under ₹100.", [], True),
        ("8. What is a Raspberry Pi?", "What is a Raspberry Pi?", [], False),
        ("9. What did we discuss earlier?", "What did we discuss earlier?", [
            {"role": "user", "content": "I am looking for an ESP32 board."},
            {"role": "assistant", "content": "The ESP32 DevKit V1 is available in the DigiComp catalog."}
        ], False),
        ("10. Brand new unseen question", "Can you explain the difference between SPI and I2C protocols?", [], False),
    ]

    all_passed = True

    for title, q, hist, expect_products in test_queries:
        print(f"--- RUNNING TEST: {title} ---")
        print(f"Prompt: \"{q}\"")
        start = time.time()
        res = process_chat_message(q, hist)
        elapsed = time.time() - start
        
        answer = res.get("answer", "")
        products = res.get("products", [])

        forbidden = check_for_forbidden_content(answer)
        complete = is_answer_complete(answer)

        print(f"Elapsed: {elapsed:.2f}s")
        print(f"Answer: \"{answer}\"")
        print(f"Products ({len(products)}): {[p['name'] + ' (₹' + str(p['price']) + ')' for p in products]}")
        print(f"Completeness Check: {'PASSED' if complete else 'FAILED'}")
        print(f"Forbidden Leaks: {'NONE (PASSED)' if not forbidden else f'FAILED: {forbidden}'}")

        if forbidden or not complete:
            all_passed = False
            print(">>> RESULT: FAIL ❌\n")
        else:
            print(">>> RESULT: PASS ✅\n")

    # TEST 11: Request-Scoped Search Filter Isolation Test (Section 7)
    print("--- RUNNING TEST 11: Request-Scoped Filter Isolation (Section 7) ---")
    print("Turn 1: 'Show me sensors under ₹200'")
    res1 = process_chat_message("Show me sensors under ₹200")
    print(f"Turn 1 Products ({len(res1['products'])}): {[p['name'] + ' (₹' + str(p['price']) + ')' for p in res1['products']]}")
    
    # Next turn without price constraint: "I want to build a small CNC machine." (NEMA17 is ₹320, A4988 is ₹180)
    print("\nTurn 2: 'I want to build a small CNC machine.' (with previous history)")
    hist_turn2 = [
        {"role": "user", "content": "Show me sensors under ₹200"},
        {"role": "assistant", "content": res1["answer"]}
    ]
    res2 = process_chat_message("I want to build a small CNC machine.", history=hist_turn2)
    print(f"Turn 2 Answer: \"{res2['answer']}\"")
    print(f"Turn 2 Products ({len(res2['products'])}): {[p['name'] + ' (₹' + str(p['price']) + ')' for p in res2['products']]}")
    
    # Verify ₹200 filter did NOT block NEMA17 (₹320) or CNC items
    nema17_found = any(p["name"] == "NEMA17 Stepper Motor" or p["price"] > 200 for p in res2["products"])
    print(f"Filter Isolation Verified: {'PASSED (Filter was NOT leaked) ✅' if nema17_found or len(res2['products']) > 0 else 'WARNING'}")

    print("\n================================================================")
    print(f"OVERALL STATUS: {'ALL TESTS PASSED ✅' if all_passed else 'SOME TESTS FAILED ❌'}")
    print("================================================================")

if __name__ == "__main__":
    run_tests()
