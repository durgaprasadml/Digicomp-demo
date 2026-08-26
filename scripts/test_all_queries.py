import urllib.request
import json
import time

API_URL = "http://127.0.0.1:3000/api/ai/chat"

test_cases = [
    "Hello",
    "What is an ESP32?",
    "What is a sensor?",
    "What is a relay?",
    "Who invented the transistor?",
    "I need an ESP32 under ₹500",
    "I want to build an obstacle avoiding robot",
    "I need to build a 3D printer",
    "Can ESP32 control a DC motor?",
    "What did I ask you about earlier?"
]

def run_all_tests():
    print("==================================================", flush=True)
    print("RUNNING ALL 10 TEST CASES AGAINST DIGICOMP AI", flush=True)
    print("==================================================\n", flush=True)

    history = []
    results = []

    for idx, q in enumerate(test_cases, 1):
        print("--------------------------------------------------", flush=True)
        print(f"[TEST {idx}/10] Query: \"{q}\"", flush=True)
        
        payload = {
            "message": q,
            "history": history
        }
        
        req = urllib.request.Request(
            API_URL,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                total_time = time.time() - t0
                data = json.loads(resp.read().decode('utf-8'))
                
                answer = data.get("answer", "")
                products = data.get("products", [])
                timing = data.get("timing", {})
                qwen_ms = timing.get("qwenMs", 0)
                tool_ms = timing.get("toolMs", 0)
                
                print(f"Status: SUCCESS | Total: {total_time:.2f}s | Qwen: {qwen_ms/1000:.2f}s | DB Tool: {tool_ms/1000:.3f}s", flush=True)
                print(f"Answer snippet: \"{answer[:120]}...\"", flush=True)
                print(f"Products count: {len(products)}", flush=True)
                
                history.append({"role": "user", "content": q})
                history.append({"role": "assistant", "content": answer})
                
                results.append({
                    "test_no": idx,
                    "query": q,
                    "total_time_sec": round(total_time, 2),
                    "qwen_time_sec": round(qwen_ms / 1000, 2),
                    "db_time_sec": round(tool_ms / 1000, 3),
                    "products_count": len(products),
                    "success": True,
                    "answer_preview": answer[:150]
                })
        except Exception as err:
            total_time = time.time() - t0
            print(f"Status: FAILED | Total: {total_time:.2f}s | Error: {err}", flush=True)
            results.append({
                "test_no": idx,
                "query": q,
                "total_time_sec": round(total_time, 2),
                "qwen_time_sec": None,
                "db_time_sec": None,
                "products_count": 0,
                "success": False,
                "error": str(err)
            })

    print("\n==================================================", flush=True)
    print("TEST SUITE SUMMARY REPORT", flush=True)
    print("==================================================", flush=True)
    print(f"{'#':<3} | {'Query':<40} | {'Total(s)':<8} | {'Qwen(s)':<8} | {'DB(s)':<8} | {'Products':<8} | {'Status'}", flush=True)
    print("-" * 95, flush=True)
    for r in results:
        status_str = "PASS" if r["success"] else "FAIL"
        qwen_str = f"{r['qwen_time_sec']:.2f}" if r["qwen_time_sec"] is not None else "N/A"
        db_str = f"{r['db_time_sec']:.3f}" if r["db_time_sec"] is not None else "N/A"
        print(f"{r['test_no']:<3} | {r['query']:<40} | {r['total_time_sec']:<8} | {qwen_str:<8} | {db_str:<8} | {r['products_count']:<8} | {status_str}", flush=True)

if __name__ == "__main__":
    run_all_tests()
