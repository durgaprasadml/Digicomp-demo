# DigiComp AI Demo

A small end-to-end demo of an AI shopping/project assistant:

User -> Gemma 3 270M -> component requirements -> SQLite product search -> Gemma 3 final response -> product cards

## Requirements

- Python 3.10+
- Ollama
- Gemma 3 270M model (`gemma3:270m` - default) or Qwen3 (`qwen3:1.7b` / `qwen3:4b` - fallback)

## 1. Install Ollama and Gemma 3 270M

Install Ollama, then pull the active model:

```bash
ollama pull gemma3:270m
```

Verify:

```bash
ollama run gemma3:270m
```

*(Optional fallback: If you want to use Qwen models, run `ollama pull qwen3:1.7b` or `ollama pull qwen3:4b`)*

## 2. Set up Python

From this folder:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows:

```powershell
.venv\Scripts\activate
pip install -r requirements.txt
```

## 3. Model Configuration

The application uses `gemma3:270m` by default for ultra-lightweight, high-speed conversational responses. You can configure the active model via environment variables without changing source code:

```bash
# Default active model (ultra-fast 270M parameter model):
export AI_MODEL=gemma3:270m

# Switch to other models if needed:
export AI_MODEL=qwen3:1.7b
export AI_MODEL=qwen3:4b
```

## 4. Start the backend

FastAPI backend:
```bash
uvicorn backend.main:app --reload
```

Next.js full-stack app (in `frontend/` directory):
```bash
cd frontend
npm run dev
```

Open:

- FastAPI: http://127.0.0.1:8000
- Next.js: http://localhost:3000

The demo automatically creates `data/digicomp.db` and seeds 20 sample products.

## 5. Demo questions

Try:

- I want to build an obstacle avoiding robot
- I want to build a smart irrigation system
- I need an ESP32 under ₹500
- I want to build a weather station
- I need a motor driver for a 12V project
- What do I need for a line follower robot?

## Notes

- Product information is intentionally local and deterministic.
- DigiComp AI does not invent prices, stock, images, or URLs.
- Product images are generated SVG placeholders stored in the database as data URLs, so the demo has zero external image dependencies.
- The "Add to Cart" button is a working demo cart counter; it does not connect to a real store.
- If Ollama is unavailable, the API returns an informative error.

## Important product-source rule

The assistant is intentionally split into two responsibilities:

1. Gemma 3 270M extracts the user's intent and generic component requirements.
2. The backend searches ONLY the DigiComp catalog stored in the local database.

The LLM does not generate product names, prices, stock, images, or URLs.

The included `scripts_crawl_site.py` is an optional starting point for syncing a real DigiComp website. Give it the real DigiComp domain:

```bash
python scripts_crawl_site.py https://YOUR-DIGICOMP-DOMAIN
```

It stays on that domain and looks for product JSON-LD in pages discovered through the site's sitemap. The real website URL and/or its product/API structure are required before wiring the demo to the actual catalog.

## Assistant behavior

The assistant answers general and technical questions as well as project/product questions.
- "Hello" -> conversational answer, no products.
- "Who invented the transistor?" -> factual answer, no products.
- "What is an ESP32?" -> concise explanation + matching DigiComp products if present in the local catalog.
- Project requests -> concise requirements + matching DigiComp products.
- Product requests -> concise answer + matching DigiComp products.

The LLM never supplies product prices, stock, images, URLs, or external shopping links. Those fields always come from the DigiComp catalog database.
