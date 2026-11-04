# PRD: Mutual Fund FAQ Assistant (RAG Prototype)

| | |
|---|---|
| **Product** | Facts-only FAQ assistant for HDFC Mutual Fund schemes on Groww |
| **Type** | Working prototype / RAG demo |
| **Version** | 1.0 (draft) |
| **Date** | 03 Nov 2026 |

---

## 1. Overview

Build a small FAQ assistant that answers **factual** questions about mutual fund schemes (expense ratio, exit load, minimum SIP, ELSS lock-in, riskometer, benchmark, statement downloads) using **only official public pages**. Every answer carries exactly one source link. The assistant never gives investment advice.

The project is also a **RAG teaching demo**: each pipeline stage (loading, chunking, embedding, retrieval, generation) must be implemented in phases and its output **stored explicitly** so it can be shown and inspected.

## 2. Problem & Users

**Problem:** Retail users comparing schemes, and support/content teams, repeatedly ask the same factual MF questions. Answers are scattered across scheme pages, and generic chatbots risk giving advice or unsourced numbers.

**Users**
- **Retail investors:** want a quick, trustworthy fact with a link to verify.
- **Support / content teams:** want consistent, citable answers to repetitive questions.

## 3. Goals & Non-Goals

### Goals
- Answer factual MF queries accurately, in ≤3 sentences, with one citation link and a "Last updated from sources" date.
- Politely refuse opinion, advice and portfolio questions, with a relevant educational link.
- Demonstrate a clean, phase-wise RAG pipeline with persisted artifacts at each stage.
- Keep components (embedding model, vector DB, LLM provider) swappable via config/`.env`.

### Non-Goals
- Investment advice, recommendations, or buy/sell/hold opinions.
- Computing, comparing or quoting performance/returns (link to the official factsheet instead).
- Crawling links found inside the five pages.
- Accepting or storing any PII.
- Production-grade hosting, auth, or user accounts.

## 4. Scope

### 4.1 AMC and schemes

| # | Type | Page | URL |
|---|------|------|-----|
| 1 | AMC overview | HDFC Mutual Fund | https://groww.in/mutual-funds/amc/hdfc-mutual-funds |
| 2 | Large Cap | HDFC Large Cap Fund Direct Growth | https://groww.in/mutual-funds/hdfc-large-cap-fund-direct-growth |
| 3 | Flexi Cap | HDFC Flexi Cap Direct Plan Growth | https://groww.in/mutual-funds/hdfc-equity-fund-direct-growth |
| 4 | ELSS (tax saver) | HDFC ELSS Tax Saver Fund Direct Plan Growth | https://groww.in/mutual-funds/hdfc-elss-tax-saver-fund-direct-plan-growth |
| 5 | Mid Cap | HDFC Mid Cap Fund Direct Growth | https://groww.in/mutual-funds/hdfc-mid-cap-fund-direct-growth |

**Scraping rule:** scrape only these 5 pages. Do **not** follow or scrape links internal to them.

### 4.2 Supported question types
- Expense ratio of `<scheme>`
- Exit load
- Minimum SIP / minimum lump sum
- ELSS lock-in period
- Riskometer / risk level
- Benchmark
- How to download statements (e.g. capital-gains statement)

## 5. Functional Requirements

### FR-1: Data ingestion pipeline (phase-wise)
Each phase is an independent, re-runnable step that persists its output.

| Phase | Description | Stored artifact (example) |
|---|---|---|
| **1. Data Loading** | Scrape the 5 pages; store raw HTML/text with URL and scrape timestamp. | `data/raw/*.html`, `data/raw/manifest.json` |
| **2. Data Chunking** | Chunk by content structure (e.g. section/field-level for scheme facts such as expense ratio, exit load, SIP, lock-in; paragraph-level for narrative/FAQ text). Strategy chosen by the coding agent based on the data. Each chunk keeps metadata: `source_url`, `scheme_name`, `section`, `scraped_at`. | `data/chunks/chunks.jsonl` |
| **3. Data Embedding** | Embed chunks with `sentence-transformers/all-MiniLM-L6-v2`. | `data/embeddings/` (vectors + ids) |
| **4. Vector Store** | Load embeddings + metadata into ChromaDB. | `data/chroma/` persistent collection |

### FR-2: Retrieval and answering
- **Embedding model:** same as ingestion (consistency is mandatory).
- **Vector DB:** same ChromaDB collection as ingestion.
- **Retrieval:** embed the query, fetch top-k chunks (k configurable), optionally filter by scheme when the query names one.
- **LLM:** Groq API, model name read from `.env` (the statement specifies `qwen/qwen3.8-27b`; keep it as an env value, not hard-coded).
- **Provider flexibility:** the LLM layer should be pluggable for Gemini, OpenAI, Anthropic and Mistral through config.
- **Grounding:** the LLM answers only from the retrieved chunks. If the facts aren't in the corpus, it says so rather than guessing.

### FR-3: Answer format
Every factual answer must:
1. Be **≤3 sentences**.
2. Include **exactly one** source link (the page the fact was drawn from).
3. End with: `Last updated from sources: <date>` (the scrape date of the cited page).

