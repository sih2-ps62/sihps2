# OWNER: integration (Day 2-3)
# Brake on password guessing: too many failed sign-ins for the same account from the same address are refused for
# a short while. In-memory (per server process), which is right for a single-instance deployment; behind a proxy
# configure it to forward the real client address.
import os
import time
from collections import defaultdict, deque

MAX_FAILURES = int(os.getenv("POLAROPS_LOGIN_MAX_FAILURES", "5"))
WINDOW_SECONDS = int(os.getenv("POLAROPS_LOGIN_WINDOW_SECONDS", "60"))


class LoginThrottle:
    def __init__(self, max_failures: int = MAX_FAILURES, window: int = WINDOW_SECONDS):
        self.max_failures = max_failures
        self.window = window
        self._failures: dict[tuple, deque] = defaultdict(deque)

    def _recent(self, key: tuple, now: float) -> deque:
        failures = self._failures[key]
        while failures and now - failures[0] > self.window:
            failures.popleft()
        return failures

    def retry_after(self, key: tuple, now: float | None = None) -> int:
        """Seconds until another attempt is allowed; 0 when the caller may try."""
        now = time.monotonic() if now is None else now
        failures = self._recent(key, now)
        if len(failures) < self.max_failures:
            return 0
        return max(1, int(self.window - (now - failures[0])) + 1)

    def record_failure(self, key: tuple, now: float | None = None) -> None:
        now = time.monotonic() if now is None else now
        self._recent(key, now).append(now)

    def clear(self, key: tuple | None = None) -> None:
        if key is None:
            self._failures.clear()
        else:
            self._failures.pop(key, None)


login_throttle = LoginThrottle()
