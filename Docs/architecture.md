# Architecture: Mutual Fund FAQ Assistant (RAG Prototype)

Companion to `PRD.md`. This document describes how the system is built: components, data flow, stored artifacts, configuration, and design decisions.

---

## 1. Architecture Goals

| Goal | Design response |
|---|---|
| Show every RAG stage explicitly | Each phase is a separate, re-runnable module that persists its output to disk |
| Facts-only, one citation per answer | Source URL travels as chunk metadata from scrape to final answer; the answer is assembled with a single link |
| Swappable components | Embedding model, vector DB, chunking params and LLM provider are all driven by `config.yaml` and `.env` |
| No PII, no advice | Guard layer runs before retrieval and before the LLM |
| Small corpus, simple ops | 5 pages, local ChromaDB, no external services except the LLM API |

## 2. System Context

```
                    ┌──────────────────────────────────────────────┐
                    │                 Public web                   │
                    │  5 Groww pages (+ reference links, not        │
                    │  scraped, used only as refusal/edu links)     │
                    └───────────────────────┬──────────────────────┘
                                            │ scrape (offline, one-time / on demand)
                                            ▼
┌────────┐   question   ┌────────────────────────────────┐   API call   ┌──────────────┐
│  User  │ ───────────► │  FAQ Assistant (local app)     │ ───────────► │  LLM (Groq;  │
│        │ ◄─────────── │  UI + guards + retriever + LLM │ ◄─────────── │  pluggable)  │
└────────┘   answer +   │  client + ChromaDB             │   response   └──────────────┘
             1 link     └────────────────────────────────┘
```

The system has two pipelines that share the same embedding model and vector store:

1. **Ingestion pipeline (offline):** Load → Chunk → Embed → Store
2. **Query pipeline (online):** Guard → Retrieve → Generate → Format

## 3. Ingestion Pipeline

Each phase reads the previous phase's stored output, so any phase can be re-run or demonstrated alone.

```
Phase 1            Phase 2             Phase 3                Phase 4
Data Loading  ──►  Data Chunking  ──►  Data Embedding   ──►   Vector Store
(scrape 5 pages)   (structure-aware)   (MiniLM-L6-v2)         (ChromaDB)
     │                  │                    │                    │
     ▼                  ▼                    ▼                    ▼
data/raw/          data/chunks/         data/embeddings/      data/chroma/
*.html             chunks.jsonl         vectors + ids         persistent collection
manifest.json
```

### 3.1 Phase 1: Data Loading
- **Input:** list of 5 URLs from `config.yaml`.
- **Behavior:** fetch each page once; do **not** follow internal links. Pages may be JS-rendered, so use plain HTTP first and fall back to a headless browser only if the content is missing from the HTML.
- **Output:** raw HTML per page plus `manifest.json` recording `url`, `scheme_name`, `page_type` (amc | scheme), `scraped_at`, `http_status`, `content_hash`.
- **Failure handling:** a failed page is recorded in the manifest and the run reports it; it never silently drops.

### 3.2 Phase 2: Data Chunking
The strategy is chosen based on the data, which comes in two shapes:

| Content shape | Strategy | Reason |
|---|---|---|
| Structured scheme facts (expense ratio, exit load, min SIP, lock-in, riskometer, benchmark, fund manager, AUM) | **Field-level chunks**: one small chunk per fact or tight group of related facts, prefixed with the scheme name (e.g. "HDFC Large Cap Fund Direct Growth – Exit load: …") | Questions target a single fact; small, self-describing chunks retrieve precisely and keep the scheme name in the embedded text |
| Narrative text (fund overview, AMC description, FAQ-style text) | **Section/paragraph chunks** with a size cap and small overlap (parameters in config) | Preserves context for longer passages |

Every chunk carries metadata:

