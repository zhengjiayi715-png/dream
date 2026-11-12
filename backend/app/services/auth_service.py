from dataclasses import dataclass
from datetime import datetime, timedelta
from threading import Lock

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, ErrorCode
from app.core.security import (
    create_access_token,
    hash_password,
    verify_dummy_password,
    verify_password,
)
from app.db.models import User, utc_now
from app.schemas.auth import LoginData, LoginUser, RegisterRequest

LOCK_THRESHOLD = 5
LOCK_MINUTES = 15
LOCK_MESSAGE = "登录失败次数过多，请 15 分钟后再试"
CREDENTIALS_MESSAGE = "用户名或密码错误"
DISABLED_MESSAGE = "账号已被禁用，请联系管理员"


@dataclass
class _ShadowState:
    failures: int = 0
    locked_until: datetime | None = None


class FailedLoginTracker:
    """记录不存在账号的失败次数；数据库无法保存这类账号的锁定状态。"""

    def __init__(self) -> None:
        self._lock = Lock()
        self._states: dict[str, _ShadowState] = {}

    def is_locked(self, account_norm: str, now: datetime) -> bool:
        with self._lock:
            state = self._states.get(account_norm)
            if state is None or state.locked_until is None:
                return False
            if state.locked_until > now:
                return True
            self._states.pop(account_norm, None)
            return False

    def record_failure(self, account_norm: str, now: datetime) -> None:
        with self._lock:
            state = self._states.setdefault(account_norm, _ShadowState())
            state.failures += 1
            if state.failures >= LOCK_THRESHOLD:
                state.locked_until = now + timedelta(minutes=LOCK_MINUTES)

    def clear(self, account_norm: str) -> None:
        with self._lock:
            self._states.pop(account_norm, None)

    def reset(self) -> None:
        """清空影子锁，供测试使用。"""
        with self._lock:
            self._states.clear()


failed_login_tracker = FailedLoginTracker()


def _find_by_username(db: Session, username_norm: str) -> User | None:
    return db.scalar(select(User).where(User.username_norm == username_norm))


def _find_by_email(db: Session, email_norm: str) -> User | None:
    return db.scalar(select(User).where(User.email_norm == email_norm))


def register_user(db: Session, payload: RegisterRequest) -> User:
    """注册新用户；唯一性忽略大小写，并发冲突由唯一索引兜底。"""
    username_norm = payload.username.lower()
    email_norm = payload.email.lower()

    if _find_by_username(db, username_norm) is not None:
        raise AppError(ErrorCode.USERNAME_EXISTS, "用户名已存在")
    if _find_by_email(db, email_norm) is not None:
        raise AppError(ErrorCode.EMAIL_EXISTS, "邮箱已被注册")

    now = utc_now()
    user = User(
        username=payload.username,
        username_norm=username_norm,
        email=payload.email,
        email_norm=email_norm,
        password_hash=hash_password(payload.password),
        status="active",
        terms_version=settings.terms_version,
        agreed_at=now,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if _find_by_username(db, username_norm) is not None:
            raise AppError(ErrorCode.USERNAME_EXISTS, "用户名已存在") from None
        if _find_by_email(db, email_norm) is not None:
            raise AppError(ErrorCode.EMAIL_EXISTS, "邮箱已被注册") from None
        raise
    db.refresh(user)
    return user


def login_user(db: Session, account: str, password: str) -> LoginData:
    """用户名或邮箱登录；连续失败 5 次锁定 15 分钟。"""
    account_norm = account.lower()
    now = utc_now()

    user = db.scalar(
        select(User).where(or_(User.username_norm == account_norm, User.email_norm == account_norm))
    )

    if user is None:
        if failed_login_tracker.is_locked(account_norm, now):
            raise AppError(ErrorCode.ACCOUNT_LOCKED, LOCK_MESSAGE)
        verify_dummy_password(password)
        failed_login_tracker.record_failure(account_norm, now)
        raise AppError(ErrorCode.LOGIN_FAILED, CREDENTIALS_MESSAGE)

    if user.locked_until is not None:
        if user.locked_until > now:
            raise AppError(ErrorCode.ACCOUNT_LOCKED, LOCK_MESSAGE)
        user.failed_login_count = 0
        user.locked_until = None

    if not verify_password(password, user.password_hash):
        user.failed_login_count += 1
        if user.failed_login_count >= LOCK_THRESHOLD:
            user.locked_until = now + timedelta(minutes=LOCK_MINUTES)
        db.commit()
        raise AppError(ErrorCode.LOGIN_FAILED, CREDENTIALS_MESSAGE)

    if user.status == "disabled":
        raise AppError(ErrorCode.ACCOUNT_DISABLED, DISABLED_MESSAGE)

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    db.commit()
    failed_login_tracker.clear(account_norm)

    return LoginData(
        token=create_access_token(user.id),
        expires_in=settings.jwt_expire_days * 24 * 60 * 60,
        user=LoginUser(id=user.id, username=user.username, email=user.email),
    )
