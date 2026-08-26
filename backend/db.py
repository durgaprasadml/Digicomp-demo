from pathlib import Path
import sqlite3
import json

import hashlib
import secrets
import hmac
from datetime import datetime, timedelta

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "digicomp.db"

def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            category TEXT NOT NULL,
            subcategory TEXT NOT NULL,
            description TEXT NOT NULL,
            price REAL NOT NULL,
            stock_quantity INTEGER NOT NULL,
            in_stock INTEGER NOT NULL DEFAULT 1,
            image_url TEXT NOT NULL,
            product_url TEXT NOT NULL,
            specifications TEXT NOT NULL,
            tags TEXT NOT NULL,
            keywords TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            title TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            product_ids TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);")
    
    # Check if migration needed for conversations table missing user_id column
    try:
        cur = conn.execute("PRAGMA table_info(conversations)")
        columns = [row["name"] for row in cur.fetchall()]
        if "user_id" not in columns:
            conn.execute("ALTER TABLE conversations ADD COLUMN user_id TEXT")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)")
    except Exception:
        pass

    conn.commit()
    conn.close()

def seed_products(products_list):
    conn = get_connection()
    count = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    if count == 0:
        for p in products_list:
            if isinstance(p, tuple) and len(p) >= 11:
                pid, sku, name, category, desc, price, stock, img, url, tags, specs = p[:11]
                slug = sku.lower().replace("-", "")
                conn.execute("""
                    INSERT OR IGNORE INTO products 
                    (id, sku, name, slug, category, subcategory, description, price, stock_quantity, in_stock, image_url, product_url, specifications, tags, keywords)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (pid, sku, name, slug, category, category, desc, price, stock, 1 if stock > 0 else 0, img, url, specs, tags, tags))
        conn.commit()
    conn.close()

# 1. get_all_products()
def get_all_products():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM products ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

# 2. get_product_by_id(id)
def get_product_by_id(product_id):
    conn = get_connection()
    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

# 3. search_products(query)
def search_products(query: str, limit: int = 20):
    generic_terms = {"product", "products", "item", "items", "component", "components", "all", "everything", "anything"}
    if not query or not query.strip() or query.strip().lower() in generic_terms:
        conn = get_connection()
        rows = conn.execute("SELECT * FROM products ORDER BY id ASC LIMIT ?", (limit,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    conn = get_connection()
    q = f"%{query.lower().strip()}%"
    rows = conn.execute("""
        SELECT *,
          CASE
            WHEN lower(name) LIKE ? THEN 1
            WHEN lower(sku) LIKE ? THEN 2
            WHEN lower(category) LIKE ? THEN 3
            WHEN lower(tags) LIKE ? THEN 4
            ELSE 5
          END as relevance
        FROM products
        WHERE lower(name) LIKE ?
           OR lower(sku) LIKE ?
           OR lower(category) LIKE ?
           OR lower(subcategory) LIKE ?
           OR lower(description) LIKE ?
           OR lower(tags) LIKE ?
           OR lower(keywords) LIKE ?
           OR lower(specifications) LIKE ?
        ORDER BY relevance ASC, stock_quantity DESC, price ASC
        LIMIT ?
    """, (q, q, q, q, q, q, q, q, q, q, q, q, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# 4. search_products_by_category(category)
def search_products_by_category(category: str):
    if not category or category.lower() == 'all':
        return get_all_products()
    conn = get_connection()
    rows = conn.execute("SELECT * FROM products WHERE lower(category) = lower(?) ORDER BY id ASC", (category,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# 5. search_products_by_price(min_price, max_price)
def search_products_by_price(min_price=None, max_price=None):
    conn = get_connection()
    sql = "SELECT * FROM products WHERE 1=1"
    params = []
    if min_price is not None:
        sql += " AND price >= ?"
        params.append(min_price)
    if max_price is not None:
        sql += " AND price <= ?"
        params.append(max_price)
    sql += " ORDER BY price ASC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# 6. search_products_in_stock()
def search_products_in_stock():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM products WHERE in_stock = 1 AND stock_quantity > 0 ORDER BY stock_quantity DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

# 7. search_products_with_filters(category, subcategory, min_price, max_price, in_stock_only, query, sort_by)
def search_products_with_filters(category=None, subcategory=None, min_price=None, max_price=None, in_stock_only=False, query=None, sort_by="id", limit=20):
    conn = get_connection()
    conditions = ["1=1"]
    params = []

    if category and category.lower() != "all":
        conditions.append("lower(category) = lower(?)")
        params.append(category)

    if subcategory:
        conditions.append("lower(subcategory) = lower(?)")
        params.append(subcategory)

    if min_price is not None:
        conditions.append("price >= ?")
        params.append(min_price)

    if max_price is not None:
        conditions.append("price <= ?")
        params.append(max_price)

    if in_stock_only:
        conditions.append("in_stock = 1 AND stock_quantity > 0")

    generic_terms = {"product", "products", "item", "items", "component", "components", "all", "everything", "anything"}
    if query and query.strip() and query.strip().lower() not in generic_terms:
        q = f"%{query.lower().strip()}%"
        conditions.append("""(
            lower(name) LIKE ?
            OR lower(sku) LIKE ?
            OR lower(category) LIKE ?
            OR lower(subcategory) LIKE ?
            OR lower(description) LIKE ?
            OR lower(tags) LIKE ?
            OR lower(keywords) LIKE ?
            OR lower(specifications) LIKE ?
        )""")
        params.extend([q] * 8)

    order_by = "id ASC"
    if sort_by == "price-asc":
        order_by = "price ASC"
    elif sort_by == "price-desc":
        order_by = "price DESC"
    elif sort_by == "name":
        order_by = "name ASC"
    elif sort_by == "stock":
        order_by = "stock_quantity DESC"

    sql = f"SELECT * FROM products WHERE {' AND '.join(conditions)} ORDER BY {order_by}"
    if limit is not None:
        sql += f" LIMIT {int(limit)}"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Alias for backwards compatibility
all_products = get_all_products

# ==========================================
# USER AUTHENTICATION & SESSION METHODS
# ==========================================

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hash_bytes = hashlib.pbkdf2_hmac("sha512", password.encode("utf-8"), salt.encode("utf-8"), 100000, dklen=64)
    return f"pbkdf2_sha512$100000${salt}${hash_bytes.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        parts = stored_hash.split("$")
        if len(parts) != 4:
            return False
        algorithm, iterations_str, salt, original_hash = parts
        if algorithm != "pbkdf2_sha512":
            return False
        iterations = int(iterations_str)
        hash_bytes = hashlib.pbkdf2_hmac("sha512", password.encode("utf-8"), salt.encode("utf-8"), iterations, dklen=64)
        return hmac.compare_digest(hash_bytes.hex(), original_hash)
    except Exception:
        return False

def create_user(name: str, email: str, password: str) -> dict:
    import time
    conn = get_connection()
    user_id = f"user-{int(time.time()*1000)}-{secrets.token_hex(4)}"
    now = datetime.utcnow().isoformat()
    pwd_hash = hash_password(password)
    clean_email = email.lower().strip()
    clean_name = name.strip()
    conn.execute("""
        INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, clean_name, clean_email, pwd_hash, now, now))
    conn.commit()
    conn.close()
    return {"id": user_id, "name": clean_name, "email": clean_email, "created_at": now}

