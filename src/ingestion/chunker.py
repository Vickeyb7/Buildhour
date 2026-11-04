"""Phase 2: chunk saved pages into data/chunks/chunks.jsonl.

Scheme facts come from the embedded __NEXT_DATA__ JSON, one chunk per fact.
Narrative text is split into paragraphs of at most narrative_max_chars,
with overlap_chars of overlap.
"""

import html
import json
import re
from pathlib import Path

from src.config import ROOT, cfg

RAW_DIR = ROOT / "data" / "raw"
CHUNKS_PATH = ROOT / "data" / "chunks" / "chunks.jsonl"
NEXT_DATA_RE = re.compile(
    r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',
    re.DOTALL,
)
TAG_RE = re.compile(r"<[^>]+>")

SCHEME_SECTIONS = (
    "expense_ratio",
    "exit_load",
    "min_sip",
    "lock_in",
    "riskometer",
    "benchmark",
    "fund_manager",
    "aum",
)


def load_next_data(path: Path) -> dict:
    match = NEXT_DATA_RE.search(path.read_text(encoding="utf-8"))
    if not match:
        raise ValueError(f"no __NEXT_DATA__ in {path.name}")
    return json.loads(match.group(1))["props"]["pageProps"]


def exact_number(value) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, int) or (isinstance(value, float) and value.is_integer()):
        return str(int(value))
    return format(value, "f").rstrip("0").rstrip(".")


def indian_group(raw: str) -> str:
    negative = raw.startswith("-")
    raw = raw[1:] if negative else raw
    whole, frac = raw.split(".", 1) if "." in raw else (raw, "")
    frac = f".{frac}" if frac else ""
    if len(whole) <= 3:
        grouped = whole
    else:
        lead, tail = whole[:-3], whole[-3:]
        parts = []
        while lead:
            parts.append(lead[-2:])
            lead = lead[:-2]
        grouped = ",".join(reversed(parts)) + "," + tail
    return ("-" if negative else "") + grouped + frac


def format_inr(value) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    return f"₹{indian_group(exact_number(value))}"


def format_aum(value) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    return f"₹{indian_group(f'{float(value):.2f}')} Cr"


def format_lock_in(lock) -> str | None:
    if not isinstance(lock, dict):
        return None
    parts = []
    for key, unit in (("years", "year"), ("months", "month"), ("days", "day")):
        count = lock.get(key)
        if not isinstance(count, (int, float)) or count <= 0:
            continue
        count = int(count)
        parts.append(f"{count} {unit}{'' if count == 1 else 's'}")
    return " ".join(parts) or None


def clean_text(value: str) -> str:
    text = re.sub(r"(?i)<br\s*/?>|</p>", "\n", value)
    text = TAG_RE.sub(" ", text)
    text = html.unescape(text).replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return re.sub(r"\n{2,}", "\n", text).strip()


def fact_line(scheme_name: str, label: str, value: str) -> str:
    value = " ".join(value.split())
    if value.lower().startswith(label.lower()):
        body = value
    else:
        body = f"{label}: {value}"
    return f"{scheme_name} – {body}"


def narrative_pieces(text: str, max_chars: int, overlap: int) -> list[str]:
    paragraphs = [part.strip() for part in clean_text(text).split("\n") if part.strip()]
    pieces = []
    for paragraph in paragraphs:
        if len(paragraph) <= max_chars:
            pieces.append(paragraph)
            continue
        start = 0
        while start < len(paragraph):
            end = min(start + max_chars, len(paragraph))
            if end < len(paragraph):
                split_at = paragraph.rfind(" ", start, end)
                if split_at > start + max_chars // 2:
                    end = split_at
            piece = paragraph[start:end].strip()
            if piece:
                pieces.append(piece)
            if end >= len(paragraph):
                break
            start = max(end - overlap, start + 1)
    return pieces


def scheme_facts(data: dict) -> list[tuple[str, str, str]]:
    facts = []

    def add(section: str, label: str, value) -> None:
        if value is None:
            return
        text = str(value).strip()
        if text:
            facts.append((section, label, text))

    expense = data.get("expense_ratio")
    if expense not in (None, ""):
        add("expense_ratio", "Expense ratio", f"{exact_number(expense)}%")
    exit_load = data.get("exit_load")
    if isinstance(exit_load, str):
        add("exit_load", "Exit load", exit_load)
    add("min_sip", "Minimum SIP", format_inr(data.get("min_sip_investment")))
    add("lock_in", "Lock-in period", format_lock_in(data.get("lock_in")))

    risk = None
    stats = data.get("return_stats") or []
    if stats and isinstance(stats[0], dict):
        risk = stats[0].get("risk")
    add("riskometer", "Riskometer", risk)

    add("benchmark", "Benchmark", data.get("benchmark_name") or data.get("benchmark"))

    managers = []
    for person in data.get("fund_manager_details") or []:
        name = (person.get("person_name") or "").strip()
        if name and name not in managers:
            managers.append(name)
    if not managers and data.get("fund_manager"):
        managers.append(str(data["fund_manager"]).strip())
    add("fund_manager", "Fund manager", ", ".join(managers))
    add("aum", "AUM", format_aum(data.get("aum")))
    return facts


