from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.rate_limit import DEFAULT_WINDOW_SECONDS, check_rate_limit
from app.core.responses import success
from app.core.security import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.schemas.zodiac import ZodiacAnalyzeRequest
from app.services import zodiac_service
from app.services.ai_client import AIClient, get_ai_client

router = APIRouter(prefix="/api/zodiac", tags=["星座分析"])

ZODIAC_USER_LIMIT = 3


@router.post("/analyze")
def analyze(
    payload: ZodiacAnalyzeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    ai_client: Annotated[AIClient, Depends(get_ai_client)],
) -> dict[str, Any]:
    """生成星座报告并落库；仅成功后返回结果。"""
    check_rate_limit("zodiac", str(current_user.id), ZODIAC_USER_LIMIT, DEFAULT_WINDOW_SECONDS)
    data = zodiac_service.analyze_zodiac(db, current_user, payload, ai_client)
    return success(data.model_dump())
