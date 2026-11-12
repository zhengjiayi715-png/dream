from dataclasses import dataclass
from threading import Lock
from time import monotonic

from app.core.errors import AppError, ErrorCode

DEFAULT_WINDOW_SECONDS = 60.0
_STALE_SECONDS = 600.0
_CLEANUP_THRESHOLD = 1024


@dataclass
class _Window:
    started_at: float
    count: int


class FixedWindowRateLimiter:
    """进程内固定窗口限流；与单 worker 部署一致，重启后计数清零。"""

    def __init__(self) -> None:
        self._lock = Lock()
        self._windows: dict[str, _Window] = {}

    def allow(self, key: str, limit: int, window_seconds: float) -> bool:
        now = monotonic()
        with self._lock:
            window = self._windows.get(key)
            if window is None or now - window.started_at >= window_seconds:
                self._windows[key] = _Window(started_at=now, count=1)
                self._remove_stale(now)
                return True
            if window.count >= limit:
                return False
            window.count += 1
            return True

    def reset(self) -> None:
        """清空所有计数，供测试使用。"""
        with self._lock:
            self._windows.clear()

    def _remove_stale(self, now: float) -> None:
        if len(self._windows) < _CLEANUP_THRESHOLD:
            return
        stale = [
            key for key, window in self._windows.items() if now - window.started_at > _STALE_SECONDS
        ]
        for key in stale:
            self._windows.pop(key, None)


rate_limiter = FixedWindowRateLimiter()


def check_rate_limit(
    scope: str,
    identity: str,
    limit: int,
    window_seconds: float = DEFAULT_WINDOW_SECONDS,
) -> None:
    """超限时抛出 4001，调用方无需关心计数细节。"""
    if not rate_limiter.allow(f"{scope}:{identity}", limit, window_seconds):
        raise AppError(ErrorCode.RATE_LIMITED, "操作过于频繁，请稍后再试")
