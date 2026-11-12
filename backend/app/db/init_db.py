from app.db import models  # noqa: F401
from app.db.database import Base, engine


def init_db() -> None:
    """创建业务表与索引；开发期使用，正式迁移后由 Alembic 接管。"""
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("数据库初始化完成")
