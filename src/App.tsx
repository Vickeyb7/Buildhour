import React, { useState, useMemo } from "react";
import appConfig from "./data/app-config.json";
import corpusData from "./data/corpus.json";
import manifestData from "./data/manifest.json";
import metaData from "./data/meta.json";
import { answerQuestion, Chunk, Answer } from "./lib/ask";
import { MF_CONCEPTS } from "./lib/knowledge";

interface Message {
  role: "user" | "assistant";
  body: string;
  source_url?: string | null;
  updated?: string | null;
}

const BROAD_EXAMPLES = [
  "What is NAV and how is it calculated?",
  "What is the difference between Direct and Regular plans?",
  "What is the expense ratio of HDFC Large Cap Fund?",
  "How does an ELSS tax saver fund work?",
  "What is an exit load in mutual funds?",
  "What is the minimum SIP for HDFC Mid Cap Fund?",
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [inspectorTab, setInspectorTab] = useState<"retrieval" | "concepts" | "manifest" | "counts" | "meta">("retrieval");

  const chunkCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const chunk of corpusData) {
      counts[chunk.scheme_name] = (counts[chunk.scheme_name] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, []);

  async function handleAsk(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setDraft("");

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

    const userText = answer.kind === "pii" ? "Personal details were removed." : trimmed;
    setMessages((current) => [
      ...current,
      { role: "user", body: userText },
      {
        role: "assistant",
        body: answer.body,
        source_url: answer.source_url,
        updated: answer.updated,
      },
    ]);
    setChunks(answer.chunks || []);
    setBusy(false);
  }

  function handleClearHistory() {
    setMessages([]);
    setChunks([]);
  }

  function corpusLabel() {
    return `Stored scheme chunks: ${corpusData.length}. Core MF concepts indexed: ${MF_CONCEPTS.length}.`;
  }

  return (
    <>
      <header className="topbar">
        <p className="brand">Mutual Fund FAQ Assistant</p>
        <p className="disclaimer">{appConfig.ui.disclaimer}</p>
      </header>
      <main>
        <section className="panel">
          <h1>Mutual Fund FAQ</h1>
          <p className="welcome">
            Ask any question about mutual funds—including core concepts (NAV, SIP, Expense Ratio, Direct vs Regular, ELSS, Taxation) or specific scheme facts.
          </p>
          <div className="examples">
            {BROAD_EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => handleAsk(example)}>
                {example}
              </button>
            ))}
          </div>

          {messages.length > 0 && (
            <div className="thread-bar">
              <span className="thread-title">Conversation ({Math.ceil(messages.length / 2)})</span>
              <button
                type="button"
                className="clear-btn"
                onClick={handleClearHistory}
                title="Clear current conversation history"
              >
                Clear history
              </button>
            </div>
          )}

          <div className="thread">
            {messages.map((message, index) => (
              <article className={`message ${message.role === "user" ? "user" : "assistant"}`} key={index}>
                <p>{message.body}</p>
                {message.source_url ? (
                  <p className="source">
                    Source:{" "}
                    <a href={message.source_url} target="_blank" rel="noopener noreferrer">
                      {message.source_url}
                    </a>
                  </p>
                ) : null}
                {message.updated ? <p className="updated">Last updated from sources: {message.updated}</p> : null}
              </article>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleAsk(draft);
            }}
          >
            <input
              aria-label="Ask any mutual fund question"
              placeholder="Ask any mutual fund question (e.g., What is NAV?)..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button className="send" type="submit" disabled={busy}>
              {busy ? "Looking…" : "Ask"}
            </button>
          </form>
          <details className="inspector">
            <summary>Pipeline inspector</summary>
            <div className="inspector-tabs">
              <button
                type="button"
                className={`tab-btn ${inspectorTab === "retrieval" ? "active" : ""}`}
                onClick={() => setInspectorTab("retrieval")}
              >
                Last retrieval
              </button>
              <button
                type="button"
                className={`tab-btn ${inspectorTab === "concepts" ? "active" : ""}`}
                onClick={() => setInspectorTab("concepts")}
              >
                MF Concepts ({MF_CONCEPTS.length})
              </button>
              <button
                type="button"
                className={`tab-btn ${inspectorTab === "manifest" ? "active" : ""}`}
                onClick={() => setInspectorTab("manifest")}
              >
                Manifest ({manifestData.length})
              </button>
              <button
                type="button"
                className={`tab-btn ${inspectorTab === "counts" ? "active" : ""}`}
                onClick={() => setInspectorTab("counts")}
              >
                Chunk counts
              </button>
              <button
                type="button"
                className={`tab-btn ${inspectorTab === "meta" ? "active" : ""}`}
                onClick={() => setInspectorTab("meta")}
              >
                Embedding meta
              </button>
            </div>

            {inspectorTab === "retrieval" && (
              <div>
                <p>{corpusLabel()}</p>
                {chunks.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: "70px" }}>Score</th>
                        <th style={{ width: "130px" }}>Section</th>
                        <th>Text</th>
                      </tr>
                    </thead>
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
                  <p>Ask a question to see retrieved chunks or concept sources.</p>
                )}
              </div>
            )}

            {inspectorTab === "concepts" && (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "180px" }}>Concept</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {MF_CONCEPTS.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {inspectorTab === "manifest" && (
              <table>
                <thead>
                  <tr>
                    <th>Source Name</th>
                    <th>Type</th>
                    <th>HTTP Status</th>
                    <th>Scraped At</th>
                  </tr>
                </thead>
                <tbody>
                  {manifestData.map((row) => (
                    <tr key={row.slug}>
                      <td>{row.name}</td>
                      <td>{row.type}</td>
                      <td>{row.http_status}</td>
                      <td>{row.scraped_at.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {inspectorTab === "counts" && (
              <table>
                <thead>
                  <tr>
                    <th>Scheme / Page</th>
                    <th>Chunks</th>
                  </tr>
                </thead>
                <tbody>
                  {chunkCounts.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {inspectorTab === "meta" && (
              <table>
                <tbody>
                  <tr>
                    <td><strong>Embedding Model</strong></td>
                    <td>{metaData.model}</td>
                  </tr>
                  <tr>
                    <td><strong>Vector Dimensions</strong></td>
                    <td>{metaData.dim}</td>
                  </tr>
                  <tr>
                    <td><strong>Stored Chunks Count</strong></td>
                    <td>{metaData.count}</td>
                  </tr>
                  <tr>
                    <td><strong>Min Score Threshold</strong></td>
                    <td>{appConfig.retrieval.min_score}</td>
                  </tr>
                  <tr>
                    <td><strong>Retrieval Top K</strong></td>
                    <td>{appConfig.retrieval.top_k}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </details>
        </section>
        <p className="caption">{appConfig.ui.disclaimer}</p>
      </main>
    </>
  );
}
