# Architecture: Mutual Fund FAQ Assistant (Hybrid RAG System)

Companion to `PRD.md`, `sources.md`, and `implementation.md`. Describes system architecture, data models, offline ingestion, query pipeline, guardrails, and full-stack implementation.

---

## 1. Architecture Goals

| Goal | Design Response |
|---|---|
| **Broad & Scheme-Specific Accuracy** | Answers general mutual fund concepts (NAV, SIP, TER, KIM/SID, SEBI categorizations, cut-offs) and scheme-specific parameters without confusion. |
| **Grounded Citations** | Source URLs travel from ingestion metadata into the final answer; exactly one verified official citation per answer. |
| **Comprehensive 25-Source Corpus** | 25 curated public pages from AMFI India, SEBI regulations, HDFC AMC factsheets/KIM/SID, and CAMS/ITD. |
| **Strict Privacy & Safety Guardrails** | Multi-tier guard layer runs before retrieval or LLM execution to block PII (PAN, Aadhaar, OTPs, folios) and refuse personal financial advice. |
| **Dual-Stack Flexibility** | Full-stack production React + Express app (port 3000) with server-side Gemini 3.8 Flash grounding, plus Python CLI ingestion and test scripts. |
| **Responsive Skeletal UI** | Skeletal chat bubbles matching response geometry provide smooth visual feedback during retrieval. |

---

## 2. System Context

```
                    ┌─────────────────────────────────────────────────────────┐
                    │               Official Regulatory & AMC Web             │
                    │   25 Pages: AMFI, SEBI Circulars, HDFC AMC, CAMS, ITD   │
                    └────────────────────────────┬────────────────────────────┘
                                                 │ Scrape & Ingestion (offline / on-demand)
                                                 ▼
┌────────┐   Question    ┌──────────────────────────────────────────────┐   API Call   ┌───────────────────────────┐
│  User  │ ────────────► │  Full-Stack Mutual Fund Assistant            │ ───────────► │  Server-Side Gemini LLM   │
│ Client │ ◄──────────── │  React + Express (Port 3000)                 │ ◄─────────── │  (gemini-3.8-flash)       │
└────────┘   Answer +    │  - PII & Advice Guards                       │   Response   └───────────────────────────┘
             1 Citation  │  - 16 Built-in AMFI/SEBI Core Concepts       │
                         │  - ChromaDB (89 chunks, 384-dim MiniLM-L6)   │
                         │  - Local Grounded Fallback Engine            │
                         └──────────────────────────────────────────────┘
```

The system operates across two pipelines:
1. **Ingestion Pipeline (Offline / Reproducible):** Scrape 25 documents &rarr; Structure-aware chunking (89 chunks) &rarr; 384-dim embeddings (`all-MiniLM-L6-v2`) &rarr; ChromaDB SQLite & `.npy` storage.
2. **Query Pipeline (Online / Real-Time):** PII Guard &rarr; Intent/Advice Guard &rarr; Statement Routing &rarr; Concept Matcher &rarr; Vector & Lexical Retriever &rarr; Grounded Synthesis &rarr; Formatter with Citation.

---

## 3. Ingestion Pipeline

Every stage writes its output explicitly to disk for auditability and verification:

```
Phase 1               Phase 2                Phase 3                   Phase 4
Data Loading    ──►   Data Chunking    ──►   Data Embedding      ──►   Vector Store
(25 Sources)          (89 Chunks)            (all-MiniLM-L6-v2)        (ChromaDB SQLite)
     │                     │                      │                         │
     ▼                     ▼                      ▼                         ▼
data/raw/             data/chunks/           data/embeddings/          data/chroma/
*.html (25 files)     chunks.jsonl           vectors.npy (89, 384)     chroma.sqlite3
manifest.json                                ids.json, meta.json       src/data/corpus.json
```

