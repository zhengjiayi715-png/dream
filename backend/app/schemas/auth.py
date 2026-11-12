import re
from typing import Any

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, ValidationInfo, field_validator

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,20}$")
DIGITS_PATTERN = re.compile(r"^\d+$")


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    confirm_password: str
    agreed_terms: bool

    @field_validator("username", mode="before")
    @classmethod
    def _strip_username(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("username")
    @classmethod
    def _check_username(cls, value: str) -> str:
        if not USERNAME_PATTERN.fullmatch(value):
            raise ValueError("用户名需为 3–20 个字符，仅可包含字母、数字、下划线")
        if value.startswith("_"):
            raise ValueError("用户名不能以下划线开头")
        if DIGITS_PATTERN.fullmatch(value):
            raise ValueError("用户名不能为纯数字")
        return value

    @field_validator("email", mode="before")
    @classmethod
    def _strip_email(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        if len(value) > 254:
            raise ValueError("邮箱长度不能超过 254 个字符")
        try:
            validate_email(value, check_deliverability=False)
        except EmailNotValidError:
            raise ValueError("请输入正确的邮箱地址") from None
        return value

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        if not 6 <= len(value) <= 20 or any(char.isspace() for char in value):
            raise ValueError("密码需为 6–20 个字符，且不能包含空格")
        return value

    @field_validator("confirm_password")
    @classmethod
    def _check_confirm_password(cls, value: str, info: ValidationInfo) -> str:
        password = info.data.get("password")
        if password is not None and value != password:
            raise ValueError("密码不一致，请重新输入")
        return value

    @field_validator("agreed_terms")
    @classmethod
    def _check_agreed_terms(cls, value: bool) -> bool:
        if not value:
            raise ValueError("请阅读并同意《用户协议》和《隐私政策》")
        return value


class LoginRequest(BaseModel):
    account: str
    password: str

    @field_validator("account", mode="before")
    @classmethod
    def _strip_account(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("account")
    @classmethod
    def _check_account(cls, value: str) -> str:
        if not value:
            raise ValueError("请输入用户名或邮箱")
        if len(value) > 254:
            raise ValueError("账号长度不能超过 254 个字符")
        return value

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        if not value:
            raise ValueError("请输入密码")
        return value


class RegisterData(BaseModel):
    id: int
    username: str


class LoginUser(BaseModel):
    id: int
    username: str
    email: str


class LoginData(BaseModel):
    token: str
    token_type: str = "Bearer"
    expires_in: int
    user: LoginUser


class UserMeData(BaseModel):
    id: int
    username: str
    email: str
    status: str
    created_at: str
    last_login_at: str | None
