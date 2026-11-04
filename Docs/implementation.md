# Implementation Guide: Mutual Fund FAQ Assistant

Companion to `PRD.md`, `architecture.md`, and `sources.md`. Covers: directory setup, multi-source ingestion (25 statutory pages), chunking, 384-dim vector embeddings, vector DB persistence, retrieval logic, guardrails, React full-stack application, and skeletal UI feedback.

---

## 1. System Architecture & Directory Setup

The project supports both a full-stack production React/Express web application (port 3000) and the baseline Python CLI / ingestion scripts.

```
project/
├── .env.example                       # GEMINI_API_KEY, GROQ_API_KEY, LLM_PROVIDER
├── config.yaml                        # Retrieval thresholds, model specs, reference links
├── package.json                       # React 18, Vite 5, Tailwind CSS v4, Express, @google/genai
├── server.ts                          # Express backend with Vite middleware & Gemini RAG
├── vite.config.ts                     # Vite configuration with @tailwindcss/vite
├── index.html                         # Entry HTML with Plus Jakarta Sans & JetBrains Mono fonts
├── requirements.txt                   # Python dependencies for offline ingestion & testing
├── run_ingestion.py                   # Python ingestion pipeline (--phase 1|2|3|4|all)
├── run_queries.py                     # CLI query testing script
├── sources.md                         # Catalog of all 25 official sources
├── sources.csv                        # Machine-readable source catalog
├── sample_qa.md                       # Verified end-to-end sample Q&A pairs
├── scripts/
│   └── ingest_all.js                  # Node/Transformers pipeline for 384-dim embedding & DB sync
├── data/
│   ├── raw/                           # Phase 1: 25 HTML files + manifest.json
│   ├── chunks/                        # Phase 2: chunks.jsonl (89 chunks)
│   ├── embeddings/                    # Phase 3: vectors.npy (89, 384), ids.json, meta.json
│   ├── chroma/                        # Phase 4: ChromaDB SQLite3 persistence
│   └── chunking_and_embeddings.txt    # Summary of chunks, vector paths, and links
├── src/
│   ├── App.tsx                        # Main React application with skeletal loading
│   ├── index.css                      # Tailwind CSS v4 design system
│   ├── components/
│   │   ├── TopBar.tsx                 # Top navigation with clear chat action
│   │   └── ChatPanel.tsx              # Chat thread, question suggestions, skeletal bubble
│   ├── data/                          # Bundled client corpus, manifest, and metadata
│   │   ├── app-config.json
│   │   ├── corpus.json                # 89 chunks with normalized 384-dim vectors
│   │   ├── manifest.json
│   │   ├── meta.json
│   │   └── sources.json
│   ├── lib/
│   │   ├── ask.ts                     # Retrieval scoring, PII guards, advice guards
│   │   └── knowledge.ts               # 16 standardized AMFI/SEBI core concepts
│   ├── ingestion/                     # Python ingestion modules
│   └── query/                         # Python retrieval and guard modules
└── tests/                             # pytest test suites (guards, retrieval, edge cases)
```

---

## 2. Source Ingestion (Phase 1)

The assistant's knowledge base spans **25 verified public sources** across AMC schemes, AMFI standards, SEBI regulations, and registrar portals:

1. **AMC Schemes & Documents (6)**:
   - HDFC Large Cap Fund Direct Growth (Factsheet & parameters)
   - HDFC Flexi Cap Direct Plan Growth
   - HDFC ELSS Tax Saver Direct Plan Growth
   - HDFC Mid-Cap Fund Direct Growth
   - HDFC Mutual Fund AMC Overview & Management
   - HDFC Statutory Offer Documents (KIM & SID Downloads)
2. **AMFI Investor Education & Industry Standards (12)**:
   - What is NAV & Daily Valuation Formula
   - Total Expense Ratio (TER) Rules & Plan Mechanics
   - Exit Load Principles & Holding Periods
   - Systematic Investment Plan (SIP) & Rupee Cost Averaging
   - Systematic Withdrawal Plan (SWP) for Cash Flows
   - Systematic Transfer Plan (STP) Asset Allocation
   - Direct vs Regular Plans & Intermediary Commissions
   - Index Funds, ETFs & Passive Replication
   - SEBI Official NAV Cut-off Timings (1:30 PM Liquid / 3:00 PM Equity)
   - SEBI 6-Level Risk-o-meter Architecture
   - AMFI Intermediary Code of Conduct & Ethical Standards
   - Scheme Information Documents Guide (KIM vs SID)
3. **SEBI Regulatory Framework (4)**:
   - Categorization & Rationalization of Mutual Fund Schemes (Large Cap Top 100, Mid Cap 101–250, Small Cap 251+)
   - Total Expense Ratio Caps and AUM Slabs
   - Mutual Fund Regulations 1996 Key Tenets
   - Risk-o-meter Monthly Evaluation Norms
4. **Statements, Registrars & Taxation (3)**:
   - CAMS Consolidated Account Statement (CAS)
   - KFintech Mutual Fund Investor Portal
   - Income Tax Department Capital Gains Framework (LTCG / STCG)

Raw HTML snapshots are stored in `data/raw/<slug>.html` with provenance tracked in `data/raw/manifest.json`.

---

## 3. Chunking Strategy (Phase 2)

**Output:** `data/chunks/chunks.jsonl` (89 total chunks).

