import os
import urllib.request
import json
import time

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
MODEL = os.environ.get("AI_MODEL") or os.environ.get("MODEL_NAME") or "gemma3:270m"

SYSTEM_PROMPT = "You are DigiComp AI, a helpful conversational assistant for an electronics and microcontroller e-commerce store. Answer user questions naturally. You have access to a tool `search_digicomp_products` to search our SQLite database for products when relevant."

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_digicomp_products",
            "description": "Search DigiComp's electronics product database for microcontrollers, sensors, relays, motor drivers, components, or project parts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Search query e.g. ESP32, ultrasonic sensor, relay, motor driver" },
                    "max_price": { "type": "number", "description": "Maximum price in INR (₹) or null" }
                },
                "required": ["query"]
            }
        }
    }
]

def test_ollama_tool_call(prompt: str):
    print(f"\n==========================================")
    print(f"[USER]: \"{prompt}\"")
    start = time.time()
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "tools": TOOLS,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 300
        }
    }

    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            msg = data.get("message", {})
            print(f"Elapsed time: {time.time() - start:.2f}s")
            print(f"[QWEN MESSAGE]: {json.dumps(msg, indent=2)}")
    except Exception as e:
        print(f"[ERROR]: {e}")

if __name__ == "__main__":
    test_ollama_tool_call("Hello")
    test_ollama_tool_call("Who invented the transistor?")
    test_ollama_tool_call("What is an ESP32?")
    test_ollama_tool_call("I need an ESP32 under ₹500")
