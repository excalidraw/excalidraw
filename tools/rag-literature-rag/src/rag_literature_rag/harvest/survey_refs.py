"""Bibliography extraction from survey PDFs is handled by the main bibliography pass."""

from __future__ import annotations

from rag_literature_rag.manifest import ManifestItem


def harvest_survey_refs(**_kwargs) -> list[ManifestItem]:
    """No-op — ``harvest/run.py`` bibliography pass scans topic-seed and survey PDFs."""
    return []