def get_user_by_email(email: str) -> dict | None:
    if not email:
        return None
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_id(user_id: str) -> dict | None:
    if not user_id:
        return None
    conn = get_connection()
    row = conn.execute("SELECT id, name, email, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def create_session(user_id: str) -> dict:
    conn = get_connection()
    token = secrets.token_hex(32)
    now = datetime.utcnow()
    expires_at = (now + timedelta(days=30)).isoformat()
    conn.execute("""
        INSERT INTO sessions (token, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
    """, (token, user_id, expires_at, now.isoformat()))
    conn.commit()
    conn.close()
    return {"token": token, "expires_at": expires_at}

def get_session(token: str) -> dict | None:
    if not token:
        return None
    conn = get_connection()
    s_row = conn.execute("SELECT * FROM sessions WHERE token = ?", (token,)).fetchone()
    if not s_row:
        conn.close()
        return None
    s = dict(s_row)
    try:
        if datetime.fromisoformat(s["expires_at"]) < datetime.utcnow():
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
            conn.close()
            return None
    except Exception:
        pass

    u_row = conn.execute("SELECT id, name, email, created_at FROM users WHERE id = ?", (s["user_id"],)).fetchone()
    if not u_row:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        return None
    conn.close()
    return {"user": dict(u_row), "session": s}

def delete_session(token: str) -> bool:
    if not token:
        return False
    conn = get_connection()
    cur = conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    changed = cur.rowcount > 0
    conn.close()
    return changed

# ==========================================
# CONVERSATION & CHAT HISTORY METHODS
# ==========================================

def get_all_conversations(user_id=None, query=None):
    conn = get_connection()
    conditions = []
    params = []
    
    if user_id:
        conditions.append("c.user_id = ?")
        params.append(user_id)
        
    if query and query.strip():
        q = f"%{query.lower().strip()}%"
        conditions.append("(lower(c.title) LIKE ? OR lower(m.content) LIKE ?)")
        params.extend([q, q])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = f"""
        SELECT DISTINCT 
          c.id, 
          c.user_id,
          c.title, 
          c.created_at, 
          c.updated_at,
          COUNT(m.id) as message_count,
          (
            SELECT content FROM messages 
            WHERE conversation_id = c.id 
            ORDER BY created_at DESC 
            LIMIT 1
          ) as last_message
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        {where_clause}
        GROUP BY c.id
        ORDER BY c.updated_at DESC
    """
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_conversation_by_id(conv_id, user_id=None):
    conn = get_connection()
    sql = "SELECT * FROM conversations WHERE id = ?"
    params = [conv_id]
    if user_id:
        sql += " AND (user_id = ? OR user_id IS NULL)"
        params.append(user_id)
    c_row = conn.execute(sql, params).fetchone()
    if not c_row:
        conn.close()
        return None
    conv = dict(c_row)
    
    m_rows = conn.execute("""
        SELECT * FROM messages 
        WHERE conversation_id = ? 
        ORDER BY created_at ASC
    """, (conv_id,)).fetchall()
    conn.close()

    messages = []
    for mr in m_rows:
        m = dict(mr)
        p_ids = []
        if m.get("product_ids"):
            try:
                p_ids = json.loads(m["product_ids"])
            except Exception:
                p_ids = []
        
        products = []
        if p_ids:
            for pid in p_ids:
                p = get_product_by_id(pid)
                if p:
                    products.append(p)
        
        m["products"] = products
        m["sender"] = m["role"]
        m["text"] = m["content"]
        messages.append(m)

    conv["messages"] = messages
    conv["message_count"] = len(messages)
    conv["last_message"] = messages[-1]["text"] if messages else None
    return conv

def create_conversation(conv_id, title="New Chat", user_id=None):
    conn = get_connection()
    now = datetime.utcnow().isoformat()
    conn.execute("""
        INSERT INTO conversations (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
    """, (conv_id, user_id, title, now, now))
    conn.commit()
    conn.close()
    return {"id": conv_id, "user_id": user_id, "title": title, "created_at": now, "updated_at": now, "message_count": 0, "messages": []}

def update_conversation_title(conv_id, title, user_id=None):
    conn = get_connection()
    now = datetime.utcnow().isoformat()
    sql = """
        INSERT INTO conversations (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at
    """
    params = [conv_id, user_id, title.strip(), now, now]
    if user_id:
        sql += " WHERE conversations.user_id = ? OR conversations.user_id IS NULL"
        params.append(user_id)
    cur = conn.execute(sql, params)
    conn.commit()
    changed = cur.rowcount > 0
    conn.close()
    return changed

def delete_conversation(conv_id, user_id=None):
    conn = get_connection()
    if user_id:
        c_row = conn.execute("SELECT id FROM conversations WHERE id = ? AND (user_id = ? OR user_id IS NULL)", (conv_id, user_id)).fetchone()
        if not c_row:
            conn.close()
            return False
    conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
    cur = conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    conn.commit()
    changed = cur.rowcount > 0
    conn.close()
    return changed

def save_chat_message(msg_id, conv_id, role, content, product_ids=None, user_id=None):
    conn = get_connection()
    now = datetime.utcnow().isoformat()
    conn.execute("""
        INSERT INTO conversations (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, 'New Chat', ?, ?)
        ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
    """, (conv_id, user_id, now, now))

    p_json = json.dumps(product_ids) if product_ids else None
    conn.execute("""
        INSERT INTO messages (id, conversation_id, role, content, product_ids, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET content = excluded.content, product_ids = excluded.product_ids
    """, (msg_id, conv_id, role, content, p_json, now))

    conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conv_id))
    conn.commit()
    conn.close()


