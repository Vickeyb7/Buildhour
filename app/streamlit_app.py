"""Streamlit UI for the MF FAQ assistant."""

import json

import streamlit as st

from src.config import ROOT, cfg
from src.query.pipeline import Pipeline

st.set_page_config(page_title="HDFC MF FAQ", page_icon="📄", layout="centered")


@st.cache_resource
def get_pipeline() -> Pipeline:
    return Pipeline()


def submit(question: str) -> None:
    result = get_pipeline().answer(question)
    user_text = "Personal details were removed." if result.kind == "pii" else question.strip()
    st.session_state.messages.append({"role": "user", "body": user_text})
    st.session_state.messages.append(
        {
            "role": "assistant",
            "body": result.body,
            "source_url": result.source_url,
            "updated": result.updated,
        }
    )
    st.session_state.last_chunks = result.chunks


def render_message(message: dict) -> None:
    with st.chat_message(message["role"]):
        st.write(message["body"])
        if message.get("source_url"):
            url = message["source_url"]
            st.markdown(f"Source: [{url}]({url})")
        if message.get("updated"):
            st.caption(f"Last updated from sources: {message['updated']}")


def pipeline_inspector() -> None:
    manifest_path = ROOT / "data" / "raw" / "manifest.json"
    chunks_path = ROOT / "data" / "chunks" / "chunks.jsonl"
    meta_path = ROOT / "data" / "embeddings" / "meta.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    chunks = [
        json.loads(line)
        for line in chunks_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    counts: dict[str, int] = {}
    for chunk in chunks:
        counts[chunk["scheme_name"]] = counts.get(chunk["scheme_name"], 0) + 1
    st.subheader("Manifest")
    st.dataframe(
        [
            {
                "name": row["name"],
                "type": row["type"],
                "status": row["http_status"],
                "scraped_at": row["scraped_at"],
            }
            for row in manifest
        ],
        hide_index=True,
    )
    st.subheader("Chunk counts")
    st.dataframe(
        [{"page": name, "chunks": count} for name, count in counts.items()],
        hide_index=True,
    )
    st.subheader("Embedding meta")
    st.json(json.loads(meta_path.read_text(encoding="utf-8")))
    st.write(f"Chroma count: {get_pipeline().retriever.collection.count()}")
    st.subheader("Last retrieval")
    last = st.session_state.get("last_chunks") or []
    if not last:
        st.caption("Ask a question to see retrieved chunks.")
        return
    st.dataframe(
        [
            {
                "score": row["score"],
                "scheme": row["scheme_name"],
                "section": row["section"],
                "text": row["text"],
            }
            for row in last
        ],
        hide_index=True,
    )


if "messages" not in st.session_state:
    st.session_state.messages = []
    st.session_state.last_chunks = []

st.title("HDFC MF FAQ")
st.write("Ask factual questions about select HDFC Mutual Fund schemes.")
st.info(cfg["ui"]["disclaimer"])

columns = st.columns(len(cfg["ui"]["examples"]))
for column, example in zip(columns, cfg["ui"]["examples"]):
    with column:
        if st.button(example, use_container_width=True):
            submit(example)

for message in st.session_state.messages:
    render_message(message)

typed = st.chat_input("Ask a factual question")
if typed:
    submit(typed)
    st.rerun()

with st.expander("Pipeline inspector"):
    pipeline_inspector()

st.caption(cfg["ui"]["disclaimer"])
