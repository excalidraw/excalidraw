import threading
import time

from graph_layout_rag.harvest import parallel


def test_parallel_map_preserves_order():
    parallel.clear_stop()
    assert parallel.parallel_map(lambda value: value * 2, [3, 1, 2], workers=3) == [6, 2, 4]


def test_parallel_map_bounds_submitted_work_after_stop():
    parallel.clear_stop()
    started = 0
    lock = threading.Lock()

    def work(value):
        nonlocal started
        with lock:
            started += 1
        if value == 0:
            parallel.request_stop()
        time.sleep(0.01)
        return value

    try:
        parallel.parallel_map(work, list(range(100)), workers=4)
        assert started <= 8
    finally:
        parallel.clear_stop()
