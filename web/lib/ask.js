import { readFileSync } from "node:fs";
import { join } from "node:path";

const config = JSON.parse(readFileSync(join(process.cwd(), "data", "app-config.json"), "utf8"));
const corpus = JSON.parse(readFileSync(join(process.cwd(), "data", "corpus.json"), "utf8"));

const PII_MESSAGE =
  "Please don't share personal details like PAN, Aadhaar, account numbers, OTPs, emails or phone numbers. I only answer general factual questions.";

const PII_PATTERNS = [
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
  /\b\d{4}\s?\d{4}\s?\d{4}\b/,
  /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/,
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
  /\botp\b.{0,20}\b\d{4,8}\b/i,
  /\b\d{9,18}\b/,
];

const ADVICE = [
  /should i/,
  /\bbuy\b/,
  /\bsell\b/,
  /\bhold\b/,
  /best fund/,
  /which is better/,
  /which fund is better/,
  /\bbetter\b/,
  /\brecommend/,
  /good investment/,
];
const PORTFOLIO = [/my portfolio/, /my sip/, /my holdings/, /my investment/];
const PERFORMANCE = [
  /\breturns\b/,
  /\bperformance\b/,
  /\bcagr\b/,
  /how much will i earn/,
  /will it go up/,
  /go up/,
  /compare returns/,
];
const REFUSALS = {
  advice: "I can only share facts, not investment advice.",
  portfolio: "I can't review personal portfolios; I only provide general factual information.",
  performance: "I don't compute or compare returns. See the official factsheet.",
};
const SCHEME_RULES = [
  ["large cap", "Large Cap"],
  ["flexi cap", "Flexi Cap"],
  ["equity fund", "Flexi Cap"],
  ["tax saver", "ELSS"],
  ["elss", "ELSS"],
  ["mid cap", "Mid Cap"],
  ["midcap", "Mid Cap"],
];
const FACT_TERMS = ["expense ratio", "exit load", "lock-in", "lock in", "riskometer", "benchmark"];
const UNKNOWN_TERMS = ["small cap", "multi cap", "value fund", "focused fund", "sectoral"];
const SYSTEM_PROMPT =
  'Answer only from CONTEXT. Do not give investment advice. Do not mention returns, performance, or predictions. Use at most 3 sentences. Do not include URLs or dates. If the answer is not in the context, say "I couldn\'t find this in the available sources."';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let embedderPromise;

function schemes() {
  return config.sources.filter((source) => source.type === "scheme");
}

function detectSchemes(query) {
  const text = query.toLowerCase();
  const found = [];
  for (const [keyword, marker] of SCHEME_RULES) {
    if (!text.includes(keyword)) continue;
    for (const source of schemes()) {
      if (source.name.toLowerCase().includes(marker.toLowerCase()) && !found.includes(source.name)) {
        found.push(source.name);
      }
    }
  }
  return found;
}

function needsScheme(query) {
  const text = query.toLowerCase();
  return FACT_TERMS.some((term) => text.includes(term)) || /\bsip\b/.test(text);
}

function hasPii(text) {
  return PII_PATTERNS.some((pattern) => pattern.test(text));
}

function intentRefusal(text) {
  const folded = text.toLowerCase();
  const checks = [
    ["advice", ADVICE, "advice"],
    ["portfolio", PORTFOLIO, "advice"],
    ["performance", PERFORMANCE, "factsheet"],
  ];
  for (const [category, patterns, linkKey] of checks) {
    if (patterns.some((pattern) => pattern.test(folded))) {
      return { category, message: REFUSALS[category], link: config.reference_links[linkKey] };
    }
  }
  return null;
}

function isUnintelligible(text) {
  const letters = text.match(/[A-Za-z]/g) || [];
  const other = text.match(/[^\x00-\x7F]/g) || [];
  if (other.length && other.length >= Math.max(letters.length, 1)) return true;
  if (letters.length < 4) return true;
  const vowels = letters.filter((character) => "aeiou".includes(character.toLowerCase())).length;
  return vowels / letters.length < 0.2;
}

function isStatement(query) {
  const text = query.toLowerCase();
  return text.includes("statement") && (text.includes("download") || text.includes("capital"));
}

function schemeList() {
  const names = schemes().map((source) => source.name);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function amcUrl() {
  return (config.sources.find((source) => source.type === "amc") || config.sources[0]).url;
}

function nearestUrl(schemeName) {
  if (!schemeName) return amcUrl();
  return schemes().find((source) => source.name === schemeName).url;
}

function formatDate(scrapedAt) {
  const parsed = new Date(scrapedAt);
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
}

function limitSentences(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/(?<=[.!?])\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 3).join(" ");
}

function cleanModelText(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function result(kind, body, extra = {}) {
  return {
    kind,
    body,
    source_url: extra.source_url || null,
    updated: extra.updated || null,
    chunks: extra.chunks || [],
  };
}

async function embed(text) {
  if (!embedderPromise) {
    embedderPromise = import("@huggingface/transformers").then(({ pipeline }) =>
      pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "fp32" }),
    );
  }
  const embedder = await embedderPromise;
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

function dot(left, right) {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) total += left[index] * right[index];
  return total;
}