```json
{
  "chunk_id": "hdfc-large-cap__exit-load__01",
  "text": "HDFC Large Cap Fund Direct Growth – Exit load: …",
  "source_url": "https://groww.in/mutual-funds/hdfc-large-cap-fund-direct-growth",
  "scheme_name": "HDFC Large Cap Fund Direct Growth",
  "page_type": "scheme",
  "section": "exit_load",
  "scraped_at": "2026-11-03T…"
}
```

The coding agent may refine the extraction rules after inspecting the real HTML; the metadata schema above is the fixed contract.

### 3.3 Phase 3: Data Embedding
- Model: `sentence-transformers/all-MiniLM-L6-v2` (384-dim), loaded by name from config.
- Embeds the `text` field of each chunk in batches.
- Output stored explicitly (vectors with `chunk_id` mapping) so the stage can be shown without touching ChromaDB.

### 3.4 Phase 4: Vector Store
- ChromaDB persistent client, collection name from config.
- Stores `chunk_id` (id), vector, `text` (document) and the metadata above.
- Ingestion is idempotent: re-running upserts by `chunk_id`; a `--reset` flag rebuilds the collection.
- The embedding model name is stored in collection metadata, and the query pipeline checks it matches at startup to prevent model mismatch.

## 4. Query Pipeline

```
User input
   │
   ▼
┌────────────────────┐  PII found   ┌───────────────────────────────┐
│ 1. PII guard       │ ───────────► │ Reject; warn; nothing stored  │
└─────────┬──────────┘              └───────────────────────────────┘
          │ clean
          ▼
┌────────────────────┐  advice /    ┌───────────────────────────────┐
│ 2. Intent guard    │  opinion /   │ Polite refusal + 1 educational│
│  (factual vs not)  │  returns ──► │ link                          │
└─────────┬──────────┘              └───────────────────────────────┘
          │ factual
          ▼
┌────────────────────┐
│ 3. Retriever       │  embed query (same MiniLM) → ChromaDB top-k
│                    │  optional scheme filter from detected scheme name
└─────────┬──────────┘
          ▼
┌────────────────────┐  no relevant   ┌─────────────────────────────┐
│ 4. Relevance check │  chunks ─────► │ "Not found in sources" +    │
│  (score threshold) │                │ nearest relevant page link  │
└─────────┬──────────┘                └─────────────────────────────┘
          ▼
┌────────────────────┐
│ 5. LLM generation  │  grounded prompt: answer only from context
└─────────┬──────────┘
          ▼
┌────────────────────┐
│ 6. Formatter       │  ≤3 sentences · exactly 1 source link ·
│  & validator       │  "Last updated from sources: <date>"
└─────────┬──────────┘
          ▼
        Answer
```

### 4.1 PII guard
Regex-based detection for PAN (`[A-Z]{5}[0-9]{4}[A-Z]`), Aadhaar (12 digits, with or without spaces), phone numbers, emails, OTP-like 4–8 digit codes in an "OTP" context, and long account-number-like digit strings. On a match the message is dropped, a warning is shown, and the text is **never** logged, embedded or sent to the LLM.

### 4.2 Intent guard
A two-layer check:
1. **Rule layer (cheap):** keyword/pattern match for advice and performance intent (should I, buy, sell, best fund, which is better, returns, will it grow, my portfolio).
2. **LLM classifier (fallback for ambiguous cases):** a short prompt returning `FACTUAL` or `REFUSE`, using the same pluggable LLM client.

Refusal categories and their educational links:

| Category | Example | Response |
|---|---|---|
| Advice / opinion | "Should I buy this fund?" | Facts-only message + link to an official investor-education page |
| Portfolio / personal | "Is my SIP good?" | Same, as no personal data is handled |
| Performance / returns | "Which fund gave better returns?" | No computation; link to the scheme's official factsheet |

### 4.3 Retriever
- Embeds the query with the same model as ingestion.
- Returns top-k chunks (k from config) with similarity scores.
- If the query names a scheme (matched against the known scheme list), a metadata filter on `scheme_name` is applied so, for example, "exit load" for ELSS doesn't return the Mid Cap chunk.
- If no scheme is named and the question is scheme-specific, the assistant asks which scheme (or answers from the AMC page where relevant).

