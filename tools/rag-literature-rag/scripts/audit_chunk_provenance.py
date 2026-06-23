"""Chunk provenance audit: what fraction of production TextChunks are recoverable
verbatim from raw page text?

Determines whether a char-offset-based late-chunking approach is viable.

Decision thresholds:
  >= 80% EXACT_SINGLE_PAGE  → OFFSET_TRACKING_VIABLE
  <  50% EXACT_SINGLE_PAGE  → BLOCK_LEVEL_REDESIGN_NEEDED
  between 50-80%             → BORDERLINE (manual review)

Usage:
  uv run python3 scripts/audit_chunk_provenance.py [--sample N] [--all]
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import random
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
EXTRACT_CACHE = DATA / "extract_cache"
PAGE_CACHE_DIR = EXTRACT_CACHE / "pages"

# Observed options used during ingest (from inspecting page cache files)
DOCLING_OPTIONS = {"ocr": "0", "tables": "1"}


def _page_cache_path(sha256: str, backend: str = "docling") -> Path:
    option_fingerprint = json.dumps(DOCLING_OPTIONS, sort_keys=True, separators=(",", ":"))
    raw = f"pages-v1:{backend}:clean=1:{option_fingerprint}:{sha256}"
    key = hashlib.sha256(raw.encode()).hexdigest()
    return PAGE_CACHE_DIR / key[:2] / f"{key}.json"


def load_page_cache(sha256: str) -> dict[int, str] | None:
    """Return {page_num: text} or None if not cached."""
    path = _page_cache_path(sha256)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {int(p["page"]): p["text"] for p in data["pages"]}
    except Exception:
        return None


def classify_chunk(chunk_text: str, page: int, page_end: int, pages: dict[int, str]) -> dict:
    """Classify a chunk's recoverability from raw page text."""
    cross_page = page_end > page

    # Check if chunk.text is a verbatim contiguous substring of any single page
    for pg in range(page, page_end + 1):
        if pg in pages and chunk_text in pages[pg]:
            return {
                "category": "EXACT_SINGLE_PAGE",
                "cross_page": cross_page,
                "found_page": pg,
            }

    # Check if recoverable by concatenating all pages in the span
    if cross_page:
        # Try concatenating adjacent pages with various separators
        for sep in ["\n\n", "\n", ""]:
            combined = sep.join(pages.get(pg, "") for pg in range(page, page_end + 1))
            if chunk_text in combined:
                return {
                    "category": "EXACT_MULTI_PAGE",
                    "cross_page": True,
                    "separator": repr(sep),
                }

    return {
        "category": "NOT_RECOVERABLE",
        "cross_page": cross_page,
    }


def detect_synthetic_markers(chunk_text: str) -> list[str]:
    """Flag synthetic assembly artifacts in the chunk text."""
    markers = []
    lines = chunk_text.splitlines()

    # Table header repeat: first non-empty line appears again later
    for i, line in enumerate(lines):
        if line.strip() and line.startswith("|"):
            later = [l for l in lines[i + 1 :] if l.strip() and l == line]
            if later:
                markers.append("TABLE_HEADER_REPEAT")
                break

    # Double-newline join: \n\n separating different markdown sections
    # (heuristic: multiple distinct section headings OR blank-line-separated prose blocks)
    if "\n\n" in chunk_text:
        # Count how many distinct blocks (paragraphs / headings) are separated by \n\n
        blocks = [b.strip() for b in chunk_text.split("\n\n") if b.strip()]
        if len(blocks) >= 2:
            # Are the blocks from different parts? Check if headings exist mid-chunk
            headings_mid = sum(
                1 for b in blocks[1:]
                if b.startswith("#") or (len(b.splitlines()) > 1 and b.splitlines()[0].startswith("#"))
            )
            if headings_mid > 0 or len(blocks) >= 3:
                markers.append("DOUBLE_NEWLINE_JOIN")

    return markers


def sample_chunk_cache_files(sample_n: int, all_files: bool = False) -> list[Path]:
    """Sample chunk cache files (not the pages sub-cache), deduplicated by sha256."""
    all_chunk_files = [
        Path(p)
        for p in glob.glob(str(EXTRACT_CACHE / "**" / "*.json"), recursive=True)
        if "/pages/" not in p
    ]
    print(f"Found {len(all_chunk_files)} chunk cache files")

    if all_files:
        return all_chunk_files

    # Shuffle and take a sample; we'll deduplicate by sha256 as we process
    random.shuffle(all_chunk_files)
    return all_chunk_files[:max(sample_n * 3, 500)]  # oversample then dedup


