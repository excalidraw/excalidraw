"""Shared request policies for harvest API providers."""

from __future__ import annotations

import os
import threading
import time
from collections import deque
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable

import httpx

from graph_layout_rag.harvest.log import get_logger
from graph_layout_rag.harvest.rate_limit import parse_retry_after


class OutcomeKind(str, Enum):
    SUCCESS = "success"
    TERMINAL_MISS = "terminal_miss"
    RETRYABLE_FAILURE = "retryable_failure"
    RATE_LIMITED = "rate_limited"
    BUDGET_EXHAUSTED = "budget_exhausted"


@dataclass(slots=True)
class RequestOutcome:
    kind: OutcomeKind
    data: Any = None
    status_code: int | None = None
    retry_after: int | None = None

    @property
    def complete(self) -> bool:
        return self.kind in {OutcomeKind.SUCCESS, OutcomeKind.TERMINAL_MISS}


@dataclass(slots=True)
class ProviderMetrics:
    started_at: float
    requests: int = 0
    successes: int = 0
    terminal_misses: int = 0
    retries: int = 0
    rate_limits: int = 0
    cooldown_seconds: float = 0.0
    active: int = 0
    peak_concurrency: int = 0
    budget_used_usd: float = 0.0
    budget_remaining_usd: float = 1.0


class ProviderPolicy:
    def __init__(
        self,
        name: str,
        *,
        concurrency: int,
        rps: float,
        max_attempts: int = 5,
        cooldown_seconds: float = 0.0,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.name = name
        self.concurrency = max(1, concurrency)
        self.rps = max(0.0, rps)
        self.max_attempts = max(1, max_attempts)
        self.cooldown_seconds = max(0.0, cooldown_seconds)
        self._clock = clock
        self._sleep = sleep
        self._semaphore = threading.BoundedSemaphore(self.concurrency)
        self._lock = threading.Lock()
        self._starts: deque[float] = deque()
        self._circuit_until = 0.0
        self.metrics = ProviderMetrics(started_at=clock())

    def _wait_for_slot(self) -> None:
        while True:
            with self._lock:
                now = self._clock()
                cooldown = max(0.0, self._circuit_until - now)
                while self._starts and self._starts[0] <= now - 1.0:
                    self._starts.popleft()
                rate_wait = 0.0
                if 0 < self.rps < 1 and self._starts:
                    rate_wait = max(0.0, (1.0 / self.rps) - (now - self._starts[-1]))
                elif self.rps and len(self._starts) >= self.rps:
                    rate_wait = max(0.0, 1.0 - (now - self._starts[0]))
                wait = max(cooldown, rate_wait)
                if wait <= 0:
                    self._starts.append(now)
                    return
            self._sleep(wait)

    def _open_circuit(self, seconds: float) -> None:
        if seconds <= 0:
            return
        with self._lock:
            now = self._clock()
            until = now + seconds
            if until > self._circuit_until:
                self.metrics.cooldown_seconds += until - max(now, self._circuit_until)
                self._circuit_until = until

    def _record_start(self) -> None:
        with self._lock:
            self.metrics.requests += 1
            self.metrics.active += 1
            self.metrics.peak_concurrency = max(
                self.metrics.peak_concurrency, self.metrics.active
            )

    def _record_end(self) -> None:
        with self._lock:
            self.metrics.active -= 1

    def request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        json: Any = None,
        timeout: float = 60.0,
        terminal_statuses: frozenset[int] = frozenset({404}),
        before_attempt: Callable[[], bool] | None = None,
    ) -> RequestOutcome:
        for attempt in range(self.max_attempts):
            if before_attempt is not None and not before_attempt():
                return RequestOutcome(OutcomeKind.BUDGET_EXHAUSTED)
            self._wait_for_slot()
            self._semaphore.acquire()
            self._record_start()
            try:
                try:
                    response = _client(self.name, timeout).request(
                        method, url, params=params, headers=headers, json=json
                    )
                except httpx.HTTPError:
                    response = None
            finally:
                self._record_end()
                self._semaphore.release()

            if response is None:
                outcome = RequestOutcome(OutcomeKind.RETRYABLE_FAILURE)
            elif 200 <= response.status_code < 300:
                try:
                    data = response.json()
                except Exception:
                    data = None
                with self._lock:
                    self.metrics.successes += 1
                return RequestOutcome(OutcomeKind.SUCCESS, data=data, status_code=response.status_code)
            elif response.status_code in terminal_statuses:
                with self._lock:
                    self.metrics.terminal_misses += 1
                return RequestOutcome(OutcomeKind.TERMINAL_MISS, status_code=response.status_code)
            elif response.status_code == 429:
                retry_after = parse_retry_after(dict(response.headers))
                with self._lock:
                    self.metrics.rate_limits += 1
                # Hard quota exhaustion (Retry-After in hours): bail immediately so workers
                # don't sleep for thousands of seconds or open a multi-hour circuit that
                # serializes every subsequent caller.  Callers get RATE_LIMITED and fall back.
                if retry_after and retry_after > 60:
                    return RequestOutcome(
                        OutcomeKind.RATE_LIMITED,
                        status_code=response.status_code,
                        retry_after=retry_after,
                    )
                self._open_circuit(float(retry_after or self.cooldown_seconds))
                outcome = RequestOutcome(
                    OutcomeKind.RATE_LIMITED,
                    status_code=response.status_code,
                    retry_after=retry_after,
                )
            elif response.status_code >= 500:
                outcome = RequestOutcome(
                    OutcomeKind.RETRYABLE_FAILURE, status_code=response.status_code
                )
            else:
                return RequestOutcome(
                    OutcomeKind.TERMINAL_MISS, status_code=response.status_code
                )

            if attempt < self.max_attempts - 1:
                with self._lock:
                    self.metrics.retries += 1
                self._sleep(outcome.retry_after or min(30.0, 2**attempt))
        return outcome

    def summary(self) -> dict[str, float | int | str]:
        with self._lock:
            elapsed = max(0.001, self._clock() - self.metrics.started_at)
            return {
                "provider": self.name,
                "requests": self.metrics.requests,
                "effective_rps": round(self.metrics.requests / elapsed, 2),
                "successes": self.metrics.successes,
                "terminal_misses": self.metrics.terminal_misses,
                "retries": self.metrics.retries,
                "429s": self.metrics.rate_limits,
                "cooldown_seconds": round(self.metrics.cooldown_seconds, 2),
                "peak_concurrency": self.metrics.peak_concurrency,
                "budget_used_usd": round(self.metrics.budget_used_usd, 6),
                "budget_remaining_usd": round(self.metrics.budget_remaining_usd, 6),
            }