### Chunking Rules:
- **Discrete Scheme Facts**: One chunk per parameter prefixed with scheme name (e.g. `"HDFC Large Cap Fund Direct Growth – Expense ratio: 1.02%"`).
- **Statutory & Educational Rules**: Section-bounded chunks (max 800 characters) preserving exact regulatory limits, cut-off hours, and formulas.
- **Metadata Fields**: `chunk_id`, `text`, `source_url`, `scheme_name`, `page_type`, `section`, `scraped_at`.

---

## 4. Vector Embeddings (Phase 3)

- **Model**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).
- **Normalization**: All embeddings L2-normalized for cosine similarity.
- **Artifacts**:
  - `data/embeddings/vectors.npy`: 136,832-byte NumPy float32 binary array of shape `(89, 384)`.
  - `data/embeddings/ids.json`: List of 89 string chunk identifiers.
  - `data/embeddings/meta.json`: `{"model": "sentence-transformers/all-MiniLM-L6-v2", "dim": 384, "count": 89}`.
  - `src/data/corpus.json`: Synchronized in-memory vector dataset for zero-latency client/server retrieval.

---

## 5. Vector Database Storage (Phase 4)

- **Engine**: ChromaDB SQLite (`data/chroma/chroma.sqlite3`).
- **Index**: HNSW collection `hdfc_mf_faq` configured with cosine distance space (`metadata={"hnsw:space": "cosine"}`).
- **Synchronization**: Chunks and embeddings upserted by unique `chunk_id` for deterministic re-runs.

---

## 6. Query Pipeline & Retrieval Logic

```
User Query
   │
   ├── 1. PII Guard ───────────────► Triggered? Block & warn (zero logging)
   │
   ├── 2. Intent / Advice Guard ───► Advice / returns requested? Politely refuse with AMFI link
   │
   ├── 3. Statement Route ─────────► Statement question? Route to CAMS/KFintech link
   │
   ├── 4. Concept Match ───────────► Standard MF concept? Fetch instant verified definition
   │
   ├── 5. Vector & Lexical RAG ────► Score 89 chunks across 25 sources (threshold ≥ 0.25)
   │
   └── 6. Generation / Synthesis ──► Gemini 3.8 Flash (or grounded fallback) ≤ 3 sentences + citation
```

### Retrieval Scoring:
- **Lexical Section Matching**: Keyword weight (`0.45`) across sections (`nav_concept`, `cut_off_timing_rules`, `sid_purpose`, `expense_ratio`, `sebi_categorization_and_market_cap_rules`).
- **Semantic Word Overlap**: Informative token ratio (`0.35`).
- **Scheme Filtering**: Scoped only when specific scheme terms (`"hdfc large cap"`, `"tax saver"`) are named without general SEBI/definition keywords.

### Formatting Guarantees:
- Maximum 3 sentences.
- Exactly one official citation URL appended (`Source: https://...`).
- Scrape / regulatory verification date.
- No investment advice, returns forecasting, or model hallucination.

---

## 7. Guardrails & Compliance

### 7.1 PII Protection
Blocks inputs containing personal identifiers before storage or LLM transmission:
- **PAN**: `\b[A-Z]{5}[0-9]{4}[A-Z]\b`
- **Aadhaar**: `\b\d{4}\s?\d{4}\s?\d{4}\b`
- **Phone**: `(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)`
- **Email**: `[\w.+-]+@[\w-]+\.[\w.-]+`
- **OTP**: `(?i)\botp\b.{0,20}\b\d{4,8}\b`
- **Bank/Folio Account**: `\b\d{9,18}\b`

### 7.2 Investment Advice Refusal
Refuses requests for portfolio recommendations, predictions, or stock picking:
- Refusal message: *"I can share factual and educational information, but not personalized investment advice. Consider consulting a SEBI-registered investment advisor."*
- Official link: `https://www.amfiindia.com/investor-corner`

---

## 8. Web Application & User Interface

- **Framework**: React 18 SPA with Vite 5 and Tailwind CSS v4.
- **Design System**: Plus Jakarta Sans typography, clean neutral canvas (`bg-slate-50`), hairline borders, and emerald accents (`#059669`).
- **Top Bar**: Fixed header with brand wordmark (*Mutual Fund FAQ Assistant · AMFI & SEBI Grounded*) and "Clear chat" action.
- **Skeletal Loading State**:
  - When waiting for the assistant, a skeletal chat bubble renders immediately.
  - Matches the assistant geometry with animated gradient shimmer lines (`92%`, `98%`, `65%`) and placeholder citation footer.
  - Replaces generic spinners to make latency feel virtually instant.
- **Curated Prompt Suggestions**: Instant inquiry chips for *Valuation & Concepts*, *SEBI Rules & Cut-offs*, and *Scheme Facts*.
- **Citation Badges & Copy Action**: Verified external source links and instant clipboard copying on every answer.

---

## 9. Verification & Testing

- **Compilation**: Verified via `compile_applet` with clean Vite bundle generation.
- **Type Safety**: Verified via `lint_applet` (`tsc --noEmit`).
- **API Tests**: Verified via `/api/ask` for:
  - Concept definitions (NAV, SIP, KIM vs SID)
  - Statutory cut-off rules (1:30 PM liquid, 3:00 PM equity)
  - Market cap categorizations (SEBI top 100, 101–250, 251+)
  - Scheme facts (HDFC Large Cap expense ratio, ELSS 3-year lock-in)
  - PII guard blocking (PAN/Aadhaar)
  - Investment advice refusals