def amc_facts(info: dict) -> list[tuple[str, str, str]]:
    facts = []

    def add(section: str, label: str, value) -> None:
        if value is None:
            return
        if isinstance(value, list):
            value = ", ".join(str(item).strip() for item in value if str(item).strip())
        text = str(value).strip()
        if text and text.lower() != "none":
            facts.append((section, label, text))

    add("aum", "AUM", format_aum(info.get("total_aum")))
    add("sponsor", "Sponsor", info.get("sponsor_name"))
    add("trustee", "Trustee", info.get("trustee_organisation"))
    add("ceo", "CEO", info.get("md") or info.get("ceo"))
    add("cio", "CIO", info.get("cio"))
    return facts


def make_chunk(slug, section, index, text, source, scheme_name, page_type, scraped_at) -> dict:
    return {
        "chunk_id": f"{slug}__{section}__{index:02d}",
        "text": text,
        "source_url": source["url"],
        "scheme_name": scheme_name,
        "page_type": page_type,
        "section": section,
        "scraped_at": scraped_at,
    }


def chunks_for_page(source: dict, max_chars: int, overlap: int) -> list[dict]:
    path = RAW_DIR / f"{source['slug']}.html"
    page = load_next_data(path)
    scheme_name = source["name"]
    page_type = source["type"]
    scraped_at = source["scraped_at"]
    slug = source["slug"]
    rows = []
    counts: dict[str, int] = {}

    def append(section: str, text: str) -> None:
        counts[section] = counts.get(section, 0) + 1
        rows.append(
            make_chunk(
                slug,
                section,
                counts[section],
                text,
                source,
                scheme_name,
                page_type,
                scraped_at,
            )
        )

    if page_type == "scheme":
        data = page["mfServerSideData"]
        for section, label, value in scheme_facts(data):
            append(section, fact_line(scheme_name, label, value))
        overview = data.get("description")
        if isinstance(overview, str):
            for piece in narrative_pieces(overview, max_chars, overlap):
                append("overview", fact_line(scheme_name, "Overview", piece))
    else:
        block = next(
            item for item in page["amcMainPageData"] if "key_information" in item
        )
        for section, label, value in amc_facts(block.get("key_information") or {}):
            append(section, fact_line(scheme_name, label, value))
        for item in block.get("contentList") or []:
            body = item.get("content") or ""
            title = (item.get("title") or "").strip()
            section = "amc_description" if title == scheme_name else "faq"
            for piece in narrative_pieces(body, max_chars, overlap):
                prefix = title if section == "faq" and title else scheme_name
                append(section, f"{prefix} – {piece}" if section == "faq" else fact_line(scheme_name, "Overview", piece))

    return rows


def page_was_scraped(record: dict) -> bool:
    return record.get("http_status") == 200


def chunk_pages() -> list[dict]:
    manifest = json.loads((RAW_DIR / "manifest.json").read_text(encoding="utf-8"))
    limits = cfg["chunking"]
    max_chars = int(limits["narrative_max_chars"])
    overlap = int(limits["overlap_chars"])
    seen: set[str] = set()
    chunks = []

    for source in manifest:
        if not page_was_scraped(source):
            print(f"{source['slug']}: skipped (status {source.get('http_status')})")
            continue
        page_chunks = []
        for chunk in chunks_for_page(source, max_chars, overlap):
            if chunk["text"] in seen:
                continue
            seen.add(chunk["text"])
            page_chunks.append(chunk)
        chunks.extend(page_chunks)
        sections = sorted({chunk["section"] for chunk in page_chunks})
        print(f"{source['slug']}: {len(page_chunks)} chunks [{', '.join(sections)}]")
        if source["type"] == "scheme":
            required = ["expense_ratio", "exit_load", "min_sip", "riskometer", "benchmark"]
            if "elss" in source["slug"]:
                required.append("lock_in")
            missing = [name for name in required if name not in sections]
            if missing:
                print(f"{source['slug']}: missing {', '.join(missing)}")

    CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CHUNKS_PATH.open("w", encoding="utf-8") as handle:
        for chunk in chunks:
            handle.write(json.dumps(chunk, ensure_ascii=False) + "\n")
    print(f"Wrote {len(chunks)} chunks to {CHUNKS_PATH}")
    return chunks
