# Mutual Fund FAQ Assistant

A facts-only, grounded FAQ assistant for Indian mutual funds. Answers general mutual fund questions (NAV calculation, Direct vs Regular plans, cut-off timings, KIM vs SID, SEBI market-cap rules, taxation) and specific scheme facts across 25 official sources (AMC, AMFI, SEBI, CAMS).

Every factual response follows strict guarantees:
- **Maximum 3 sentences** of concise, educational prose.
- **Exactly one official citation link** to the verified source document.
- **Zero investment advice** and automated PII protection.
- **Skeletal loading state** for responsive visual feedback.

---

## Sample Q&A (Verified Assistant Responses & Official Links)

The following 10 sample queries demonstrate the assistant's factual coverage, statutory grounding, citation formatting, and safety guardrails:

### 1. Core Valuation: Net Asset Value (NAV)
- **Question:** What is NAV and how is it calculated?
- **Assistant Answer:** Net Asset Value (NAV) represents the per-unit market value of a mutual fund scheme. It is calculated as: NAV = (Total Value of Assets − Liabilities and Expenses) ÷ Total Outstanding Units. Unlike stock prices which change continuously during market hours, mutual fund NAV is declared once each business day after the market closes at the end of trading.
- **Official Citation:** [https://www.amfiindia.com/investor-corner/knowledge-center/what-is-nav.html](https://www.amfiindia.com/investor-corner/knowledge-center/what-is-nav.html)

---

### 2. Statutory Offer Documents: KIM vs SID
- **Question:** What is the difference between KIM and SID?
- **Assistant Answer:** A Scheme Information Document (SID) is the primary legal document detailing a mutual fund's investment objective, asset allocation strategy, risk factors, fees, and fund managers. The Key Information Memorandum (KIM) is a concise summary of the SID attached to every application form so that investors can quickly review essential fund facts before investing. Both documents are prepared under SEBI regulations.
- **Official Citation:** [https://www.amfiindia.com/investor-corner/knowledge-center/scheme-documents.html](https://www.amfiindia.com/investor-corner/knowledge-center/scheme-documents.html)

---

### 3. SEBI Transaction Rules: NAV Cut-Off Timings
- **Question:** What is the cut-off timing for subscription in liquid funds?
- **Assistant Answer:** SEBI sets standard cut-off timings for receiving same-day NAV. For Liquid and Overnight funds, subscriptions placed before 1:30 PM with funds realized get previous day's NAV. For other equity and debt mutual funds, investments submitted and realized before 3:00 PM receive the same day's closing NAV. Orders after 3:00 PM receive the next business day's NAV.
- **Official Citation:** [https://www.amfiindia.com/investor-corner/knowledge-center/cut-off-timings.html](https://www.amfiindia.com/investor-corner/knowledge-center/cut-off-timings.html)

---

### 4. SEBI Categorization: Market Cap Definitions
- **Question:** What are large cap and mid cap stocks defined as under SEBI rules?
- **Assistant Answer:** According to SEBI regulations, equity funds are categorized by market capitalization: Large Cap funds invest at least 80% in the top 100 companies by market cap; Mid Cap funds invest at least 65% in 101st to 250th companies; Small Cap funds invest at least 65% in 251st company onwards; and Flexi Cap funds can dynamically invest across large, mid, and small cap companies without fixed caps.
- **Official Citation:** [https://www.sebi.gov.in/legal/circulars/oct-2017/categorization-and-rationalization-of-mutual-fund-schemes_36199.html](https://www.sebi.gov.in/legal/circulars/oct-2017/categorization-and-rationalization-of-mutual-fund-schemes_36199.html)

---

### 5. Plan Mechanics: Direct vs Regular
- **Question:** What is the difference between Direct and Regular plans?
- **Assistant Answer:** Every mutual fund scheme offers two options: Direct Plan and Regular Plan. In a Direct Plan, you invest directly with the AMC with zero distributor commission, leading to a lower expense ratio and higher compounding returns. In a Regular Plan, you invest through a broker or distributor who receives an ongoing trail commission paid from the fund's assets, resulting in a higher expense ratio.
- **Official Citation:** [https://www.amfiindia.com/investor-corner/knowledge-center/direct-plan.html](https://www.amfiindia.com/investor-corner/knowledge-center/direct-plan.html)

---

### 6. Scheme Facts: Expense Ratio
- **Question:** What is the expense ratio of HDFC Large Cap Fund Direct Growth?
- **Assistant Answer:** HDFC Large Cap Fund Direct Growth – Expense ratio: 1.02%
- **Official Citation:** [https://groww.in/mutual-funds/hdfc-large-cap-fund-direct-growth](https://groww.in/mutual-funds/hdfc-large-cap-fund-direct-growth)
- **Last Updated:** 03 Nov 2026

---

### 7. Scheme Facts: ELSS Tax Saver Lock-in
- **Question:** What is the lock-in period of HDFC ELSS Tax Saver Fund?
- **Assistant Answer:** HDFC ELSS Tax Saver Fund Direct Plan Growth – Lock-in period: 3 years
- **Official Citation:** [https://groww.in/mutual-funds/hdfc-elss-tax-saver-fund-direct-plan-growth](https://groww.in/mutual-funds/hdfc-elss-tax-saver-fund-direct-plan-growth)
- **Last Updated:** 03 Nov 2026

---

### 8. Scheme Facts: Minimum SIP Installment
- **Question:** What is the minimum SIP for HDFC Mid Cap Fund?
- **Assistant Answer:** HDFC Mid-Cap Fund Direct Growth – Minimum SIP: ₹100
- **Official Citation:** [https://groww.in/mutual-funds/hdfc-mid-cap-fund-direct-growth](https://groww.in/mutual-funds/hdfc-mid-cap-fund-direct-growth)
- **Last Updated:** 03 Nov 2026

---

### 9. Guardrail Refusal: Personalized Investment Advice
- **Question:** Can you recommend the best mutual fund to buy right now?
- **Assistant Answer:** I can share factual and educational information, but not personalized investment advice. Consider consulting a SEBI-registered investment advisor.
- **Official Citation:** [https://www.amfiindia.com/investor-corner](https://www.amfiindia.com/investor-corner)
- **Guardrail Rule:** Intercepts advice solicitations (`recommend`, `buy`, `sell`, `best fund`) and redirects to certified SEBI advisors.

---

### 10. Guardrail Refusal: PII Protection
- **Question:** My PAN card number is ABCDE1234F, what is my portfolio balance?
- **Assistant Answer:** Please don't share personal details like PAN, Aadhaar, account numbers, OTPs, emails or phone numbers. I only answer general factual and educational questions.
- **Official Citation:** None (personal data is sanitized immediately and dropped; never logged, embedded, or transmitted to any LLM).
- **Guardrail Rule:** Strict regex matching for PAN, Aadhaar, phone numbers, email addresses, OTP codes, and bank/folio numbers.

---

## Features

- **25 Verified Public Sources**: Curated pages from AMFI India, SEBI regulations, HDFC AMC factsheets/KIM/SID, and CAMS/ITD.
- **384-Dim Hybrid RAG Pipeline**: Embedded with `sentence-transformers/all-MiniLM-L6-v2` across 89 chunks in ChromaDB SQLite (`data/chroma/chroma.sqlite3`) and NumPy (`data/embeddings/vectors.npy`).
- **Real-Time Gemini Grounding**: Server-side Gemini 3.8 Flash RAG with zero-latency local fallback.
- **Modern UI with Skeletal Loading**: Conversational UI built in React 18 and Tailwind CSS v4, featuring geometry-matched skeletal shimmer animations while fetching answers.
- **Clear Conversation**: Dedicated action to reset chat history.

---

## Running the Application

```bash
# Install dependencies
npm install

# Start full-stack development server (Express + Vite on port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Building for Production

```bash
npm run build
npm start
```

## Disclaimer

Facts-only. No investment advice.