### 3.1 Phase 1: Data Loading (25 Sources)
- **Sources**: 25 official URLs documented in `sources.md` and `sources.csv`:
  - 6 AMC Scheme & Document pages (HDFC Large Cap, Mid Cap, Flexi Cap, ELSS, AMC Overview, SID/KIM).
  - 12 AMFI Educational & Regulatory pages (NAV, TER, Exit Load, SIP, SWP, STP, Direct vs Regular, Index Funds, Cut-off Timings, Risk-o-meter, Code of Conduct, KIM/SID guide).
  - 4 SEBI Regulatory circulars (Categorization of MF schemes, market cap definitions, TER slabs, riskometer rules).
  - 3 Statement and Taxation pages (CAMS CAS, KFintech portal, Income Tax Department capital gains).
- **Output**: Raw HTML snapshots in `data/raw/<slug>.html` and provenance log in `data/raw/manifest.json`.

### 3.2 Phase 2: Data Chunking (89 Chunks)
- **Fact-Level Scheme Chunks**: Self-describing, scheme-prefixed strings (e.g. `"HDFC Large Cap Fund Direct Growth – Expense ratio: 1.02%"`).
- **Regulatory / Narrative Chunks**: Bounded paragraphs (max 800 characters) preserving exact percentages, cut-off times, and statutory definitions.
- **Contract Schema** (`data/chunks/chunks.jsonl`):
  ```json
  {
    "chunk_id": "sebi-categorization...__sebi_categorization_and_market_cap_rules__01",
    "text": "SEBI Scheme Categorization: Equity funds are categorized by market cap: Large Cap funds invest at least 80% in top 100 companies by market cap; Mid Cap funds invest at least 65% in 101st to 250th companies...",
    "source_url": "https://www.sebi.gov.in/legal/circulars/oct-2017/categorization-and-rationalization-of-mutual-fund-schemes_36199.html",
    "scheme_name": "SEBI Categorization and Rationalization of Mutual Fund Schemes",
    "page_type": "regulation",
    "section": "sebi_categorization_and_market_cap_rules",
    "scraped_at": "2026-11-04T12:00:00.000000+00:00"
  }
  ```

### 3.3 Phase 3: Vector Embeddings
- **Model**: `sentence-transformers/all-MiniLM-L6-v2` (384-dim vectors, L2-normalized).
- **Artifacts**:
  - `data/embeddings/vectors.npy`: 136,832-byte NumPy float32 binary array of shape `(89, 384)`.
  - `data/embeddings/ids.json`: List of 89 chunk identifiers.
  - `data/embeddings/meta.json`: `{"model": "sentence-transformers/all-MiniLM-L6-v2", "dim": 384, "count": 89}`.
  - `src/data/corpus.json`: Embedded dataset bundled for fast zero-latency in-memory lookup.

### 3.4 Phase 4: Vector Store (ChromaDB)
- **Engine**: Persistent ChromaDB SQLite database (`data/chroma/chroma.sqlite3`).
- **HNSW Space**: Cosine similarity index (`metadata={"hnsw:space": "cosine"}`).
- **Sync Log**: Documented in `data/chunking_and_embeddings.txt`.

---

## 4. Query Pipeline

```
User Input
   │
   ├── 1. PII Guard ───────────────► Found? Reject & show privacy warning (zero logging)
   │
   ├── 2. Intent Guard ────────────► Advice / returns? Politely refuse + AMFI guidance link
   │
   ├── 3. Statement Route ─────────► Statement question? Fixed response + CAMS/KFintech link
   │
   ├── 4. Concept Matcher ─────────► Matches core MF concept? Return verified standard definition
   │
   ├── 5. Hybrid Retriever ────────► Score 89 chunks across 25 sources (threshold ≥ 0.25, top-k 4)
   │
   ├── 6. LLM Synthesis ──────────► Gemini 3.8 Flash (with verified context grounding)
   │                                 or grounded local fallback engine
   │
   └── 7. Formatter ───────────────► ≤3 sentences · exactly 1 official URL · source date
```

### 4.1 PII Guard
Blocks personal identifiers using strict regex boundaries:
- **PAN**: `\b[A-Z]{5}[0-9]{4}[A-Z]\b`
- **Aadhaar**: `\b\d{4}\s?\d{4}\s?\d{4}\b`
- **Phone**: `(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)`
- **Email**: `[\w.+-]+@[\w-]+\.[\w.-]+`
- **OTP**: `(?i)\botp\b.{0,20}\b\d{4,8}\b`
- **Account / Folio**: `\b\d{9,18}\b`

