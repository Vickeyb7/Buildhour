"""Groq chat client. Model name and API key come from .env."""

import os
import re

from dotenv import load_dotenv
from groq import Groq

from src.config import ROOT

load_dotenv(ROOT / ".env")

SYSTEM_PROMPT = (
    "Answer only from CONTEXT. Do not give investment advice. Do not mention returns, "
    "performance, or predictions. Use at most 3 sentences. Do not include URLs or dates. "
    'If the answer is not in the context, say "I couldn\'t find this in the available sources."'
)


def generate(system_prompt: str, user_prompt: str) -> str:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    model = os.getenv("GROQ_MODEL", "").strip()
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is missing. Put it in .env.")
    if not model:
        raise RuntimeError("GROQ_MODEL is missing. Put it in .env.")
    client = Groq(api_key=api_key)
    last_error = None
    for _ in range(2):
        try:
            response = client.chat.completions.create(
                model=model,
                temperature=0,
                max_tokens=200,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            last_error = exc
    raise last_error


def clean_model_text(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", " ", text, flags=re.I | re.S)
    text = re.sub(r"https?://\S+", " ", text)
    return re.sub(r"\s+", " ", text).strip()
