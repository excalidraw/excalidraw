"""LLM relevance judging of the multi-system pool (UMBRELA-style).

Grades every (query, pooled-doc) pair on the UMBRELA 0-3 scale with a single
deterministic LLM call, **blind to which retriever surfaced the doc** (so the
judge can't favor a retrieval style). Produces a graded qrels file that
`qrels.apply_qrels_overlay` folds into the gold set.

Reference: Upadhyay/Thomas et al., *UMBRELA* (arXiv:2406.06519) — graded 0-3
prompting reaches Kendall τ > 0.87 vs human assessors on TREC DL and gives high
system-ranking correlation.

Concurrency + on-disk checkpointing mirror `ingest/contextual.py` so a full pool
(a few thousand judgments) is feasible and re-runs are cheap.
"""
from __future__ import annotations

import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from rag_literature_rag.paths import DATA_DIR

log = logging.getLogger("rag_literature_rag.eval.judge")

JUDGE_MODEL_ENV = "RAG_LIT_JUDGE_LLM_MODEL"
DEFAULT_JUDGE_MODEL = "gemini-3.1-pro-preview"
CACHE_PATH = DATA_DIR / "eval" / "judge_cache.json"
MAX_ABSTRACT_CHARS = 1500
MAX_EXCERPT_CHARS = 800

_RUBRIC = (
    "You are a relevance assessor for a graph-drawing / graph-layout literature "
    "search engine. Rate how well the DOCUMENT satisfies the information need "
    "behind the QUERY, on this 0-3 scale:\n"
    "  3 = Perfectly relevant: directly about the query's method/topic; a "
    "searcher wanting this query would want this document.\n"
    "  2 = Highly relevant: substantially on-topic and useful, even if not the "
    "single best match.\n"
    "  1 = Related: shares the broad area or some terminology but does not "
    "address the specific need.\n"
    "  0 = Irrelevant: different topic, or only incidental keyword overlap.\n"
    "Judge on substance, not keyword overlap. Reward conceptual/method matches "
    "even when wording differs; do not reward superficial term matches.\n"
    'Respond with ONLY a JSON object: {"grade": <0-3>, "reason": "<<=20 words>"}'
)


def judge_model() -> str:
    return os.getenv(JUDGE_MODEL_ENV, DEFAULT_JUDGE_MODEL).strip() or DEFAULT_JUDGE_MODEL


def _load_cache() -> dict[str, Any]:
    if not CACHE_PATH.is_file():
        return {}
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_cache(cache: dict[str, Any]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CACHE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, sort_keys=True), encoding="utf-8")
    os.replace(tmp, CACHE_PATH)


def build_judge_prompt(query: str, doc: dict[str, Any]) -> str:
    """Render the source-blind judging prompt for one (query, doc) pair.

    Intentionally omits which systems surfaced the doc and any retrieval score.
    """
    title = doc.get("title") or "(untitled)"
    abstract = (doc.get("abstract") or "")[:MAX_ABSTRACT_CHARS]
    excerpt = (doc.get("excerpt") or "")[:MAX_EXCERPT_CHARS]
    parts = [
        _RUBRIC,
        "",
        f"QUERY: {query}",
        "",
        f"DOCUMENT TITLE: {title}",
    ]
    if abstract:
        parts.append(f"ABSTRACT: {abstract}")
    if excerpt:
        parts.append(f"MATCHED PASSAGE: {excerpt}")
    if not abstract and not excerpt:
        parts.append("(No abstract or passage available; judge from the title.)")
    return "\n".join(parts)


def _parse_grade(text: str) -> tuple[int, str]:
    raw = (text or "").strip()
    # Prefer a JSON object if present.
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            obj = json.loads(match.group(0))
            grade = int(obj.get("grade"))
            reason = str(obj.get("reason", ""))[:200]
            return max(0, min(3, grade)), reason
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    # Fallback: first standalone 0-3 digit.
    digit = re.search(r"\b([0-3])\b", raw)
    if digit:
        return int(digit.group(1)), raw[:200]
    return 0, raw[:200]


