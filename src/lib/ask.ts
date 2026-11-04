import config from "../data/app-config.json";
import corpusData from "../data/corpus.json";
import { findMatchingConcept } from "./knowledge";

export interface Chunk {
  chunk_id: string;
  text: string;
  score: number;
  scheme_name: string;
  section: string;
  source_url?: string;
  scraped_at?: string;
}

export interface Answer {
  kind: "answer" | "refusal" | "clarify" | "pii" | "statement" | "not_found" | "error";
  body: string;
  source_url: string | null;
  updated: string | null;
  chunks: Chunk[];
}

export interface StoredChunk {
  chunk_id: string;
  text: string;
  source_url: string;
  scheme_name: string;
  page_type: string;
  section: string;
  scraped_at: string;
  vector?: number[];
}

const corpus: StoredChunk[] = corpusData as StoredChunk[];

export const PII_MESSAGE =
  "Please don't share personal details like PAN, Aadhaar, account numbers, OTPs, emails or phone numbers. I only answer general factual and educational questions.";

const PII_PATTERNS = [
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
  /\b\d{4}\s?\d{4}\s?\d{4}\b/,
  /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/,
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
  /\botp\b.{0,20}\b\d{4,8}\b/i,
  /\b\d{9,18}\b/,
];

const ADVICE = [
  /should i buy/i,
  /should i sell/i,
  /should i invest/i,
  /\bbuy this fund\b/i,
  /\bsell my\b/i,
  /which fund will give best returns/i,
  /tell me which fund to pick/i,
  /guaranteed return/i,
];

const PORTFOLIO = [/my portfolio/i, /review my holdings/i, /is my sip good/i];

const PERFORMANCE_PREDICTIONS = [
  /how much will i earn next year/i,
  /will it go up tomorrow/i,
  /predict return/i,
];

const REFUSALS: Record<string, string> = {
  advice: "I can share factual and educational information, but not personalized investment advice. Consider consulting a SEBI-registered investment advisor.",
  portfolio: "I can't review personal portfolios; I provide general mutual fund information and factual data.",
  performance: "I don't compute or predict future returns. Please see the official scheme factsheets for historical performance.",
};

const SCHEME_RULES: [string, string][] = [
  ["large cap", "Large Cap"],
  ["flexi cap", "Flexi Cap"],
  ["equity fund", "Flexi Cap"],
  ["tax saver", "ELSS"],
  ["elss", "ELSS"],
  ["mid cap", "Mid Cap"],
  ["midcap", "Mid Cap"],
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function schemes() {
  return config.sources.filter((source) => source.type === "scheme");
}

export function detectSchemes(query: string): string[] {
  const text = query.toLowerCase();
  const found: string[] = [];
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

export function hasPii(text: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(text));
}

export function intentRefusal(text: string): { category: string; message: string; link: string } | null {
  const folded = text.toLowerCase();
  const checks: [string, RegExp[], string][] = [
    ["advice", ADVICE, "advice"],
    ["portfolio", PORTFOLIO, "advice"],
    ["performance", PERFORMANCE_PREDICTIONS, "factsheet"],
  ];
  for (const [category, patterns, linkKey] of checks) {
    if (patterns.some((pattern) => pattern.test(folded))) {
      return {
        category,
        message: REFUSALS[category],
        link: (config.reference_links as Record<string, string>)[linkKey] || "https://www.amfiindia.com",
      };
    }
  }
  return null;
}

export function isUnintelligible(text: string): boolean {
  const letters = text.match(/[A-Za-z]/g) || [];
  const other = text.match(/[^\x00-\x7F]/g) || [];
  if (other.length && other.length >= Math.max(letters.length, 1)) return true;
  if (letters.length < 4) return true;
  const vowels = letters.filter((character) => "aeiou".includes(character.toLowerCase())).length;
  return vowels / letters.length < 0.2;
}

export function isStatement(query: string): boolean {
  const text = query.toLowerCase();
  return text.includes("statement") && (text.includes("download") || text.includes("capital"));
}

export function schemeList(): string {
  const names = schemes().map((source) => source.name);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function amcUrl(): string {
  const amc = config.sources.find((source) => source.type === "amc");
  return amc ? amc.url : config.sources[0].url;
}

export function nearestUrl(schemeName?: string | null): string {
  if (!schemeName) return amcUrl();
  const match = schemes().find((source) => source.name === schemeName);
  return match ? match.url : amcUrl();
}

export function formatDate(scrapedAt: string): string {
  const parsed = new Date(scrapedAt);
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
}

export function limitSentences(text: string, count: number = 3): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/(?<=[.!?])\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, count).join(" ");
}

