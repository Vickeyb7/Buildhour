# HDFC Mutual Fund FAQ Assistant

A facts-only React FAQ assistant for a fixed set of HDFC Mutual Fund pages. Every factual answer has at most three sentences, one source link, and the scrape date. It does not provide investment advice.

## Features

- **Facts-Only Q&A**: Answers questions regarding expense ratios, exit loads, lock-in periods, minimum SIP, benchmarks, and riskometers for select HDFC Mutual Funds.
- **Strict Guardrails**:
  - Automatically identifies and blocks PII (PAN, Aadhaar, account numbers, OTPs, phone numbers, emails).
  - Explicit refusals for investment advice, portfolio reviews, and future performance predictions.
  - Directional guidance with links to official AMFI and HDFC statement request portals.
- **Pipeline Inspector**:
  - Real-time inspection of chunk retrieval and relevance scores.
  - Corpus manifest and scraped source status.
  - Chunk distribution across schemes.
  - Embedding metadata and thresholds.

## Covered Schemes

- HDFC Mutual Fund (AMC Overview)
- HDFC Large Cap Fund Direct Growth
- HDFC Flexi Cap Direct Plan Growth
- HDFC ELSS Tax Saver Fund Direct Plan Growth
- HDFC Mid Cap Fund Direct Growth

## Running the Application

```bash
npm install
npm run dev
```

The application runs on http://localhost:3000.

## Building for Production

```bash
npm run build
```

## Disclaimer

Facts-only. No investment advice.
