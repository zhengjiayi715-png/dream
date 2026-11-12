from typing import Any, Literal

from pydantic import BaseModel

RecordType = Literal["zodiac", "dream"]
HistoryFilter = Literal["all", "zodiac", "dream"]


class HistoryItem(BaseModel):
    id: int
    record_type: RecordType
    summary: str
    overall_rating: str | None
    meta: dict[str, str]
    created_at: str


class HistoryPage(BaseModel):
    items: list[HistoryItem]
    total: int
    page: int
    page_size: int


class HistoryDetailData(BaseModel):
    id: int
    record_type: RecordType
    summary: str
    constellation_code: str | None
    overall_rating: str | None
    risk_flag: int
    input: dict[str, Any]
    result: dict[str, Any]
    created_at: str