export function cleanModelText(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function result(kind: Answer["kind"], body: string, extra: Partial<Answer> = {}): Answer {
  return {
    kind,
    body,
    source_url: extra.source_url || null,
    updated: extra.updated || null,
    chunks: extra.chunks || [],
  };
}

function normalizeQuery(query: string): string {
  let q = query.toLowerCase();
  q = q.replace(/\bkap\b/g, "cap");
  q = q.replace(/\blod\b/g, "load");
  q = q.replace(/\beksit\b/g, "exit");
  q = q.replace(/\bexpens\b/g, "expense");
  q = q.replace(/\bratioo\b/g, "ratio");
  return q;
}

const SECTION_KEYWORDS: Record<string, string[]> = {
  expense_ratio: ["expense ratio", "expense", "ter", "ratio"],
  exit_load: ["exit load", "exit"],
  lock_in: ["lock-in", "lock in", "lockin", "period"],
  min_sip: ["minimum sip", "min sip", "sip", "installment"],
  riskometer: ["riskometer", "risk"],
  benchmark: ["benchmark", "nifty", "index"],
  fund_manager: ["fund manager", "manager", "navneet", "chirag"],
  aum: ["aum", "asset", "size", "assets"],
  sponsor: ["sponsor", "abrdn"],
  trustee: ["trustee"],
  ceo: ["ceo"],
  cio: ["cio"],
  overview: ["overview", "about"],
  faq: ["faq", "question"],
};

export function scoreChunk(chunk: StoredChunk, query: string, targetScheme?: string | null): number {
  const normQ = normalizeQuery(query);
  const qWords = normQ
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !["the", "is", "of", "and", "in", "to", "what", "for"].includes(w));

  if (!qWords.length) return 0;

  if (targetScheme && chunk.scheme_name !== targetScheme) {
    return 0;
  }

  let score = 0;
  const chunkTextLower = chunk.text.toLowerCase();
  const chunkSection = chunk.section.toLowerCase();

  const sectionKeywords = SECTION_KEYWORDS[chunkSection] || [];
  let hasSectionMatch = false;
  for (const kw of sectionKeywords) {
    if (normQ.includes(kw)) {
      score += 0.45;
      hasSectionMatch = true;
      break;
    }
  }

  const chunkSchemeLower = chunk.scheme_name.toLowerCase();
  for (const [kw, marker] of SCHEME_RULES) {
    if (normQ.includes(kw) && chunkSchemeLower.includes(marker.toLowerCase())) {
      score += 0.25;
      break;
    }
  }

  const chunkWords = chunkTextLower.split(/[^a-z0-9]+/);
  let matchedWords = 0;
  for (const word of qWords) {
    if (chunkWords.includes(word)) {
      matchedWords += 1;
    }
  }
  if (qWords.length > 0) {
    score += (matchedWords / qWords.length) * 0.35;
  }

  if (!hasSectionMatch && matchedWords === 0) {
    return 0.05;
  }

  return Math.min(Number(score.toFixed(4)), 0.99);
}

