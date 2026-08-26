'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

/**
 * Validates and sanitizes link URLs to prevent javascript:, data:, and other unsafe protocols.
 */
function isSafeUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:')
  ) {
    return false;
  }
  return true;
}

/**
 * Code block with copy button, syntax badge, and clean scrollable container.
 */
function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore copy error in environments without clipboard access
    }
  };

  return (
    <div className="relative group my-2.5 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 shadow-2xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span className="uppercase font-semibold tracking-wider text-sky-400">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          aria-label={copied ? 'Copied code' : 'Copy code'}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono text-slate-100 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content, className = '', isUser = false }: MarkdownRendererProps) {
  if (!content) return null;

  if (isUser) {
    // For user messages, keep clean plain text rendering with preserved whitespace
    return <div className={`whitespace-pre-wrap ${className}`}>{content}</div>;
  }

  return (
    <div className={`digicomp-markdown text-sm leading-relaxed text-slate-800 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // Transparent pre wrapper to avoid nested pre tags
          pre: ({ node: _node, children }) => <>{children}</>,

          // Bold
          strong: ({ node: _node, children, ...props }) => (
            <strong className="font-bold text-slate-900" {...props}>
              {children}
            </strong>
          ),
          b: ({ node: _node, children, ...props }) => (
            <strong className="font-bold text-slate-900" {...props}>
              {children}
            </strong>
          ),

          // Italic
          em: ({ node: _node, children, ...props }) => (
            <em className="italic text-slate-700" {...props}>
              {children}
            </em>
          ),
          i: ({ node: _node, children, ...props }) => (
            <em className="italic text-slate-700" {...props}>
              {children}
            </em>
          ),

          // Headings
          h1: ({ node: _node, children, ...props }) => (
            <h1 className="text-base font-bold text-slate-900 mt-3 mb-1.5 first:mt-0" {...props}>
              {children}
            </h1>
          ),
          h2: ({ node: _node, children, ...props }) => (
            <h2 className="text-sm font-bold text-slate-900 mt-2.5 mb-1 first:mt-0" {...props}>
              {children}
            </h2>
          ),
          h3: ({ node: _node, children, ...props }) => (
            <h3 className="text-sm font-semibold text-slate-900 mt-2 mb-1 first:mt-0" {...props}>
              {children}
            </h3>
          ),
          h4: ({ node: _node, children, ...props }) => (
            <h4 className="text-xs font-bold text-slate-900 mt-1.5 mb-0.5 first:mt-0" {...props}>
              {children}
            </h4>
          ),

          // Paragraphs
          p: ({ node: _node, children, ...props }) => (
            <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0" {...props}>
              {children}
            </p>
          ),

          // Lists
          ul: ({ node: _node, children, ...props }) => (
            <ul className="list-disc pl-5 my-2 space-y-1 marker:text-sky-500" {...props}>
              {children}
            </ul>
          ),
          ol: ({ node: _node, children, ...props }) => (
            <ol className="list-decimal pl-5 my-2 space-y-1 marker:text-slate-600 font-medium" {...props}>
              {children}
            </ol>
          ),
          li: ({ node: _node, children, ...props }) => (
            <li className="leading-relaxed pl-0.5 text-slate-800 font-normal" {...props}>
              {children}
            </li>
          ),

          // Blockquotes
          blockquote: ({ node: _node, children, ...props }) => (
            <blockquote
              className="border-l-3 border-sky-500 pl-3 py-1 my-2 bg-sky-50/60 rounded-r text-slate-700 italic text-xs leading-relaxed"
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Links
          a: ({ node: _node, href, children, ...props }) => {
            const safe = isSafeUrl(href);
            if (!safe || !href) {
              return <span className="underline text-slate-700">{children}</span>;
            }
            const isExternal = href.startsWith('http://') || href.startsWith('https://');
            return (
              <a
                href={href}
                className="text-sky-600 hover:text-sky-700 font-medium underline underline-offset-2 transition-colors"
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },

          // Code & Code Blocks
          code: ({ node: _node, className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const rawContent = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || rawContent.includes('\n');

            if (isBlock) {
              return <CodeBlock language={match ? match[1] : undefined} code={rawContent} />;
            }

            return (
              <code
                className="px-1.5 py-0.5 rounded bg-slate-100 text-sky-800 font-mono text-xs border border-slate-200/80 font-medium"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Tables
          table: ({ node: _node, children, ...props }) => (
            <div className="overflow-x-auto my-2.5 rounded-lg border border-slate-200">
              <table className="w-full text-xs text-left border-collapse" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ node: _node, children, ...props }) => (
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200" {...props}>
              {children}
            </thead>
          ),
          th: ({ node: _node, children, ...props }) => (
            <th className="px-3 py-2 font-semibold text-slate-800 border-b border-slate-200" {...props}>
              {children}
            </th>
          ),
          td: ({ node: _node, children, ...props }) => (
            <td className="px-3 py-1.5 border-b border-slate-100 text-slate-600" {...props}>
              {children}
            </td>
          ),
          hr: ({ node: _node, ...props }) => <hr className="border-t border-slate-200 my-3" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
