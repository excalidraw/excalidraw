from __future__ import annotations

import logging
import re
from collections.abc import Callable

from graph_layout_rag.harvest.archive_fallback import archive_pdf_urls
from graph_layout_rag.harvest.doi_validate import is_well_formed_doi
from graph_layout_rag.harvest.download import download_to_file
from graph_layout_rag.harvest.http_client import get_json
from graph_layout_rag.harvest.ledger import set_harvest_stage, update_document
from graph_layout_rag.harvest.parallel import parallel_map
from graph_layout_rag.manifest import ManifestItem, relative_local_path, slug_id
from graph_layout_rag.paths import PDF_DIR

log = logging.getLogger("graph_layout_rag.harvest.doi")

USER_AGENT = "mailto:graph-layout-rag@excalidraw-tf.local"
UNPAYWALL_EMAIL = "graph-layout-rag@excalidraw-tf.local"
OPENALEX_API = "https://api.openalex.org/works"
S2_API = "https://api.semanticscholar.org/graph/v1/paper/DOI:"

_PMC_ID_RE = re.compile(r"PMC\d+", re.I)
_MAX_CANDIDATE_URLS = 12
_MAX_FAILED_URL_ATTEMPTS = 6
_MAX_OPENALEX_LOCATION_URLS = 5


def _abstract_from_inverted_index(idx: dict | None) -> str | None:
    if not idx:
        return None
    pairs = [(pos, word) for word, positions in idx.items() for pos in positions]
    pairs.sort(key=lambda x: x[0])
    return " ".join(word for _, word in pairs)[:4000]


def _openalex_by_doi(doi: str) -> dict | None:
    return get_json(f"{OPENALEX_API}/https://doi.org/{doi}", timeout=30.0)


def _semantic_scholar_pdf(doi: str) -> str | None:
    data = get_json(
        f"{S2_API}{doi}",
        params={"fields": "title,openAccessPdf"},
        timeout=30.0,
    )
    if not data:
        return None
    oa = data.get("openAccessPdf") or {}
    url = oa.get("url") or ""
    return url if url else None


def _springer_pdf_url(doi: str) -> str | None:
    if not doi.startswith("10.1007/"):
        return None
    return f"https://link.springer.com/content/pdf/{doi}.pdf"


def _arxiv_pdf_url(doi: str) -> str | None:
    m = re.match(r"10\.48550/arxiv\.(\d+\.\d+)", doi, re.I)
    if m:
        return f"https://arxiv.org/pdf/{m.group(1)}.pdf"
    m = re.match(r"10\.48550/arXiv\.(\d+\.\d+)", doi, re.I)
    if m:
        return f"https://arxiv.org/pdf/{m.group(1)}.pdf"
    return None


def _plos_pdf_url(doi: str) -> str | None:
    if not doi.startswith("10.1371/"):
        return None
    return f"https://journals.plos.org/plosone/article/file?id={doi}&type=printable"


def _openalex_has_oa_pdf(work: dict | None) -> bool:
    """True when OpenAlex already surfaced a likely PDF URL."""
    if not work:
        return False
    for key in ("best_oa_location", "primary_location"):
        loc = work.get(key) or {}
        if loc.get("pdf_url"):
            return True
    if _openalex_location_pdfs(work):
        return True
    oa = work.get("open_access") or {}
    return bool(oa.get("oa_url"))


def _pmc_id_from_work(work: dict | None) -> str | None:
    if not work:
        return None
    for loc in work.get("locations") or []:
        landing = (loc.get("landing_page_url") or loc.get("pdf_url") or "") or ""
        m = _PMC_ID_RE.search(landing)
        if m:
            return m.group(0).upper()
    oa = work.get("best_oa_location") or {}
    for key in ("landing_page_url", "pdf_url"):
        m = _PMC_ID_RE.search(oa.get(key) or "")
        if m:
            return m.group(0).upper()
    return None


