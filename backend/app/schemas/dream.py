from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

Gender = Literal["male", "female"]
AgeRange = Literal["18_25", "26_35", "36_45", "46_55", "56_plus"]
OverallRating = Literal["good", "normal", "attention"]


def _check_text(
    value: str,
    empty_message: str,
    max_length: int,
    too_long_message: str,
) -> str:
    if not value:
        raise ValueError(empty_message)
    if len(value) > max_length:
        raise ValueError(too_long_message)
    return value


class DreamAnalyzeRequest(BaseModel):
    """解梦请求；所有文本先去除首尾空格，再校验长度。"""

    dream_content: str
    dream_time: str
    gender: Gender
    age_range: AgeRange
    occupation: str
    recent_state: str
    focus_points: str

    @field_validator(
        "dream_content",
        "dream_time",
        "occupation",
        "recent_state",
        "focus_points",
        mode="before",
    )
    @classmethod
    def _strip_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("dream_content")
    @classmethod
    def _check_dream_content(cls, value: str) -> str:
        if not value:
            raise ValueError("请输入梦境内容")
        if len(value) < 10:
            raise ValueError("梦境内容至少 10 个字符")
        if len(value) > 500:
            raise ValueError("梦境内容不能超过 500 个字符")
        return value

    @field_validator("dream_time")
    @classmethod
    def _check_dream_time(cls, value: str) -> str:
        return _check_text(value, "请输入做梦时间", 20, "做梦时间不能超过 20 个字符")

    @field_validator("occupation")
    @classmethod
    def _check_occupation(cls, value: str) -> str:
        return _check_text(value, "请输入职业", 30, "职业不能超过 30 个字符")

    @field_validator("recent_state")
    @classmethod
    def _check_recent_state(cls, value: str) -> str:
        return _check_text(value, "请输入近期状态", 50, "近期状态不能超过 50 个字符")

    @field_validator("focus_points")
    @classmethod
    def _check_focus_points(cls, value: str) -> str:
        return _check_text(value, "请输入解梦关注点", 100, "解梦关注点不能超过 100 个字符")

    @field_validator("gender", mode="before")
    @classmethod
    def _check_gender(cls, value: Any) -> Any:
        if value not in {"male", "female"}:
            raise ValueError("请选择性别")
        return value

    @field_validator("age_range", mode="before")
    @classmethod
    def _check_age_range(cls, value: Any) -> Any:
        if value not in {"18_25", "26_35", "36_45", "46_55", "56_plus"}:
            raise ValueError("请选择年龄")
        return value


class DreamInterpretations(BaseModel):
    career: str = Field(min_length=1)
    love: str = Field(min_length=1)
    health: str = Field(min_length=1)


class DreamResult(BaseModel):
    """AI 返回的梦境解读结构。"""

    core_meaning: str = Field(min_length=1)
    interpretations: DreamInterpretations
    suggestions: list[str] = Field(min_length=3, max_length=5)
    overall_rating: OverallRating
    care_notice: str | None = None

    @field_validator("suggestions")
    @classmethod
    def _check_suggestions(cls, value: list[str]) -> list[str]:
        items = [item.strip() for item in value]
        if any(not item for item in items):
            raise ValueError("建议内容不能为空")
        return items

    @field_validator("care_notice", mode="before")
    @classmethod
    def _normalize_care_notice(cls, value: Any) -> Any:
        if isinstance(value, str):
            text = value.strip()
            return text or None
        return value


class DreamAnalyzeData(BaseModel):
    id: int
    record_type: str = "dream"
    summary: str
    constellation_code: None = None
    overall_rating: OverallRating
    risk_flag: int
    input: dict[str, Any]
    result: DreamResult
    created_at: str