### 4.4 LLM generation
- Provider layer exposes one interface, `generate(system_prompt, user_prompt) -> text`, with adapters for Groq (default), Gemini, OpenAI, Anthropic and Mistral selected by config.
- Model name for the active provider is read from `.env`.
- **Prompt rules (system prompt summary):**
  - Answer only from the provided context; if absent, say it isn't available in the sources.
  - Facts only; never recommend, compare returns or predict.
  - Maximum 3 sentences.
  - Do not include URLs or dates; the formatter adds them.

### 4.5 Formatter and validator
The **source link and date are attached by code, not by the LLM**, which keeps citations reliable:
- Link = `source_url` of the top chunk that supported the answer.
- Date = `scraped_at` of that page.
- Validator enforces ≤3 sentences (truncate or regenerate once), exactly one link, and the "Last updated from sources" line. If the check fails after one retry, fall back to a templated answer from the top chunk.

Final shape:
```
<≤3 sentence answer>
Source: <one URL>
Last updated from sources: <date>
```

## 5. Component Layout

```
project/
├── config.yaml              # all tunables (see §6)
├── .env / .env.example      # API keys, active LLM provider + model name
├── data/
│   ├── raw/                 # Phase 1 output
│   ├── chunks/              # Phase 2 output
│   ├── embeddings/          # Phase 3 output
│   └── chroma/              # Phase 4 output (persistent ChromaDB)
├── src/
│   ├── ingestion/
│   │   ├── loader.py        # Phase 1
│   │   ├── chunker.py       # Phase 2
│   │   ├── embedder.py      # Phase 3
│   │   └── indexer.py       # Phase 4
│   ├── query/
│   │   ├── guards.py        # PII + intent guards
│   │   ├── retriever.py
│   │   ├── prompts.py
│   │   ├── formatter.py     # citation, date, ≤3-sentence validation
│   │   └── pipeline.py      # orchestrates the query flow
│   ├── llm/
│   │   ├── base.py          # provider interface
│   │   ├── groq_client.py
│   │   └── (gemini|openai|anthropic|mistral)_client.py
│   └── config.py            # config + env loading
├── app/                     # UI (Streamlit / Gradio / notebook)
├── run_ingestion.py         # CLI: run all phases or one (--phase 1..4)
├── sample_qa.md
├── sources.md
└── README.md
```

## 6. Configuration

`config.yaml` (non-secret) and `.env` (secret):

```yaml
sources:
  scrape_urls: [ ...5 URLs... ]
  reference_links: [ ...educational/factsheet links, not scraped... ]

chunking:
  structured_strategy: field_level
  narrative_max_chars: 800
  narrative_overlap_chars: 100

embedding:
  model_name: sentence-transformers/all-MiniLM-L6-v2

vector_db:
  type: chroma
  path: data/chroma
  collection: hdfc_mf_faq

retrieval:
  top_k: 4
  min_score: 0.30
  scheme_filter: true

llm:
  provider: groq            # groq | gemini | openai | anthropic | mistral
  temperature: 0.0
  max_output_tokens: 200

ui:
  disclaimer: "Facts-only. No investment advice."
```

```
# .env
GROQ_API_KEY=...
GROQ_MODEL=qwen/qwen3.8-27b      # verify against Groq's model list
GEMINI_API_KEY= / OPENAI_API_KEY= / ANTHROPIC_API_KEY= / MISTRAL_API_KEY=
```

## 7. Data Model Summary

| Artifact | Format | Key fields |
|---|---|---|
| Raw page | `.html` + `manifest.json` | url, scheme_name, page_type, scraped_at, content_hash |
| Chunk | JSONL | chunk_id, text, source_url, scheme_name, page_type, section, scraped_at |
| Embedding | vectors + id map | chunk_id → 384-dim vector |
| Chroma record | collection entry | id, embedding, document, metadata (as chunk) |
| Q&A log (optional, PII-free) | JSONL | query (post-guard), intent, retrieved chunk_ids, answer, source_url |

