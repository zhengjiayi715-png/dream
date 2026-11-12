from datetime import UTC, datetime


def to_utc_iso(value: datetime | None) -> str | None:
    """把数据库中的 UTC 时间转成 ISO 8601 字符串（以 Z 结尾）。"""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
