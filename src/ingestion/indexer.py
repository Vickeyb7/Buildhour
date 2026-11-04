"""Phase 4: upsert embeddings into a persistent Chroma collection."""

import json

import chromadb
import numpy as np
from sentence_transformers import SentenceTransformer

from src.config import ROOT, cfg

CHUNKS_PATH = ROOT / "data" / "chunks" / "chunks.jsonl"
EMBED_DIR = ROOT / "data" / "embeddings"


def _flat_metadata(chunk: dict) -> dict:
    return {
        "source_url": str(chunk["source_url"]),
        "scheme_name": str(chunk["scheme_name"]),
        "page_type": str(chunk["page_type"]),
        "section": str(chunk["section"]),
        "scraped_at": str(chunk["scraped_at"]),
    }


class PrecomputedEmbeddings:
    """Chroma calls this only when embeddings are not supplied. Phase 4 always supplies them."""

    def __call__(self, input):
        raise RuntimeError("Pass precomputed embeddings; this collection does not embed text.")

    @staticmethod
    def name() -> str:
        return "precomputed"


def _collection_names(client) -> list[str]:
    names = []
    for item in client.list_collections():
        names.append(item if isinstance(item, str) else item.name)
    return names


def index_vectors(reset: bool = False):
    meta = json.loads((EMBED_DIR / "meta.json").read_text(encoding="utf-8"))
    model_name = cfg["embedding"]["model_name"]
    if meta["model"] != model_name:
        raise SystemExit(
            f"Embedding model mismatch: index has {meta['model']}, config has {model_name}."
        )

    chunk_ids = json.loads((EMBED_DIR / "ids.json").read_text(encoding="utf-8"))
    vectors = np.load(EMBED_DIR / "vectors.npy")
    chunks = {
        chunk["chunk_id"]: chunk
        for chunk in (
            json.loads(line)
            for line in CHUNKS_PATH.read_text(encoding="utf-8").splitlines()
            if line.strip()
        )
    }
    if len(chunk_ids) != len(vectors) or len(chunk_ids) != meta["count"]:
        raise SystemExit("vectors.npy, ids.json, and meta.json are out of sync.")
    missing = [chunk_id for chunk_id in chunk_ids if chunk_id not in chunks]
    if missing:
        raise SystemExit(f"Chunk text missing for {missing[0]}. Re-run phase 2 and phase 3.")

    db_path = ROOT / cfg["vector_db"]["path"]
    db_path.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(db_path))
    collection_name = cfg["vector_db"]["collection"]
    if reset and collection_name in _collection_names(client):
        client.delete_collection(collection_name)

    collection = client.get_or_create_collection(
        collection_name,
        metadata={"hnsw:space": "cosine", "embedding_model": model_name},
        embedding_function=PrecomputedEmbeddings(),
    )
    stored_model = (collection.metadata or {}).get("embedding_model")
    if stored_model != model_name:
        raise SystemExit(
            f"Collection was built with {stored_model}, config has {model_name}. Re-run with --reset."
        )

    collection.upsert(
        ids=chunk_ids,
        embeddings=vectors.astype("float32").tolist(),
        documents=[chunks[chunk_id]["text"] for chunk_id in chunk_ids],
        metadatas=[_flat_metadata(chunks[chunk_id]) for chunk_id in chunk_ids],
    )

    count = collection.count()
    print(f"collection count {count} (chunks {len(chunk_ids)})")
    if count != len(chunk_ids):
        raise SystemExit("Collection count does not match the chunk count.")

    query_model = SentenceTransformer(model_name)
    query_vector = query_model.encode(
        ["ELSS lock-in"],
        normalize_embeddings=True,
    )
    found = collection.query(
        query_embeddings=np.asarray(query_vector, dtype="float32").tolist(),
        n_results=3,
        include=["documents", "metadatas", "distances"],
    )
    top_id = found["ids"][0][0]
    top_section = found["metadatas"][0][0]["section"]
    top_scheme = found["metadatas"][0][0]["scheme_name"]
    print(f"ELSS lock-in top hit: {top_id} ({top_scheme}, {top_section})")
    if "elss" not in top_scheme.lower() or top_section != "lock_in":
        raise SystemExit("ELSS lock-in query did not return the ELSS lock-in chunk first.")
    return collection
