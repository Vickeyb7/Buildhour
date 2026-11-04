"""PII and intent guards. Blocked text is never logged or sent onward."""

import re
from typing import NamedTuple

from src.config import cfg

PII_MESSAGE = (
    "Please don't share personal details like PAN, Aadhaar, account numbers, "
    "OTPs, emails or phone numbers. I only answer general factual questions."
)

PII_PATTERNS = (
    re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),
    re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"),
    re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)"),
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    re.compile(r"(?i)\botp\b.{0,20}\b\d{4,8}\b"),
    re.compile(r"\b\d{9,18}\b"),
)

ADVICE_PATTERNS = (
    r"should i",
    r"\bbuy\b",
    r"\bsell\b",
    r"\bhold\b",
    r"best fund",
    r"which is better",
    r"which fund is better",
    r"\bbetter\b",
    r"\brecommend",
    r"good investment",
)
PORTFOLIO_PATTERNS = (
    r"my portfolio",
    r"my sip",
    r"my holdings",
    r"my investment",
)
PERFORMANCE_PATTERNS = (
    r"\breturns\b",
    r"\bperformance\b",
    r"\bcagr\b",
    r"how much will i earn",
    r"will it go up",
    r"go up",
    r"compare returns",
)

REFUSALS = {
    "advice": "I can only share facts, not investment advice.",
    "portfolio": "I can't review personal portfolios; I only provide general factual information.",
    "performance": "I don't compute or compare returns. See the official factsheet.",
}


def has_pii(text: str) -> bool:
    return any(pattern.search(text) for pattern in PII_PATTERNS)


class IntentRefusal(NamedTuple):
    category: str
    message: str
    link: str


def intent_refusal(text: str) -> IntentRefusal | None:
    folded = text.lower()
    checks = (
        ("advice", ADVICE_PATTERNS, "advice"),
        ("portfolio", PORTFOLIO_PATTERNS, "advice"),
        ("performance", PERFORMANCE_PATTERNS, "factsheet"),
    )
    for category, patterns, link_key in checks:
        if any(re.search(pattern, folded) for pattern in patterns):
            return IntentRefusal(category, REFUSALS[category], cfg["reference_links"][link_key])
    return None


def is_unintelligible(text: str) -> bool:
    """Gibberish or non-English input that should not be sent to the LLM."""
    letters = re.findall(r"[A-Za-z]", text)
    other = re.findall(r"[^\x00-\x7F]", text)
    if other and len(other) >= max(len(letters), 1):
        return True
    if len(letters) < 4:
        return True
    vowels = sum(character.lower() in "aeiou" for character in letters)
    return vowels / len(letters) < 0.2


def classify_intent(text: str) -> str:
    """Return FACTUAL or REFUSE. Used only when phrase rules do not match."""
    from src.query.llm import generate

    system = (
        "Classify the user message as FACTUAL or REFUSE. "
        "REFUSE means investment advice, a personal portfolio review, or a request "
        "about returns or performance. FACTUAL means a general question about a "
        "mutual fund fact or the AMC. Reply with one word."
    )
    try:
        raw = generate(system, text)
    except Exception:
        return "FACTUAL"
    word = re.sub(r"<think>.*?</think>", "", raw, flags=re.I | re.S)
    word = word.strip().split()
    if not word:
        return "FACTUAL"
    return "REFUSE" if word[-1].upper().startswith("REFUSE") else "FACTUAL"