**Example**
> The expense ratio of HDFC Large Cap Fund Direct Growth is X%. 
> Source: https://groww.in/mutual-funds/hdfc-large-cap-fund-direct-growth 
> Last updated from sources: 03 Nov 2026

### FR-4: Refusal handling
Refuse, politely and in a facts-only tone, any query that is:
- Opinion or advice ("Should I buy/sell/hold?", "Which fund is best?")
- About the user's portfolio or personal finances
- A request to compute or compare returns/performance (link to the official factsheet instead)

A refusal states that the assistant provides facts only, and includes **one relevant educational link**.

### FR-5: PII protection
- Do not accept, process, log or store PAN, Aadhaar, account numbers, OTPs, emails or phone numbers.
- Detect likely PII patterns in input, discard the message and show a warning asking the user not to share such details.
- PII must never reach logs, the vector DB, or the LLM provider.

### FR-6: Minimal UI
- Welcome line.
- **3 example questions** (clickable).
- Chat input and answer area with a visible citation link.
- Persistent note: **"Facts-only. No investment advice."**

### FR-7: Configuration
A single config file (plus `.env` for secrets) controls:
- Embedding model name
- Vector DB type, path and collection name
- Chunking parameters
- Top-k and similarity settings
- LLM provider and model (model from `.env`)
- Source URL list

API keys (Groq and optional Gemini/OpenAI/Anthropic/Mistral) live only in `.env`.

## 6. Constraints

| Constraint | Detail |
|---|---|
| Public sources only | No app back-end screenshots, no third-party blogs. |
| No PII | As per FR-5. |
| No performance claims | Don't compute or compare returns; link to the official factsheet. |
| Clarity and transparency | ≤3 sentences, one citation, "Last updated from sources" line. |
| Facts only | No advice of any kind. |

## 7. Suggested Architecture

```
Scraper → Raw store → Chunker → Chunk store → Embedder (MiniLM-L6-v2)
                                                   ↓
                                             ChromaDB
                                                   ↑
User query → PII/intent guard → Query embed → Retriever (top-k)
                    ↓ (advice/opinion)                ↓
               Refusal + edu link          LLM (Groq, via .env) → Answer + 1 link + date
```

**Suggested project layout**
```
config.yaml
.env.example
data/{raw,chunks,embeddings,chroma}/
src/{loader,chunker,embedder,vectorstore,retriever,llm,guards}.py
app/            # UI (Streamlit / Gradio / notebook)
sample_qa.md
sources.md
README.md
```

## 8. Deliverables

1. **Working prototype** (hosted app or notebook), or a ≤3-minute demo video if hosting isn't possible.
2. **Source list** (CSV/MD) of the URLs used (see Open Question 1).
3. **README** with setup steps, scope (AMC + schemes) and known limits.
4. **Sample Q&A file** with 5–10 queries, the assistant's answers and links, including at least 1–2 refusals.
5. **Disclaimer snippet** used in the UI ("Facts-only. No investment advice.").
6. Persisted artifacts from each pipeline phase, for demo.

## 9. Success Criteria

- 100% of factual answers include exactly one valid source link and the "Last updated" line.
- 100% of answers are ≤3 sentences.
- Factual answers match the content of the cited page (manual check across the sample Q&A set).
- Advice/opinion/performance queries are refused correctly, with an educational link.
- PII inputs are rejected and never stored.
- Embedding model, vector DB and LLM can be changed through config/`.env` without code changes.
- Each RAG phase can be run alone and shows its stored output.

## 10. Skills Demonstrated

- **W1, Thinking like a model:** identify the exact fact asked; decide answer vs. refuse.
- **W2, LLMs & prompting:** concise phrasing, polite safe refusals, citation wording.
- **W3, RAG:** small-corpus retrieval with accurate citations.

## 11. Known Limits (to document in README)

- Corpus is limited to 5 pages, so only these HDFC schemes are covered.
- Data is a point-in-time snapshot; values such as expense ratio may change after the scrape date.
- Page structure changes on the source site can break scraping.
- Small embedding model may mis-rank ambiguous queries (e.g. a scheme name not stated).
- No live refresh; re-run ingestion to update.

## 12. Open Questions

1. **Source count mismatch:** the statement asks to scrape only 5 pages, but the deliverable asks for a 15–25 URL source list and mentions AMC/SEBI/AMFI pages for retrieval. Proposed resolution: the 5 Groww pages are the scraped corpus; the remaining URLs are reference links (e.g. AMFI/SEBI/HDFC AMC factsheet and statement-download help pages) used only for refusal/educational links and not scraped. Needs confirmation.
2. **Model name:** `qwen/qwen3.8-27b` should be verified against Groq's available models; it is kept in `.env` so it can be corrected without code changes.
3. **Statement-download questions:** the five scheme pages may not cover these, so an official help/educational page may be needed as the citation target.
4. **UI choice:** Streamlit, Gradio or notebook is left to the implementer.
5. **"Last updated" semantics:** assumed to be the scrape date of the cited page.
