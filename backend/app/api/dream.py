from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.rate_limit import DEFAULT_WINDOW_SECONDS, check_rate_limit
from app.core.responses import success
from app.core.security import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.schemas.dream import DreamAnalyzeRequest
from app.services import dream_service
from app.services.ai_client import AIClient, get_ai_client

router = APIRouter(prefix="/api/dream", tags=["周公解梦"])

DREAM_USER_LIMIT = 3


@router.post("/analyze")
def analyze(
    payload: DreamAnalyzeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    ai_client: Annotated[AIClient, Depends(get_ai_client)],
) -> dict[str, Any]:
    """生成梦境解读并落库；仅成功后返回结果。"""
    check_rate_limit("dream", str(current_user.id), DREAM_USER_LIMIT, DEFAULT_WINDOW_SECONDS)
    data = dream_service.analyze_dream(db, current_user, payload, ai_client)
    return success(data.model_dump())
