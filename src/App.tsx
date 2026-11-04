import React, { useState, useMemo } from "react";
import appConfig from "./data/app-config.json";
import corpusData from "./data/corpus.json";
import manifestData from "./data/manifest.json";
import metaData from "./data/meta.json";
import { answerQuestion, Chunk, Answer } from "./lib/ask";

interface Message {
  role: "user" | "assistant";
  body: string;
  source_url?: string | null;
  updated?: string | null;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [inspectorTab, setInspectorTab] = useState<"retrieval" | "manifest" | "counts" | "meta">("retrieval");

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
    try {
      const answer: Answer = await answerQuestion(trimmed);
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
    } catch {
      setMessages((current) => [
        ...current,
        { role: "user", body: trimmed },
        {
          role: "assistant",
          body: "The answer service failed.",
          source_url: null,
          updated: null,
        },
      ]);
      setChunks([]);
    } finally {
      setBusy(false);
    }
  }

  function corpusLabel() {
    return `Stored chunks: ${corpusData.length}. Embedding model: ${metaData.model}.`;
  }

  return (
    <>
      <header className="topbar">
        <p className="brand">HDFC MF FAQ</p>
        <p className="disclaimer">{appConfig.ui.disclaimer}</p>
      </header>
      <main>
        <section className="panel">
          <h1>HDFC MF FAQ</h1>
          <p className="welcome">{appConfig.ui.welcome}</p>
          <div className="examples">
            {appConfig.ui.examples.map((example) => (
              <button key={example} type="button" onClick={() => handleAsk(example)}>
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
                  <p>Ask a question to see retrieved chunks.</p>
                )}
              </div>
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
