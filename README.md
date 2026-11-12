# 星梦智能助手,AI写的小玩意

星座星盘分析与周公解梦 Web 应用，包含注册 / 登录、两类 AI 分析与历史记录。

- 前端：原生 HTML / CSS / JavaScript（无框架、无构建步骤），由 FastAPI 静态托管。
- 后端：Python 3.12 + FastAPI + 同步 SQLAlchemy + SQLite。
- AI：DeepSeek（OpenAI 兼容接口），仅在服务端调用。

## 环境要求

| 工具 | 版本 |
| --- | --- |
| Python | 3.12+ |
| uv | 0.13+ |
| DeepSeek API Key | 真实分析必填；仅跑测试可不填 |

## 快速开始

```bash
cd backend
uv sync

# 创建本地环境变量文件（Windows 可用 copy .env.example .env）
cp .env.example .env
```

编辑 `backend/.env`：

```dotenv
DEEPSEEK_API_KEY=你的密钥
JWT_SECRET=随机长字符串
```

生成 JWT_SECRET 可用：

```bash
cd backend
uv run python -c "import secrets; print(secrets.token_urlsafe(48))"
```

启动服务（同时托管前端）：

```bash
cd backend
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- 应用入口：http://127.0.0.1:8000/
- Swagger：http://127.0.0.1:8000/docs

数据库默认位于 `backend/data/app.db`，首次启动自动建表。相对路径以 `backend/` 为工作目录，请从 backend 目录启动。

## 测试与检查

```bash
cd backend
uv run pytest
uv run ruff check app ../test/backend
uv run ruff format --check app ../test/backend
```

测试使用临时 SQLite 并 mock AI，不访问真实 DeepSeek，也不会污染开发库。测试代码与需求/开发文档仅本地保留，不包含在本仓库中。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `APP_ENV` | `development` / `production` |
| `DATABASE_URL` | 默认 `sqlite:///./data/app.db` |
| `JWT_SECRET` | JWT 签名密钥；生产环境必须替换为随机长字符串 |
| `JWT_EXPIRE_DAYS` | 登录态有效期，默认 7 天 |
| `DEEPSEEK_API_KEY` | DeepSeek 密钥，仅后端使用 |
| `DEEPSEEK_BASE_URL` | 默认 `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 默认 `deepseek-chat` |
| `DEEPSEEK_TIMEOUT_SECONDS` | 默认 15 秒 |
| `TERMS_VERSION` | 用户协议版本，默认 `v1.0` |

`.env`、数据库文件与测试产物均不入库。

## 目录结构

```text
backend/       FastAPI 后端
frontend/      前端页面与脚本，由后端托管
.gitignore
README.md
```

## 已知限制

- 真实 AI 生成需要配置 `DEEPSEEK_API_KEY`；未配置时分析接口返回 5001。
- 本期不做服务端登出与 token 刷新，退出登录由前端清除 token 完成。
- 账号锁定计数与限流为进程内状态，单 worker 部署；服务重启后清空。
- 测试、需求文档、开发文档、原型图与 CLAUDE.md 仅本地保留，不随仓库发布。
