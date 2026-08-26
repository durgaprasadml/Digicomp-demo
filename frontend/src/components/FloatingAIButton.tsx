'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function FloatingAIButton() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  // Hide on /ai page, /login, or /signup page
  if (pathname === '/ai' || pathname === '/login' || pathname === '/signup') return null;

  const target = isAuthenticated ? '/ai' : `/login?redirect=${encodeURIComponent('/ai')}`;

  return (
    <Link
      href={target}
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2 bg-slate-900/95 hover:bg-slate-900 text-white rounded-full shadow-md hover:shadow-lg border border-slate-700/80 backdrop-blur-xs transition-all hover:scale-105 active:scale-95 group"
      aria-label="Ask DigiComp AI"
    >
      <div className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center group-hover:bg-sky-400 transition-colors">
        <Sparkles className="w-3 h-3" />
      </div>
      <span className="text-xs font-semibold tracking-wide pr-0.5">Ask DigiComp AI</span>
    </Link>
  );
}
