import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Copy, Check, ExternalLink, ArrowUp, RefreshCw, Trash2 } from "lucide-react";

export interface Message {
  role: "user" | "assistant";
  body: string;
  source_url?: string | null;
  updated?: string | null;
  kind?: string;
}

interface ChatPanelProps {
  messages: Message[];
  busy: boolean;
  onAsk: (question: string) => void;
  onClearHistory: () => void;
}

const POPULAR_QUESTIONS = [
  {
    category: "Valuation & Concepts",
    questions: [
      "What is NAV and how is it calculated?",
      "What is the difference between Direct and Regular plans?",
      "How does an ELSS tax saver fund work?",
    ],
  },
  {
    category: "SEBI Rules & Cut-offs",
    questions: [
      "What is the cut-off timing for subscription in liquid funds?",
      "What are large cap and mid cap stocks defined as under SEBI rules?",
      "What is the difference between KIM and SID?",
    ],
  },
  {
    category: "Scheme Facts",
    questions: [
      "What is the expense ratio of HDFC Large Cap Fund?",
      "What is the lock-in period for HDFC ELSS Tax Saver Fund?",
      "What is the minimum SIP for HDFC Mid Cap Fund?",
    ],
  },
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  busy,
  onAsk,
  onClearHistory,
}) => {
  const [draft, setDraft] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, busy]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = draft.trim();
    if (!q || busy) return;
    onAsk(q);
    setDraft("");
  }

  function handleCopy(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
      {/* Panel Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            Mutual Fund FAQ Assistant
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ask any question about mutual fund concepts (NAV, SIP, fund types, etc.) or specific fund schemes
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-rose-50/50 transition-colors shrink-0 cursor-pointer"
            title="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear conversation</span>
          </button>
        )}
      </div>

      {/* Message Feed / Welcome Screen */}
      <div className="overflow-y-auto p-5 sm:p-7 space-y-6 min-h-[480px] max-h-[680px]">
        {messages.length === 0 ? (
          <div className="space-y-6 py-2">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Welcome to the Mutual Fund Knowledge Assistant
              </h2>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                Get instant, factual answers grounded in official sources from AMFI India, SEBI regulations, scheme information documents (KIM/SID), factsheets, and registrar guides.
              </p>
            </div>

            {/* Curated Question Clusters */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Common Questions to Try
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {POPULAR_QUESTIONS.map((cat) => (
                  <div
                    key={cat.category}
                    className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-4 flex flex-col justify-between"
                  >
                    <div className="text-xs font-bold text-slate-900 mb-2.5">
                      {cat.category}
                    </div>
                    <div className="space-y-2">
                      {cat.questions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => onAsk(q)}
                          className="w-full text-left text-xs text-slate-600 hover:text-emerald-700 hover:bg-white p-2.5 rounded-lg border border-transparent hover:border-slate-200 hover:shadow-xs transition-all leading-snug cursor-pointer"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-slate-900 text-white shadow-xs rounded-tr-xs"
                      : "bg-white border border-slate-200/90 text-slate-800 shadow-xs rounded-tl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>

                  {/* Assistant Citation and Actions */}
                  {message.role === "assistant" && (
                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {message.source_url ? (
                        <a
                          href={message.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:text-emerald-800 hover:underline max-w-[280px] sm:max-w-md truncate"
                        >
                          <span className="truncate">Source: {message.source_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400">Official Reference</span>
                      )}

                      <div className="flex items-center gap-3">
                        {message.updated && (
                          <span className="text-xs text-slate-400">
                            Updated: {message.updated}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopy(message.body, index)}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Copy answer"
                        >
                          {copiedIndex === index ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-4 shadow-xs text-xs text-slate-500 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span>Searching official mutual fund sources...</span>
                </div>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>
        )}
      </div>

      {/* Input Dock */}
      <div className="p-4 sm:p-5 bg-slate-50/70 border-t border-slate-200/80">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask any mutual fund question (e.g. What is NAV? What are SEBI cut-off timings?)..."
            disabled={busy}
            maxLength={1000}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs transition"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl px-5 py-3.5 text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Ask</span>
            <ArrowUp className="w-4 h-4" />
          </button>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mt-2.5 px-1 text-xs text-slate-400">
          <span>Factual & educational only · No financial advice</span>
          <span>Never share personal PAN or banking credentials</span>
        </div>
      </div>
    </div>
  );
};
