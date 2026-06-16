from rag_literature_rag.harvest.doi_validate import (
    filter_plausible_bibliography_dois,
    is_plausible_bibliography_doi,
    is_well_formed_doi,
)


def test_well_formed_doi_accepts_layout_papers():
    assert is_well_formed_doi("10.1007/3-540-45848-4_3")
    assert is_well_formed_doi("10.1145/1234567.1234567")


def test_well_formed_doi_rejects_truncated():
    assert not is_well_formed_doi("10.1007/s10502-020-")
    assert not is_well_formed_doi("10.1007/s10502-020-.pdf")
    assert not is_well_formed_doi("10.1007/")


def test_plausible_bibliography_doi_blocks_geophysics_prefix():
    assert not is_plausible_bibliography_doi("10.1029/2002jd002347")
    assert is_plausible_bibliography_doi("10.1007/3-540-45848-4_3")


def test_filter_plausible_bibliography_dois():
    raw = [
        "10.1007/3-540-45848-4_3",
        "10.1029/2002jd002347",
        "10.1007/s10502-020-",
    ]
    assert filter_plausible_bibliography_dois(raw) == ["10.1007/3-540-45848-4_3"]
