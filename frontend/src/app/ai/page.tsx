'use client';

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import {
  sendChatMessageStream,
  fetchConversations,
  fetchConversationById,
  renameConversation,
  deleteConversation,
  saveMessageToConversation,
} from '@/lib/api';
import { generateConversationTitle } from '@/lib/title-generator';
import { generateWelcomeMessage } from '@/lib/greeting';
import { ChatMessage, Conversation } from '@/types/chat';
import { Product } from '@/types/product';
import ChatHistorySidebar from '@/components/ChatHistorySidebar';
import AIProcessingIndicator from '@/components/AIProcessingIndicator';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import {
  Send,
  Bot,
  User,
  ArrowLeft,
  ShoppingCart,
  Check,
  ExternalLink,
  Cpu,
  Plus,
  Info,
  ArrowDown,
  History,
  Sparkles,
} from 'lucide-react';

function cleanDisplayedText(text: string): string {
  if (!text) return '';
  let cleaned = String(text)
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, '')
    .replace(/<analysis>[\s\S]*?(?:<\/analysis>|$)/gi, '')
    .replace(/<\/?think>|<\/?thinking>|<\/?analysis>/gi, '')
    .trim();

  // Remove tool call tags / markers / raw JSON / artifacts
  cleaned = cleaned.replace(/SEARCH_PRODUCTS:\s*[^\n]+/gi, '');
  cleaned = cleaned.replace(/search_digicomp_products[^\n]*/gi, '');
  cleaned = cleaned.replace(/MAX_PRICE:\s*\d+/gi, '');
  cleaned = cleaned.replace(/^ANSWER:\s*/i, '');
  cleaned = cleaned.replace(/^Possible response:\s*/i, '');
  cleaned = cleaned.replace(/\{[\s\S]*?"(?:tool|query|max_price)"[\s\S]*?\}/gi, '');

  // Filter out sentences containing internal reasoning indicators
  const reasoningRegex = /\b(the user (is|wants|needs|asked|looking|might)|they('ll|'re| will| might| need| want| are)|let me (start|check|think|search|recall|first|see|use|know if you)|i (need|should|will|must|have|might|can|would|'ll) (to )?(check|search|find|use|look|recall|suggest|recommend|call|query)|first,?\s*i need|okay,?\s*the user|okay,?\s*let me|okay,?\s*i need|alright,?\s*the user|my role is|system prompt|maybe they need|i should check|if they want|search function|search query|tool call|make sure to (mention|include|search)|the function allows|the query should be|max_price should be)\b/i;

  const lines = cleaned.split('\n');
  const cleanLines: string[] = [];
  let consecutiveEmpty = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (consecutiveEmpty < 1 && cleanLines.length > 0) {
        cleanLines.push('');
        consecutiveEmpty++;
      }
      continue;
    }
    consecutiveEmpty = 0;

    if (reasoningRegex.test(trimmed)) {
      const sentences = line.split(/(?<=[.?!])\s+/);
      const cleanSentences = sentences.filter(
        (s) => s.trim() && !reasoningRegex.test(s) && !/^(the|and|or|so|then|there's|let me know if you)$/i.test(s.trim())
      );
      if (cleanSentences.length > 0) {
        cleanLines.push(cleanSentences.join(' ').trim());
      }
    } else {
      cleanLines.push(line);
    }
  }

  let result = cleanLines.join('\n').trim();
  result = result.replace(/\s+(?:the|and|or|so|then|maybe|there's|let me know if you|let me know if|let me)\.?$/i, '').trim();
  return result || cleaned;
}

function generateNewConvId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function AIChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productParam = searchParams.get('product') || searchParams.get('query');
  const chatParam = searchParams.get('chat') || searchParams.get('id');
  const { addToCart } = useCart();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Route protection effect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const fullPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/ai';
      router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`);
    }
  }, [authLoading, isAuthenticated, router]);

  const suggestedPrompts = [
    'What is an ESP32?',
    'What is a relay?',
    'I want to build an obstacle avoiding robot',
    'I need an ESP32 under ₹500',
  ];

  // Sidebar & conversation states
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(() => chatParam || generateNewConvId());
  const [activeTitle, setActiveTitle] = useState<string>('New Chat');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const getInitialMessages = useCallback((): ChatMessage[] => {
    if (productParam) {
      return [
        {
          id: 'welcome-product',
          sender: 'assistant',
          text: `Tell me what you'd like to know about the ${productParam}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ];
    }
    return [
      {
        id: 'welcome-1',
        sender: 'assistant',
        text: generateWelcomeMessage({
          userName: user?.name,
          isReturningUser: conversations.length > 0,
        }),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  }, [productParam, user?.name, conversations.length]);

  // Chat UI states
  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeQuery, setActiveQuery] = useState('');
  const [, setRequestState] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [addedProductIds, setAddedProductIds] = useState<Record<number, boolean>>({});
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const activeRequestRef = useRef(false);
  const initialFetchDone = useRef(false);
  const isInitialMountRef = useRef(true);
  const userIsNearBottomRef = useRef(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Initial page load & scroll setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo(0, 0);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, []);

  // 2. Fetch conversation history list on mount
  const refreshConversationsList = useCallback(async () => {
    const list = await fetchConversations();
    setConversations(list);
    return list;
  }, []);

  useEffect(() => {
    refreshConversationsList();
  }, [refreshConversationsList]);

  // 3. Load specific conversation if specified in URL or on state change
  const loadConversationData = useCallback(async (convId: string) => {
    const conv = await fetchConversationById(convId);
    if (conv && conv.messages && conv.messages.length > 0) {
      setMessages(conv.messages);
      setActiveTitle(conv.title || 'New Chat');
      setActiveConversationId(conv.id);
    } else {
      setMessages([
        {
          id: 'welcome-1',
          sender: 'assistant',
          text: generateWelcomeMessage({
            userName: user?.name,
            isReturningUser: conversations.length > 0,
            productParam,
          }),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setActiveTitle('New Chat');
      setActiveConversationId(convId);
    }
  }, [user?.name, conversations.length, productParam]);

  // 3b. Dynamically update initial greeting when authenticated user session or conversations load
  useEffect(() => {
    if (!productParam && !chatParam) {
      setMessages((prev) => {
        if (
          prev.length === 1 &&
          prev[0].id === 'welcome-1' &&
          prev[0].sender === 'assistant'
        ) {
          const freshText = generateWelcomeMessage({
            userName: user?.name,
            isReturningUser: conversations.length > 0,
          });
          if (prev[0].text !== freshText) {
            return [{ ...prev[0], text: freshText }];
          }
        }
        return prev;
      });
    }
  }, [user?.name, conversations.length, productParam, chatParam]);

  useEffect(() => {
    if (chatParam) {
      loadConversationData(chatParam);
    }
  }, [chatParam, loadConversationData]);

  // 4. Near-bottom scroll detection threshold (100px)
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNear = distanceFromBottom < 100;
    userIsNearBottomRef.current = isNear;
    setShowScrollBottomBtn(!isNear);
  };

  // 5. Container-only scroll function
  const scrollToContainerBottom = (force = false) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    if (force || userIsNearBottomRef.current) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: force ? 'smooth' : 'auto',
      });
      if (force) {
        userIsNearBottomRef.current = true;
        setShowScrollBottomBtn(false);
      }
    }
  };

  // 6. Auto-follow streaming updates ONLY if user is already near bottom
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    scrollToContainerBottom(false);
  }, [messages, isLoading]);

  // 7. Initial fetch if prefilled with product param
  useEffect(() => {
    if (productParam && !initialFetchDone.current && !activeRequestRef.current) {
      initialFetchDone.current = true;
      activeRequestRef.current = true;
      const queryText = `What is ${productParam}`;
      setIsLoading(true);
      setRequestState('processing');
      setActiveQuery(queryText);
      scrollToContainerBottom(true);

      const convId = activeConversationId;
      const initialUserMsgId = `user-${Date.now()}`;
      const initialAiMsgId = `ai-${Date.now() + 1}`;

      // Save initial user message
      saveMessageToConversation(convId, {
        id: initialUserMsgId,
        role: 'user',
        content: queryText,
      }).catch((e) => console.warn('Failed to save initial product msg:', e));

      // Auto generate title
      const title = generateConversationTitle(queryText);
      setActiveTitle(title);
      renameConversation(convId, title).then(() => refreshConversationsList());

      sendChatMessageStream(
        queryText,
        [],
        (token) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === initialAiMsgId) {
              return [
                ...prev.slice(0, -1),
                { ...last, text: cleanDisplayedText(last.text + token) },
              ];
            }
            return [
              ...prev,
              {
                id: initialAiMsgId,
                conversation_id: convId,
                sender: 'assistant',
                text: cleanDisplayedText(token),
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ];
          });
        },
        (products) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === initialAiMsgId) {
              return [...prev.slice(0, -1), { ...last, products }];
            }
            return prev;
          });
        }
      )
        .then((res) => {
          const finalClean = cleanDisplayedText(res.answer);
          saveMessageToConversation(convId, {
            id: initialAiMsgId,
            role: 'assistant',
            content: finalClean,
            products: res.products,
          }).catch((e) => console.warn('Failed to save initial AI response:', e));
          refreshConversationsList();
        })
        .catch((err) => {
          console.warn('Initial product lookup failed:', err);
        })
        .finally(() => {
          activeRequestRef.current = false;
          setIsLoading(false);
          setActiveQuery('');
          setRequestState('idle');
        });
    }
  }, [productParam, activeConversationId, refreshConversationsList]);

  // ==========================================
  // CONVERSATION ACTIONS
  // ==========================================

  const handleNewChat = () => {
    if (activeRequestRef.current) return;
    const newId = generateNewConvId();
    setActiveConversationId(newId);
    setActiveTitle('New Chat');
    setMessages([
      {
        id: 'welcome-1',
        sender: 'assistant',
        text: generateWelcomeMessage({
          userName: user?.name,
          isReturningUser: conversations.length > 0,
        }),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInputValue('');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('chat');
      url.searchParams.delete('id');
      url.searchParams.delete('product');
      url.searchParams.delete('query');
      window.history.replaceState({}, '', url.pathname);
      window.scrollTo(0, 0);
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    inputRef.current?.focus();
  };

  const handleSelectConversation = async (id: string) => {
    if (id === activeConversationId || activeRequestRef.current) return;
    setActiveConversationId(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('chat', id);
      window.history.replaceState({}, '', url.toString());
    }
    await loadConversationData(id);
    setTimeout(() => scrollToContainerBottom(true), 50);
  };

  const handleRenameConversation = async (id: string, newTitle: string): Promise<boolean> => {
    const ok = await renameConversation(id, newTitle);
    if (ok) {
      if (id === activeConversationId) {
        setActiveTitle(newTitle);
      }
      await refreshConversationsList();
    }
    return ok;
  };

  const handleDeleteConversation = async (id: string): Promise<boolean> => {
    const ok = await deleteConversation(id);
    if (ok) {
      const remaining = await refreshConversationsList();
      if (id === activeConversationId) {
        if (remaining.length > 0) {
          handleSelectConversation(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    }
    return ok;
  };

  // ==========================================
  // SEND MESSAGE HANDLER
  // ==========================================

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();

    if (!text || activeRequestRef.current || isLoading) return;

    activeRequestRef.current = true;
    setIsLoading(true);
    setRequestState('processing');
    setActiveQuery(text);
    setInputValue('');

    const convId = activeConversationId;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user-${Date.now()}`;
    const aiMsgId = `ai-${Date.now() + 1}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      conversation_id: convId,
      sender: 'user',
      text,
      timestamp: now,
    };

    const aiMsgPlaceholder: ChatMessage = {
      id: aiMsgId,
      conversation_id: convId,
      sender: 'assistant',
      text: '',
      timestamp: now,
    };

    // Auto-generate short title if this is the first user prompt or title is 'New Chat'
    const isFirstUserMessage = !messages.some((m) => m.sender === 'user');
    if (isFirstUserMessage || activeTitle === 'New Chat') {
      const generatedTitle = generateConversationTitle(text);
      setActiveTitle(generatedTitle);
      renameConversation(convId, generatedTitle)
        .then(() => refreshConversationsList())
        .catch((e) => console.warn('Failed to save title:', e));
    }

    // Synchronously save user message to SQLite
    saveMessageToConversation(convId, {
      id: userMsgId,
      role: 'user',
      content: text,
    }).catch((err) => console.warn('Failed to persist user message:', err));

    // Send ONLY current conversation's history
    const history = messages
      .filter((m) => !m.text.startsWith('⚠️ Error:') && m.text.trim())
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

    setMessages((prev) => [...prev, userMsg, aiMsgPlaceholder]);

    userIsNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setTimeout(() => scrollToContainerBottom(true), 50);

    try {
      const res = await sendChatMessageStream(
        text,
        history,
        (token) => {
          const displayable = cleanDisplayedText(token);
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, text: displayable } : m))
          );
        },
        (products) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, products } : m))
          );
        },
        undefined,
        convId
      );

      const finalCleanAnswer = cleanDisplayedText(res.answer) || 'I could not process your request. Please try again.';
      const finalProducts = res.products && res.products.length > 0 ? res.products : undefined;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                text: finalCleanAnswer,
                products: finalProducts,
              }
            : m
        )
      );
      setRequestState('complete');

      // Save assistant message to SQLite with product IDs (isolated so DB errors don't fail chat)
      saveMessageToConversation(convId, {
        id: aiMsgId,
        role: 'assistant',
        content: finalCleanAnswer,
        products: finalProducts,
      })
        .then(() => refreshConversationsList())
        .catch((e) => console.warn('Failed to persist assistant message:', e));
    } catch (err: unknown) {
      console.error('Chat request failed in handleSend:', err);
      let errorText = err instanceof Error ? err.message : 'Failed to connect to DigiComp AI backend';
      errorText = errorText.replace(/Please try again\.?/gi, '').trim();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, text: `⚠️ Error: ${errorText}. Please try again.` }
            : m
        )
      );
      setRequestState('error');
    } finally {
      activeRequestRef.current = false;
      setIsLoading(false);
      setActiveQuery('');
      setRequestState('idle');
    }
  };

  const handleAddToCart = (product: Product) => {
    addToCart(product, 1);
    setAddedProductIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedProductIds((prev) => ({ ...prev, [product.id]: false }));
    }, 2000);
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-140px)] bg-slate-900 text-white p-6">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg text-sky-400">
              <Cpu className="w-7 h-7 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-slate-950 shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Verifying DigiComp Authentication</h2>
            <p className="text-xs text-slate-400">Securing your AI assistant session...</p>
          </div>
          <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-var(--header-height,98px))] min-h-[500px] bg-slate-50 overflow-hidden">
      {/* Left Chat History Sidebar (ChatGPT / Gemini style) */}
      <ChatHistorySidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileDrawerOpen}
        onCloseMobile={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Chat View Area */}
      <div className="flex-1 flex flex-col relative min-w-0 h-full overflow-hidden bg-slate-50">
        {/* Top Header */}
        <div className="bg-slate-900 text-white border-b border-slate-800 shadow-xs shrink-0 z-10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Mobile History Drawer Toggle */}
              <button
                onClick={() => setIsMobileDrawerOpen(true)}
                className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                title="Open chat history"
              >
                <History className="w-4 h-4" />
              </button>

              <Link
                href="/products"
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
                title="Back to Catalog"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>

              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 text-sky-400 flex items-center justify-center shadow-inner shrink-0">
                <Bot className="w-4.5 h-4.5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-white tracking-tight truncate">
                    {activeTitle === 'New Chat' ? 'DigiComp AI' : activeTitle}
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Active Catalog
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">Electronics & Product Assistant</p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleNewChat}
                className="text-xs text-sky-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-sky-600 transition-all font-semibold"
                title="Start a new conversation"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Chat</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Chat Stream Container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 px-4 py-6 space-y-6 overflow-y-auto"
        >
          <div className="container mx-auto max-w-4xl space-y-6">
            {/* Message Items */}
            {messages
              .filter((msg) => !(msg.sender === 'assistant' && !msg.text && (!msg.products || msg.products.length === 0)))
              .map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Avatar for AI */}
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-sky-400 flex items-center justify-center shrink-0 border border-slate-700 shadow-2xs mt-1">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                )}

                {/* Message Container */}
                <div className={`space-y-3 max-w-3xl ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-sky-600 text-white rounded-tr-xs shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-2xs'
                    }`}
                  >
                    <MarkdownRenderer content={msg.text} isUser={msg.sender === 'user'} />
                    <div
                      className={`text-[10px] mt-2 font-mono ${
                        msg.sender === 'user' ? 'text-sky-200 text-right' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* Product Cards Grid inside AI response */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Cpu className="w-4 h-4 text-sky-600" />
                        <span>Matching DigiComp Products ({msg.products.length}):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {msg.products.map((product) => {
                          const isAdded = addedProductIds[product.id];
                          return (
                            <div
                              key={product.id}
                              className="bg-white border border-slate-200 hover:border-sky-300 rounded-xl p-3.5 shadow-2xs transition-all flex flex-col justify-between gap-3 group"
                            >
                              <div className="flex gap-3">
                                <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0 flex items-center justify-center overflow-hidden">
                                  <Image
                                    src={product.image_url || product.image || '/images/products/esp32.svg'}
                                    alt={product.name}
                                    width={64}
                                    height={64}
                                    className="object-contain max-h-full"
                                  />
                                </div>
                                <div className="space-y-1 min-w-0 flex-1">
                                  <span className="text-[10px] font-bold tracking-wider text-sky-600 uppercase">
                                    {product.category}
                                  </span>
                                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-sky-600 transition-colors">
                                    {product.name}
                                  </h4>
                                  <div className="flex items-center justify-between pt-0.5">
                                    <span className="text-sm font-extrabold text-slate-900">
                                      ₹{product.price}
                                    </span>
                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      In Stock ({product.stock_quantity ?? product.stock ?? 0})
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <Link
                                  href={`/products/${product.id}`}
                                  className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1"
                                >
                                  <span>View Product</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>

                                <button
                                  onClick={() => handleAddToCart(product)}
                                  disabled={isAdded}
                                  className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                                    isAdded
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-sky-600 hover:bg-sky-700 text-white shadow-2xs'
                                  }`}
                                >
                                  {isAdded ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Added!</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShoppingCart className="w-3.5 h-3.5" />
                                      <span>Add to Cart</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Avatar for User */}
                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                    <User className="w-4.5 h-4.5" />
                  </div>
                )}
              </div>
            ))}

            {/* Dynamic AI Processing Indicator */}
            {isLoading && (
              <AIProcessingIndicator query={activeQuery} />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Floating Scroll to Bottom Button */}
        {showScrollBottomBtn && (
          <button
            onClick={() => scrollToContainerBottom(true)}
            className="absolute bottom-28 right-8 z-20 bg-sky-600 hover:bg-sky-700 text-white p-2.5 rounded-full shadow-lg border border-sky-400/40 transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold animate-bounce"
          >
            <ArrowDown className="w-4 h-4" />
            <span>Scroll to latest</span>
          </button>
        )}

        {/* Unified Chat Input Composer Area */}
        <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-xs z-10">
          <div className="container mx-auto max-w-4xl space-y-3">
            {/* Quick prompt chips above input bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="text-slate-400 font-semibold shrink-0 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Suggested:
              </span>
              {suggestedPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p)}
                  disabled={isLoading}
                  className="shrink-0 px-3 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 text-slate-600 rounded-full border border-slate-200 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Form input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask DigiComp AI about microcontrollers, sensors, projects, or pricing..."
                disabled={isLoading}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
              />

              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="px-5 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors shadow-2xs flex items-center gap-2 shrink-0"
              >
                <span>Send</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AIAssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-slate-500 text-sm">
          Loading DigiComp AI Assistant...
        </div>
      }
    >
      <AIChatContent />
    </Suspense>
  );
}
