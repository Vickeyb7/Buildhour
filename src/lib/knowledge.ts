/**
 * Comprehensive Mutual Fund Knowledge Base covering general mutual fund concepts,
 * terms, categories, mechanics, taxation, and SEBI regulations.
 */

export interface MFConcept {
  id: string;
  name: string;
  keywords: string[];
  patterns: RegExp[];
  summary: string;
  sourceUrl: string;
}

export const MF_CONCEPTS: MFConcept[] = [
  {
    id: "nav",
    name: "Net Asset Value (NAV)",
    keywords: ["nav", "net asset value", "what is nav", "calculate nav", "nav calculation", "per unit value"],
    patterns: [/\bnav\b/i, /net asset value/i],
    summary:
      "Net Asset Value (NAV) represents the per-unit market value of a mutual fund scheme. It is calculated as: NAV = (Total Value of Assets − Liabilities and Expenses) ÷ Total Outstanding Units. Unlike stock prices which change continuously during market hours, mutual fund NAV is declared once each business day after the market closes at the end of trading.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/what-is-nav.html",
  },
  {
    id: "expense_ratio",
    name: "Total Expense Ratio (TER)",
    keywords: ["expense ratio", "ter", "total expense ratio", "fund management fee", "cost of mutual fund"],
    patterns: [/expense ratio/i, /\bter\b/i],
    summary:
      "The Expense Ratio (Total Expense Ratio or TER) is the annual percentage fee charged by the Asset Management Company (AMC) to cover fund management, administration, registrar, audit, and operational expenses. A lower expense ratio leaves more money invested to compound over time. Direct plans always have a lower expense ratio than Regular plans because they exclude distributor commissions.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/expense-ratio.html",
  },
  {
    id: "exit_load",
    name: "Exit Load",
    keywords: ["exit load", "redemption charge", "penalty for withdrawal"],
    patterns: [/exit load/i],
    summary:
      "Exit Load is a fee charged by a mutual fund if you redeem your units before a specified holding period (for example, 1% if redeemed within 365 days of purchase). Its purpose is to discourage short-term trading and protect long-term investors. If you redeem after the specified exit load period, no exit load is charged.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/exit-load.html",
  },
  {
    id: "sip",
    name: "Systematic Investment Plan (SIP)",
    keywords: ["sip", "systematic investment plan", "what is sip", "how sip works", "sip vs lumpsum"],
    patterns: [/\bsip\b/i, /systematic investment/i],
    summary:
      "A Systematic Investment Plan (SIP) allows you to invest a fixed amount regularly (usually monthly or weekly) into a mutual fund. SIPs benefit from 'Rupee Cost Averaging'—purchasing more units when markets are down and fewer when markets are up—eliminating the need to time the market, and harness the power of compounding.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/what-is-sip.html",
  },
  {
    id: "direct_vs_regular",
    name: "Direct vs Regular Plans",
    keywords: ["direct vs regular", "direct plan", "regular plan", "difference between direct and regular"],
    patterns: [/direct.*regular/i, /regular.*direct/i, /direct plan/i, /regular plan/i],
    summary:
      "Every mutual fund scheme offers two options: Direct Plan and Regular Plan. In a Direct Plan, you invest directly with the AMC with zero distributor commission, leading to a lower expense ratio and higher compounding returns. In a Regular Plan, you invest through a broker or distributor who receives an ongoing trail commission paid from the fund's assets, resulting in a higher expense ratio.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/direct-plan.html",
  },
  {
    id: "elss",
    name: "Equity Linked Savings Scheme (ELSS)",
    keywords: ["elss", "tax saver fund", "tax saving mutual fund", "section 80c", "lock in period"],
    patterns: [/\belss\b/i, /tax saver/i, /tax saving/i, /80c/i],
    summary:
      "An Equity Linked Savings Scheme (ELSS) is a diversified equity mutual fund offering tax deductions under Section 80C of the Income Tax Act up to ₹1.5 lakh per financial year (under the old tax regime). ELSS funds have a mandatory 3-year lock-in period, which is the shortest lock-in among all Section 80C options (such as PPF, NPS, or Tax-Saver FDs).",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/elss.html",
  },
  {
    id: "swp",
    name: "Systematic Withdrawal Plan (SWP)",
    keywords: ["swp", "systematic withdrawal plan", "monthly income from mutual fund"],
    patterns: [/\bswp\b/i, /systematic withdrawal/i],
    summary:
      "A Systematic Withdrawal Plan (SWP) allows an investor to withdraw a predetermined sum of money from their mutual fund investments at regular intervals (monthly, quarterly, etc.). It is popular among retirees seeking a predictable income stream while allowing remaining capital to stay invested.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/swp.html",
  },
  {
    id: "stp",
    name: "Systematic Transfer Plan (STP)",
    keywords: ["stp", "systematic transfer plan", "transfer from liquid to equity"],
    patterns: [/\bstp\b/i, /systematic transfer/i],
    summary:
      "A Systematic Transfer Plan (STP) enables you to periodically transfer a fixed amount from one mutual fund scheme (source fund, typically a low-risk liquid or debt fund) to another scheme (target fund, typically an equity fund) of the same AMC. It helps deploy lumpsum funds steadily without timing risk.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/stp.html",
  },
  {
    id: "index_funds",
    name: "Index Funds & ETFs",
    keywords: ["index fund", "etf", "passive fund", "nifty 50 fund", "sensex fund", "tracking error"],
    patterns: [/index fund/i, /\betf\b/i, /passive fund/i],
    summary:
      "Index Funds and Exchange Traded Funds (ETFs) are passively managed funds designed to mirror the composition and performance of a specific market index, such as the Nifty 50 or BSE Sensex. Because they replicate an index rather than having an active fund manager picking individual stocks, they typically feature very low expense ratios and zero fund-manager bias.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/index-funds.html",
  },
  {
    id: "categories",
    name: "SEBI Mutual Fund Categories",
    keywords: ["large cap", "mid cap", "small cap", "flexi cap", "multi cap", "sebi categorization", "types of mutual funds"],
    patterns: [/sebi.*category/i, /types of mutual funds/i, /large cap/i, /mid cap/i, /small cap/i, /flexi cap/i],
    summary:
      "According to SEBI regulations, equity funds are categorized by market capitalization: Large Cap funds invest at least 80% in the top 100 companies by market cap; Mid Cap funds invest at least 65% in 101st to 250th companies; Small Cap funds invest at least 65% in 251st company onwards; and Flexi Cap funds can dynamically invest across large, mid, and small cap companies without fixed caps.",
    sourceUrl: "https://www.sebi.gov.in/legal/circulars/oct-2017/categorization-and-rationalization-of-mutual-fund-schemes_36199.html",
  },
  {
    id: "taxation",
    name: "Mutual Fund Taxation in India",
    keywords: ["taxation", "capital gains", "ltcg", "stcg", "tax on mutual funds", "budget 2024 tax"],
    patterns: [/\btax\b/i, /taxation/i, /\bltcg\b/i, /\bstcg\b/i, /capital gains/i],
    summary:
      "For equity-oriented funds (holding >65% Indian equities): Long-Term Capital Gains (LTCG) on units held for more than 12 months are taxed at 12.5% on gains exceeding ₹1.25 lakh per financial year (without indexation). Short-Term Capital Gains (STCG) on units held up to 12 months are taxed at 20%. For debt funds purchased after April 1, 2023, gains are added to taxable income and taxed at the investor's slab rate.",
    sourceUrl: "https://incometaxindia.gov.in",
  },
  {
    id: "cut_off",
    name: "NAV Cut-off Timings",
    keywords: ["cut off time", "cut-off", "same day nav", "order timing"],
    patterns: [/cut[- ]off/i, /same day nav/i],
    summary:
      "SEBI sets standard cut-off timings for receiving same-day NAV. For Liquid and Overnight funds, subscriptions placed before 1:30 PM with funds realized get previous day's NAV. For other equity and debt mutual funds, investments submitted and realized before 3:00 PM receive the same day's closing NAV. Orders after 3:00 PM receive the next business day's NAV.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/cut-off-timings.html",
  },
  {
    id: "amc",
    name: "Asset Management Company (AMC)",
    keywords: ["what is amc", "amc", "fund house", "sponsor", "trustee"],
    patterns: [/\bamc\b/i, /asset management company/i, /fund house/i],
    summary:
      "An Asset Management Company (AMC) or Fund House manages the pooled money of mutual fund investors. Regulated by SEBI, the AMC employs professional fund managers, research analysts, and compliance teams to invest the corpus according to the stated investment objective of each scheme under the supervision of a Board of Trustees.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/what-is-amc.html",
  },
  {
    id: "kim_sid",
    name: "KIM vs SID (Offer Documents)",
    keywords: ["kim", "sid", "scheme information document", "key information memorandum", "difference between kim and sid"],
    patterns: [/kim/i, /sid/i, /scheme information document/i, /key information memorandum/i],
    summary:
      "A Scheme Information Document (SID) is the primary legal document detailing a mutual fund's investment objective, asset allocation strategy, risk factors, fees, and fund managers. The Key Information Memorandum (KIM) is a concise summary of the SID attached to every application form so that investors can quickly review essential fund facts before investing. Both documents are prepared under SEBI regulations.",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/scheme-documents.html",
  },
  {
    id: "riskometer",
    name: "SEBI Risk-o-meter",
    keywords: ["riskometer", "risk-o-meter", "risk level", "very high risk", "moderately high"],
    patterns: [/risk[- ]?o[- ]?meter/i, /risk level/i],
    summary:
      "The SEBI Risk-o-meter is a standardized visual gauge with 6 risk levels: Low, Low to Moderate, Moderate, Moderately High, High, and Very High. Mutual fund houses are mandated to evaluate and update the scheme's risk level on a monthly basis based on the actual portfolio holdings (credit risk, interest rate risk, and liquidity risk for debt; market cap and volatility for equities).",
    sourceUrl: "https://www.amfiindia.com/investor-corner/knowledge-center/riskometer.html",
  },
  {
    id: "cas",
    name: "Consolidated Account Statement (CAS)",
    keywords: ["cas", "consolidated account statement", "cams statement", "kfintech statement", "download statement"],
    patterns: [/\bcas\b/i, /consolidated account statement/i, /cams.*statement/i, /kfintech.*statement/i],
    summary:
      "A Consolidated Account Statement (CAS) is a single monthly statement that aggregates all mutual fund holdings and transactions across all AMCs tied to your PAN. It is jointly generated by depositories (NSDL/CDSL) and RTAs (CAMS/KFintech). You can generate an e-CAS on-demand for free from CAMS Online or KFintech.",
    sourceUrl: "https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement",
  },
];

export function findMatchingConcept(query: string): MFConcept | null {
  const q = query.toLowerCase().trim();
  for (const concept of MF_CONCEPTS) {
    if (concept.patterns.some((p) => p.test(q))) {
      return concept;
    }
    if (concept.keywords.some((kw) => q.includes(kw))) {
      return concept;
    }
  }
  return null;
}
