"""Small in-process rate limits for a single self-hosted deployment."""

from collections import deque
import time


class SlidingWindowRateLimiter:
    """Track a bounded number of attempts per key without external services."""

    def __init__(self, *, limit: int, window_seconds: int):
        self.limit = limit
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque[float]] = {}

    def _recent_attempts(self, key: str, now: float) -> deque[float]:
        attempts = self._attempts.setdefault(key, deque())
        cutoff = now - self.window_seconds
        while attempts and attempts[0] <= cutoff:
            attempts.popleft()
        if not attempts:
            self._attempts.pop(key, None)
            attempts = self._attempts.setdefault(key, deque())
        return attempts

    def is_allowed(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        return len(self._recent_attempts(key, now)) < self.limit

    def record_failure(self, key: str, now: float | None = None) -> None:
        now = time.monotonic() if now is None else now
        self._recent_attempts(key, now).append(now)

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)
