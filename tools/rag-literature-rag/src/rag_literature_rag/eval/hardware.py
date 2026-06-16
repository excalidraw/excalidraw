from __future__ import annotations

import os
import platform
import resource
import subprocess
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class MemorySnapshot:
    available_gb: float | None
    swap_used_gb: float | None
    process_peak_rss_gb: float

    def to_dict(self) -> dict[str, float | None]:
        return {
            "available_gb": self.available_gb,
            "swap_used_gb": self.swap_used_gb,
            "process_peak_rss_gb": self.process_peak_rss_gb,
        }


def _run_text(*command: str) -> str:
    try:
        return subprocess.check_output(command, text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def _available_memory_gb() -> float | None:
    if platform.system() != "Darwin":
        return None
    text = _run_text("memory_pressure")
    for line in text.splitlines():
        if line.startswith("System-wide memory free percentage:"):
            try:
                percent = float(line.rsplit(":", 1)[1].strip().rstrip("%"))
                total = int(_run_text("sysctl", "-n", "hw.memsize"))
                return round(total * percent / 100 / (1024**3), 3)
            except (ValueError, TypeError):
                return None
    return None


def _swap_used_gb() -> float | None:
    if platform.system() != "Darwin":
        return None
    text = _run_text("sysctl", "-n", "vm.swapusage")
    for part in text.split():
        if part.startswith("used"):
            continue
    try:
        used = text.split("used =", 1)[1].split("M", 1)[0].strip()
        return round(float(used) / 1024, 3)
    except (IndexError, ValueError):
        return None


def memory_snapshot() -> MemorySnapshot:
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak_gb = peak / (1024**3) if platform.system() == "Darwin" else peak / (1024**2)
    return MemorySnapshot(
        available_gb=_available_memory_gb(),
        swap_used_gb=_swap_used_gb(),
        process_peak_rss_gb=round(peak_gb, 3),
    )


def process_rss_gb(pid: int) -> float | None:
    text = _run_text("ps", "-o", "rss=", "-p", str(pid))
    try:
        return round(float(text.strip()) / 1024 / 1024, 3)
    except ValueError:
        return None


def memory_abort_reason(
    *,
    pid: int,
    start_swap_gb: float | None,
    max_process_rss_gb: float,
    min_available_gb: float,
    max_swap_growth_gb: float,
) -> str | None:
    rss = process_rss_gb(pid)
    snapshot = memory_snapshot()
    if rss is not None and rss > max_process_rss_gb:
        return f"process RSS {rss:.2f} GB exceeded {max_process_rss_gb:.2f} GB"
    if snapshot.available_gb is not None and snapshot.available_gb < min_available_gb:
        return f"available memory {snapshot.available_gb:.2f} GB fell below {min_available_gb:.2f} GB"
    if (
        start_swap_gb is not None
        and snapshot.swap_used_gb is not None
        and snapshot.swap_used_gb - start_swap_gb > max_swap_growth_gb
    ):
        return (
            f"swap grew by {snapshot.swap_used_gb - start_swap_gb:.2f} GB, "
            f"exceeding {max_swap_growth_gb:.2f} GB"
        )
    return None


def assert_memory_start_safe(min_available_gb: float) -> MemorySnapshot:
    snapshot = memory_snapshot()
    if snapshot.available_gb is not None and snapshot.available_gb < min_available_gb:
        raise RuntimeError(
            f"available memory {snapshot.available_gb:.2f} GB is below "
            f"required {min_available_gb:.2f} GB"
        )
    if os.getenv("RAG_LIT_ALLOW_INGEST_DURING_EVAL", "").lower() not in ("1", "true", "yes"):
        ingest = _run_text("pgrep", "-f", "rag-literature-rag ingest")
        if ingest:
            raise RuntimeError("rag-literature-rag ingest is running; stop it before benchmarking")
    return snapshot
