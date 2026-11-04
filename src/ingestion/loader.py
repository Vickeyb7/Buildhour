"""Phase 1: scrape the five configured pages. Never follow links on those pages."""

import hashlib
import json
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests

from src.config import ROOT, cfg

RAW_DIR = ROOT / "data" / "raw"
USER_AGENT = "Mozilla/5.0"
NEXT_DATA_RE = re.compile(
    r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',
    re.DOTALL,
)


def slug_from_url(url: str) -> str:
    return urlparse(url).path.rstrip("/").split("/")[-1]


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def has_expense_ratio(html: str) -> bool:
    if "Expense ratio" in html:
        return True
    match = NEXT_DATA_RE.search(html)
    if not match:
        return False
    try:
        blob = json.loads(match.group(1))
    except json.JSONDecodeError:
        return False
    return "Expense ratio" in json.dumps(blob)


def needs_playwright(html: str, page_type: str) -> bool:
    """Scheme pages must contain the expense-ratio fact. The AMC page does not."""
    if has_expense_ratio(html):
        return False
    if page_type == "scheme":
        return True
    return NEXT_DATA_RE.search(html) is None


def fetch_http(url: str) -> requests.Response:
    return requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)


def fetch_playwright(url: str) -> str:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            page = browser.new_page(user_agent=USER_AGENT)
            page.goto(url, wait_until="domcontentloaded", timeout=60_000)
            return page.content()
        finally:
            browser.close()


def load_sources() -> list[dict]:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    for source in cfg["sources"]:
        url = source["url"]
        slug = slug_from_url(url)
        record = {
            "slug": slug,
            "name": source["name"],
            "type": source["type"],
            "url": url,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "http_status": None,
            "content_hash": None,
        }
        try:
            response = fetch_http(url)
            record["http_status"] = response.status_code
            html = response.text
            if response.ok and needs_playwright(html, source["type"]):
                print(f"{slug}: page looks JavaScript-rendered; trying Playwright")
                try:
                    html = fetch_playwright(url)
                except Exception as exc:
                    print(f"{slug}: Playwright fallback failed ({exc}); keeping HTTP body")
            data = html.encode("utf-8")
            (RAW_DIR / f"{slug}.html").write_bytes(data)
            record["content_hash"] = content_hash(data)
        except Exception as exc:
            print(f"{slug}: failed ({exc})")
        manifest.append(record)
        print(f"{slug}: status {record['http_status']}")

    (RAW_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    ok = sum(1 for row in manifest if row["http_status"] == 200)
    print(f"Saved {len(manifest)} manifest rows, {ok} with status 200, to {RAW_DIR}")
    return manifest