def _pmc_pdf_urls(doi: str, work: dict | None) -> list[str]:
    urls: list[str] = []
    pmc_id = _pmc_id_from_work(work)
    if not pmc_id and doi.startswith("10.1371/"):
        if work:
            for ext_id in work.get("ids") or {}:
                if ext_id.lower() == "pmcid" and work["ids"][ext_id]:
                    pmc_id = work["ids"][ext_id].upper()
                    if not pmc_id.startswith("PMC"):
                        pmc_id = f"PMC{pmc_id}"
    if pmc_id:
        numeric = pmc_id.replace("PMC", "")
        urls.append(f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/pdf/")
        urls.append(f"https://europepmc.org/articles/{pmc_id}?pdf=render")
        urls.append(f"https://www.ncbi.nlm.nih.gov/pmc/articles/PMC{numeric}/pdf/")
    return urls


def _unpaywall_pdf(doi: str) -> list[str]:
    data = get_json(
        f"https://api.unpaywall.org/v2/{doi}",
        params={"email": UNPAYWALL_EMAIL},
        timeout=30.0,
    )
    if not data:
        return []
    urls: list[str] = []
    best = data.get("best_oa_location") or {}
    for key in ("url_for_pdf", "url"):
        if best.get(key):
            urls.append(best[key])
    for loc in data.get("oa_locations") or []:
        for key in ("url_for_pdf", "url"):
            if loc.get(key):
                urls.append(loc[key])
    return urls


def _wiley_pdf_url(doi: str) -> str | None:
    if doi.startswith(("10.1002/", "10.1111/", "10.1117/")):
        return f"https://onlinelibrary.wiley.com/doi/pdfdirect/{doi}"
    return None


def _acm_pdf_url(doi: str) -> str | None:
    if doi.startswith("10.1145/"):
        return f"https://dl.acm.org/doi/pdf/{doi}"
    return None


def _ieee_pdf_url(doi: str) -> str | None:
    if doi.startswith("10.1109/"):
        return f"https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?arnumber={doi.split('/')[-1]}"
    return None


def _openalex_location_pdfs(work: dict | None) -> list[str]:
    if not work:
        return []
    urls: list[str] = []
    for loc in work.get("locations") or []:
        if loc.get("pdf_url"):
            urls.append(loc["pdf_url"])
        if len(urls) >= _MAX_OPENALEX_LOCATION_URLS:
            break
    return urls


def _direct_pdf_urls(urls: list[str]) -> list[str]:
    """Prefer URLs that look like direct PDF links."""
    direct: list[str] = []
    other: list[str] = []
    for u in urls:
        low = u.lower()
        if ".pdf" in low or "/pdf/" in low or "pdfdirect" in low or "type=printable" in low:
            direct.append(u)
        else:
            other.append(u)
    return direct + other


def _dedupe_urls(urls: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for u in urls:
        if u and u not in seen:
            seen.add(u)
            unique.append(u)
    return unique


def pick_pdf_urls(
    doi: str,
    work: dict | None,
    extra_urls: list[str] | None = None,
    *,
    include_archive: bool = False,
    include_paywall_guesses: bool = True,
) -> list[str]:
    """Return candidate PDF URLs in priority order."""
    tier1: list[str] = []
    tier2: list[str] = []
    tier3: list[str] = []
    tier_paywall: list[str] = []
    tier4: list[str] = []

    if extra_urls:
        tier1.extend(extra_urls)

    arxiv = _arxiv_pdf_url(doi)
    if arxiv:
        tier1.append(arxiv)
    springer = _springer_pdf_url(doi)
    if springer:
        tier1.append(springer)
    plos = _plos_pdf_url(doi)
    if plos:
        tier1.append(plos)
    tier1.extend(_pmc_pdf_urls(doi, work))

    if work:
        oa = work.get("best_oa_location") or {}
        if oa.get("pdf_url"):
            tier2.append(oa["pdf_url"])
        primary = work.get("primary_location") or {}
        if primary.get("pdf_url"):
            tier2.append(primary["pdf_url"])
        tier2.extend(_openalex_location_pdfs(work))
        open_access = work.get("open_access") or {}
        if open_access.get("oa_url"):
            tier2.append(open_access["oa_url"])

    # Skip slow Unpaywall + S2 when OpenAlex already has OA PDF hints.
    if not _openalex_has_oa_pdf(work):
        tier3.extend(_unpaywall_pdf(doi))
        s2 = _semantic_scholar_pdf(doi)
        if s2:
            tier3.append(s2)

    wiley = _wiley_pdf_url(doi)
    if wiley:
        tier3.append(wiley)

    if include_paywall_guesses:
        acm = _acm_pdf_url(doi)
        if acm:
            tier_paywall.append(acm)
        ieee = _ieee_pdf_url(doi)
        if ieee:
            tier_paywall.append(ieee)

    if include_archive:
        tier4.extend(archive_pdf_urls(doi))

    return _dedupe_urls(
        _direct_pdf_urls(tier1)
        + _direct_pdf_urls(tier2)
        + _direct_pdf_urls(tier3)
        + _direct_pdf_urls(tier_paywall)
        + (_direct_pdf_urls(tier4) if include_archive else [])
    )


def resolve_doi_with_fallbacks(
    doi: str,
    *,
    source: str = "doi-resolver",
    tags: list[str] | None = None,
    pdf_urls: list[str] | None = None,
    dry_run: bool = False,
    verify: bool = True,
    include_archive: bool = False,
    include_paywall_guesses: bool = True,
) -> ManifestItem:
    if not is_well_formed_doi(doi):
        log.debug("skipping malformed DOI %s", doi)
        doc_id = slug_id(f"doi-{doi}")
        return ManifestItem(
            id=doc_id,
            title=f"DOI {doi}",
            authors=[],
            year=None,
            source=source,
            url=f"https://doi.org/{doi}",
            localPath=f"data/raw/pdf/{doc_id}.pdf",
            contentType="application/pdf",
            status="metadata_only",
            tags=[*(tags or []), "graph-drawing"],
            doi=doi,
        )

    # Dry runs must be deterministic and offline; metadata enrichment is optional.
    work = None if dry_run else _openalex_by_doi(doi)
    authors: list[str] = []
    title = f"DOI {doi}"
    year: int | None = None
    abstract: str | None = None
    if work:
        title = work.get("display_name") or title
        year = work.get("publication_year")
        abstract = _abstract_from_inverted_index(work.get("abstract_inverted_index"))
        authors = [
            a.get("author", {}).get("display_name", "")
            for a in work.get("authorships") or []
            if a.get("author", {}).get("display_name")
        ]

    doc_id = slug_id(f"doi-{doi}")
    item = ManifestItem(
        id=doc_id,
        title=title,
        authors=authors,
        year=year,
        source=source,
        url=f"https://doi.org/{doi}",
        localPath=f"data/raw/pdf/{doc_id}.pdf",
        contentType="application/pdf",
        status="metadata_only",
        tags=[*(tags or []), "graph-drawing"],
        doi=doi,
        abstract=abstract,
    )

    if dry_run:
        # Do not call Unpaywall/Semantic Scholar during a dry run.
        candidates = list(pdf_urls or [])
        if candidates:
            item.url = candidates[0]
            item.status = "failed"
        return item

    dest = PDF_DIR / f"{doc_id}.pdf"
    set_harvest_stage("doi-resolve")
    had_transient = False

    def _try_urls(urls: list[str]) -> bool:
        nonlocal had_transient
        failures = 0
        for url in urls[:_MAX_CANDIDATE_URLS]:
            insecure = any(h in url for h in ("infotech.monash.edu", "it.monash.edu", "marvl."))
            try:
                dl = download_to_file(
                    dest,
                    url,
                    verify=verify if not insecure else False,
                    expected_sha256=item.sha256,
                    doc_id=doc_id,
                    doi=doi,
                    stage="doi-resolve",
                )
                if dl.get("ok"):
                    item.status = "ok"
                    item.url = url
                    item.sha256 = dl.get("sha256")
                    item.localPath = relative_local_path(dest)
                    update_document(
                        doc_id,
                        final_status="ok",
                        winning_url=url,
                        last_outcome="ok",
                    )
                    return True
                if dl.get("transient"):
                    had_transient = True
                failures += 1
                dest.unlink(missing_ok=True)
                if failures >= _MAX_FAILED_URL_ATTEMPTS:
                    break
            except Exception:
                failures += 1
                dest.unlink(missing_ok=True)
                if failures >= _MAX_FAILED_URL_ATTEMPTS:
                    break
        return False

    if _try_urls(
        pick_pdf_urls(
            doi,
            work,
            pdf_urls,
            include_archive=False,
            include_paywall_guesses=include_paywall_guesses,
        )
    ):
        return item

    if include_archive and _try_urls(archive_pdf_urls(doi)):
        return item

    if had_transient and item.tags is not None and "rate_limited" not in item.tags:
        item.tags = [*item.tags, "rate_limited"]
    update_document(
        doc_id,
        final_status=item.status,
        last_outcome="rate_limited" if had_transient else item.status,
    )
    return item


def resolve_dois(
    dois: list[str],
    *,
    source: str = "doi-resolver",
    tags: list[str] | None = None,
    dry_run: bool = False,
    workers: int | None = None,
    include_archive: bool = False,
    on_batch: Callable[[list[ManifestItem]], None] | None = None,
    batch_size: int = 30,
) -> list[ManifestItem]:
    def _resolve(doi: str) -> ManifestItem:
        try:
            return resolve_doi_with_fallbacks(
                doi,
                source=source,
                tags=tags,
                dry_run=dry_run,
                include_archive=include_archive,
            )
        except Exception as exc:
            log.warning("DOI resolve failed for %s: %s", doi, exc)
            doc_id = slug_id(f"doi-{doi}")
            return ManifestItem(
                id=doc_id,
                title=f"DOI {doi}",
                authors=[],
                year=None,
                source=source,
                url=f"https://doi.org/{doi}",
                localPath=f"data/raw/pdf/{doc_id}.pdf",
                contentType="application/pdf",
                status="metadata_only",
                tags=[*(tags or []), "graph-drawing"],
                doi=doi,
            )

    if not dois:
        return []

    if on_batch is None or batch_size <= 0 or len(dois) <= batch_size:
        results = parallel_map(_resolve, dois, workers=workers, label="doi-resolve")
        if on_batch and results:
            on_batch(results)
        return results

    results: list[ManifestItem] = []
    for start in range(0, len(dois), batch_size):
        batch = dois[start : start + batch_size]
        batch_items = parallel_map(_resolve, batch, workers=workers, label="doi-resolve")
        results.extend(batch_items)
        if batch_items:
            on_batch(batch_items)
    return results


# Alias for bibliography module
resolve_dois_to_items = resolve_dois
