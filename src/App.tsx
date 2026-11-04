import React, { useState } from "react";
import appConfig from "./data/app-config.json";
import { answerQuestion, Answer } from "./lib/ask";
import { TopBar } from "./components/TopBar";
import { ChatPanel, Message } from "./components/ChatPanel";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleAsk(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    setBusy(true);

    let answer: Answer;
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (response.ok) {
        answer = await response.json();
      } else {
        answer = await answerQuestion(trimmed);
      }
    } catch {
      // Local client fallback
      try {
        answer = await answerQuestion(trimmed);
      } catch {
        answer = {
          kind: "error",
          body: "The answer service encountered an issue. Please try again.",
          source_url: null,
          updated: null,
          chunks: [],
        };
      }
    }

    const userText = answer.kind === "pii" ? "Personal details were removed for privacy." : trimmed;
    setMessages((current) => [
      ...current,
      { role: "user", body: userText },
      {
        role: "assistant",
        body: answer.body,
        source_url: answer.source_url,
        updated: answer.updated,
        kind: answer.kind,
      },
    ]);
    setBusy(false);
  }

  function handleClearHistory() {
    setMessages([]);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      <TopBar
        messageCount={messages.length}
        onClearHistory={handleClearHistory}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <ChatPanel
          messages={messages}
          busy={busy}
          onAsk={handleAsk}
          onClearHistory={handleClearHistory}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>{appConfig.ui.disclaimer}</p>
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <span>AMFI India</span>
            <span aria-hidden="true">·</span>
            <span>SEBI Regulations</span>
            <span aria-hidden="true">·</span>
            <span>KIM / SID Documents</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
