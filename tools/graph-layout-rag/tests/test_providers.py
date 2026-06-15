from graph_layout_rag.harvest.providers import OpenAlexPolicy, OutcomeKind, ProviderPolicy


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def clock(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def test_openalex_free_budget_reservation_stops_metered_but_not_singletons():
    policy = OpenAlexPolicy(concurrency=1, rps=100, clock=lambda: 0.0, sleep=lambda _: None)
    policy._daily_budget = 0.001
    policy.metrics.budget_remaining_usd = 0.001
    assert policy.reserve("search")
    assert not policy.reserve("list")
    assert policy.reserve("singleton")


def test_provider_circuit_waits_then_resets():
    clock = FakeClock()
    policy = ProviderPolicy(
        "test", concurrency=1, rps=0, cooldown_seconds=5, clock=clock.clock, sleep=clock.sleep
    )
    policy._open_circuit(5)
    policy._wait_for_slot()
    assert clock.now == 5
    assert policy.metrics.cooldown_seconds == 5


def test_sub_one_rps_policy_paces_requests():
    clock = FakeClock()
    policy = ProviderPolicy(
        "slow", concurrency=1, rps=10 / 60, clock=clock.clock, sleep=clock.sleep
    )
    policy._wait_for_slot()
    policy._wait_for_slot()
    assert clock.now == 6
