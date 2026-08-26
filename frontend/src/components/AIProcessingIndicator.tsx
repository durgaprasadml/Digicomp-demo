'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Bot, Sparkles, Search, Layers, Cpu, CheckCircle2 } from 'lucide-react';

export type QueryCategory = 'product' | 'project' | 'question' | 'general';

export interface StatusStep {
  text: string;
  icon?: 'sparkles' | 'search' | 'layers' | 'cpu' | 'ready';
}

/**
 * Client-side heuristic to determine the nature of the user prompt
 * so we can display relevant, friendly status messages.
 * Runs purely on the frontend without extra API calls or artificial delays.
 */
export function classifyQuery(query?: string): QueryCategory {
  if (!query || typeof query !== 'string') return 'general';
  const q = query.toLowerCase().trim();
  if (!q) return 'general';

  // 1. Project / Build intent (check project first to catch "build robot using ESP32 under 500")
  const projectPatterns = [
    /\b(build|make|create|develop|construct|diy|project|robot|robotics|smart|system|automation|automate|iot|circuit|wiring|schematic|interfac(e|ing)|connect(ing)?|line follower|obstacle avoid(ing|er)?|quadcopter|drone|tracker|transmitter|receiver)\b/i,
    /\b(how to build|how to make|how to connect|how to wire|guide to|tutorial for|components? for)\b/i,
  ];

  // 2. Product / Price / Buy intent
  const productPricePatterns = [
    /\b(under|below|around|within|budget|price|cost|rate|cheap|cheapest|affordable)\b/i,
    /₹|\brs\.?|\binr\b/i,
    /\b(buy|purchase|order|shop|store|in stock|stock|available|catalog|discount|deal|specs|datasheet)\b/i,
    /\b(i need|i want|looking for|recommend|suggest|find me|search for|give me)\b/i,
  ];

  // 3. Conceptual question / Definition intent
  const questionPatterns = [
    /^(hi|hello|hey|greetings|howdy|good (morning|afternoon|evening))\b/i,
    /^(what is|what are|what's|explain|who (is|was|invented)|why (is|are|do|does)|how (does|do|works?)|difference between|compare|tell me about|definition of|can you explain)\b/i,
    /\?$/,
  ];

  const hasProjectIntent = projectPatterns.some((pattern) => pattern.test(q));
  if (hasProjectIntent) {
    return 'project';
  }

  const hasProductIntent = productPricePatterns.some((pattern) => pattern.test(q));
  if (hasProductIntent) {
    return 'product';
  }

  const hasQuestionIntent = questionPatterns.some((pattern) => pattern.test(q));
  if (hasQuestionIntent) {
    return 'question';
  }

  return 'general';
}

export function getStatusSteps(category: QueryCategory): StatusStep[] {
  switch (category) {
    case 'question':
      return [
        { text: 'Understanding your question...', icon: 'sparkles' },
        { text: 'Analyzing the topic...', icon: 'cpu' },
        { text: 'Preparing an explanation...', icon: 'layers' },
        { text: 'Finalizing your answer...', icon: 'ready' },
      ];
    case 'product':
      return [
        { text: 'Understanding your requirements...', icon: 'sparkles' },
        { text: 'Searching DigiComp products...', icon: 'search' },
        { text: 'Checking availability...', icon: 'layers' },
        { text: 'Matching your budget...', icon: 'cpu' },
        { text: 'Preparing your recommendations...', icon: 'ready' },
      ];
    case 'project':
      return [
        { text: 'Understanding your project...', icon: 'sparkles' },
        { text: 'Identifying required components...', icon: 'cpu' },
        { text: 'Finding suitable DigiComp products...', icon: 'search' },
        { text: 'Checking availability...', icon: 'layers' },
        { text: 'Preparing your recommendations...', icon: 'ready' },
      ];
    case 'general':
    default:
      return [
        { text: 'Understanding your request...', icon: 'sparkles' },
        { text: 'Analyzing your requirements...', icon: 'cpu' },
        { text: 'Finding relevant information...', icon: 'search' },
        { text: 'Checking DigiComp products...', icon: 'search' },
        { text: 'Matching available components...', icon: 'layers' },
        { text: 'Preparing your recommendations...', icon: 'ready' },
        { text: 'Finalizing your answer...', icon: 'sparkles' },
      ];
  }
}

export interface AIProcessingIndicatorProps {
  active?: boolean;
  mode?: QueryCategory | 'products';
  query?: string;
  statusOverride?: string;
  intervalMs?: number;
  className?: string;
}

export default function AIProcessingIndicator({
  active = true,
  mode,
  query,
  statusOverride,
  intervalMs = 1800,
  className = '',
}: AIProcessingIndicatorProps) {
  const normalizedCategory: QueryCategory = useMemo(() => {
    if (mode) {
      if (mode === 'products') return 'product';
      if (mode === 'product' || mode === 'project' || mode === 'question' || mode === 'general') {
        return mode;
      }
    }
    return classifyQuery(query);
  }, [mode, query]);

  const steps = useMemo(() => getStatusSteps(normalizedCategory), [normalizedCategory]);
  const [stepIndex, setStepIndex] = useState(0);

  // Continuously rotate through status messages indefinitely until request finishes
  useEffect(() => {
    if (!active || steps.length <= 1) return;

    // Reset index on fresh start or category change
    setStepIndex(0);

    const timer = setInterval(() => {
      // Continuous indefinite cycle: index = (index + 1) % steps.length
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [active, steps, intervalMs]);

  if (!active) return null;

  const currentStep = steps[stepIndex % steps.length] || steps[0];
  const displayText = statusOverride || currentStep.text;

  const renderIcon = (iconType?: StatusStep['icon']) => {
    switch (iconType) {
      case 'search':
        return <Search className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />;
      case 'layers':
        return <Layers className="w-3.5 h-3.5 text-sky-500 animate-pulse" />;
      case 'cpu':
        return <Cpu className="w-3.5 h-3.5 text-sky-500 animate-pulse" />;
      case 'ready':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'sparkles':
      default:
        return <Sparkles className="w-3.5 h-3.5 text-sky-500 animate-pulse" />;
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex gap-3.5 items-start ${className}`}
    >
      {/* Bot Avatar */}
      <div className="w-8 h-8 rounded-lg bg-slate-900 text-sky-400 flex items-center justify-center shrink-0 border border-slate-700 shadow-2xs mt-0.5">
        <Bot className="w-4.5 h-4.5 animate-pulse text-sky-400" />
      </div>

      {/* Modern Compact Processing Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-3.5 sm:p-4 shadow-2xs min-w-[260px] sm:min-w-[320px] max-w-sm sm:max-w-md space-y-2.5 transition-all">
        {/* Header with DigiComp AI Brand & Pulsing Cyan Dot */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 tracking-tight">
            <span className="text-sky-500 text-sm leading-none select-none">✦</span>
            <span>DigiComp AI</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            <span className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider">
              Working
            </span>
          </div>
        </div>

        {/* Dynamic Status Text & Icon */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1 rounded-md bg-slate-50 border border-slate-100 shrink-0">
              {renderIcon(currentStep.icon)}
            </div>
            <p
              key={displayText}
              className="text-xs text-slate-600 font-medium tracking-tight truncate animate-fade-in"
            >
              {displayText}
            </p>
          </div>

          {/* Animated 3-dot pulse (continuous independent CSS animation) */}
          <div className="flex items-center gap-1 shrink-0 pl-1" aria-hidden="true">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0ms]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:150ms]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-bounce [animation-delay:300ms]"></span>
          </div>
        </div>

        {/* Subtle Horizontal Progress Shimmer */}
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden relative" aria-hidden="true">
          <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-600 rounded-full animate-shimmer-slide"></div>
        </div>

        {/* Screen Reader Only Announcement */}
        <span className="sr-only">
          DigiComp AI is processing your request: {displayText}
        </span>
      </div>
    </div>
  );
}