def run_audit(sample_n: int = 300, all_files: bool = False) -> dict:
    files = sample_chunk_cache_files(sample_n, all_files)

    seen_sha256: set[str] = set()
    counts = defaultdict(int)
    synthetic_counts = defaultdict(int)
    examples: dict[str, list[dict]] = defaultdict(list)

    docs_processed = 0
    chunks_processed = 0
    page_cache_misses = 0

    for cache_file in files:
        if docs_processed >= sample_n and not all_files:
            break

        try:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            continue

        sha256 = data.get("sha256", "")
        if not sha256 or sha256 in seen_sha256:
            continue
        seen_sha256.add(sha256)

        pages = load_page_cache(sha256)
        if pages is None:
            page_cache_misses += 1
            continue

        chunks = data.get("chunks", [])
        if not chunks:
            continue

        docs_processed += 1

        for chunk in chunks:
            text = chunk.get("text", "")
            page = chunk.get("page", 1)
            page_end = chunk.get("page_end", page)

            if not text:
                continue

            result = classify_chunk(text, page, page_end, pages)
            category = result["category"]
            counts[category] += 1
            chunks_processed += 1

            # Synthetic markers
            markers = detect_synthetic_markers(text)
            for m in markers:
                synthetic_counts[m] += 1

            # Collect examples (up to 3 per category)
            if len(examples[category]) < 3:
                examples[category].append({
                    "text_preview": text[:150].replace("\n", "\\n"),
                    "page": page,
                    "page_end": page_end,
                    "detail": result,
                    "markers": markers,
                    "doc_sha256": sha256[:12],
                })

    return {
        "docs_processed": docs_processed,
        "chunks_processed": chunks_processed,
        "page_cache_misses": page_cache_misses,
        "counts": dict(counts),
        "synthetic_counts": dict(synthetic_counts),
        "examples": dict(examples),
    }


def verdict(counts: dict) -> str:
    total = sum(counts.values())
    if total == 0:
        return "NO_DATA"
    exact_single_pct = counts.get("EXACT_SINGLE_PAGE", 0) / total * 100
    if exact_single_pct >= 80:
        return f"OFFSET_TRACKING_VIABLE ({exact_single_pct:.1f}% exact-single-page)"
    if exact_single_pct < 50:
        return f"BLOCK_LEVEL_REDESIGN_NEEDED ({exact_single_pct:.1f}% exact-single-page)"
    return f"BORDERLINE — manual review needed ({exact_single_pct:.1f}% exact-single-page)"


def main() -> None:
    parser = argparse.ArgumentParser(description="Chunk provenance audit")
    parser.add_argument("--sample", type=int, default=300, help="Number of unique documents to sample")
    parser.add_argument("--all", action="store_true", help="Process all chunk cache files (slow)")
    args = parser.parse_args()

    random.seed(42)

    print(f"Auditing chunk provenance — sampling {args.sample} documents...")
    print()

    result = run_audit(sample_n=args.sample, all_files=args.all)

    counts = result["counts"]
    total = result["chunks_processed"]
    docs = result["docs_processed"]

    print(f"=== CHUNK PROVENANCE AUDIT RESULTS ===")
    print(f"Documents processed: {docs}")
    print(f"Chunks processed:    {total}")
    print(f"Page cache misses:   {result['page_cache_misses']}")
    print()

    print("--- Classification ---")
    categories = ["EXACT_SINGLE_PAGE", "EXACT_MULTI_PAGE", "NOT_RECOVERABLE"]
    for cat in categories:
        n = counts.get(cat, 0)
        pct = n / total * 100 if total else 0
        print(f"  {cat:<25} {n:>6} ({pct:5.1f}%)")
    print()

    cross_page = sum(
        1 for examples_list in result["examples"].values()
        for ex in examples_list
        if ex["detail"].get("cross_page")
    )
    print("--- Synthetic Markers (may overlap) ---")
    for marker, n in result["synthetic_counts"].items():
        pct = n / total * 100 if total else 0
        print(f"  {marker:<30} {n:>6} ({pct:5.1f}%)")
    print()

    print("--- Examples ---")
    for cat in categories:
        exs = result["examples"].get(cat, [])
        print(f"\n  {cat}:")
        for ex in exs:
            print(f"    doc={ex['doc_sha256']} page={ex['page']}-{ex['page_end']} markers={ex['markers']}")
            print(f"    text: {ex['text_preview']!r}")
    print()

    v = verdict(counts)
    print(f"=== VERDICT: {v} ===")
    print()

    exact_pct = counts.get("EXACT_SINGLE_PAGE", 0) / total * 100 if total else 0
    print("Implication for Track B (late-chunking) implementation:")
    if "OFFSET_TRACKING_VIABLE" in v:
        print("  Per-page char-offset approach is viable for the majority of chunks.")
        print("  Proceed with B3 implementation: track start_char/end_char in TextChunk,")
        print("  add None-span fallback (pooled embed + warning) for NOT_RECOVERABLE chunks.")
    elif "BLOCK_LEVEL_REDESIGN_NEEDED" in v:
        print("  Offset tracking is not viable — too many synthetic assemblies.")
        print("  Block-level redesign needed: embed each StructuralBlock before _split_block")
        print("  mangles it, pool block embeddings into chunk vectors post-assembly.")
        print("  This is a separate, deeper plan (~3-4 days); late-chunking deferred.")
    else:
        print("  Borderline result — review NOT_RECOVERABLE examples before deciding.")
        print("  Consider whether the unrecoverable chunks are systematically different")
        print("  (e.g. all tables) or distributed across doc types.")


if __name__ == "__main__":
    main()
