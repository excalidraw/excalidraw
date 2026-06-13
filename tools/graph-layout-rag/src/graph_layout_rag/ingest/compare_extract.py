"""Side-by-side A/B of PDF extraction backends (quality + structure + timing + cost).

PyMuPDF-raw is always the fixed baseline (its hyphen-break count is the "before"); each
requested backend's clean extraction is measured against it. Run two or three backends
together (``--all``) for an in-depth pymupdf vs docling vs gemini comparison.
"""

from __future__ import annotations

import json
import os
import re
import time

import click

from graph_layout_rag.ingest.extract import PDF_BACKENDS, extract_pdf_result
from graph_layout_rag.manifest import load_manifest
from graph_layout_rag.paths import PKG_ROOT
from graph_layout_rag.pdf_text import _HYPHEN_BREAK

# A Markdown table row: starts/ends with a pipe and has an interior pipe (``| a | b |``).
_TABLE_ROW = re.compile(r"^\s*\|.*\|.*\|\s*$")
_HEADING = re.compile(r"^\s{0,3}#{1,6}\s")
_CLEAN_BACKENDS = tuple(b for b in PDF_BACKENDS)  # ("pymupdf", "docling", "gemini")


def _gemini_cost_per_mtok() -> float:
    try:
        return float(os.getenv("GRAPH_RAG_GEMINI_VISION_COST_PER_MTOK", "2.0"))
    except ValueError:
        return 2.0


def _join_pages(pages: list[tuple[int, str]]) -> str:
    return "\n\n".join(text for _no, text in pages)


def _nonascii_ratio(text: str) -> float:
    if not text:
        return 0.0
    return sum(1 for ch in text if ord(ch) > 127) / len(text)


def _count_lines(text: str, pattern: re.Pattern[str]) -> int:
    return sum(1 for line in text.splitlines() if pattern.match(line))


def _metrics(text: str) -> dict:
    return {
        "chars": len(text),
        "words": len(text.split()),
        "nonascii_ratio": round(_nonascii_ratio(text), 5),
        "hyphen_breaks_remaining": len(_HYPHEN_BREAK.findall(text)),
        "table_rows": _count_lines(text, _TABLE_ROW),
        "headings": _count_lines(text, _HEADING),
    }


def _run_backend(item, backend: str) -> dict:
    """Clean-extract with one backend; return metrics + timing + cost + text."""
    t0 = time.perf_counter()
    res = extract_pdf_result(item, clean=True, backend=backend)
    ms = (time.perf_counter() - t0) * 1000.0
    text = _join_pages(res.pages)
    row = _metrics(text)
    row.update(
        backend=backend,
        ms=round(ms, 1),
        open_error=res.open_error,
        pages=len(res.pages),
        tokens=getattr(res, "tokens", 0),
        est_cost=round(getattr(res, "tokens", 0) / 1_000_000 * _gemini_cost_per_mtok(), 4),
        _text=text,
    )
    return row


def _compare_one(item, *, backends: list[str]) -> dict:
    # PyMuPDF-raw baseline: the hyphen-break count here is the "before" all clean passes fix.
    raw = extract_pdf_result(item, clean=False, backend="pymupdf")
    raw_text = _join_pages(raw.pages)
    return {
        "doc_id": item.id,
        "title": item.title,
        "hyphen_breaks_baseline": len(_HYPHEN_BREAK.findall(raw_text)),
        "chars_raw": len(raw_text),
        "backends": [_run_backend(item, b) for b in backends],
    }


def _mean(rows: list[dict], backend: str, key: str) -> float:
    vals = [b[key] for r in rows for b in r["backends"] if b["backend"] == backend]
    return sum(vals) / len(vals) if vals else 0.0


