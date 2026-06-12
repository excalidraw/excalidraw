from unittest.mock import patch

from graph_layout_rag.harvest.doi_resolver import (
    _arxiv_pdf_url,
    _openalex_has_oa_pdf,
    _pmc_pdf_urls,
    _plos_pdf_url,
    _springer_pdf_url,
    pick_pdf_urls,
    resolve_doi_with_fallbacks,
)


def test_springer_pdf_url():
    assert _springer_pdf_url("10.1007/3-540-45848-4_3") == (
        "https://link.springer.com/content/pdf/10.1007/3-540-45848-4_3.pdf"
    )
    assert _springer_pdf_url("10.1109/TVCG.2006.156") is None


def test_arxiv_pdf_url():
    assert _arxiv_pdf_url("10.48550/arXiv.2311.00533") == (
        "https://arxiv.org/pdf/2311.00533.pdf"
    )


def test_plos_pdf_url():
    assert _plos_pdf_url("10.1371/journal.pone.0025630") == (
        "https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0025630&type=printable"
    )


def test_pmc_pdf_urls_from_work():
    work = {
        "best_oa_location": {
            "landing_page_url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1234567/",
        }
    }
    urls = _pmc_pdf_urls("10.1371/journal.pone.0000001", work)
    assert any("PMC1234567/pdf" in u for u in urls)
    assert any("europepmc.org" in u for u in urls)


def test_openalex_has_oa_pdf():
    assert _openalex_has_oa_pdf({"best_oa_location": {"pdf_url": "https://x/a.pdf"}})
    assert not _openalex_has_oa_pdf(None)


def test_pick_pdf_urls_merges_sources():
    work = {
        "best_oa_location": {"pdf_url": "https://example.com/a.pdf"},
        "open_access": {"oa_url": "https://example.com/b.pdf"},
    }
    with patch("graph_layout_rag.harvest.doi_resolver._unpaywall_pdf") as unpaywall:
        with patch("graph_layout_rag.harvest.doi_resolver._semantic_scholar_pdf") as s2:
            urls = pick_pdf_urls(
                "10.1007/3-540-45848-4_3",
                work,
                ["https://example.com/extra.pdf"],
            )
    unpaywall.assert_not_called()
    s2.assert_not_called()
    assert urls[0] == "https://example.com/extra.pdf"
    assert "https://example.com/a.pdf" in urls
    assert any("springer.com" in u for u in urls)


def test_pick_pdf_urls_no_hal_or_paywall_by_default():
    with patch("graph_layout_rag.harvest.doi_resolver._unpaywall_pdf", return_value=[]):
        with patch("graph_layout_rag.harvest.doi_resolver._semantic_scholar_pdf", return_value=None):
            urls = pick_pdf_urls(
                "10.1109/TVCG.2006.156",
                None,
                include_paywall_guesses=False,
            )
    assert not any("hal.science" in u for u in urls)
    assert not any("ieeexplore.ieee.org" in u for u in urls)


def test_pick_pdf_urls_paywall_guesses_last():
    work = {"best_oa_location": {"pdf_url": "https://example.com/oa.pdf"}}
    with patch("graph_layout_rag.harvest.doi_resolver._unpaywall_pdf", return_value=[]):
        with patch("graph_layout_rag.harvest.doi_resolver._semantic_scholar_pdf", return_value=None):
            urls = pick_pdf_urls(
                "10.1145/1234567.1234567",
                work,
                include_paywall_guesses=True,
            )
    acm_idx = next(i for i, u in enumerate(urls) if "dl.acm.org" in u)
    oa_idx = urls.index("https://example.com/oa.pdf")
    assert oa_idx < acm_idx


def test_pick_pdf_urls_archive_only_when_requested():
    with patch(
        "graph_layout_rag.harvest.doi_resolver.archive_pdf_urls",
        return_value=["https://web.archive.org/web/2020/https://example.com/a.pdf"],
    ) as archive_mock:
        with patch("graph_layout_rag.harvest.doi_resolver._unpaywall_pdf", return_value=[]):
            with patch("graph_layout_rag.harvest.doi_resolver._semantic_scholar_pdf", return_value=None):
                urls = pick_pdf_urls("10.1145/1234567.1234567", None, include_archive=False)
    archive_mock.assert_not_called()
    assert not any("web.archive.org" in u for u in urls)

    with patch(
        "graph_layout_rag.harvest.doi_resolver.archive_pdf_urls",
        return_value=["https://web.archive.org/web/2020/https://example.com/a.pdf"],
    ):
        with patch("graph_layout_rag.harvest.doi_resolver._unpaywall_pdf", return_value=[]):
            with patch("graph_layout_rag.harvest.doi_resolver._semantic_scholar_pdf", return_value=None):
                urls = pick_pdf_urls("10.1145/1234567.1234567", None, include_archive=True)
    assert any("web.archive.org" in u for u in urls)


def test_resolve_skips_malformed_doi_without_openalex():
    with patch("graph_layout_rag.harvest.doi_resolver._openalex_by_doi") as openalex:
        item = resolve_doi_with_fallbacks("10.1007/s10502-020-", dry_run=True)
    openalex.assert_not_called()
    assert item.status == "metadata_only"
