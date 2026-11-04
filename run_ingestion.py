"""Run one ingestion phase or all of them.

Usage: python run_ingestion.py --phase 1|2|3|4|all
"""

import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the MF FAQ ingestion pipeline.")
    parser.add_argument("--phase", required=True, choices=["1", "2", "3", "4", "all"])
    parser.add_argument("--reset", action="store_true", help="Delete and rebuild the Chroma collection.")
    args = parser.parse_args()

    if args.phase in ("1", "all"):
        from src.ingestion.loader import load_sources

        load_sources()
    if args.phase in ("2", "all"):
        from src.ingestion.chunker import chunk_pages

        chunk_pages()
    if args.phase in ("3", "all"):
        from src.ingestion.embedder import embed_chunks

        embed_chunks()
    if args.phase in ("4", "all"):
        from src.ingestion.indexer import index_vectors

        index_vectors(reset=args.reset)


if __name__ == "__main__":
    main()
