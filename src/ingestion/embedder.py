"""Phase 3: embed chunks with the configured sentence-transformer."""

import json

import numpy as np
from sentence_transformers import SentenceTransformer

from src.config import ROOT, cfg

CHUNKS_PATH = ROOT / "data" / "chunks" / "chunks.jsonl"
EMBED_DIR = ROOT / "data" / "embeddings"


def embed_chunks() -> dict:
    chunks = [
        json.loads(line)
        for line in CHUNKS_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not chunks:
        raise SystemExit(f"No chunks in {CHUNKS_PATH}. Run phase 2 first.")

    model_name = cfg["embedding"]["model_name"]
    batch_size = int(cfg["embedding"]["batch_size"])
    texts = [chunk["text"] for chunk in chunks]
    chunk_ids = [chunk["chunk_id"] for chunk in chunks]

    model = SentenceTransformer(model_name)
    vectors = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    vectors = np.asarray(vectors, dtype=np.float32)
    count, dim = vectors.shape

    EMBED_DIR.mkdir(parents=True, exist_ok=True)
    np.save(EMBED_DIR / "vectors.npy", vectors)
    (EMBED_DIR / "ids.json").write_text(json.dumps(chunk_ids, indent=2), encoding="utf-8")
    meta = {"model": model_name, "dim": int(dim), "count": int(count)}
    (EMBED_DIR / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"vectors.npy shape ({count}, {dim})")
    print(f"ids count {len(chunk_ids)}")
    print(f"model {meta['model']}")
    return meta
