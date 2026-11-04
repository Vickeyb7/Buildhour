"""Run 10 sample queries and print retrieved chunks, scores, and answers.

Usage: python run_queries.py
"""

from src.query.pipeline import Pipeline

QUERIES = (
    ("Expense ratio of HDFC Large Cap Fund Direct Growth", "Large Cap", "expense_ratio"),
    ("What is the lock-in period of HDFC ELSS Tax Saver Fund?", "ELSS", "lock_in"),
    ("What is the minimum SIP for HDFC Mid Cap Fund?", "Mid Cap", "min_sip"),
    ("What is the exit load of HDFC Flexi Cap?", "Flexi Cap", "exit_load"),
    ("What is the benchmark of HDFC Large Cap?", "Large Cap", "benchmark"),
    ("What is the riskometer of HDFC Mid Cap?", "Mid Cap", "riskometer"),
    ("hdfc mid kap exit lod", "Mid Cap", "exit_load"),
    ("Who is the fund manager of HDFC ELSS Tax Saver Fund?", "ELSS", "fund_manager"),
    ("What is the AUM of HDFC Large Cap Fund?", "Large Cap", "aum"),
    ("Expense ratio of HDFC Flexi Cap Direct Plan Growth", "Flexi Cap", "expense_ratio"),
)


def main() -> None:
    pipeline = Pipeline()
    hits = 0
    for query, scheme_marker, section in QUERIES:
        result = pipeline.answer(query)
        print("=" * 80)
        print("Q:", query)
        matched = False
        for index, chunk in enumerate(result.chunks[:3], start=1):
            mark = scheme_marker.lower() in chunk["scheme_name"].lower() and chunk["section"] == section
            matched = matched or mark
            print(
                f"  {index}. {chunk['score']:.3f}  {chunk['scheme_name']}  {chunk['section']}  {chunk['text']}"
            )
        if not result.chunks:
            print("  (no chunks)")
        print(result.formatted())
        print("RETRIEVAL", "PASS" if matched else "FAIL")
        hits += int(matched)
    print("=" * 80)
    print(f"{hits}/{len(QUERIES)} retrieved the expected scheme and section in the top 3")


if __name__ == "__main__":
    main()
