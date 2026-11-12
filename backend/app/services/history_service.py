import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.core.time_utils import to_utc_iso
from app.db.models import AnalysisRecord
from app.schemas.history import HistoryDetailData, HistoryItem, HistoryPage


def _load_input(record: AnalysisRecord) -> dict:
    return json.loads(record.input_json)


def _build_meta(record: AnalysisRecord, input_data: dict) -> dict[str, str]:
    if record.record_type == "zodiac":
        return {
            "birth_place": str(input_data.get("birth_place", "")),
            "focus_points": str(input_data.get("focus_points", "")),
        }
    return {
        "dream_time": str(input_data.get("dream_time", "")),
        "gender": str(input_data.get("gender", "")),
        "age_range": str(input_data.get("age_range", "")),
    }


def list_history(
    db: Session,
    user_id: int,
    record_type: str = "all",
    page: int = 1,
    page_size: int = 10,
) -> HistoryPage:
    """按登录用户查询历史列表，排序固定为创建时间、ID 倒序。"""
    conditions = [AnalysisRecord.user_id == user_id]
    if record_type != "all":
        conditions.append(AnalysisRecord.record_type == record_type)

    total = db.scalar(select(func.count()).select_from(AnalysisRecord).where(*conditions)) or 0
    records = db.scalars(
        select(AnalysisRecord)
        .where(*conditions)
        .order_by(AnalysisRecord.created_at.desc(), AnalysisRecord.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [
        HistoryItem(
            id=record.id,
            record_type=record.record_type,
            summary=record.summary,
            overall_rating=record.overall_rating,
            meta=_build_meta(record, _load_input(record)),
            created_at=to_utc_iso(record.created_at) or "",
        )
        for record in records
    ]
    return HistoryPage(items=items, total=total, page=page, page_size=page_size)


def get_history_detail(db: Session, user_id: int, record_id: int) -> HistoryDetailData:
    """查询本人记录详情；不存在与越权统一返回 1002。"""
    record = db.scalar(
        select(AnalysisRecord).where(
            AnalysisRecord.id == record_id,
            AnalysisRecord.user_id == user_id,
        )
    )
    if record is None:
        raise AppError(ErrorCode.NOT_FOUND, "记录不存在")

    return HistoryDetailData(
        id=record.id,
        record_type=record.record_type,
        summary=record.summary,
        constellation_code=record.constellation_code,
        overall_rating=record.overall_rating,
        risk_flag=record.risk_flag,
        input=_load_input(record),
        result=json.loads(record.result_json),
        created_at=to_utc_iso(record.created_at) or "",
    )
