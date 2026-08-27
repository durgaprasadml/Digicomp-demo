import os
import urllib.request
import json
import time

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
MODEL = os.environ.get("AI_MODEL") or os.environ.get("MODEL_NAME") or "qwen3.5:0.8b"

SYSTEM_PROMPT = """You are DigiComp AI. Output ONLY valid JSON matching this schema:
{
  "answer": "A concise direct technical answer (1-3 sentences).",
  "intent": "conversation|general_question|technical_question|product_search|project_request",
  "search_products": true,
  "search_query": "search query or null",
  "components": [],
  "filters": {
    "max_price": null,
    "in_stock": true,
    "category": null
  }
}
"""

def test_query(prompt: str):
    print(f"\n==========================================")
    print(f"[USER PROMPT]: {prompt}")
    start = time.time()
    
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.0,
            "num_predict": 250
        }
    }
    
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            msg = data.get("message", {})
            content = msg.get("content", "")
            thinking = msg.get("thinking", "")
            raw = (content + "\n" + thinking).strip()
            print(f"[RAW QWEN RESPONSE] ({time.time() - start:.2f}s):\n{raw}")
            
            # Extract JSON object
            match = json.loads(content) if content.strip().startswith("{") else None
            if match:
                print(f"\n[PARSED ANSWER]: {match.get('answer')}")
                print(f"[PARSED INTENT]: {match.get('intent')}")
                print(f"[SEARCH QUERY]: {match.get('search_query')}")
                print(f"[COMPONENTS]: {match.get('components')}")
    except Exception as e:
        print(f"[ERROR]: {e}")

if __name__ == "__main__":
    test_query("What is a sensor?")
    test_query("I want to build an obstacle avoiding robot.")
