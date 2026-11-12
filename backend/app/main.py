from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, dream, history, users, zodiac
from app.core.errors import register_exception_handlers
from app.db.init_db import init_db

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="星梦智能助手 API",
    version="0.1.0",
    description="星座分析、周公解梦与历史记录服务",
    lifespan=lifespan,
)
register_exception_handlers(app)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(zodiac.router)
app.include_router(dream.router)
app.include_router(history.router)


@app.get("/", include_in_schema=False)
def index() -> RedirectResponse:
    """根路径跳转主页面；未登录时由前端守卫转到登录页。"""
    return RedirectResponse(url="/home.html")


# 静态挂载必须放在 API 路由之后，否则会吞掉 /api 请求
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
