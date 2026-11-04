"""Query flow: guards, retrieval, generation, and formatting."""

import re
from dataclasses import dataclass, field
from datetime import datetime

from src.config import cfg
from src.query.guards import PII_MESSAGE, classify_intent, has_pii, intent_refusal, is_unintelligible
from src.query.llm import SYSTEM_PROMPT, clean_model_text, generate
from src.query.retriever import (
    Retriever,
    detect_schemes,
    mentions_unknown_scheme,
    needs_scheme,
    scheme_sources,
)

MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


@dataclass
class Answer:
    kind: str
    body: str
    source_url: str | None = None
    updated: str | None = None
    chunks: list[dict] = field(default_factory=list)

    def formatted(self) -> str:
        lines = [self.body]
        if self.source_url:
            lines.append(f"Source: {self.source_url}")
        if self.updated:
            lines.append(f"Last updated from sources: {self.updated}")
        return "\n".join(lines)


def format_date(scraped_at: str) -> str:
    parsed = datetime.fromisoformat(scraped_at)
    return f"{parsed.day:02d} {MONTHS[parsed.month - 1]} {parsed.year}"


def limit_sentences(text: str, count: int = 3) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)
    kept = [part.strip() for part in parts if part.strip()]
    return " ".join(kept[:count])


def amc_url() -> str:
    for source in cfg["sources"]:
        if source["type"] == "amc":
            return source["url"]
    return cfg["sources"][0]["url"]


def scheme_list() -> str:
    names = [source["name"] for source in scheme_sources()]
    if len(names) == 1:
        return names[0]
    return ", ".join(names[:-1]) + ", and " + names[-1]


def is_statement_question(query: str) -> bool:
    text = query.lower()
    return "statement" in text and ("download" in text or "capital" in text)


def nearest_url(scheme_name: str | None) -> str:
    if scheme_name:
        return next(source["url"] for source in scheme_sources() if source["name"] == scheme_name)
    return amc_url()


def not_found(scheme_name: str | None, chunks: list[dict] | None = None) -> Answer:
    return Answer(
        "not_found",
        "I couldn't find this in the available sources.",
        source_url=nearest_url(scheme_name),
        chunks=chunks or [],
    )


class Pipeline:
    def __init__(self, retriever: Retriever | None = None) -> None:
        self._retriever = retriever

    @property
    def retriever(self) -> Retriever:
        if self._retriever is None:
            self._retriever = Retriever()
        return self._retriever

    def answer(self, query: str) -> Answer:
        if not query or not query.strip():
            return Answer("clarify", "Please type a question.")
        query = query.strip()
        if has_pii(query):
            return Answer("pii", PII_MESSAGE)
        if len(query) > 1000:
            return Answer("clarify", "Please shorten your question to under 1000 characters.")

        refused = intent_refusal(query)
        fact_and_advice = bool(refused and needs_scheme(query) and detect_schemes(query))
        if refused and not fact_and_advice:
            return Answer("refusal", refused.message, source_url=refused.link)
        if is_statement_question(query):
            return Answer(
                "statement",
                "Capital-gains statements are not in the scheme pages. Request one from the official statement page.",
                source_url=cfg["reference_links"]["statements"],
            )
        if mentions_unknown_scheme(query) and not detect_schemes(query):
            return Answer(
                "refusal",
                f"I only have information on these schemes: {scheme_list()}.",
                source_url=amc_url(),
            )
        if is_unintelligible(query) and not detect_schemes(query) and not needs_scheme(query):
            return Answer(
                "clarify",
                "I couldn't understand that. Please ask a factual question about one of the HDFC schemes.",
            )
        if not refused and self._looks_ambiguous(query) and classify_intent(query) == "REFUSE":
            return Answer(
                "refusal",
                "I can only share facts, not investment advice.",
                source_url=cfg["reference_links"]["advice"],
            )

        schemes = detect_schemes(query)
        if needs_scheme(query) and not schemes:
            return Answer(
                "clarify",
                f"Which scheme do you mean? I have information on {scheme_list()}.",
            )
        if re.search(r"\bage\b", query, re.I):
            return not_found(schemes[0] if len(schemes) == 1 else None)

        chunks = self._retrieve(query, schemes)
        if not chunks:
            return not_found(schemes[0] if len(schemes) == 1 else None, chunks)

        context = "\n".join(f"[{index}] {chunk['text']}" for index, chunk in enumerate(chunks, start=1))
        extra = ""
        if len(schemes) > 1:
            extra = (
                "\nThe question names more than one scheme. Give the fact for each if it fits in "
                "3 sentences. Otherwise answer the first and invite a question about the other. "
                "Do not say which is better."
            )
        if fact_and_advice:
            extra += "\nThe question also asks for advice. Answer only the factual part."
        user_prompt = f"CONTEXT:\n{context}\n\nQUESTION: {query}{extra}"
        try:
            raw = generate(SYSTEM_PROMPT, user_prompt)
            body = limit_sentences(clean_model_text(raw))
        except Exception:
            body = limit_sentences(chunks[0]["text"])
        if not body:
            body = "I couldn't find this in the available sources."
        top = chunks[0]
        return Answer(
            "answer",
            body,
            source_url=top["source_url"],
            updated=format_date(top["scraped_at"]),
            chunks=chunks,
        )

    def _retrieve(self, query: str, schemes: list[str]) -> list[dict]:
        if len(schemes) <= 1:
            return self.retriever.retrieve(query, schemes[0] if schemes else None)
        merged = []
        seen = set()
        for name in schemes:
            for row in self.retriever.retrieve(query, name):
                if row["chunk_id"] in seen:
                    continue
                seen.add(row["chunk_id"])
                merged.append(row)
        merged.sort(key=lambda row: row["score"], reverse=True)
        return merged[: self.retriever.top_k]

    def _looks_ambiguous(self, query: str) -> bool:
        if detect_schemes(query) or needs_scheme(query) or is_statement_question(query):
            return False
        text = query.lower()
        factual_hints = ("fund manager", "aum", "overview", "amc", "hdfc mutual fund", "trustee", "sponsor", "ceo")
        return not any(hint in text for hint in factual_hints)
