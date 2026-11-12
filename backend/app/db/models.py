from datetime import UTC, datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def utc_now() -> datetime:
    """返回不带时区信息的 UTC 时间，SQLite 统一按 UTC 文本存储。"""
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(Text, nullable=False)
    username_norm: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    email_norm: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="active", server_default=text("'active'")
    )
    failed_login_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    terms_version: Mapped[str] = mapped_column(Text, nullable=False)
    agreed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now, onupdate=utc_now
    )

    records: Mapped[list["AnalysisRecord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("username_norm", name="uq_users_username_norm"),
        UniqueConstraint("email_norm", name="uq_users_email_norm"),
        CheckConstraint("length(username) BETWEEN 3 AND 20", name="ck_users_username_len"),
        CheckConstraint(
            "length(username_norm) BETWEEN 3 AND 20",
            name="ck_users_username_norm_len",
        ),
        CheckConstraint("length(email) <= 254", name="ck_users_email_len"),
        CheckConstraint("length(email_norm) <= 254", name="ck_users_email_norm_len"),
        CheckConstraint("status IN ('active', 'disabled')", name="ck_users_status"),
        CheckConstraint("failed_login_count >= 0", name="ck_users_failed_count"),
    )


class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    record_type: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    constellation_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_json: Mapped[str] = mapped_column(Text, nullable=False)
    result_json: Mapped[str] = mapped_column(Text, nullable=False)
    overall_rating: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_flag: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    model: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_version: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)

    user: Mapped[User] = relationship(back_populates="records")

    __table_args__ = (
        CheckConstraint("record_type IN ('zodiac', 'dream')", name="ck_records_type"),
        CheckConstraint("length(summary) BETWEEN 1 AND 50", name="ck_records_summary_len"),
        CheckConstraint("json_valid(input_json)", name="ck_records_input_json"),
        CheckConstraint("json_valid(result_json)", name="ck_records_result_json"),
        CheckConstraint(
            "overall_rating IS NULL OR overall_rating IN ('good', 'normal', 'attention')",
            name="ck_records_rating",
        ),
        CheckConstraint("risk_flag IN (0, 1)", name="ck_records_risk_flag"),
        CheckConstraint(
            "constellation_code IS NULL OR constellation_code IN "
            "('aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', "
            "'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces')",
            name="ck_records_constellation_code",
        ),
        CheckConstraint(
            "record_type <> 'zodiac' OR (constellation_code IS NOT NULL "
            "AND overall_rating IS NULL AND risk_flag = 0)",
            name="ck_records_zodiac_fields",
        ),
        CheckConstraint(
            "record_type <> 'dream' OR (constellation_code IS NULL AND overall_rating IS NOT NULL)",
            name="ck_records_dream_fields",
        ),
    )


Index(
    "idx_records_user_created",
    AnalysisRecord.user_id,
    AnalysisRecord.created_at.desc(),
    AnalysisRecord.id.desc(),
)
Index(
    "idx_records_user_type_created",
    AnalysisRecord.user_id,
    AnalysisRecord.record_type,
    AnalysisRecord.created_at.desc(),
    AnalysisRecord.id.desc(),
)
