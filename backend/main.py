from pathlib import Path
import sys
import traceback
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.db import (
    init_db,
    get_all_conversations, get_conversation_by_id, create_conversation,
    update_conversation_title, delete_conversation, save_chat_message,
    create_user, get_user_by_email, verify_password, create_session,
    get_session, delete_session
)
from backend.catalog_client import fetch_live_catalog
from backend.ai import process_chat_message, clean_final_assistant_answer, MODEL

FRONTEND = ROOT / "frontend"
app = FastAPI(title="DigiComp AI Demo")
if (FRONTEND / "public").exists():
    app.mount("/static", StaticFiles(directory=FRONTEND / "public"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()
    # Pre-fetch and cache the live DigiComp catalog on startup
    fetch_live_catalog()

# Auth Dependency
def get_current_user(request: Request):
    token = request.cookies.get("digicomp_session")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
    
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized. Please log in to use DigiComp AI.")
    
    session_data = get_session(token)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in again.")
    
    return session_data["user"]

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/signup")
def signup(req: SignupRequest, response: Response):
    name = req.name.strip()
    email = req.email.strip().lower()
    password = req.password.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Full name is required")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email address is required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    new_user = create_user(name, email, password)
    session = create_session(new_user["id"])
    response.set_cookie(
        key="digicomp_session",
        value=session["token"],
        max_age=30 * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=False
    )
    return {"success": True, "user": new_user, "token": session["token"]}

@app.post("/api/auth/login")
def login(req: LoginRequest, response: Response):
    email = req.email.strip().lower()
    password = req.password.strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    user_row = get_user_by_email(email)
    if not user_row or not verify_password(password, user_row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session = create_session(user_row["id"])
    user = {
        "id": user_row["id"],
        "name": user_row["name"],
        "email": user_row["email"],
        "created_at": user_row["created_at"],
    }
    response.set_cookie(
        key="digicomp_session",
        value=session["token"],
        max_age=30 * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=False
    )
    return {"success": True, "user": user, "token": session["token"]}

@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get("digicomp_session")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
    if token:
        delete_session(token)
    response.delete_cookie(key="digicomp_session")
    return {"success": True, "message": "Logged out successfully"}

@app.get("/api/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

class ChatRequest(BaseModel):
    message: str
    conversationId: str | None = None
    conversation_id: str | None = None
    history: list[dict] | None = None

def product_payload(product, component_type=""):
    """
    Shapes the live DigiComp product dictionary into the payload consumed by the AI frontend.
    """
    return {
        "id": product["id"],
        "sku": product.get("sku", ""),
        "name": product["name"],
        "slug": product.get("slug", ""),
        "category": product.get("category", "Hardware"),
        "description": product.get("description") or product.get("excerpt") or "",
        "price": product["price"],
        "stock": product.get("stock", "instock"),
        "stock_quantity": product.get("stock_quantity", 0),
        "image_url": product.get("image_url", ""),
        "product_url": product.get("product_url", f"/product/{product.get('slug', product['id'])}"),
        "permalink": product.get("permalink", ""),
        "attributes": product.get("attributes", {}),
        "component_type": component_type,
    }

@app.get("/")
def index():
    index_file = FRONTEND / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {
        "status": "ok",
        "service": "DigiComp AI FastAPI Backend",
        "model": MODEL,
        "docs_url": "/docs"
    }

@app.get("/api/products")
def products():
    # Return live products from DigiComp catalog
    return fetch_live_catalog()

@app.get("/api/ai/health")
def ai_health():
    import urllib.request, json
    try:
        req = urllib.request.Request("http://127.0.0.1:11434/api/tags")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = [m.get("name") or m.get("model") for m in data.get("models", [])]
            if MODEL in models or any(MODEL in str(m) for m in models):
                return {"backend": "ok", "ollama": "ok", "model": MODEL, "ready": True}
            return {"backend": "ok", "ollama": "ok", "model": MODEL, "ready": False, "error": f"{MODEL} model not found"}
    except Exception as e:
        return {"backend": "ok", "ollama": "unreachable", "model": MODEL, "ready": False, "error": str(e)}

@app.post("/api/chat")
@app.post("/api/ai/chat")
def chat(req: ChatRequest, current_user: dict = Depends(get_current_user)):
    import time
    message = req.message.strip()
    conv_id = req.conversationId or req.conversation_id or f"conv-{int(time.time()*1000)}"
    req_id = f"ai-{int(time.time()*1000)}"
    msg_id = f"msg-{int(time.time()*1000)}"

    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    print("\n========== DIGICOMP AI REQUEST ==========")
    print(f"User: {current_user.get('email')} ({current_user.get('id')})")
    print(f"Conversation ID: {conv_id}")
    print(f"User message: {message}")
    print(f"Active model: {MODEL}")

    try:
        ai_res = process_chat_message(message, history=req.history)
    except Exception as exc:
        print(f"ERROR: {exc}")
        traceback.print_exc()
        print("==========================================\n")
        raise HTTPException(
            status_code=503,
            detail=f"DigiComp AI service error: {exc}. Ensure Ollama is running and {MODEL} is available."
        )

    raw_answer = ai_res.get("answer", "")
    answer = clean_final_assistant_answer(raw_answer)
    raw_products = ai_res.get("products", [])
    products = [product_payload(p) for p in raw_products]
    show_products = len(products) > 0

    print(f"Answer: {answer[:80]}...")
    print(f"Products found: {len(products)}")
    print("==========================================\n")

    return {
        "conversationId": conv_id,
        "messageId": msg_id,
        "requestId": req_id,
        "answer": answer,
        "message": answer,
        "show_products": show_products,
        "products": products,
    }

class ConversationCreateRequest(BaseModel):
    id: str | None = None
    title: str = "New Chat"

class ConversationRenameRequest(BaseModel):
    title: str

class MessageSaveRequest(BaseModel):
    id: str
    role: str
    content: str
    product_ids: list[int] | None = None

@app.get("/api/ai/conversations")
def list_conversations(q: str | None = None, current_user: dict = Depends(get_current_user)):
    return get_all_conversations(user_id=current_user["id"], query=q)

@app.post("/api/ai/conversations")
def new_conversation(req: ConversationCreateRequest, current_user: dict = Depends(get_current_user)):
    import time, random
    conv_id = req.id or f"conv-{int(time.time()*1000)}-{random.randint(1000, 9999)}"
    return create_conversation(conv_id, req.title, user_id=current_user["id"])

@app.get("/api/ai/conversations/{conv_id}")
def get_conversation(conv_id: str, current_user: dict = Depends(get_current_user)):
    conv = get_conversation_by_id(conv_id, user_id=current_user["id"])
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@app.patch("/api/ai/conversations/{conv_id}")
@app.put("/api/ai/conversations/{conv_id}")
def rename_conv(conv_id: str, req: ConversationRenameRequest, current_user: dict = Depends(get_current_user)):
    success = update_conversation_title(conv_id, req.title, user_id=current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True, "id": conv_id, "title": req.title}

@app.delete("/api/ai/conversations/{conv_id}")
def delete_conv(conv_id: str, current_user: dict = Depends(get_current_user)):
    success = delete_conversation(conv_id, user_id=current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True, "id": conv_id}

@app.post("/api/ai/conversations/{conv_id}/messages")
def save_message(conv_id: str, req: MessageSaveRequest, current_user: dict = Depends(get_current_user)):
    content_to_save = clean_final_assistant_answer(req.content) if req.role == "assistant" else req.content
    save_chat_message(req.id, conv_id, req.role, content_to_save, req.product_ids, user_id=current_user["id"])
    return {"id": req.id, "conversation_id": conv_id, "role": req.role, "content": content_to_save, "product_ids": req.product_ids}
