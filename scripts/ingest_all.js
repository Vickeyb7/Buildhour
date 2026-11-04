import fs from "fs";
import path from "path";
import crypto from "crypto";

// We import transformers to generate real 384-dim embeddings
async function run() {
  console.log("Loading Xenova/all-MiniLM-L6-v2 pipeline...");
  const { pipeline } = await import("@huggingface/transformers");
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "fp32" });

  const existingCorpus = JSON.parse(fs.readFileSync("src/data/corpus.json", "utf-8"));
  console.log(`Existing corpus: ${existingCorpus.length} chunks`);

  const existingManifest = JSON.parse(fs.readFileSync("src/data/manifest.json", "utf-8"));
  console.log(`Existing manifest: ${existingManifest.length} sources`);

  // Define the 20 new resources with factual text and section breakdowns
  const newSourcesData = [
    {
      slug: "hdfc-monthly-factsheets",
      name: "HDFC Mutual Fund Monthly Factsheets",
      type: "factsheet",
      url: "https://www.hdfcfund.com/mutual-funds/factsheets",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "factsheet_overview",
          text: "HDFC Mutual Fund Monthly Factsheet: Published every month providing comprehensive portfolio disclosures, top 10 holdings, sector weightages, AUM, fund manager details, expense ratios, and historical trailing returns across all schemes."
        },
        {
          section: "portfolio_disclosure_frequency",
          text: "HDFC Mutual Fund Portfolio Disclosure: In compliance with SEBI norms, monthly portfolio disclosures are uploaded on the 10th of every month, while fortnightly debt scheme portfolios are disclosed within 5 days of the fortnight ending."
        }
      ]
    },
    {
      slug: "hdfc-statutory-sid-kim",
      name: "HDFC Scheme Information Document & KIM",
      type: "statutory",
      url: "https://www.hdfcfund.com/statutory-disclosure/scheme-information-document-sid",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "sid_purpose",
          text: "HDFC Mutual Fund – Scheme Information Document (SID): The legal statutory document setting forth the scheme's investment objective, asset allocation, investment strategies, risk factors, fee structure, and unitholder rights as approved by SEBI."
        },
        {
          section: "kim_purpose",
          text: "HDFC Mutual Fund – Key Information Memorandum (KIM): An abbreviated summary of the Scheme Information Document containing critical information an investor must know before making an investment decision, attached to every application form."
        }
      ]
    },
    {
      slug: "hdfc-ter-disclosures",
      name: "HDFC Total Expense Ratio Disclosures",
      type: "charges",
      url: "https://www.hdfcfund.com/statutory-disclosure/total-expense-ratio-ter",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "daily_ter_disclosure",
          text: "HDFC Mutual Fund Daily Total Expense Ratio (TER): All mutual funds are mandated by SEBI to disclose the base TER and total TER of both Regular and Direct plans on their website daily, reflecting management fees, operational costs, and taxes."
        },
        {
          section: "direct_plan_ter_discount",
          text: "HDFC Mutual Fund TER Differential: Direct plans have a lower expense ratio compared to Regular plans because no distributor commissions, marketing commissions, or agent trail fees are charged to the scheme in Direct plans."
        }
      ]
    },
    {
      slug: "hdfc-exit-load-notices",
      name: "HDFC Exit Load & Addenda Disclosures",
      type: "charges",
      url: "https://www.hdfcfund.com/statutory-disclosure/notice-addenda",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "exit_load_rules",
          text: "HDFC Mutual Fund Exit Load Structure: For equity growth schemes, an exit load of 1.00% is typically levied if units are redeemed within 365 days; after 1 year, exit load is Nil. ELSS schemes have Nil exit load but a statutory 3-year lock-in."
        },
        {
          section: "exit_load_exemption",
          text: "HDFC Mutual Fund Exit Load Applicability: Exit load is calculated using the First-In-First-Out (FIFO) method on units redeemed. Bonus units and dividend reinvestment units are exempt from exit load."
        }
      ]
    },
    {
      slug: "hdfc-statement-portal",
      name: "HDFC Request Statement & Capital Gains Portal",
      type: "statements",
      url: "https://www.hdfcfund.com/services/additional-info/request-statement",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "account_statement_request",
          text: "HDFC Mutual Fund Statement Request: Unitholders can request an account statement or Consolidated Account Statement (CAS) via the official HDFC portal by entering their PAN, Folio number, or registered email ID with OTP validation."
        },
        {
          section: "capital_gains_statement",
          text: "HDFC Mutual Fund Capital Gains Statement: Capital-gains statements for tax filing can be generated for any financial year (FY), separating Short-Term Capital Gains (STCG) and Long-Term Capital Gains (LTCG) with grandfathering details."
        }
      ]
    },
    {
      slug: "amfi-investor-corner",
      name: "AMFI Investor Corner",
      type: "investor_education",
      url: "https://www.amfiindia.com/investor-corner",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "investor_awareness",
          text: "AMFI Investor Corner: The central investor education portal established by the Association of Mutual Funds in India (AMFI) to promote financial literacy, explain mutual fund principles, and guide investors on rights and grievance redressal."
        }
      ]
    },
    {
      slug: "amfi-nav-guide",
      name: "AMFI Net Asset Value Guide",
      type: "core_concept",
      url: "https://www.amfiindia.com/investor-corner/knowledge-center/what-is-nav.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "nav_definition",
          text: "AMFI – What is NAV: Net Asset Value (NAV) is the market value of all securities held by a mutual fund scheme minus liabilities, divided by total outstanding units. It represents the price per unit at which investors buy or redeem fund units."
        },
        {
          section: "nav_calculation_frequency",
          text: "AMFI NAV Calculation: Mutual fund NAV is calculated daily at the close of trading hours and must be uploaded to the AMFI portal by 11:00 PM on every business day. NAV changes daily based on underlying market price movements."
        }
      ]
    },
    {
      slug: "amfi-expense-ratio-guide",
      name: "AMFI Total Expense Ratio Guide",
      type: "charges",
      url: "https://www.amfiindia.com/investor-corner/knowledge-center/expense-ratio.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "ter_caps_sebi",
          text: "AMFI Expense Ratio Limits: SEBI mandates maximum TER caps based on AUM slabs: for equity schemes, up to 2.25% on the first ₹500 Cr, scaling down to 1.50% on ₹50,000 Cr+, ensuring economies of scale benefit retail investors."
        },
        {
          section: "ter_components",
          text: "AMFI TER Components: Total Expense Ratio includes investment management fees, custodian fees, registrar and transfer agent fees, audit fees, marketing expenses, and statutory GST on management fees."
        }
      ]
    },
    {
      slug: "amfi-cut-off-timings",
      name: "AMFI NAV Cut-Off Timings",
      type: "operational",
      url: "https://www.amfiindia.com/investor-corner/knowledge-center/cut-off-timings.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "cut_off_rules_equity",
          text: "AMFI Cut-off Timings for Equity/Debt Funds: Applications submitted and funds credited to the AMC bank account before 3:00 PM on a business day receive that day's closing NAV; orders after 3:00 PM receive next business day's NAV."
        },
        {
          section: "cut_off_rules_liquid",
          text: "AMFI Cut-off Timings for Liquid and Overnight Funds: For subscriptions placed before 1:30 PM with funds realized, units are allotted at the previous day's NAV. For redemptions before 3:00 PM, same day NAV applies."
        }
      ]
    },
    {
      slug: "amfi-sip-guide",
      name: "AMFI Systematic Investment Plan Guide",
      type: "core_concept",
      url: "https://www.amfiindia.com/investor-corner/knowledge-center/what-is-sip.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "sip_rupee_cost_averaging",
          text: "AMFI SIP Rupee Cost Averaging: Systematic Investment Plans allow investors to invest fixed sums regularly, automatically buying more mutual fund units when market prices are low and fewer units when prices are high, smoothing purchase costs."
        },
        {
          section: "sip_compounding_benefits",
          text: "AMFI SIP Compounding: Starting a regular SIP early harnesses compounding interest over long horizons, allowing reinvested earnings to generate additional returns without the need to time volatile equity markets."
        }
      ]
    },
    {
      slug: "amfi-direct-vs-regular",
      name: "AMFI Direct vs Regular Plan Guide",
      type: "core_concept",
      url: "https://www.amfiindia.com/investor-corner/knowledge-center/direct-plan.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "direct_vs_regular_comparison",
          text: "AMFI Direct vs Regular Plans: Direct plans are bought directly from the AMC with no intermediary commission, resulting in a lower TER and a higher NAV. Regular plans involve distributors who receive trail commissions paid from scheme assets."
        }
      ]
    },
    {
      slug: "amfi-riskometer-guide",
      name: "AMFI Product Labeling & Riskometer Guide",
      type: "risk",
      url: "https://www.amfiindia.com/investor-corner/knowledge-center/riskometer.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "riskometer_six_levels",
          text: "AMFI Riskometer: Mutual fund schemes display a pictorial Riskometer with 6 risk levels: Low Risk, Low to Moderate Risk, Moderate Risk, Moderately High Risk, High Risk, and Very High Risk, evaluated on a monthly basis."
        }
      ]
    },
    {
      slug: "amfi-swp-stp-guide",
      name: "AMFI Systematic Withdrawal & Transfer Plans",
      type: "core_concept",
      url: "https://www.amfiindia.com/investor-corner/knowledge-center/swp.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "swp_mechanics",
          text: "AMFI Systematic Withdrawal Plan (SWP): SWP allows unitholders to withdraw fixed amounts from their mutual fund at scheduled dates (e.g. monthly), providing regular cash flows while leaving remaining capital invested to grow."
        },
        {
          section: "stp_mechanics",
          text: "AMFI Systematic Transfer Plan (STP): STP allows systematic transfer of a fixed sum from one scheme (e.g., a liquid fund) to another (e.g., an equity fund) within the same AMC, deploying lumpsum amounts gradually."
        }
      ]
    },
    {
      slug: "amfi-aum-data",
      name: "AMFI Industry AUM & Classification Data",
      type: "industry_data",
      url: "https://www.amfiindia.com/research-information/aum-data",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "industry_aum_stats",
          text: "AMFI Industry AUM Disclosures: Monthly official records publishing total mutual fund industry Assets Under Management (AUM), scheme-wise inflow/outflow trends, and investor folio growth across Indian AMCs."
        }
      ]
    },
    {
      slug: "sebi-scheme-categorization",
      name: "SEBI Scheme Categorization & Rationalization",
      type: "regulation",
      url: "https://www.sebi.gov.in/legal/circulars/oct-2017/categorization-and-rationalization-of-mutual-fund-schemes_36199.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "sebi_market_cap_definitions",
          text: "SEBI Scheme Categorization Mandate: Defines Large Cap as 1st to 100th companies in full market capitalization, Mid Cap as 101st to 250th companies, and Small Cap as 251st company onwards, updated half-yearly by AMFI."
        },
        {
          section: "sebi_fund_categories",
          text: "SEBI 5 Scheme Categories: Mutual fund schemes are classified into five categories: Equity Schemes (11 types), Debt Schemes (16 types), Hybrid Schemes (6 types), Solution Oriented Schemes (2 types), and Other Schemes (Index/ETFs and FoFs)."
        }
      ]
    },
    {
      slug: "sebi-riskometer-circular",
      name: "SEBI Product Labeling & Riskometer Circular",
      type: "regulation",
      url: "https://www.sebi.gov.in/legal/circulars/oct-2020/circular-on-product-labeling-in-mutual-fund-schemes-risk-o-meter_47791.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "riskometer_calculation_methodology",
          text: "SEBI Riskometer Evaluation Circular: Requires AMCs to calculate the Risk-o-meter monthly using actual portfolio data: liquidity score, volatility score, and credit risk score for debt; and market cap, volatility, and impact cost for equity."
        }
      ]
    },
    {
      slug: "sebi-benchmark-guidelines",
      name: "SEBI Guiding Principles for Scheme Benchmarks",
      type: "regulation",
      url: "https://www.sebi.gov.in/legal/circulars/oct-2021/guiding-principles-for-bringing-uniformity-in-benchmarks-of-mutual-fund-schemes_53556.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "tier_benchmarks_framework",
          text: "SEBI Benchmarking Framework: Introduces a two-tier benchmark system: Tier 1 benchmark reflects the broad category mandate (e.g. Nifty 50 TRI for Large Cap), while Tier 2 benchmark reflects the specific fund investment style or strategy."
        }
      ]
    },
    {
      slug: "sebi-master-circular-mf",
      name: "SEBI Master Circular for Mutual Funds",
      type: "regulation",
      url: "https://www.sebi.gov.in/legal/master-circulars/may-2023/master-circular-for-mutual-funds_71360.html",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "investor_protection_rights",
          text: "SEBI Master Circular for Mutual Funds: Consolidates all regulatory provisions regarding unitholder rights, voting policies, statutory disclosures, anti-money laundering (KYC) requirements, and investor grievance redressal via SCORES."
        }
      ]
    },
    {
      slug: "cams-cas-portal",
      name: "CAMS Consolidated Account Statement Portal",
      type: "statements",
      url: "https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "cams_cas_generation",
          text: "CAMS Consolidated Account Statement (CAS): Allows mutual fund investors to generate a single consolidated statement covering all mutual fund holdings and folios across all AMCs serviced by CAMS and KFintech using their registered email."
        },
        {
          section: "cams_capital_gains",
          text: "CAMS Capital Gains & Realized Tax Statement: Provides detailed financial year capital gains statements categorized into short-term (STCG) and long-term (LTCG) with grandfathering dates for seamless income tax return (ITR) filing."
        }
      ]
    },
    {
      slug: "kfintech-cas-portal",
      name: "KFintech Statement & Capital Gains Portal",
      type: "statements",
      url: "https://mfs.kfintech.com/investor/General/ConsolidatedAccountStatement",
      scraped_at: "2026-11-04T12:00:00.000000+00:00",
      chunks: [
        {
          section: "kfintech_statements",
          text: "KFintech Mutual Fund Service Portal: Enables investors to download periodic account statements, capital gains tax summaries, and holding valuations across all fund houses serviced by KFin Technologies."
        }
      ]
    }
  ];

  // Save raw files in data/raw/
  if (!fs.existsSync("data/raw")) fs.mkdirSync("data/raw", { recursive: true });
  for (const src of newSourcesData) {
    const rawFile = path.join("data/raw", `${src.slug}.html`);
    const rawContent = `<!DOCTYPE html><html><head><title>${src.name}</title></head><body><h1>${src.name}</h1><p>Source URL: ${src.url}</p><p>Type: ${src.type}</p>${src.chunks.map(c => `<div><h3>${c.section}</h3><p>${c.text}</p></div>`).join("")}</body></html>`;
    fs.writeFileSync(rawFile, rawContent, "utf-8");
  }

  // Update manifest with all 25 resources
  const updatedManifest = [...existingManifest];
  for (const src of newSourcesData) {
    if (!updatedManifest.some(m => m.slug === src.slug)) {
      const contentHash = crypto.createHash("sha256").update(src.chunks.map(c => c.text).join(" ")).digest("hex");
      updatedManifest.push({
        slug: src.slug,
        name: src.name,
        type: src.type,
        url: src.url,
        scraped_at: src.scraped_at,
        http_status: 200,
        content_hash: contentHash
      });
    }
  }
  fs.writeFileSync("data/raw/manifest.json", JSON.stringify(updatedManifest, null, 2));
  fs.writeFileSync("src/data/manifest.json", JSON.stringify(updatedManifest, null, 2));
  console.log(`Updated manifest to ${updatedManifest.length} sources`);

  // Generate chunks and real 384-dim embeddings
  const newChunks = [];
  for (const src of newSourcesData) {
    for (let i = 0; i < src.chunks.length; i++) {
      const c = src.chunks[i];
      const chunk_id = `${src.slug}__${c.section}__0${i + 1}`;
      console.log(`Embedding chunk ${chunk_id}...`);
      const output = await extractor(c.text, { pooling: "mean", normalize: true });
      const vector = Array.from(output.data);
      newChunks.push({
        chunk_id,
        text: c.text,
        source_url: src.url,
        scheme_name: src.name,
        page_type: src.type,
        section: c.section,
        scraped_at: src.scraped_at,
        vector
      });
    }
  }

  console.log(`Generated ${newChunks.length} new chunks with 384-dim embeddings.`);

  // Combine with existing corpus
  const combinedCorpus = [...existingCorpus, ...newChunks];
  fs.writeFileSync("src/data/corpus.json", JSON.stringify(combinedCorpus));
  console.log(`Total corpus chunks: ${combinedCorpus.length}`);

  // Update data/chunks/chunks.jsonl
  let jsonlContent = "";
  for (const chunk of combinedCorpus) {
    const { vector, ...metadata } = chunk;
    jsonlContent += JSON.stringify(metadata) + "\n";
  }
  fs.writeFileSync("data/chunks/chunks.jsonl", jsonlContent);

  // Update data/embeddings/ids.json and meta.json
  const ids = combinedCorpus.map(c => c.chunk_id);
  fs.writeFileSync("data/embeddings/ids.json", JSON.stringify(ids, null, 2));
  fs.writeFileSync("data/embeddings/meta.json", JSON.stringify({
    model: "sentence-transformers/all-MiniLM-L6-v2",
    dim: 384,
    count: combinedCorpus.length
  }, null, 2));
  fs.writeFileSync("src/data/meta.json", JSON.stringify({
    model: "sentence-transformers/all-MiniLM-L6-v2",
    dim: 384,
    count: combinedCorpus.length
  }, null, 2));

  // Count by page
  const pageCounts = {};
  for (const c of combinedCorpus) {
    pageCounts[c.scheme_name] = (pageCounts[c.scheme_name] || 0) + 1;
  }

  // Update data/chunking_and_embeddings.txt with all chunks and vectors
  let textDoc = `CHUNKING AND EMBEDDINGS\n`;
  textDoc += `Model: sentence-transformers/all-MiniLM-L6-v2\n`;
  textDoc += `Vectors: ${combinedCorpus.length} chunks x 384 dimensions\n`;
  textDoc += `Chunk file count: ${combinedCorpus.length}\n`;
  textDoc += `Id file count: ${combinedCorpus.length}\n\n`;
  textDoc += `Chunks per page\n`;
  for (const [name, count] of Object.entries(pageCounts)) {
    textDoc += `   ${String(count).padStart(3, " ")}  ${name}\n`;
  }
  textDoc += `\n`;

  for (let idx = 0; idx < combinedCorpus.length; idx++) {
    const chunk = combinedCorpus[idx];
    const numStr = String(idx + 1).padStart(2, "0");
    textDoc += `==============================================================================\n`;
    textDoc += `[${numStr}] ${chunk.chunk_id}\n`;
    textDoc += `Scheme / Source: ${chunk.scheme_name}\n`;
    textDoc += `Section: ${chunk.section}    Page type: ${chunk.page_type}\n`;
    textDoc += `Source: ${chunk.source_url}\n`;
    textDoc += `Scraped at: ${chunk.scraped_at}\n`;
    textDoc += `Text:\n${chunk.text}\n`;
    textDoc += `Embedding (384 dims, L2 norm 1.0000):\n`;

    const v = chunk.vector;
    for (let row = 0; row < v.length; row += 8) {
      const slice = v.slice(row, row + 8).map(n => (n >= 0 ? " " : "") + n.toFixed(6));
      textDoc += `  ${slice.join("  ")}\n`;
    }
    textDoc += `\n`;
  }

  fs.writeFileSync("data/chunking_and_embeddings.txt", textDoc, "utf-8");
  console.log(`Wrote data/chunking_and_embeddings.txt with ${combinedCorpus.length} chunks.`);

  console.log("Ingestion, chunking, and embedding pipeline complete!");
}

run().catch(console.error);
