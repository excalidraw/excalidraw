"""Complete crawlers for high-signal open graph-drawing venues."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

from graph_layout_rag.harvest.doi_resolver import resolve_doi_with_fallbacks
from graph_layout_rag.harvest.download import download_to_file
from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.harvest.relevance import is_layout_relevant
from graph_layout_rag.manifest import ManifestItem, relative_local_path, slug_id
from graph_layout_rag.paths import PDF_DIR, TRUSTED_VENUE_CHECKPOINT_PATH

USER_AGENT = "excalidraw-tf-graph-layout-rag/0.1"
CHECKPOINT_PATH = TRUSTED_VENUE_CHECKPOINT_PATH
JGAA_ARCHIVE = "https://jgaa.info/index.php/jgaa/issue/archive"

# Complete GD volumes are trusted. SoCG is broad and remains strict-gated.
DROPS_VOLUMES = (
    {"id": "LIPIcs-volume-320", "venue": "GD", "year": 2024, "trusted": True},
    {"id": "LIPIcs-volume-357", "venue": "GD", "year": 2025, "trusted": True},
    {"id": "LIPIcs-volume-332", "venue": "SoCG", "year": 2025, "trusted": False},
)


def _load_checkpoint() -> dict[str, list[str]]:
    if not CHECKPOINT_PATH.exists():
        return {"drops_volumes": [], "jgaa_issues": []}
    try:
        data = json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
        return {
            "drops_volumes": list(data.get("drops_volumes") or []),
            "jgaa_issues": list(data.get("jgaa_issues") or []),
        }
    except (OSError, json.JSONDecodeError):
        return {"drops_volumes": [], "jgaa_issues": []}


def _save_checkpoint(data: dict[str, list[str]]) -> None:
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CHECKPOINT_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    tmp.replace(CHECKPOINT_PATH)


def _get_html(url: str) -> str | None:
    try:
        response = httpx.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=60.0,
            follow_redirects=True,
        )
        response.raise_for_status()
        return response.text
    except httpx.HTTPError as exc:
        get_logger().warning("trusted venue request failed for %s: %s", url, exc)
        return None


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [s for item in value for s in _strings(item)]
    if isinstance(value, dict):
        return [s for item in value.values() for s in _strings(item)]
    return []


def _person_names(value: Any) -> list[str]:
    people = value if isinstance(value, list) else [value]
    return [
        str(person.get("name")).strip()
        for person in people
        if isinstance(person, dict) and person.get("name")
    ]


def _drops_specs(volume: dict) -> list[dict]:
    url = f"https://drops.dagstuhl.de/entities/volume/{volume['id']}"
    html = _get_html(url)
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    script = soup.find("script", attrs={"type": "application/ld+json"})
    if not script or not script.string:
        return []
    payload = json.loads(script.string)
    entity = payload.get("mainEntity") or {}
    articles = entity.get("hasPart") or []
    if isinstance(articles, dict):
        articles = [articles]
    specs: list[dict] = []
    for article in articles:
        if not isinstance(article, dict) or article.get("@type") != "ScholarlyArticle":
            continue
        strings = _strings(article)
        doi = next(
            (match.group(0) for text in strings if (match := re.search(r"10\.4230/LIPIcs\.[^\s\"<>]+", text))),
            None,
        )
        title = str(article.get("name") or article.get("headline") or "").strip()
        if not doi or not title or doi.count(".") < 3:
            continue
        abstract = str(article.get("abstract") or article.get("description") or "").strip() or None
        if not volume["trusted"] and not is_layout_relevant(title, abstract, strict=True):
            continue
        pdf_url = next((text for text in strings if ".pdf" in text.lower()), None)
        landing = str(article.get("url") or f"https://drops.dagstuhl.de/entities/document/{doi}")
        specs.append(
            {
                "doi": doi.rstrip(").,;"),
                "title": title,
                "authors": _person_names(article.get("author")),
                "abstract": abstract,
                "year": volume["year"],
                "pdf_url": pdf_url,
                "landing": landing,
                "tags": ["drops", "lipics", volume["venue"].lower()],
            }
        )
    return specs


def _resolve_drops(spec: dict, *, dry_run: bool) -> ManifestItem:
    item = resolve_doi_with_fallbacks(
        spec["doi"],
        source="drops",
        tags=spec["tags"],
        pdf_urls=[spec["pdf_url"]] if spec["pdf_url"] else None,
        dry_run=dry_run,
        include_archive=False,
        include_paywall_guesses=False,
    )
    item.id = slug_id(f"doi-{spec['doi']}")
    item.title = spec["title"] or item.title
    item.authors = spec["authors"] or item.authors
    item.year = spec["year"] or item.year
    item.abstract = spec["abstract"] or item.abstract
    item.abstractSource = "drops" if spec["abstract"] else item.abstractSource
    item.externalIds["DOI"] = spec["doi"]
    item.discoverySources = ["drops"]
    item.sourceUrls = sorted({spec["landing"], *([spec["pdf_url"]] if spec["pdf_url"] else [])})
    return item


def _jgaa_issue_urls() -> list[str]:
    pages = [JGAA_ARCHIVE]
    visited: set[str] = set()
    issues: set[str] = set()
    while pages:
        page = pages.pop(0)
        if page in visited:
            continue
        visited.add(page)
        html = _get_html(page)
        if not html:
            continue
        soup = BeautifulSoup(html, "html.parser")
        issues.update(
            str(a["href"])
            for a in soup.select('a[href*="/issue/view/"]')
            if a.get("href")
        )
        next_link = soup.select_one(".cmp_pagination a.next")
        if next_link and next_link.get("href"):
            pages.append(str(next_link["href"]))
    return sorted(issues)


def _jgaa_specs(issue_url: str) -> list[dict]:
    html = _get_html(issue_url)
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    specs: list[dict] = []
    for summary in soup.select(".obj_article_summary"):
        title_link = summary.select_one('a[id^="article-"]')
        pdf_link = summary.select_one("a.obj_galley_link.pdf")
        if not title_link or not pdf_link:
            continue
        article_url = str(title_link.get("href") or "")
        article_id = str(title_link.get("id") or "").removeprefix("article-")
        title = title_link.get_text(" ", strip=True)
        authors_node = summary.select_one(".authors")
        authors = [
            name.strip()
            for name in (authors_node.get_text(" ", strip=True) if authors_node else "").split(",")
            if name.strip()
        ]
        specs.append(
            {
                "article_id": article_id,
                "title": title,
                "authors": authors,
                "landing": article_url,
                "pdf_url": _jgaa_pdf_url(str(pdf_link.get("href"))),
            }
        )
    return specs


def _jgaa_pdf_url(url: str) -> str:
    """Convert OJS galley view links to the direct PDF download endpoint."""
    return url.replace("/article/view/", "/article/download/", 1)


def _download_jgaa(spec: dict, *, dry_run: bool) -> ManifestItem:
    doc_id = slug_id(f"jgaa-{spec['article_id']}-{spec['title']}")
    dest = PDF_DIR / f"{doc_id}.pdf"
    result = download_to_file(dest, spec["pdf_url"], dry_run=dry_run)
    ok = bool(result.get("ok"))
    if not ok and not dry_run:
        dest.unlink(missing_ok=True)
    return ManifestItem(
        id=doc_id,
        title=spec["title"],
        authors=spec["authors"],
        source="jgaa",
        url=spec["pdf_url"],
        localPath=relative_local_path(dest) if ok else None,
        contentType="application/pdf",
        status="ok" if ok else "metadata_only",
        tags=["jgaa", "graph-drawing"],
        sha256=result.get("sha256"),
        externalIds={"JGAA": spec["article_id"]},
        discoverySources=["jgaa"],
        sourceUrls=[spec["landing"], spec["pdf_url"]],
    )


def harvest_trusted_venues(
    *,
    dry_run: bool = False,
    workers: int | None = None,
    existing_ids: set[str] | None = None,
    incremental: bool = True,
) -> list[ManifestItem]:
    checkpoint = _load_checkpoint()
    items: list[ManifestItem] = []
    completed_volumes = set(checkpoint["drops_volumes"])
    for volume in DROPS_VOLUMES:
        if incremental and volume["id"] in completed_volumes:
            continue
        specs = _drops_specs(volume)
        if not specs:
            continue
        items.extend(
            parallel_map(
                lambda spec: _resolve_drops(spec, dry_run=dry_run),
                specs,
                workers=workers,
                label=f"drops {volume['id']}",
            )
        )
        if not dry_run:
            completed_volumes.add(volume["id"])
            checkpoint["drops_volumes"] = sorted(completed_volumes)
            _save_checkpoint(checkpoint)

    completed_issues = set(checkpoint["jgaa_issues"])
    for issue_url in _jgaa_issue_urls():
        if incremental and issue_url in completed_issues:
            continue
        specs = _jgaa_specs(issue_url)
        if not specs:
            continue
        issue_items = parallel_map(
            lambda spec: _download_jgaa(spec, dry_run=dry_run),
            specs,
            workers=workers,
            label="jgaa",
        )
        items.extend(issue_items)
        if not dry_run and len(issue_items) == len(specs) and all(
            item.status == "ok" for item in issue_items
        ):
            completed_issues.add(issue_url)
            checkpoint["jgaa_issues"] = sorted(completed_issues)
            _save_checkpoint(checkpoint)

    skip = existing_ids or set()
    return [item for item in items if item.id not in skip]