def _judge_one(query: str, doc: dict[str, Any], model: str) -> tuple[int, str]:
    from rag_common.gemini_embed import _client, llm_location

    client = _client(location=llm_location())
    prompt = build_judge_prompt(query, doc)
    config: Any = None
    try:  # deterministic if the genai types are importable
        from google.genai import types

        config = types.GenerateContentConfig(temperature=0.0)
    except Exception:  # noqa: BLE001
        config = None
    if config is not None:
        response = client.models.generate_content(model=model, contents=prompt, config=config)
    else:
        response = client.models.generate_content(model=model, contents=prompt)
    return _parse_grade(getattr(response, "text", None) or "")


def _judge_workers() -> int:
    raw = os.getenv("RAG_LIT_JUDGE_WORKERS", "8").strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return 8


def judge_pool(pool: dict[str, Any], *, model: str | None = None) -> dict[str, Any]:
    """Grade every pooled (query, doc) pair → qrels ``cases`` mapping.

    Returns ``{case_id: {doc_id: {grade, reason, systems, curated}}}``.
    """
    model = model or judge_model()
    cache = _load_cache()

    # Flatten to (cache_key, case_id, doc_id, query, doc) work items. The cache
    # key omits the track: a (query, doc) relevance grade is track-independent,
    # so judging the pdf track reuses the catalog grades for shared (case, doc).
    work: list[tuple[str, str, str, str, dict[str, Any]]] = []
    for case_id, case in pool["cases"].items():
        query = case["query"]
        for doc_id, doc in case["pooled"].items():
            key = f"{model}:{case_id}:{doc_id}"
            work.append((key, case_id, doc_id, query, doc))

    misses = [w for w in work if w[0] not in cache]

    def _run(item: tuple[str, str, str, str, dict[str, Any]]) -> tuple[str, dict[str, Any]]:
        key, _case_id, _doc_id, query, doc = item
        try:
            grade, reason = _judge_one(query, doc, model)
        except Exception as exc:  # noqa: BLE001 — degrade to 0, keep going
            log.warning("judge failed for %s (%s)", key, exc)
            return key, {"grade": 0, "reason": f"judge_error: {exc}"[:200]}
        return key, {"grade": grade, "reason": reason}

    if misses:
        done = 0
        with ThreadPoolExecutor(max_workers=_judge_workers()) as pool_exec:
            for key, verdict in pool_exec.map(_run, misses):
                cache[key] = verdict
                done += 1
                if done % 200 == 0:
                    _save_cache(cache)
                    log.info("judged %d/%d", done, len(misses))
        _save_cache(cache)
        log.info("judged %d new (query, doc) pairs", len(misses))

    cases_out: dict[str, dict[str, dict[str, Any]]] = {}
    for key, case_id, doc_id, _query, doc in work:
        verdict = cache.get(key, {"grade": 0, "reason": ""})
        cases_out.setdefault(case_id, {})[doc_id] = {
            "grade": int(verdict.get("grade", 0)),
            "reason": verdict.get("reason", ""),
            "systems": sorted(doc.get("systems", {})),
            "curated": bool(doc.get("curated")),
        }
    return cases_out


def judge_agreement(cases_out: dict[str, dict[str, dict[str, Any]]]) -> dict[str, Any]:
    """Free quality check: how the judge graded the curated (known-relevant) docs.

    A well-calibrated judge should grade most curated docs >= 2. A low rate flags
    either judge miscalibration or genuinely mislabeled curated docs to review.
    """
    grades: list[int] = []
    for docs in cases_out.values():
        for verdict in docs.values():
            if verdict.get("curated"):
                grades.append(int(verdict.get("grade", 0)))
    if not grades:
        return {"curated_judged": 0}
    relevant = sum(1 for g in grades if g >= 2)
    return {
        "curated_judged": len(grades),
        "curated_grade>=2_rate": round(relevant / len(grades), 3),
        "curated_grade_mean": round(sum(grades) / len(grades), 3),
        "curated_grade_hist": {g: grades.count(g) for g in (0, 1, 2, 3)},
    }
