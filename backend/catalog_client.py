import os
import re
import time
import json
import logging
import urllib.request
import urllib.error

logger = logging.getLogger("digicomp.catalog")

DIGICOMP_SITE_URL = os.environ.get("DIGICOMP_SITE_URL", "http://digicomp.local").rstrip("/")
DIGICOMP_API_BASE = f"{DIGICOMP_SITE_URL}/wp-json/dc/v1"

# In-memory catalog cache with 60-second TTL
_CATALOG_CACHE = {
    "timestamp": 0.0,
    "products": [],
    "filters": {},
}
CACHE_TTL = 60.0  # seconds

PROJECT_COMPONENTS_MAP = {
    "obstacle": ["microcontroller", "ultrasonic sensor", "motor driver", "dc geared motor", "robot chassis"],
    "robot": ["microcontroller", "distance sensor", "motor driver", "dc motor", "robot chassis"],
    "irrigation": ["microcontroller", "soil moisture sensor", "water pump", "relay"],
    "weather": ["microcontroller", "temperature sensor", "humidity sensor", "display"],
    "3d printer": ["microcontroller", "stepper driver", "stepper motor", "power supply"],
    "cnc": ["microcontroller", "stepper driver", "stepper motor", "power supply"],
}

COMPONENT_SYNONYMS = {
    "microcontroller": ["esp32", "rp2040", "rp2350", "stm32", "ch32", "mcu"],
    "mcu": ["esp32", "rp2040", "rp2350", "stm32", "ch32", "nuvoton"],
    "sbc": ["rk3506", "industrial sbc", "sbc"],
    "distance sensor": ["ultrasonic", "hc-sr04", "distance", "proximity", "sensor"],
    "sensor": ["sensor", "ultrasonic", "temperature", "humidity", "moisture", "ldr"],
    "motor driver": ["l298n", "a4988", "driver", "motor driver"],
    "motor": ["dc motor", "stepper", "geared motor", "servo", "12v motor"],
    "chassis": ["chassis", "robot chassis", "2wd", "4wd"],
    "programmer": ["wch linke", "programmer", "debugger"],
    "fpga": ["artix", "xilinx", "fpga"],
}


def normalize_product(p: dict) -> dict:
    """
    Normalizes a WooCommerce API product dict into a uniform DigiComp product structure.
    """
    pid = int(p.get("id") or 0)
    name = str(p.get("name") or "").strip()
    slug = str(p.get("slug") or f"product-{pid}").strip()
    sku = str(p.get("sku") or "").strip()
    
    # Categories
    cats = p.get("categories") or []
    if isinstance(cats, str):
        cats = [cats]
    category = cats[0] if cats else "Hardware"

    tags = p.get("tags") or []
    brands = p.get("brands") or []

    # Price handling
    try:
        price_val = float(p.get("price") or 0)
    except (ValueError, TypeError):
        price_val = 0.0

    try:
        reg_price = float(p.get("regPrice") or price_val)
    except (ValueError, TypeError):
        reg_price = price_val

    sale_price = None
    if p.get("salePrice") is not None and str(p.get("salePrice")).strip():
        try:
            sale_price = float(p.get("salePrice"))
        except (ValueError, TypeError):
            sale_price = None

    # Stock
    stock_status = str(p.get("stock") or "instock").lower()
    is_in_stock = stock_status in ("instock", "in_stock", "available")
    
    stock_qty = p.get("stockQty") or p.get("stock_quantity") or 0
    try:
        stock_qty = int(stock_qty)
    except (ValueError, TypeError):
        stock_qty = 5 if is_in_stock else 0

    # Images and URLs
    image_url = str(p.get("image") or p.get("image_url") or "").strip()
    if not image_url:
        image_url = f"{DIGICOMP_SITE_URL}/wp-content/themes/dc/assets/img/logo.svg"

    product_url = str(p.get("url") or f"/product/{slug}")
    if not product_url.startswith("http") and not product_url.startswith("/"):
        product_url = f"/{product_url}"

    attrs = p.get("attributes") or {}

    return {
        "id": pid,
        "name": name,
        "slug": slug,
        "sku": sku,
        "category": category,
        "categories": cats,
        "tags": tags,
        "brands": brands,
        "excerpt": str(p.get("excerpt") or "").strip(),
        "description": str(p.get("description") or p.get("excerpt") or "").strip(),
        "price": price_val,
        "regPrice": reg_price,
        "salePrice": sale_price,
        "stock": stock_status,
        "in_stock": is_in_stock,
        "stock_quantity": stock_qty,
        "image_url": image_url,
        "product_url": product_url,
        "permalink": str(p.get("permalink") or f"{DIGICOMP_SITE_URL}/product/{slug}/"),
        "attributes": attrs,
    }


