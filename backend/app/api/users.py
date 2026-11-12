from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.core.responses import success
from app.core.security import get_current_user
from app.core.time_utils import to_utc_iso
from app.db.models import User
from app.schemas.auth import UserMeData

router = APIRouter(prefix="/api/users", tags=["用户"])


@router.get("/me")
def read_me(current_user: Annotated[User, Depends(get_current_user)]) -> dict[str, Any]:
    """返回当前登录用户信息，不包含密码哈希。"""
    data = UserMeData(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        status=current_user.status,
        created_at=to_utc_iso(current_user.created_at) or "",
        last_login_at=to_utc_iso(current_user.last_login_at),
    )
    return success(data.model_dump())