@click.command("compare-extract", context_settings={"help_option_names": ["-h", "--help"]})
@click.option("--limit", default=0, show_default=True, type=int, help="Max docs (0 = all).")
@click.option(
    "--backend",
    "backends",
    type=click.Choice(list(_CLEAN_BACKENDS)),
    multiple=True,
    help="Backend(s) for the clean comparison; repeatable. "
    "Default: pymupdf + docling (no API cost). Add 'gemini' to include the vision backend.",
)
@click.option("--all", "all_backends", is_flag=True, help="Compare all backends (incl. gemini).")
@click.option("--show-diff", is_flag=True, help="Print a clean excerpt per backend for the first doc.")
@click.option("--json", "as_json", is_flag=True, help="JSON output.")
def compare_extract_cmd(
    limit: int, backends: tuple[str, ...], all_backends: bool, show_diff: bool, as_json: bool
) -> None:
    """Run extraction backends side by side and report quality + structure + timing + cost.

    'raw' is always PyMuPDF-raw (the hyphen-break baseline); each backend column is its
    clean extraction. ``--all`` (or ``--backend gemini``) includes the Gemini-vision
    backend, which makes one API call per page — use ``--limit`` to bound cost.
    """
    if all_backends:
        chosen = list(_CLEAN_BACKENDS)
    elif backends:
        # Preserve PDF_BACKENDS order, dedupe.
        chosen = [b for b in _CLEAN_BACKENDS if b in set(backends)]
    else:
        chosen = ["pymupdf", "docling"]

    manifest = load_manifest()
    ok_items = [i for i in manifest.items if i.status == "ok" and i.localPath]
    if limit > 0:
        ok_items = ok_items[:limit]

    rows: list[dict] = []
    for item in ok_items:
        if not (PKG_ROOT / item.localPath).is_file():
            continue
        rows.append(_compare_one(item, backends=chosen))

    if as_json:
        out = []
        for r in rows:
            out.append(
                {
                    **{k: v for k, v in r.items() if k != "backends"},
                    "backends": [
                        {k: v for k, v in b.items() if not k.startswith("_")}
                        for b in r["backends"]
                    ],
                }
            )
        click.echo(json.dumps(out, indent=2))
        return

    if not rows:
        click.echo("No PDFs to compare.")
        return

    n = len(rows)
    click.echo(
        f"Compared {n} PDF(s) across: {', '.join(chosen)} "
        f"(baseline: PyMuPDF-raw).\n"
    )
    for r in rows:
        click.echo(
            f"- {r['doc_id']}  {r['title'][:66]}  "
            f"(raw hyphen-breaks: {r['hyphen_breaks_baseline']})"
        )
        for b in r["backends"]:
            flag = f"  [open_error={b['open_error']}]" if b["open_error"] else ""
            cost = f" ${b['est_cost']:.4f}" if b["backend"] == "gemini" else ""
            click.echo(
                f"    {b['backend']:<8} chars {b['chars']:>7}  words {b['words']:>6}  "
                f"non-ascii {b['nonascii_ratio']:.4f}  hyph {b['hyphen_breaks_remaining']:>3}  "
                f"tbl {b['table_rows']:>3}  hdr {b['headings']:>3}  "
                f"{b['ms']:>7.0f}ms{cost}{flag}"
            )

    # Aggregate table: mean per metric per backend.
    click.echo("\n=== aggregate (mean per doc) ===")
    header = (
        f"{'backend':<8} {'chars':>8} {'words':>7} {'nonascii':>9} {'hyph':>5} "
        f"{'tbl':>5} {'hdr':>5} {'ms':>8} {'$/doc':>8}"
    )
    click.echo(header)
    for backend in chosen:
        click.echo(
            f"{backend:<8} "
            f"{_mean(rows, backend, 'chars'):>8.0f} "
            f"{_mean(rows, backend, 'words'):>7.0f} "
            f"{_mean(rows, backend, 'nonascii_ratio'):>9.4f} "
            f"{_mean(rows, backend, 'hyphen_breaks_remaining'):>5.1f} "
            f"{_mean(rows, backend, 'table_rows'):>5.1f} "
            f"{_mean(rows, backend, 'headings'):>5.1f} "
            f"{_mean(rows, backend, 'ms'):>8.0f} "
            f"{_mean(rows, backend, 'est_cost'):>8.4f}"
        )

    if show_diff and rows:
        r = rows[0]
        click.echo(f"\n=== diff sample: {r['doc_id']} (first 500 chars per backend) ===")
        for b in r["backends"]:
            click.echo(f"\n--- {b['backend']} ---")
            click.echo(b["_text"][:500])
