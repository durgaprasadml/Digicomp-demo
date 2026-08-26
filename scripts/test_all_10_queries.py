import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.db import init_db, seed_products
from backend.products import PRODUCTS
from backend.ai import process_chat_message, clean_final_assistant_answer, is_answer_complete

init_db()
seed_products(PRODUCTS)

queries = [
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
    ("10. Novel Unseen Question", "Can you explain the difference between SPI and I2C protocols?", [])
]

print("=== TESTING ALL 10 TARGET QUERIES AGAINST DIGICOMP AI PIPELINE ===")

for idx, (title, q, hist) in enumerate(queries, 1):
    print(f"\n--------------------------------------------------")
    print(f"[{idx}/10] {title}")
    print(f"User Prompt: \"{q}\"")
    start = time.time()
    res = process_chat_message(q, hist)
    elapsed = time.time() - start

    answer = res.get("answer", "")
    products = res.get("products", [])

    print(f"Elapsed: {elapsed:.2f}s")
    print(f"Answer: \"{answer}\"")
    print(f"Products ({len(products)}): {[p['name'] + ' (₹' + str(p['price']) + ')' for p in products]}")
    print(f"Complete Answer: {is_answer_complete(answer)}")

print("\n=== ALL 10 TARGET QUERIES COMPLETED SUCCESSFULLY ===")