def fetch_live_catalog(force_refresh: bool = False) -> list[dict]:
    """
    Fetches the live catalog from the DigiComp website REST API.
    Caches results in memory for CACHE_TTL seconds to ensure sub-millisecond response times.
    """
    global _CATALOG_CACHE
    now = time.time()

    if not force_refresh and _CATALOG_CACHE["products"] and (now - _CATALOG_CACHE["timestamp"] < CACHE_TTL):
        return _CATALOG_CACHE["products"]

    url = f"{DIGICOMP_API_BASE}/shop"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "DigiComp-AI-Assistant/1.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw_products = data.get("products", [])
            normalized = [normalize_product(p) for p in raw_products]
            
            _CATALOG_CACHE["timestamp"] = now
            _CATALOG_CACHE["products"] = normalized
            _CATALOG_CACHE["filters"] = data.get("filters", {})
            logger.info("Successfully fetched %d live products from %s", len(normalized), url)
            return normalized
    except Exception as exc:
        logger.warning("Failed to fetch live catalog from %s: %s", url, exc)
        if _CATALOG_CACHE["products"]:
            return _CATALOG_CACHE["products"]
        return []


def fetch_single_product_details(slug_or_id: str | int) -> dict | None:
    """
    Retrieves full single product details from /wp-json/dc/v1/product/{slug}.
    """
    url = f"{DIGICOMP_API_BASE}/product/{slug_or_id}"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "DigiComp-AI-Assistant/1.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data
    except Exception as exc:
        logger.warning("Failed to fetch product details for %s: %s", slug_or_id, exc)
        return None


def extract_search_constraints(user_text: str) -> dict:
    """
    Normalizes natural language expressions into search constraints:
    - max_price (e.g. "under ₹500", "below 500", "less than 500 rupees")
    - min_price (e.g. "above 200", "more than 200")
    - stock_only (e.g. "in stock", "only in stock", "available")
    - clean_query (the remaining core search term)
    """
    text = user_text.lower().strip()

    # Max price: matches "under 500", "below ₹500", "less than 500 rupees", "<= 500"
    max_price = None
    price_match = re.search(r'(?:under|below|less than|within|\<|<=)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', text)
    if price_match:
        try:
            max_price = float(price_match.group(1))
        except ValueError:
            max_price = None

    # Min price: matches "above 200", "more than ₹200", "> 200"
    min_price = None
    min_match = re.search(r'(?:above|over|more than|greater than|\>|>=)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', text)
    if min_match:
        try:
            min_price = float(min_match.group(1))
        except ValueError:
            min_price = None

    # Stock constraint
    stock_only = bool(re.search(r'(in\s+stock|available|only\s+in\s+stock|in-stock)', text))

    # Strip price phrases from query
    q = re.sub(r'(?:under|below|less than|within|\<|<=)\s*(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?(?:\s*rupees)?', '', text)
    q = re.sub(r'(?:above|over|more than|greater than|\>|>=)\s*(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?(?:\s*rupees)?', '', q)
    q = re.sub(r'(?:only\s+in\s+stock|in\s+stock|in-stock|available|stock\s+only)', '', q)
    
    # Strip conversational inquiry prefixes
    fluff_patterns = [
        r'^(?:show\s+me|find\s+me|give\s+me|get\s+me|display|search\s+for|search)',
        r'^(?:do\s+you\s+have|are\s+there\s+any|is\s+there|have\s+you\s+got)',
        r'^(?:i\s+need|i\s+want|i\s+am\s+looking\s+for|looking\s+for|suggest|recommend)',
        r'^(?:can\s+you\s+find|can\s+you\s+suggest|can\s+you\s+show|can\s+you\s+recommend)',
        r'^(?:what\s+are\s+the|which\s+one\s+is|what\s+is\s+the\s+price\s+of)',
    ]
    for fp in fluff_patterns:
        q = re.sub(fp, '', q).strip()

    # Strip leading articles
    q = re.sub(r'^(?:an?|some|all|the)\s+', '', q).strip()
    # Replace non-alphanumeric punctuation with spaces, but keep hyphens
    q = re.sub(r'[^a-zA-Z0-9\s-]', ' ', q).strip()
    q = re.sub(r'\s+', ' ', q).strip()

    return {
        "raw_text": user_text,
        "clean_query": q,
        "max_price": max_price,
        "min_price": min_price,
        "stock_only": stock_only,
    }


