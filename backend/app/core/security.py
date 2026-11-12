from datetime import UTC, datetime, timedelta
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, ErrorCode
from app.db.database import get_db
from app.db.models import User

# 固定占位哈希：账号不存在时也执行一次 bcrypt，避免响应耗时可被用于探测账号
_DUMMY_HASH = "$2b$12$uC8JRizQ1ws2zaWWJzkhHeUsgUxmhadFGfr4Vzj7ZtY9Rmljntjla"

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """使用 bcrypt 生成密码哈希。"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """校验密码；非法哈希或超长密码一律视为不匹配。"""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def verify_dummy_password(password: str) -> None:
    """用固定哈希做一次等价校验，保持账号不存在时的响应耗时。"""
    try:
        bcrypt.checkpw(password.encode("utf-8"), _DUMMY_HASH.encode("utf-8"))
    except ValueError:
        pass


def create_access_token(user_id: int, expires_delta: timedelta | None = None) -> str:
    """签发 HS256 JWT，默认有效期为配置的天数。"""
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(days=settings.jwt_expire_days))
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> int:
    """解析 token 并返回用户 ID；无效或过期统一返回 2001。"""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError:
        raise AppError(ErrorCode.UNAUTHORIZED, "未登录或登录态失效") from None
    try:
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise AppError(ErrorCode.UNAUTHORIZED, "未登录或登录态失效") from None


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """鉴权依赖：解析 Bearer token，加载用户并校验账号状态。"""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(ErrorCode.UNAUTHORIZED, "未登录或登录态失效")
    user = db.get(User, decode_access_token(credentials.credentials))
    if user is None:
        raise AppError(ErrorCode.UNAUTHORIZED, "未登录或登录态失效")
    if user.status == "disabled":
        raise AppError(ErrorCode.ACCOUNT_DISABLED, "账号已被禁用，请联系管理员")
    return user