async function retrieve(query, schemeName) {
  const vector = await embed(query);
  return corpus
    .filter((chunk) => !schemeName || chunk.scheme_name === schemeName)
    .map((chunk) => ({
      chunk_id: chunk.chunk_id,
      text: chunk.text,
      score: Number(dot(vector, chunk.vector).toFixed(4)),
      scheme_name: chunk.scheme_name,
      section: chunk.section,
      source_url: chunk.source_url,
      scraped_at: chunk.scraped_at,
    }))
    .filter((chunk) => chunk.score >= config.retrieval.min_score)
    .sort((left, right) => right.score - left.score)
    .slice(0, config.retrieval.top_k);
}

async function retrieveAll(query, schemeNames) {
  if (schemeNames.length <= 1) return retrieve(query, schemeNames[0] || null);
  const merged = [];
  const seen = new Set();
  for (const name of schemeNames) {
    for (const row of await retrieve(query, name)) {
      if (seen.has(row.chunk_id)) continue;
      seen.add(row.chunk_id);
      merged.push(row);
    }
  }
  return merged.sort((left, right) => right.score - left.score).slice(0, config.retrieval.top_k);
}

async function groq(systemPrompt, userPrompt) {
  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  const model = (process.env.GROQ_MODEL || "").trim();
  if (!apiKey || !model) throw new Error("GROQ_API_KEY or GROQ_MODEL is missing.");
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 200,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!response.ok) throw new Error(`Groq status ${response.status}`);
      const payload = await response.json();
      return payload.choices?.[0]?.message?.content || "";
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function looksAmbiguous(query) {
  if (detectSchemes(query).length || needsScheme(query) || isStatement(query)) return false;
  const text = query.toLowerCase();
  const hints = ["fund manager", "aum", "overview", "amc", "hdfc mutual fund", "trustee", "sponsor", "ceo"];
  return !hints.some((hint) => text.includes(hint));
}

export function publicConfig() {
  return {
    disclaimer: config.ui.disclaimer,
    welcome: config.ui.welcome,
    examples: config.ui.examples,
    chunkCount: corpus.length,
  };
}

export async function answerQuestion(query) {
  if (!query || !query.trim()) return result("clarify", "Please type a question.");
  query = query.trim();
  if (hasPii(query)) return result("pii", PII_MESSAGE);
  if (query.length > 1000) return result("clarify", "Please shorten your question to under 1000 characters.");

  const refused = intentRefusal(query);
  const named = detectSchemes(query);
  const factAndAdvice = Boolean(refused && needsScheme(query) && named.length);
  if (refused && !factAndAdvice) return result("refusal", refused.message, { source_url: refused.link });
  if (isStatement(query)) {
    return result(
      "statement",
      "Capital-gains statements are not in the scheme pages. Request one from the official statement page.",
      { source_url: config.reference_links.statements },
    );
  }
  if (UNKNOWN_TERMS.some((term) => query.toLowerCase().includes(term)) && !named.length) {
    return result("refusal", `I only have information on these schemes: ${schemeList()}.`, { source_url: amcUrl() });
  }
  if (isUnintelligible(query) && !named.length && !needsScheme(query)) {
    return result("clarify", "I couldn't understand that. Please ask a factual question about one of the HDFC schemes.");
  }
  if (!refused && looksAmbiguous(query)) {
    try {
      const verdict = await groq(
        "Classify the user message as FACTUAL or REFUSE. REFUSE means investment advice, a personal portfolio review, or a request about returns or performance. FACTUAL means a general question about a mutual fund fact or the AMC. Reply with one word.",
        query,
      );
      if (cleanModelText(verdict).toUpperCase().includes("REFUSE")) {
        return result("refusal", REFUSALS.advice, { source_url: config.reference_links.advice });
      }
    } catch {
      // A classifier failure still allows a factual lookup.
    }
  }
  if (needsScheme(query) && !named.length) {
    return result("clarify", `Which scheme do you mean? I have information on ${schemeList()}.`);
  }
  if (/\bage\b/i.test(query)) {
    return result("not_found", "I couldn't find this in the available sources.", {
      source_url: nearestUrl(named.length === 1 ? named[0] : null),
    });
  }

  const chunks = await retrieveAll(query, named);
  if (!chunks.length) {
    return result("not_found", "I couldn't find this in the available sources.", {
      source_url: nearestUrl(named.length === 1 ? named[0] : null),
    });
  }

  const context = chunks.map((chunk, index) => `[${index + 1}] ${chunk.text}`).join("\n");
  let extra = "";
  if (named.length > 1) {
    extra +=
      "\nThe question names more than one scheme. Give the fact for each if it fits in 3 sentences. Otherwise answer the first and invite a question about the other. Do not say which is better.";
  }
  if (factAndAdvice) extra += "\nThe question also asks for advice. Answer only the factual part.";
  let body;
  try {
    body = limitSentences(cleanModelText(await groq(SYSTEM_PROMPT, `CONTEXT:\n${context}\n\nQUESTION: ${query}${extra}`)));
  } catch {
    body = limitSentences(chunks[0].text);
  }
  if (!body) body = "I couldn't find this in the available sources.";
  return result("answer", body, {
    source_url: chunks[0].source_url,
    updated: formatDate(chunks[0].scraped_at),
    chunks: chunks.map(({ chunk_id, text, score, scheme_name, section }) => ({
      chunk_id,
      text,
      score,
      scheme_name,
      section,
    })),
  });
}
