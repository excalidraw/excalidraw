"""One-off: re-judge the curated (known-relevant) pool docs under the corrected
RAG-literature rubric and compare to the stale graph-drawing-rubric grades.

A correct fix should RAISE the curated grade>=2 rate (the judge stops penalizing
genuinely-relevant RAG papers it was mis-framing as graph-drawing off-topic).
Cheap: only curated pairs (~45), not the full 5k pool.
"""
from __future__ import annotations

import json

from rag_literature_rag.env import load_env_file
from rag_literature_rag.paths import DATA_DIR

load_env_file()

from rag_literature_rag.eval import judge  # noqa: E402  (after env load)

POOL = DATA_DIR / "eval" / "pool" / "catalog" / "pool.json"


def main() -> None:
    pool = json.loads(POOL.read_text())
    model = judge.judge_model()
    old_cache = judge._load_cache()

    curated = []  # (case_id, doc_id, query, doc)
    for cid, c in pool["cases"].items():
        for did, doc in c["pooled"].items():
            if doc.get("curated"):
                curated.append((cid, did, c["query"], doc))

    old_grades, new_grades = [], []
    for cid, did, query, doc in curated:
        old_key = f"{model}:{cid}:{did}"  # pre-fix key format
        old = old_cache.get(old_key, {}).get("grade")
        old_grades.append(int(old) if old is not None else None)
        grade, _reason = judge._judge_one(query, doc, model)
        new_grades.append(grade)

    def rate(gs):
        vals = [g for g in gs if g is not None]
        return round(sum(1 for g in vals if g >= 2) / len(vals), 3) if vals else None

    print(f"curated pairs judged: {len(curated)}")
    print(f"OLD (graph rubric) grade>=2 rate: {rate(old_grades)}")
    print(f"NEW (RAG rubric)   grade>=2 rate: {rate(new_grades)}")
    print(f"OLD mean: {round(sum(g for g in old_grades if g is not None)/max(1,len([g for g in old_grades if g is not None])),3)}")
    print(f"NEW mean: {round(sum(new_grades)/len(new_grades),3)}")
    flips = sum(1 for o, n in zip(old_grades, new_grades) if o is not None and o < 2 <= n)
    print(f"flipped <2 -> >=2 (recovered relevant): {flips}")


if __name__ == "__main__":
    main()
