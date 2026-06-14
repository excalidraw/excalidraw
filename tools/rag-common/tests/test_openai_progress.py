from rag_common.openai_embed import _Progress


def test_progress_tracks_concurrency_and_throughput():
    progress = _Progress(total_batches=2, total_texts=4, estimated_tokens=1000)
    progress.started -= 30
    assert progress.start_batch() == 1
    assert progress.start_batch() == 2
    snapshot = progress.finish_batch(2, 500)

    assert snapshot["active"] == 1
    assert snapshot["peak_active"] == 2
    assert snapshot["completed_tokens"] == 500
    assert snapshot["cumulative_tpm"] > 900
