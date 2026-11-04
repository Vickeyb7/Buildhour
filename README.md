# HDFC Mutual Fund FAQ Assistant

Facts-only assistant for a fixed set of HDFC Mutual Fund pages. Every factual answer has at most three sentences, one source link, and the scrape date. It does not give investment advice.

## Setup

```bash
pip install -r requirements.txt
copy .env.example .env
```

Put `GROQ_API_KEY` and `GROQ_MODEL` in `.env`. The embedding model, chunk size, retrieval cutoff, and source URLs live in `config.yaml`.

## Ingestion

```bash
python run_ingestion.py --phase 1
python run_ingestion.py --phase 2
python run_ingestion.py --phase 3
python run_ingestion.py --phase 4
```

`--phase all` runs the phases in order. `--reset` on phase 4 deletes the Chroma collection and builds it again.

## App and checks

The Vercel app is the Next.js site in `web/`. Streamlit remains available for a local Python demo.

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. On Vercel, set the project root to `web` and add `GROQ_API_KEY` and `GROQ_MODEL` as environment variables.

```bash
python -m streamlit run app/streamlit_app.py
python run_queries.py
pytest -q
```

## Scope

The scraped corpus is five Groww pages: the HDFC Mutual Fund AMC overview, and the direct-growth plans for Large Cap, Flexi Cap, ELSS Tax Saver, and Mid Cap. Pages linked from those five are not scraped. Refusal and statement answers point at AMFI or HDFC AMC pages listed in `sources.md`.

## Known limits

- Only these five pages are covered. Other HDFC schemes are out of scope.
- Figures are a snapshot. The "Last updated from sources" line is the scrape date, not a live refresh.
- A change in the Groww page structure can break scraping.
- The small embedding model can miss a fact when the question does not name the scheme.
- Re-run ingestion to refresh the corpus. There is no scheduled update.

## Disclaimer

Facts-only. No investment advice.
