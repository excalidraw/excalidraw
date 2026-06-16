"""Harvest checkpoint for resume after interrupt."""

from __future__ import annotations

import json
from typing import Any

from rag_literature_rag.paths import HARVEST_CHECKPOINT_PATH

BIB_STAGES = frozenset(
    {
        "bibliography-scan",
        "bibliography-relevance",
        "bibliography-resolve",
        "bibliography",
    }
)

DISCOVERY_COMPLETE_STAGES = frozenset(
    {
        "semantic-scholar",
        "openalex-broad",
        *BIB_STAGES,
        "interrupted",
    }
)

RELEVANCE_CHECKPOINT_EVERY = 50
RESOLVE_BATCH_SIZE = 30


def save_checkpoint(data: dict[str, Any]) -> None:
    HARVEST_CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = HARVEST_CHECKPOINT_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    tmp.replace(HARVEST_CHECKPOINT_PATH)


def load_checkpoint() -> dict[str, Any] | None:
    if not HARVEST_CHECKPOINT_PATH.exists():
        return None
    try:
        return json.loads(HARVEST_CHECKPOINT_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def clear_checkpoint() -> None:
    HARVEST_CHECKPOINT_PATH.unlink(missing_ok=True)


def discovery_complete(stage: str | None) -> bool:
    return bool(stage and stage in DISCOVERY_COMPLETE_STAGES)


def load_bib_state(checkpoint: dict[str, Any] | None) -> dict[str, Any]:
    if not checkpoint:
        return {}
    bib = checkpoint.get("bibliography")
    return dict(bib) if isinstance(bib, dict) else {}


def merge_bib_state(patch: dict[str, Any]) -> dict[str, Any]:
    """Merge patch into checkpoint bibliography sub-state; return full checkpoint."""
    checkpoint = load_checkpoint() or {}
    bib = load_bib_state(checkpoint)
    bib.update(patch)
    checkpoint["bibliography"] = bib
    save_checkpoint(checkpoint)
    return checkpoint


def clear_bib_state() -> None:
    checkpoint = load_checkpoint()
    if not checkpoint or "bibliography" not in checkpoint:
        return
    checkpoint = dict(checkpoint)
    checkpoint.pop("bibliography", None)
    save_checkpoint(checkpoint)
