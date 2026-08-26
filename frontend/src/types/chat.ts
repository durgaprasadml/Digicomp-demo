import { Product } from './product';

export type MessageSender = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  conversation_id?: string;
  sender: MessageSender;
  text: string;
  product_ids?: number[];
  products?: Product[];
  timestamp: string;
  created_at?: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
  messages?: ChatMessage[];
}

export type ConversationGroupLabel = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older';

export interface ConversationGroup {
  label: ConversationGroupLabel;
  conversations: Conversation[];
}

export interface ChatResponse {
  answer: string;
  products: Product[];
  requestId?: string;
  conversationId?: string;
  messageId?: string;
}
