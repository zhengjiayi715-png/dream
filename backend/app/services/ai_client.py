import json
from pathlib import Path
from typing import Any

from openai import APIStatusError, APITimeoutError, OpenAI, OpenAIError

from app.core.config import Settings, settings

PROMPT_DIR = Path(__file__).resolve().parents[1] / "prompts"


class AIError(Exception):
    """AI 调用失败的基类。"""


class AITimeoutError(AIError):
    """AI 调用超时。"""


class AIResponseError(AIError):
    """AI 返回内容无法解析或结构不可用。"""


def load_prompt(name: str) -> str:
    """按名称读取 app/prompts 下的提示词，如 zodiac_v1。"""
    path = PROMPT_DIR / f"{name}.md"
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise AIError(f"提示词不存在：{name}") from exc


class AIClient:
    def __init__(self, config: Settings | None = None, client: OpenAI | None = None) -> None:
        self._settings = config or settings
        self._client = client or OpenAI(
            api_key=self._settings.deepseek_api_key or "not-configured",
            base_url=self._settings.deepseek_base_url,
            timeout=self._settings.deepseek_timeout_seconds,
        )

    @property
    def model(self) -> str:
        return self._settings.deepseek_model

    def generate_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        if not self._settings.deepseek_api_key:
            raise AIError("未配置 DEEPSEEK_API_KEY")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        last_content = ""

        for attempt in range(2):
            try:
                response = self._client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.7,
                    max_tokens=2000,
                )
                last_content = (response.choices[0].message.content or "").strip()
                return self._parse_json(last_content)
            except APITimeoutError as exc:
                # 硬超时 15 秒：超时不再重试，避免整体耗时翻倍
                raise AITimeoutError("AI 调用超时") from exc
            except APIStatusError as exc:
                if attempt == 0 and exc.status_code in {429, 500, 502, 503, 504}:
                    continue
                raise AIError(f"AI 服务返回错误：{exc.status_code}") from exc
            except AIResponseError:
                if attempt == 0:
                    messages.append({"role": "assistant", "content": last_content})
                    messages.append(
                        {
                            "role": "user",
                            "content": "请只返回合法 JSON，不要 Markdown 代码块或额外文字。",
                        }
                    )
                    continue
                raise
            except OpenAIError as exc:
                raise AIError("AI 服务调用失败") from exc

        raise AIResponseError("AI 返回内容无法解析")

    @staticmethod
    def _parse_json(content: str) -> dict[str, Any]:
        text = content.strip()
        if text.startswith("```"):
            text = text.strip("`").strip()
            if text.startswith("json"):
                text = text[4:].strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise AIResponseError("AI 返回内容不是合法 JSON") from exc
        if not isinstance(data, dict):
            raise AIResponseError("AI 返回内容不是 JSON 对象")
        return data


def get_ai_client() -> AIClient:
    return AIClient()