class OpenAlexPolicy(ProviderPolicy):
    COSTS = {"singleton": 0.0, "list": 0.0001, "search": 0.001}

    def __init__(self, **kwargs: Any) -> None:
        super().__init__("openalex", **kwargs)
        self._daily_budget = _env_float("GRAPH_RAG_OPENALEX_FREE_BUDGET_USD", 1.0)
        self.metrics.budget_remaining_usd = self._daily_budget

    def reserve(self, operation: str) -> bool:
        cost = self.COSTS[operation]
        with self._lock:
            if cost > self.metrics.budget_remaining_usd + 1e-12:
                return False
            self.metrics.budget_used_usd += cost
            self.metrics.budget_remaining_usd -= cost
            return True

    def request_openalex(
        self,
        method: str,
        url: str,
        *,
        operation: str,
        params: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> RequestOutcome:
        params = dict(params or {})
        api_key = os.getenv("OPENALEX_API_KEY")
        if api_key:
            params["api_key"] = api_key
        return self.request(
            method,
            url,
            params=params,
            before_attempt=lambda: self.reserve(operation),
            **kwargs,
        )


_clients = threading.local()


def _client(provider: str, timeout: float) -> httpx.Client:
    clients = getattr(_clients, "clients", None)
    if clients is None:
        clients = {}
        _clients.clients = clients
    key = (provider, timeout)
    client = clients.get(key)
    if client is None:
        client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=16, max_keepalive_connections=8),
        )
        clients[key] = client
    return client


def _env_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return max(0.0, float(os.getenv(name, str(default))))
    except ValueError:
        return default


OPENALEX = OpenAlexPolicy(
    concurrency=_env_int("GRAPH_RAG_OPENALEX_CONCURRENCY", 32),
    rps=_env_float("GRAPH_RAG_OPENALEX_RPS", 100.0),
)
SEMANTIC_SCHOLAR = ProviderPolicy(
    "semantic-scholar",
    concurrency=_env_int("GRAPH_RAG_S2_CONCURRENCY", 32),
    rps=_env_float("GRAPH_RAG_S2_RPS", 1000.0),
    cooldown_seconds=_env_float("GRAPH_RAG_S2_COOLDOWN_SECONDS", 300.0),
)
CORE = ProviderPolicy(
    "core",
    concurrency=_env_int("GRAPH_RAG_CORE_CONCURRENCY", 2),
    rps=_env_float(
        "GRAPH_RAG_CORE_RPS",
        (25.0 if os.getenv("CORE_API_KEY") else 10.0) / 60.0,
    ),
    cooldown_seconds=60.0,
)


def log_provider_summaries() -> None:
    log = get_logger()
    for provider in (OPENALEX, SEMANTIC_SCHOLAR, CORE):
        log.info("provider summary: %s", provider.summary())