### 4.2 Intent & Advice Guard
- Intercepts requests for personalized financial advice, portfolio reviews, or return predictions.
- Returns factual guidance citing official AMFI investor education:
  *"I can share factual and educational information, but not personalized investment advice. Consider consulting a SEBI-registered investment advisor."*

### 4.3 Concept Matcher & Hybrid Retriever
- **16 Core MF Concepts**: Immediate factual definitions for NAV, Expense Ratio, Exit Load, SIP, SWP, STP, Direct vs Regular, ELSS, Index Funds, SEBI Categories, Taxation, Cut-off Timings, AMC, KIM/SID, Risk-o-meter, and CAS.
- **Retriever Scoring**:
  - Section keyword match (`0.45` weight): `nav_concept`, `cut_off_timing_rules`, `sid_purpose`, `kim_purpose`, `expense_ratio`, `sebi_categorization_and_market_cap_rules`.
  - Semantic token overlap (`0.35` weight).
  - Scheme isolation: Applies metadata filtering only when specific scheme terms (e.g., "HDFC Large Cap") are queried without general SEBI or definition terms.

### 4.4 Formatter & Validator
- Enforces maximum 3 sentences.
- Strips any hallucinated URLs from model output and appends the single verified `source_url`.
- Appends source verification date.

---

## 5. Technology Stack & Component Structure

```
project/
├── server.ts                       # Express backend (port 3000), Vite dev server, Gemini 3.8 RAG
├── vite.config.ts                  # Vite config with @tailwindcss/vite
├── index.html                      # Entry HTML with Plus Jakarta Sans & JetBrains Mono fonts
├── src/
│   ├── App.tsx                     # Main React application
│   ├── index.css                   # Tailwind CSS v4 design tokens and base styles
│   ├── components/
│   │   ├── TopBar.tsx              # Clean top navigation with "Clear chat" action
│   │   └── ChatPanel.tsx           # Chat thread, prompt suggestions, skeletal loading bubble
│   ├── lib/
│   │   ├── ask.ts                  # Query pipeline, guards, and scoring algorithms
│   │   └── knowledge.ts            # 16 standardized AMFI/SEBI concepts
│   └── data/                       # Synchronized corpus, manifest, metadata, and config
├── data/                           # Raw HTML, chunks.jsonl, vectors.npy, and ChromaDB SQLite
├── Docs/                           # PRD.md, architecture.md, implementation.md
├── sources.md & sources.csv        # Complete 25-source documentation
└── sample_qa.md                    # Verified test questions and responses
```

---

## 6. User Interface Architecture

- **Clean Single-Column Workspace**: Focused `max-w-4xl` layout adhering to the *Zero-Pill Discipline* and *Anti-AI Slop Constitution*.
- **Skeletal Loading Feedback**:
  - Replaces mechanical spinning wheels with a conversational skeletal placeholder.
  - Renders 3 varied-length animated gradient shimmer lines (`92%`, `98%`, `65%`) and placeholder citation footer.
  - Matches assistant response geometry to eliminate layout shift and lower perceived latency.
- **Top Bar Contract**: Wordmark brand zone (*Mutual Fund FAQ Assistant · AMFI & SEBI Grounded*) + quiet contextual label + primary "Clear chat" action button.
- **Interactive Affordances**: Categorized sample inquiries, one-click answer copying, and direct links to official documents.

---

## 7. Security, Privacy & Compliance

- **Zero PII Exposure**: Personal details are stripped before processing and never logged or stored.
- **Official Grounding Only**: Model generation constrained to verified context from the 25 official documents and 16 concepts.
- **No Autonomous Advice**: Refuses portfolio management or scheme recommendations under SEBI investment advisor norms.
- **Safe Environment**: Secrets maintained strictly in server-side environment variables; client communicates via local API proxy (`/api/ask`).
