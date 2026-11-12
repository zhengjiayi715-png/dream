from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.rate_limit import DEFAULT_WINDOW_SECONDS, check_rate_limit
from app.core.responses import success
from app.db.database import get_db
from app.schemas.auth import LoginRequest, RegisterData, RegisterRequest
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["认证"])

REGISTER_IP_LIMIT = 5
LOGIN_IP_LIMIT = 10


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/register")
def register(
    payload: RegisterRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    """注册账号；成功后不自动登录。"""
    check_rate_limit("register", _client_ip(request), REGISTER_IP_LIMIT, DEFAULT_WINDOW_SECONDS)
    user = auth_service.register_user(db, payload)
    return success(RegisterData(id=user.id, username=user.username).model_dump())


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    """用户名或邮箱登录，返回 7 天 JWT。"""
    check_rate_limit("login", _client_ip(request), LOGIN_IP_LIMIT, DEFAULT_WINDOW_SECONDS)
    data = auth_service.login_user(db, payload.account, payload.password)
    return success(data.model_dump())
