"""DOI shape checks for bibliography harvest (drop PDF-extraction garbage)."""

from __future__ import annotations

import re

_DOI_RE = re.compile(r"^10\.\d{4,9}/[-._;()/:a-z0-9]+$", re.IGNORECASE)

# Prefixes that bibliography extraction often pulls from unrelated citations.
_BIB_DOI_BLOCKLIST_PREFIXES = (
    "10.1029/",  # AGU / Wiley geophysics — not graph layout
)


def is_well_formed_doi(doi: str) -> bool:
    """Reject truncated or PDF-artifact DOIs from reference extraction."""
    d = (doi or "").strip().lower()
    if len(d) < 9 or "/" not in d:
        return False
    if not _DOI_RE.match(d):
        return False
    suffix = d.split("/", 1)[1]
    if len(suffix) < 4:
        return False
    if suffix.endswith((".pdf", "-", ".", "_")):
        return False
    if re.search(r"-\.?$", suffix):
        return False
    return True


def is_plausible_bibliography_doi(doi: str) -> bool:
    if not is_well_formed_doi(doi):
        return False
    d = doi.lower()
    return not any(d.startswith(p) for p in _BIB_DOI_BLOCKLIST_PREFIXES)


def filter_plausible_bibliography_dois(dois: list[str]) -> list[str]:
    return [d for d in dois if is_plausible_bibliography_doi(d)]
