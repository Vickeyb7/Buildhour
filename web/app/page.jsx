"use client";

import { useEffect, useState } from "react";
import appConfig from "../data/app-config.json";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [chunks, setChunks] = useState([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function ask(question) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setDraft("");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const answer = await response.json();
      const userText = answer.kind === "pii" ? "Personal details were removed." : trimmed;
      setMessages((current) => [...current, { role: "user", body: userText }, answer]);
      setChunks(answer.chunks || []);
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return (
    <>
      <header className="topbar">
        <p className="brand">HDFC MF FAQ</p>
        <p className="disclaimer">Facts-only. No investment advice.</p>
      </header>
      <main>
        <section className="panel">
          <h1>HDFC MF FAQ</h1>
          <p className="welcome">Ask factual questions about select HDFC Mutual Fund schemes.</p>
          <div className="examples">
            {appConfig.ui.examples.map((example) => (
              <button key={example} type="button" onClick={() => ask(example)}>
                {example}
              </button>
            ))}
          </div>
          <div className="thread">
            {messages.map((message, index) => (
              <article className={`message ${message.role === "user" ? "user" : "assistant"}`} key={index}>
                <p>{message.body}</p>
                {message.source_url ? (
                  <p className="source">
                    Source: <a href={message.source_url}>{message.source_url}</a>
                  </p>
                ) : null}
                {message.updated ? <p className="updated">Last updated from sources: {message.updated}</p> : null}
              </article>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(draft);
            }}
          >
            <input
              aria-label="Ask a factual question"
              placeholder="Ask a factual question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button className="send" type="submit" disabled={busy}>
              {busy ? "Looking…" : "Ask"}
            </button>
          </form>
          <details className="inspector">
            <summary>Pipeline inspector</summary>
            <p>{corpusLabel()}</p>
            {chunks.length ? (
              <table>
                <tbody>
                  {chunks.map((chunk) => (
                    <tr key={chunk.chunk_id}>
                      <td>{chunk.score}</td>
                      <td>{chunk.section}</td>
                      <td>{chunk.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Ask a question to see retrieved chunks.</p>
            )}
          </details>
        </section>
        <p className="caption">Facts-only. No investment advice.</p>
      </main>
    </>
  );
}

function corpusLabel() {
  return "Stored chunks: 57. Embedding model: sentence-transformers/all-MiniLM-L6-v2.";
}