def calculate_relevance(product: dict, query_terms: list[str], full_query: str) -> float:
    """
    Calculates weighted relevance score.
    Returns 0.0 if the product does not match any of the query terms.
    """
    if not query_terms and not full_query:
        return 0.0

    name_lower = product["name"].lower()
    slug_lower = product["slug"].lower()
    sku_lower = product["sku"].lower()
    cat_lower = product["category"].lower()
    desc_lower = (product["excerpt"] + " " + product["description"]).lower()
    
    attrs_str = ""
    for k, v in product.get("attributes", {}).items():
        if isinstance(v, list):
            attrs_str += f" {k} {' '.join(str(item) for item in v)}"
        else:
            attrs_str += f" {k} {v}"
    attrs_lower = attrs_str.lower()

    score = 0.0
    matched_any = False

    # 1. Exact match on full query
    if full_query:
        if full_query == name_lower:
            score += 100.0
            matched_any = True
        elif full_query == slug_lower:
            score += 90.0
            matched_any = True
        elif full_query == sku_lower:
            score += 95.0
            matched_any = True
        elif re.search(r'' + re.escape(full_query) + r'', name_lower):
            score += 60.0
            matched_any = True

    # 2. Match individual query terms
    # Ignore stop words in query
    stop_words = {"a", "an", "the", "and", "or", "for", "with", "in", "of", "to", "on", "at", "by", "is", "are", "do", "you", "have", "me"}
    meaningful_terms = [t for t in query_terms if t not in stop_words and len(t) > 1]
    
    if not meaningful_terms and not matched_any:
        return 0.0

    term_matches = 0
    for term in meaningful_terms:
        term_matched = False
        
        # Name match
        if term == name_lower:
            score += 50.0
            term_matched = True
        elif re.search(r'' + re.escape(term) + r'', name_lower):
            score += 35.0
            term_matched = True
        elif term in name_lower:
            score += 20.0
            term_matched = True

        # Category match
        if term == cat_lower:
            score += 25.0
            term_matched = True
        elif term in cat_lower:
            score += 15.0
            term_matched = True

        # Wireless specs (wifi, bluetooth, ble)
        if term in ("wifi", "wi-fi"):
            if "wi-fi" in desc_lower or "wifi" in desc_lower or "wi-fi" in attrs_lower:
                score += 30.0
                term_matched = True
        elif term in ("bluetooth", "ble"):
            if "bluetooth" in desc_lower or "ble" in desc_lower or "bluetooth" in attrs_lower:
                score += 30.0
                term_matched = True

        # Processor / architecture specs (risc-v, arm, xtensa, 240mhz, etc.)
        if term in ("risc-v", "riscv"):
            if "risc v" in attrs_lower or "risc-v" in desc_lower or "ch32" in name_lower:
                score += 30.0
                term_matched = True
        elif re.search(r'' + re.escape(term) + r'', attrs_lower):
            score += 25.0
            term_matched = True
        elif re.search(r'' + re.escape(term) + r'', desc_lower):
            score += 15.0
            term_matched = True

        if term_matched:
            term_matches += 1
            matched_any = True

    # If meaningful terms were present but NONE matched, score is 0
    if meaningful_terms and term_matches == 0 and not matched_any:
        return 0.0

    # Boost score if multiple terms matched
    if len(meaningful_terms) > 1 and term_matches == len(meaningful_terms):
        score += 30.0

    # Stock boost ONLY if there was already an actual match
    if matched_any and product.get("in_stock", False):
        score += 5.0

    return score


