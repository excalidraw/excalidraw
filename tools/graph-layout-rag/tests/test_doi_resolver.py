from graph_layout_rag.harvest.doi_resolver import (
    _arxiv_pdf_url,
    _pmc_pdf_urls,
    _plos_pdf_url,
    _springer_pdf_url,
    pick_pdf_urls,
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


def test_pick_pdf_urls_merges_sources():
    work = {
        "best_oa_location": {"pdf_url": "https://example.com/a.pdf"},
        "open_access": {"oa_url": "https://example.com/b.pdf"},
    }
    urls = pick_pdf_urls(
        "10.1007/3-540-45848-4_3",
        work,
        ["https://example.com/extra.pdf"],
    )
    assert urls[0] == "https://example.com/extra.pdf"
    assert "https://example.com/a.pdf" in urls
    assert any("springer.com" in u for u in urls)
