"""Embed a query and fetch matching chunks from the ingestion collection."""

import json

import chromadb
import numpy as np
from sentence_transformers import SentenceTransformer

from src.config import ROOT, cfg
from src.ingestion.indexer import PrecomputedEmbeddings

EMBED_DIR = ROOT / "data" / "embeddings"

SCHEME_RULES = (
    ("large cap", "Large Cap"),
    ("flexi cap", "Flexi Cap"),
    ("equity fund", "Flexi Cap"),
    ("tax saver", "ELSS"),
    ("elss", "ELSS"),
    ("mid cap", "Mid Cap"),
    ("midcap", "Mid Cap"),
)
FACT_TERMS = ("expense ratio", "exit load", "lock-in", "lock in", "riskometer", "benchmark")
UNKNOWN_SCHEME_TERMS = ("small cap", "multi cap", "value fund", "focused fund", "sectoral")


def scheme_sources() -> list[dict]:
    return [source for source in cfg["sources"] if source["type"] == "scheme"]


def detect_schemes(query: str) -> list[str]:
    text = query.lower()
    found = []
    for keyword, marker in SCHEME_RULES:
        if keyword not in text:
            continue
        for source in scheme_sources():
            if marker.lower() in source["name"].lower() and source["name"] not in found:
                found.append(source["name"])
    return found


def needs_scheme(query: str) -> bool:
    text = query.lower()
    if any(term in text for term in FACT_TERMS):
        return True
    return bool(re_sip(text))


def re_sip(text: str) -> bool:
    import re

    return re.search(r"\bsip\b", text) is not None


def mentions_unknown_scheme(query: str) -> bool:
    text = query.lower()
    return any(term in text for term in UNKNOWN_SCHEME_TERMS)


def require_same_model(stored: str | None, expected: str) -> None:
    if stored != expected:
        raise RuntimeError(
            f"Embedding model mismatch: index has {stored}, config uses {expected}."
        )


class Retriever:
    def __init__(self) -> None:
        model_name = cfg["embedding"]["model_name"]
        meta = json.loads((EMBED_DIR / "meta.json").read_text(encoding="utf-8"))
        require_same_model(meta.get("model"), model_name)
        client = chromadb.PersistentClient(path=str(ROOT / cfg["vector_db"]["path"]))
        self.collection = client.get_collection(
            cfg["vector_db"]["collection"],
            embedding_function=PrecomputedEmbeddings(),
        )
        stored = (self.collection.metadata or {}).get("embedding_model")
        require_same_model(stored, model_name)
        self.model = SentenceTransformer(model_name)
        self.top_k = int(cfg["retrieval"]["top_k"])
        self.min_score = float(cfg["retrieval"]["min_score"])

    def retrieve(self, query: str, scheme_name: str | None = None) -> list[dict]:
        vector = self.model.encode([query], normalize_embeddings=True)
        kwargs = {
            "query_embeddings": np.asarray(vector, dtype="float32").tolist(),
            "n_results": self.top_k,
            "include": ["documents", "metadatas", "distances"],
        }
        if scheme_name:
            kwargs["where"] = {"scheme_name": scheme_name}
        found = self.collection.query(**kwargs)
        rows = []
        ids = found["ids"][0]
        documents = found["documents"][0]
        metadatas = found["metadatas"][0]
        distances = found["distances"][0]
        for chunk_id, text, metadata, distance in zip(ids, documents, metadatas, distances):
            score = 1 - float(distance)
            if score < self.min_score:
                continue
            rows.append(
                {
                    "chunk_id": chunk_id,
                    "text": text,
                    "score": round(score, 4),
                    "scheme_name": metadata.get("scheme_name", ""),
                    "section": metadata.get("section", ""),
                    "source_url": metadata.get("source_url", ""),
                    "scraped_at": metadata.get("scraped_at", ""),
                }
            )
        return rows
