import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { answerQuestion, hasPii, PII_MESSAGE, retrieveAll, detectSchemes, formatDate, nearestUrl } from "./src/lib/ask.js";
import { findMatchingConcept } from "./src/lib/knowledge.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const isProd = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json());

// Initialize Google GenAI client if GEMINI_API_KEY is available
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
  }
}

app.post("/api/ask", async (req, res) => {
  try {
    const rawQuestion = req.body?.question;
    if (typeof rawQuestion !== "string" || !rawQuestion.trim()) {
      return res.json({
        kind: "clarify",
        body: "Please type a question about mutual funds.",
        source_url: null,
        updated: null,
        chunks: [],
      });
    }

    const question = rawQuestion.trim();

    // 1. Guardrail: PII check
    if (hasPii(question)) {
      return res.json({
        kind: "pii",
        body: PII_MESSAGE,
        source_url: null,
        updated: null,
        chunks: [],
      });
    }

    // 2. Identify relevant scheme or general corpus chunks across AMC, AMFI, and SEBI
    const namedSchemes = detectSchemes(question);
    const retrievedChunks = namedSchemes.length > 0 ? retrieveAll(question, namedSchemes) : retrieveAll(question, []);

    // 3. Check for general concept match
    const conceptMatch = findMatchingConcept(question);

    // 4. If Gemini API is available, ask Gemini with grounding context!
    if (ai) {
      try {
        let contextText = "";
        if (retrievedChunks.length > 0) {
          contextText += "\nVERIFIED SCHEME CONTEXT:\n" + retrievedChunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n");
        }
        if (conceptMatch) {
          contextText += `\nCONCEPT REFERENCE: ${conceptMatch.name}: ${conceptMatch.summary}`;
        }

        const prompt = `QUESTION: ${question}\n${contextText}`;

        const callPromise = ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            systemInstruction:
              "You are a friendly, factual, and expert Mutual Fund Assistant. You answer questions about all mutual funds in India (including concepts like NAV, Expense Ratio, Exit Load, SIP, SWP, STP, ELSS, fund categories, taxation, SEBI rules, index funds, debt vs equity, and specific fund schemes across AMCs like HDFC, SBI, ICICI, Nippon, etc.).\n\n" +
              "Guidelines:\n" +
              "1. Provide clear, direct, accurate explanations. Explain terms simply with practical examples where helpful.\n" +
              "2. When context from verified scheme data is provided, use those exact figures (expense ratios, exit loads, benchmarks, lock-ins, min SIPs, etc.).\n" +
              "3. Do NOT provide personal financial advice (e.g. 'You should buy X fund', 'Invest your salary here'); instead, explain how the funds work, risk factors, and asset allocation concepts neutrally.\n" +
              "4. Keep answers concise and readable (typically 2-4 sentences or short bullet points for conceptual questions).\n" +
              "5. Never ask for or record personal details (PAN, Aadhaar, account numbers, OTPs).",
          },
        });

        // Timeout race in case of network latency
        let timer: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Timeout")), 8000);
        });

        const response: any = await Promise.race([callPromise, timeoutPromise]).finally(() => {
          clearTimeout(timer);
        });

        const body = response?.text?.trim() || "";
        if (body) {
          const topChunk = retrievedChunks[0];
          const sourceUrl = topChunk?.source_url || conceptMatch?.sourceUrl || "https://www.amfiindia.com/investor-corner";
          const updatedDate = topChunk?.scraped_at ? formatDate(topChunk.scraped_at) : null;

          return res.json({
            kind: "answer",
            body,
            source_url: sourceUrl,
            updated: updatedDate,
            chunks: retrievedChunks,
          });
        }
      } catch (geminiError) {
        console.warn("Gemini generation skipped or failed, falling back to knowledge base:", geminiError);
      }
    }

    // 5. Fallback: Use local knowledge base + corpus pipeline
    if (conceptMatch && (!namedSchemes.length || retrievedChunks.length === 0)) {
      return res.json({
        kind: "answer",
        body: conceptMatch.summary,
        source_url: conceptMatch.sourceUrl,
        updated: null,
        chunks: retrievedChunks,
      });
    }

    // 6. Scheme-specific pipeline
    const localAnswer = await answerQuestion(question);
    return res.json(localAnswer);
  } catch (error) {
    console.error("API error in /api/ask:", error);
    return res.status(500).json({
      kind: "error",
      body: "The answer service encountered an issue. Please try again.",
      source_url: null,
      updated: null,
      chunks: [],
    });
  }
});

// Configure Vite middleware in development or static serving in production
async function startServer() {
  if (!isProd) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (${isProd ? "production" : "development"})`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
