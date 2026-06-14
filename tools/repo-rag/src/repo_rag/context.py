from __future__ import annotations

from repo_rag.chunk.ast_ts import count_tokens
from repo_rag.graph import neighbors
from repo_rag.paths import REPO_ROOT
from repo_rag.query.search import search


def read_entity(entity: str) -> list[dict]:
    from repo_rag.graph import find_entities

    output = []
    for row in find_entities(entity):
        lines = (REPO_ROOT / row["file_path"]).read_text(encoding="utf-8", errors="replace").splitlines()
        start = max(0, row["start_line"] - 4)
        end = min(len(lines), row["start_line"] + 80)
        output.append({**row, "start_line": start + 1, "end_line": end, "text": "\n".join(lines[start:end])})
    return output


def assemble_context(task: str, budget: int = 6000) -> dict:
    seeds = search(task, top=12)
    candidates: list[dict] = []
    seen: set[str] = set()
    for seed in seeds:
        key = seed["file_path"]
        if key not in seen:
            candidates.append({**seed, "evidence": ["hybrid"]})
            seen.add(key)
        for row in neighbors(seed.get("symbol") or seed["file_path"], depth=1):
            if row["file_path"] not in seen:
                candidates.append({**row, "evidence": [f"graph:{row['type']}"]})
                seen.add(row["file_path"])
    items, used = [], 0
    for row in candidates:
        text = (REPO_ROOT / row["file_path"]).read_text(encoding="utf-8", errors="replace")
        tokens = count_tokens(text)
        if used + tokens > budget:
            continue
        items.append({**row, "text": text, "tokens": tokens})
        used += tokens
    return {"task": task, "budget": budget, "tokens": used, "items": items}
