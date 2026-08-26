'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Conversation, ConversationGroup, ConversationGroupLabel } from '@/types/chat';
import {
  Plus,
  Search,
  X,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  AlertCircle,
} from 'lucide-react';

interface ChatHistorySidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<boolean>;
  onDeleteConversation: (id: string) => Promise<boolean>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

/**
 * Group conversations into Today, Yesterday, Previous 7 Days, and Older.
 */
function groupConversations(conversations: Conversation[]): ConversationGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfSevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const groups: Record<ConversationGroupLabel, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    Older: [],
  };

  for (const conv of conversations) {
    const updatedTime = new Date(conv.updated_at || conv.created_at).getTime();
    if (isNaN(updatedTime)) {
      groups.Older.push(conv);
    } else if (updatedTime >= startOfToday) {
      groups.Today.push(conv);
    } else if (updatedTime >= startOfYesterday) {
      groups.Yesterday.push(conv);
    } else if (updatedTime >= startOfSevenDaysAgo) {
      groups['Previous 7 Days'].push(conv);
    } else {
      groups.Older.push(conv);
    }
  }

  const result: ConversationGroup[] = [];
  const groupOrder: ConversationGroupLabel[] = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];

  for (const label of groupOrder) {
    if (groups[label].length > 0) {
      result.push({
        label,
        conversations: groups[label],
      });
    }
  }

  return result;
}

export default function ChatHistorySidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: ChatHistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input on rename
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Filter conversations locally by search query
  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) => {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = c.title.toLowerCase().includes(q);
        const lastMsgMatch = c.last_message?.toLowerCase().includes(q);
        return titleMatch || lastMsgMatch;
      })
    : conversations;

  const grouped = groupConversations(filteredConversations);

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setMenuOpenId(null);
  };

  const handleSaveRename = async (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    await onRenameConversation(id, editTitle.trim());
    setEditingId(null);
  };

  const handleDeletePrompt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    setMenuOpenId(null);
  };

  const handleConfirmDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await onDeleteConversation(id);
    setDeletingId(null);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 border-r border-slate-800 select-none">
      {/* Top Header / Actions */}
      <div className="p-3.5 space-y-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between gap-2">
          {!isCollapsed && (
            <button
              onClick={() => {
                onNewChat();
                if (isMobileOpen) onCloseMobile();
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sky-500/20 active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          )}

          {/* Desktop Collapse Toggle / Mobile Close */}
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:flex p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            <button
              onClick={onCloseMobile}
              title="Close history"
              className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar (When not collapsed) */}
        {!isCollapsed && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Collapsed View Shortcuts */}
      {isCollapsed && (
        <div className="p-2 flex flex-col items-center gap-2 border-b border-slate-800">
          <button
            onClick={onNewChat}
            title="New Chat"
            className="w-10 h-10 flex items-center justify-center bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {isCollapsed ? (
          // Collapsed Icon-rail list
          <div className="flex flex-col items-center gap-1.5 py-1">
            {conversations.slice(0, 15).map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  title={conv.title}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        ) : (
          // Expanded Grouped List
          <>
            {grouped.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-slate-500">
                {searchQuery ? (
                  <span>No chats matching &quot;{searchQuery}&quot;</span>
                ) : (
                  <span>No previous chats yet</span>
                )}
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.label} className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    {group.label}
                  </div>

                  <div className="space-y-0.5">
                    {group.conversations.map((conv) => {
                      const isActive = conv.id === activeConversationId;
                      const isEditing = editingId === conv.id;
                      const isMenuOpen = menuOpenId === conv.id;
                      const isDeleting = deletingId === conv.id;

                      if (isDeleting) {
                        return (
                          <div
                            key={conv.id}
                            className="bg-red-950/40 border border-red-800/60 rounded-lg p-2 text-xs space-y-2"
                          >
                            <div className="flex items-center gap-1.5 text-red-300 font-medium">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Delete this chat?</span>
                            </div>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingId(null);
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={(e) => handleConfirmDelete(conv.id, e)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-bold"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (isEditing) {
                        return (
                          <form
                            key={conv.id}
                            onSubmit={(e) => handleSaveRename(conv.id, e)}
                            className="flex items-center gap-1 bg-slate-800 rounded-lg p-1"
                          >
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => handleSaveRename(conv.id)}
                              className="flex-1 bg-slate-950 text-white text-xs px-2 py-1 rounded border border-sky-500 focus:outline-none"
                              maxLength={40}
                            />
                            <button
                              type="submit"
                              className="p-1 text-emerald-400 hover:text-emerald-300 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 text-slate-400 hover:text-slate-300 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        );
                      }

                      return (
                        <div
                          key={conv.id}
                          onClick={() => {
                            onSelectConversation(conv.id);
                            if (isMobileOpen) onCloseMobile();
                          }}
                          className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                            isActive
                              ? 'bg-sky-500/20 text-sky-300 border-l-2 border-sky-400 font-medium'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                            <MessageSquare
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-400'
                              }`}
                            />
                            <span className="truncate">{conv.title || 'New Chat'}</span>
                          </div>

                          {/* Options Button (⋯) */}
                          <div className="relative shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(isMenuOpen ? null : conv.id);
                              }}
                              className={`p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/80 transition-opacity ${
                                isMenuOpen || isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              }`}
                              title="Chat options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Options Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-full mt-1 w-32 bg-slate-950 border border-slate-700 rounded-lg shadow-xl z-30 py-1 text-xs"
                              >
                                <button
                                  onClick={(e) => handleStartRename(conv, e)}
                                  className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-200 hover:bg-slate-800 hover:text-white text-left transition-colors"
                                >
                                  <Edit2 className="w-3 h-3 text-slate-400" />
                                  <span>Rename</span>
                                </button>
                                <button
                                  onClick={(e) => handleDeletePrompt(conv.id, e)}
                                  className="w-full px-3 py-1.5 flex items-center gap-2 text-red-400 hover:bg-red-950/50 hover:text-red-300 text-left transition-colors"
                                >
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>DigiComp AI Assistant</span>
          <span className="font-mono text-[10px] text-slate-400">Local History</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-full shrink-0 transition-all duration-200 ease-in-out ${
          isCollapsed ? 'w-16' : 'w-72'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (with backdrop) */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