def search_digicomp_catalog(
    query: str = "",
    max_price: float | None = None,
    min_price: float | None = None,
    stock_only: bool = False,
    category: str | None = None,
    brand: str | None = None,
    limit: int = 6,
) -> list[dict]:
    """
    High-performance, website-aware product search and ranking.
    Searches the live DigiComp catalog and applies exact filtering and relevance ranking.
    """
    catalog = fetch_live_catalog()
    if not catalog:
        return []

    constraints = extract_search_constraints(query or "")
    clean_q = constraints["clean_query"]
    effective_max_price = max_price if max_price is not None else constraints["max_price"]
    effective_min_price = min_price if min_price is not None else constraints["min_price"]
    effective_stock_only = stock_only or constraints["stock_only"]

    query_terms = [t for t in clean_q.split() if len(t) > 1] if clean_q else []

    results = []
    for p in catalog:
        # Stock filter
        if effective_stock_only and not p.get("in_stock", False):
            continue

        # Price filters
        price = p.get("price", 0.0)
        if effective_max_price is not None and price > effective_max_price:
            continue
        if effective_min_price is not None and price < effective_min_price:
            continue

        # Category filter
        if category and category.lower() not in p.get("category", "").lower():
            continue

        # Brand filter
        if brand and not any(brand.lower() in b.lower() for b in p.get("brands", [])):
            continue

        # Calculate relevance
        score = 0.0
        if not clean_q or clean_q in ("products", "items", "components", "all", "boards"):
            # Generic listing - rank in-stock first, then by date/id
            score = 10.0 + (5.0 if p.get("in_stock", False) else 0.0)
        else:
            score = calculate_relevance(p, query_terms, clean_q)

        # STRICT: Only include if there is an actual positive relevance match
        if score > 0:
            results.append((score, p))

    # Sort descending by score, then ascending by price
    results.sort(key=lambda item: (-item[0], item[1].get("price", 0.0)))

    return [item[1] for item in results[:limit]]


def find_project_recommendations(project_query: str, max_price: float | None = None) -> list[dict]:
    """
    Decomposes an engineering project request (e.g. "obstacle avoiding robot")
    into required component types and searches the real catalog for matching DigiComp products.
    """
    q_lower = project_query.lower()
    matched_project = None

    for key in PROJECT_COMPONENTS_MAP:
        if key in q_lower:
            matched_project = key
            break

    if not matched_project:
        return search_digicomp_catalog(query=project_query, max_price=max_price, limit=4)

    required_components = PROJECT_COMPONENTS_MAP[matched_project]
    found_products = []
    seen_ids = set()

    catalog = fetch_live_catalog()
    for comp in required_components:
        synonyms = COMPONENT_SYNONYMS.get(comp, [comp])
        comp_matches = []
        for term in synonyms:
            matches = search_digicomp_catalog(query=term, max_price=max_price, limit=2)
            for m in matches:
                if m["id"] not in seen_ids:
                    comp_matches.append(m)
                    seen_ids.add(m["id"])
                    break
            if comp_matches:
                break
        found_products.extend(comp_matches)

    return found_products[:6]