export function retrieve(query: string, schemeName?: string | null): Chunk[] {
  const minScore = config.retrieval.min_score ?? 0.25;
  const topK = config.retrieval.top_k ?? 4;

  const scored = corpus
    .filter((chunk) => !schemeName || chunk.scheme_name === schemeName)
    .map((chunk) => {
      const score = scoreChunk(chunk, query, schemeName);
      return {
        chunk_id: chunk.chunk_id,
        text: chunk.text,
        score,
        scheme_name: chunk.scheme_name,
        section: chunk.section,
        source_url: chunk.source_url,
        scraped_at: chunk.scraped_at,
      };
    })
    .filter((chunk) => chunk.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export function retrieveAll(query: string, schemeNames: string[]): Chunk[] {
  const topK = config.retrieval.top_k ?? 4;
  if (schemeNames.length <= 1) {
    return retrieve(query, schemeNames[0] || null);
  }
  const merged: Chunk[] = [];
  const seen = new Set<string>();

  for (const name of schemeNames) {
    for (const row of retrieve(query, name)) {
      if (seen.has(row.chunk_id)) continue;
      seen.add(row.chunk_id);
      merged.push(row);
    }
  }

  return merged.sort((a, b) => b.score - a.score).slice(0, topK);
}

export async function answerQuestion(rawQuery: string): Promise<Answer> {
  if (!rawQuery || !rawQuery.trim()) {
    return result("clarify", "Please type a question about mutual funds.");
  }
  const query = rawQuery.trim();

  // PII guardrail
  if (hasPii(query)) {
    return result("pii", PII_MESSAGE);
  }

  if (query.length > 1000) {
    return result("clarify", "Please shorten your question to under 1000 characters.");
  }

  // Refusal check for explicit advice solicitation
  const refused = intentRefusal(query);
  const named = detectSchemes(query);
  if (refused && !named.length) {
    return result("refusal", refused.message, { source_url: refused.link });
  }

  if (isStatement(query)) {
    return result(
      "statement",
      "Capital-gains statements are not in the scheme pages. Request one from the official statement page.",
      { source_url: config.reference_links.statements },
    );
  }

  // Check general mutual fund concept first
  const concept = findMatchingConcept(query);
  if (concept && !named.length) {
    return result("answer", concept.summary, {
      source_url: concept.sourceUrl,
      updated: null,
      chunks: [],
    });
  }

  if (isUnintelligible(query) && !named.length && !concept) {
    return result("clarify", "I couldn't understand that. Please ask a factual question about mutual funds or schemes.");
  }

  if (/\bage\b/i.test(query)) {
    return result("not_found", "I couldn't find this in the available sources.", {
      source_url: nearestUrl(named.length === 1 ? named[0] : null),
    });
  }

  const chunks = retrieveAll(query, named);
  if (!chunks.length) {
    if (concept) {
      return result("answer", concept.summary, {
        source_url: concept.sourceUrl,
      });
    }
    return result("not_found", "I couldn't find this in the available sources.", {
      source_url: nearestUrl(named.length === 1 ? named[0] : null),
    });
  }

  let body: string;
  if (named.length > 1) {
    const schemeFacts: string[] = [];
    for (const name of named) {
      const match = chunks.find((c) => c.scheme_name.toLowerCase().includes(name.toLowerCase()));
      if (match) {
        schemeFacts.push(limitSentences(match.text, 1));
      }
    }
    if (schemeFacts.length > 0) {
      body = limitSentences(schemeFacts.join(" "), 3);
    } else {
      body = limitSentences(chunks[0].text, 3);
    }
  } else {
    body = limitSentences(chunks[0].text, 3);
  }

  if (!body) {
    body = concept ? concept.summary : "I couldn't find this in the available sources.";
  }

  return result("answer", body, {
    source_url: chunks[0].source_url || nearestUrl(named[0] || null),
    updated: chunks[0].scraped_at ? formatDate(chunks[0].scraped_at) : null,
    chunks: chunks.map(({ chunk_id, text, score, scheme_name, section }) => ({
      chunk_id,
      text,
      score,
      scheme_name,
      section,
    })),
  });
}
