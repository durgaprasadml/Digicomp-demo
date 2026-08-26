"""
Test script to verify chat history persistence and functionality in DigiComp database.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.db import (
    init_db,
    create_conversation,
    get_all_conversations,
    get_conversation_by_id,
    save_chat_message,
    update_conversation_title,
    delete_conversation,
    get_product_by_id,
)

def run_tests():
    print("=== Testing DigiComp Chat History Persistence ===")
    init_db()

    # 1. Create a conversation
    conv_id = "test-conv-1"
    conv = create_conversation(conv_id, "New Chat")
    assert conv["id"] == conv_id
    assert conv["title"] == "New Chat"
    print("✓ Created conversation successfully")

    # 2. Add user message
    save_chat_message(
        msg_id="msg-user-1",
        conv_id=conv_id,
        role="user",
        content="What is an ESP32?"
    )
    print("✓ Added user message successfully")

    # 3. Add assistant message with product IDs [1, 4]
    save_chat_message(
        msg_id="msg-ai-1",
        conv_id=conv_id,
        role="assistant",
        content="ESP32 is a low-power system on a chip with integrated Wi-Fi and dual-mode Bluetooth.",
        product_ids=[1, 4]
    )
    print("✓ Added assistant message with product IDs [1, 4] successfully")

    # 4. Auto-update title
    update_conversation_title(conv_id, "ESP32 Basics")
    print("✓ Updated conversation title to 'ESP32 Basics'")

    # 5. Fetch conversation details and verify product rehydration
    fetched = get_conversation_by_id(conv_id)
    assert fetched is not None
    assert fetched["title"] == "ESP32 Basics"
    assert len(fetched["messages"]) == 2
    ai_msg = fetched["messages"][1]
    assert ai_msg["role"] == "assistant"
    assert len(ai_msg["products"]) == 2
    assert ai_msg["products"][0]["sku"] == "DC-ESP32-01"
    assert ai_msg["products"][0]["price"] == 450
    print(f"✓ Rehydrated products correctly: {[p['name'] for p in ai_msg['products']]}")

    # 6. Create second conversation to test isolation
    conv_id_2 = "test-conv-2"
    create_conversation(conv_id_2, "Obstacle Robot")
    save_chat_message("msg-user-2", conv_id_2, "user", "I want to build an obstacle avoiding robot.")
    save_chat_message("msg-ai-2", conv_id_2, "assistant", "Here are the components needed for an obstacle avoiding robot.", product_ids=[4, 8, 12])
    
    all_convs = get_all_conversations()
    assert any(c["id"] == conv_id for c in all_convs)
    assert any(c["id"] == conv_id_2 for c in all_convs)
    print(f"✓ Multiple conversations listed: {len(all_convs)} total conversations")

    # 7. Search conversations
    search_results = get_all_conversations(query="obstacle")
    assert any(c["id"] == conv_id_2 for c in search_results)
    assert not any(c["id"] == conv_id for c in search_results)
    print("✓ Search functionality working accurately")

    # 8. Clean up test conversations
    delete_conversation(conv_id)
    delete_conversation(conv_id_2)
    assert get_conversation_by_id(conv_id) is None
    assert get_conversation_by_id(conv_id_2) is None
    print("✓ Deletion and cascade removal working cleanly")

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
