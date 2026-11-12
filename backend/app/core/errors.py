import logging
from enum import IntEnum
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.responses import fail

logger = logging.getLogger(__name__)


class ErrorCode(IntEnum):
    VALIDATION = 1001
    NOT_FOUND = 1002
    UNAUTHORIZED = 2001
    LOGIN_FAILED = 2002
    ACCOUNT_DISABLED = 2003
    ACCOUNT_LOCKED = 2004
    USERNAME_EXISTS = 2005
    EMAIL_EXISTS = 2006
    RATE_LIMITED = 4001
    AI_FAILED = 5001
    AI_TIMEOUT = 5002
    SERVER_ERROR = 5003


DEFAULT_HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.VALIDATION: 400,
    ErrorCode.NOT_FOUND: 404,
    ErrorCode.UNAUTHORIZED: 401,
    ErrorCode.LOGIN_FAILED: 401,
    ErrorCode.ACCOUNT_DISABLED: 403,
    ErrorCode.ACCOUNT_LOCKED: 429,
    ErrorCode.USERNAME_EXISTS: 409,
    ErrorCode.EMAIL_EXISTS: 409,
    ErrorCode.RATE_LIMITED: 429,
    ErrorCode.AI_FAILED: 500,
    ErrorCode.AI_TIMEOUT: 504,
    ErrorCode.SERVER_ERROR: 500,
}


class AppError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        http_status: int | None = None,
        data: Any = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status or DEFAULT_HTTP_STATUS.get(code, 400)
        self.data = data


def _translate_validation_error(error: dict[str, Any]) -> str:
    error_type = error.get("type", "")
    message = str(error.get("msg", "参数错误"))
    if message.startswith("Value error, "):
        return message.removeprefix("Value error, ")
    if error_type == "missing":
        return "该字段为必填项"
    if error_type in {"int_parsing", "int_type", "float_parsing"}:
        return "请输入有效的数字"
    if error_type == "string_type":
        return "请输入文本"
    if error_type == "bool_parsing":
        return "请输入布尔值"
    if error_type == "string_too_short":
        min_length = error.get("ctx", {}).get("min_length")
        return f"长度不能少于 {min_length} 个字符"
    if error_type == "string_too_long":
        max_length = error.get("ctx", {}).get("max_length")
        return f"长度不能超过 {max_length} 个字符"
    if error_type == "literal_error":
        return "参数取值不合法"
    if error_type == "greater_than_equal":
        minimum = error.get("ctx", {}).get("ge")
        return f"不能小于 {minimum}"
    if error_type == "less_than_equal":
        maximum = error.get("ctx", {}).get("le")
        return f"不能大于 {maximum}"
    return message


def _field_errors(exc: RequestValidationError) -> dict[str, str]:
    errors: dict[str, str] = {}
    for error in exc.errors():
        location = [
            str(part) for part in error.get("loc", ()) if part not in {"body", "query", "path"}
        ]
        field = location[-1] if location else "request"
        errors[field] = _translate_validation_error(error)
    return errors


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.http_status,
        content=fail(exc.code, exc.message, exc.data),
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content=fail(
            ErrorCode.VALIDATION,
            "参数校验失败",
            {"errors": _field_errors(exc)},
        ),
    )


async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if exc.status_code == 404 and exc.detail == "Not Found":
        message = "资源不存在"
    else:
        message = exc.detail if isinstance(exc.detail, str) else "请求失败"
    code = {
        400: ErrorCode.VALIDATION,
        401: ErrorCode.UNAUTHORIZED,
        403: ErrorCode.ACCOUNT_DISABLED,
        404: ErrorCode.NOT_FOUND,
        429: ErrorCode.RATE_LIMITED,
    }.get(exc.status_code, ErrorCode.SERVER_ERROR)
    return JSONResponse(status_code=exc.status_code, content=fail(code, message))


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # 只记录异常类型，避免异常消息中携带梦境正文、出生信息等敏感内容
    logger.exception("Unhandled server error: %s", type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content=fail(ErrorCode.SERVER_ERROR, "服务异常，请稍后重试"),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
