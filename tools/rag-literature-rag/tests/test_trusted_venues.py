from unittest.mock import MagicMock

from rag_literature_rag.harvest import trusted_venues


def test_harvest_trusted_venues_tags_and_source(monkeypatch):
    sample = MagicMock()
    sample.tags = ["openalex", "foundations"]
    sample.source = "openalex"
    monkeypatch.setattr(
        trusted_venues,
        "harvest_openalex",
        lambda **kwargs: [sample],
    )
    items = trusted_venues.harvest_trusted_venues(dry_run=True)
    assert len(items) == 1
    assert "trusted-venue" in items[0].tags
    assert items[0].source == "openalex"
