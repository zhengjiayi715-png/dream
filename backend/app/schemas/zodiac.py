from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationInfo, field_validator

Gender = Literal["male", "female"]
RelationshipStatus = Literal["single", "dating", "married"]


class ZodiacAnalyzeRequest(BaseModel):
    """星座分析请求；文本字段先去首尾空格，再校验非空与长度。"""

    birth_year: int = Field(ge=1970, le=2010)
    birth_month: int = Field(ge=1, le=12)
    birth_day: int = Field(ge=1, le=31)
    birth_hour: int = Field(ge=0, le=23)
    birth_minute: int = Field(ge=0, le=59)
    birth_place: str
    gender: Gender
    relationship_status: RelationshipStatus
    occupation: str
    focus_points: str

    @field_validator("birth_day")
    @classmethod
    def _check_birth_day(cls, value: int, info: ValidationInfo) -> int:
        year = info.data.get("birth_year")
        month = info.data.get("birth_month")
        if year is None or month is None:
            return value
        try:
            date(year, month, value)
        except ValueError:
            raise ValueError("请选择正确的出生日期") from None
        return value

    @field_validator("birth_place", "occupation", "focus_points", mode="before")
    @classmethod
    def _strip_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("birth_place")
    @classmethod
    def _check_birth_place(cls, value: str) -> str:
        if not value:
            raise ValueError("请输入出生地点")
        if len(value) > 50:
            raise ValueError("出生地点不能超过 50 个字符")
        return value

    @field_validator("occupation")
    @classmethod
    def _check_occupation(cls, value: str) -> str:
        if not value:
            raise ValueError("请输入职业身份")
        if len(value) > 30:
            raise ValueError("职业身份不能超过 30 个字符")
        return value

    @field_validator("focus_points")
    @classmethod
    def _check_focus_points(cls, value: str) -> str:
        if not value:
            raise ValueError("请输入测算关注点")
        if len(value) > 100:
            raise ValueError("测算关注点不能超过 100 个字符")
        return value

    @field_validator("gender", mode="before")
    @classmethod
    def _check_gender(cls, value: Any) -> Any:
        if value not in {"male", "female"}:
            raise ValueError("请选择性别")
        return value

    @field_validator("relationship_status", mode="before")
    @classmethod
    def _check_relationship_status(cls, value: Any) -> Any:
        if value not in {"single", "dating", "married"}:
            raise ValueError("请选择情感状态")
        return value


class ZodiacFortune(BaseModel):
    career: str = Field(min_length=1)
    love: str = Field(min_length=1)
    health: str = Field(min_length=1)


class ZodiacResult(BaseModel):
    """AI 返回的星座报告结构。"""

    constellation_code: str = Field(min_length=1)
    constellation_name: str = Field(min_length=1)
    personality: str = Field(min_length=1)
    fortune: ZodiacFortune
    lucky_color: str = Field(min_length=1)
    lucky_number: int
    advice: list[str] = Field(min_length=3, max_length=5)

    @field_validator("advice")
    @classmethod
    def _check_advice(cls, value: list[str]) -> list[str]:
        items = [item.strip() for item in value]
        if any(not item for item in items):
            raise ValueError("建议内容不能为空")
        return items


class ZodiacAnalyzeData(BaseModel):
    id: int
    record_type: str = "zodiac"
    summary: str
    constellation_code: str
    overall_rating: None = None
    risk_flag: int = 0
    input: dict[str, Any]
    result: ZodiacResult
    created_at: str