## 8. UI

Minimal single page:
- Welcome line and **3 clickable example questions** (e.g. "Expense ratio of HDFC Large Cap Fund?", "ELSS lock-in period?", "How do I download a capital-gains statement?").
- Chat input and answer panel with a clickable citation link.
- Persistent footer note: **"Facts-only. No investment advice."**
- A "pipeline inspector" tab or section (optional but useful for the demo) that shows the stored output of each ingestion phase and the retrieved chunks and scores for the latest query.

## 9. Security and Privacy

- PII guard runs first; blocked input is never persisted, logged or sent to any provider.
- Secrets only in `.env` (gitignored); `.env.example` committed.
- Only public pages are scraped; no authenticated or back-end sources.
- Logs store post-guard queries only, and logging can be disabled in config.

## 10. Error Handling

| Situation | Behavior |
|---|---|
| Page fails to scrape | Recorded in manifest; run reports it; other pages continue |
| Embedding model mismatch between index and query | Startup check fails with a clear message |
| No chunk above `min_score` | "Not found in the sources" reply with the nearest relevant page link |
| LLM API error or timeout | One retry, then a templated answer from the top chunk, or an error message |
| Output fails validation | One regeneration, then template fallback |
| Question names no scheme but needs one | Ask the user to pick a scheme (examples shown) |

## 11. Testing and Evaluation

- **Unit tests:** PII regexes, intent rules, formatter/validator (sentence count, single link, date line), chunker output schema.
- **Retrieval check:** for a fixed set of 10–15 questions, assert the expected scheme and section appear in the top-k.
- **End-to-end:** the 5–10 query sample Q&A set (including 1–2 refusals and 1 PII case), checked manually against the live pages.
- **Acceptance** maps to PRD §9: 100% single-link and ≤3-sentence compliance, correct refusals, PII never stored, config-only swaps for model/DB/LLM.

## 12. Design Decisions and Trade-offs

| Decision | Rationale | Trade-off |
|---|---|---|
| Citations attached by code, not LLM | Prevents hallucinated or multiple links | Slightly less flexible phrasing |
| Field-level chunks with scheme name prefixed | Precise retrieval on a tiny corpus with near-identical scheme pages | More chunks; needs extraction rules tuned to page HTML |
| Scheme metadata filter | Avoids cross-scheme answers (very likely failure mode) | Requires scheme-name detection |
| Rule-first intent guard, LLM fallback | Fast, cheap, predictable refusals | Rules need tuning to avoid false positives |
| Persist each stage's output | Meets the "show each RAG stage" demo requirement | Extra files on disk |
| Local ChromaDB, small MiniLM model | Zero infra, runs on a laptop | Lower retrieval quality than larger models; acceptable for 5 pages |

## 13. Risks and Open Items

- **JS-rendered pages:** scraping may need a headless browser; verify early.
- **Page structure drift:** extraction rules may break if Groww changes its layout; the manifest `content_hash` helps detect change.
- **Statement-download questions:** may not be answerable from the 5 pages; needs an official help page as a reference link (see PRD Open Question 3).
- **Model name:** `qwen/qwen3.8-27b` should be verified on Groq; it is isolated in `.env`.
- **"Last updated" semantics:** assumed to be the scrape date of the cited page.

## 14. Build Order (suggested)

1. Config + project skeleton + `.env.example`
2. Phase 1 loader, then inspect real HTML
3. Phase 2 chunker (finalize extraction rules from the real HTML)
4. Phases 3–4 embedder and indexer, with `run_ingestion.py`
5. Retriever and a CLI query to verify retrieval quality
6. LLM client (Groq first), prompts, formatter/validator
7. Guards (PII, intent) and refusal links
8. UI and pipeline inspector
9. Sample Q&A, sources list, README, demo
