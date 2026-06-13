from unittest.mock import patch

from graph_layout_rag.eval.hardware import MemorySnapshot, memory_abort_reason


def test_memory_abort_reason_detects_process_rss():
    snapshot = MemorySnapshot(available_gb=12, swap_used_gb=0, process_peak_rss_gb=0)
    with patch("graph_layout_rag.eval.hardware.process_rss_gb", return_value=11), patch(
        "graph_layout_rag.eval.hardware.memory_snapshot",
        return_value=snapshot,
    ):
        reason = memory_abort_reason(
            pid=1,
            start_swap_gb=0,
            max_process_rss_gb=10,
            min_available_gb=3,
            max_swap_growth_gb=2,
        )
    assert reason and "RSS" in reason


def test_memory_abort_reason_detects_swap_growth():
    snapshot = MemorySnapshot(available_gb=12, swap_used_gb=3, process_peak_rss_gb=0)
    with patch("graph_layout_rag.eval.hardware.process_rss_gb", return_value=1), patch(
        "graph_layout_rag.eval.hardware.memory_snapshot",
        return_value=snapshot,
    ):
        reason = memory_abort_reason(
            pid=1,
            start_swap_gb=0,
            max_process_rss_gb=10,
            min_available_gb=3,
            max_swap_growth_gb=2,
        )
    assert reason and "swap" in reason
