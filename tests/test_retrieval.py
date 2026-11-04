"""Retrieval tests against the stored Chroma collection."""

import pytest

from src.query.retriever import Retriever


@pytest.fixture(scope="module")
def retriever():
    return Retriever()


CASES = (
    ("Expense ratio of HDFC Large Cap", "Large Cap", "expense_ratio"),
    ("ELSS lock-in", "ELSS", "lock_in"),
    ("Minimum SIP for Mid Cap", "Mid Cap", "min_sip"),
    ("Exit load Flexi Cap", "Flexi Cap", "exit_load"),
    ("Benchmark of HDFC Large Cap", "Large Cap", "benchmark"),
    ("Riskometer HDFC Mid Cap", "Mid Cap", "riskometer"),
    ("hdfc mid kap exit lod", "Mid Cap", "exit_load"),
)


@pytest.mark.parametrize("query,scheme_marker,section", CASES)
def test_expected_section_in_top_three(retriever, query, scheme_marker, section):
    rows = retriever.retrieve(query)
    top = rows[:3]
    assert any(
        scheme_marker.lower() in row["scheme_name"].lower() and row["section"] == section
        for row in top
    )


def test_scheme_filter_keeps_elss_chunks(retriever):
    from src.query.retriever import detect_schemes

    scheme = detect_schemes("ELSS lock-in")[0]
    rows = retriever.retrieve("ELSS lock-in", scheme)
    assert rows
    assert all("elss" in row["scheme_name"].lower() for row in rows)
    assert all("mid cap" not in row["scheme_name"].lower() for row in rows)


def test_unrelated_query_is_below_min_score(retriever):
    assert retriever.retrieve("weather today") == []
