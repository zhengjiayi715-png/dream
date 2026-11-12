from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.responses import success
from app.core.security import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.services import history_service

router = APIRouter(prefix="/api/history", tags=["历史记录"])


@router.get("")
def list_history(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    record_type: Annotated[Literal["all", "zodiac", "dream"], Query(alias="type")] = "all",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
) -> dict[str, Any]:
    """返回本人历史列表，支持类型筛选与分页。"""
    data = history_service.list_history(db, current_user.id, record_type, page, page_size)
    return success(data.model_dump())


@router.get("/{id}")
def get_detail(
    id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    """返回本人记录快照；越权与不存在统一 1002。"""
    data = history_service.get_history_detail(db, current_user.id, id)
    return success(data.model_dump())
