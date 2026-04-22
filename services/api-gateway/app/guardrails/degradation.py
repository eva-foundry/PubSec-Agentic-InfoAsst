from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import StrEnum


class DependencyStatus(StrEnum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"


@dataclass
class CircuitBreaker:
    """Tracks health of a single dependency with circuit-breaker semantics."""

    name: str
    failure_threshold: int = 5
    reset_timeout_seconds: int = 60

    _failure_count: int = field(default=0, init=False, repr=False)
    _last_failure: datetime | None = field(default=None, init=False, repr=False)
    _state: DependencyStatus = field(default=DependencyStatus.HEALTHY, init=False, repr=False)

    def record_success(self) -> None:
        """Record a successful call — reset failure count and state."""
        self._failure_count = 0
        self._last_failure = None
        self._state = DependencyStatus.HEALTHY

    def record_failure(self) -> None:
        """Record a failed call — increment count and potentially trip breaker."""
        self._failure_count += 1
        self._last_failure = datetime.now(UTC)

        if self._failure_count >= self.failure_threshold:
            self._state = DependencyStatus.DOWN
        elif self._failure_count >= (self.failure_threshold // 2) or self._failure_count >= 1:
            # Any failure puts us in degraded; threshold trips to down
            self._state = DependencyStatus.DEGRADED

    @property
    def status(self) -> DependencyStatus:
        """Current status, accounting for reset timeout."""
        if self._state == DependencyStatus.DOWN and self._last_failure is not None:
            elapsed = datetime.now(UTC) - self._last_failure
            if elapsed > timedelta(seconds=self.reset_timeout_seconds):
                # Half-open: allow retry — move to degraded
                self._state = DependencyStatus.DEGRADED
        return self._state

    @property
    def is_open(self) -> bool:
        """True when the breaker is open (dependency is DOWN)."""
        return self.status == DependencyStatus.DOWN


class DegradationManager:
    """Manages graceful degradation across multiple dependencies."""

    def __init__(self) -> None:
        self.breakers: dict[str, CircuitBreaker] = {}

    def register(
        self,
        name: str,
        failure_threshold: int = 5,
        reset_timeout: int = 60,
    ) -> None:
        self.breakers[name] = CircuitBreaker(
            name=name,
            failure_threshold=failure_threshold,
            reset_timeout_seconds=reset_timeout,
        )

    def record_success(self, name: str) -> None:
        if name in self.breakers:
            self.breakers[name].record_success()

    def record_failure(self, name: str) -> None:
        if name in self.breakers:
            self.breakers[name].record_failure()

    def get_status(self, name: str) -> DependencyStatus:
        if name not in self.breakers:
            return DependencyStatus.HEALTHY
        return self.breakers[name].status

    def get_all_statuses(self) -> dict[str, DependencyStatus]:
        return {name: breaker.status for name, breaker in self.breakers.items()}

    def get_degradation_notice(self) -> str | None:
        """Returns a user-facing notice if any dependency is degraded or down."""
        degraded = [
            name
            for name, breaker in self.breakers.items()
            if breaker.status in (DependencyStatus.DEGRADED, DependencyStatus.DOWN)
        ]
        if not degraded:
            return None

        return (
            "Some services are currently experiencing issues: "
            + ", ".join(degraded)
            + ". Responses may be limited or delayed."
        )

    def get_fallback_tier(self) -> str:
        """Determine current fallback tier based on dependency health.

        - All healthy -> ``"full-rag"``
        - Search down -> ``"partial-rag-disclosure"``
        - Model down -> ``"cached-response"``
        - All down -> ``"cannot-answer"``
        """
        statuses = self.get_all_statuses()
        if not statuses:
            return "full-rag"

        search_down = statuses.get("search") == DependencyStatus.DOWN
        model_down = (
            statuses.get("model") == DependencyStatus.DOWN
            or statuses.get("openai") == DependencyStatus.DOWN
        )

        if search_down and model_down:
            return "cannot-answer"
        if model_down:
            return "cached-response"
        if search_down:
            return "partial-rag-disclosure"

        # Check if everything is healthy
        all_healthy = all(s == DependencyStatus.HEALTHY for s in statuses.values())
        if all_healthy:
            return "full-rag"

        # Some degraded but not down
        return "full-rag"
