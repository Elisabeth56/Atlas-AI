"""
Groq provider — talks to Groq's OpenAI-compatible /chat/completions
endpoint directly over httpx (no SDK dependency, since Groq's wire format
is just OpenAI's). Requests JSON-mode output and validates it against the
caller's Pydantic schema, retrying on transient errors or malformed JSON.
"""
from __future__ import annotations

import json
import logging

import httpx
from pydantic import BaseModel, ValidationError

from app.llm.provider import LLMError, LLMProvider, T

logger = logging.getLogger("atlas.llm.groq")


class GroqProvider(LLMProvider):
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://api.groq.com/openai/v1",
        model: str = "llama-3.3-70b-versatile",
        timeout_seconds: float = 60.0,
        max_retries: int = 2,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout_seconds
        self._max_retries = max_retries

    async def complete(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: type[T],
    ) -> T:
        schema_hint = _schema_hint(schema)
        full_system = (
            f"{system_prompt}\n\n"
            "You must respond with a single JSON object and nothing else — "
            "no markdown fences, no commentary. It must conform exactly to "
            f"this shape:\n{schema_hint}"
        )

        last_error: Exception | None = None
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            for attempt in range(self._max_retries + 1):
                try:
                    resp = await client.post(
                        f"{self._base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self._api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": self._model,
                            "messages": [
                                {"role": "system", "content": full_system},
                                {"role": "user", "content": user_prompt},
                            ],
                            "temperature": 0.2,
                            "response_format": {"type": "json_object"},
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    raw_content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(raw_content)
                    return schema.model_validate(parsed)

                except (httpx.HTTPError, KeyError, json.JSONDecodeError, ValidationError) as exc:
                    last_error = exc
                    logger.warning(
                        "groq completion attempt %d/%d failed: %s",
                        attempt + 1,
                        self._max_retries + 1,
                        exc,
                    )

        raise LLMError(
            f"Groq completion failed after {self._max_retries + 1} attempts: {last_error}"
        ) from last_error


def _schema_hint(schema: type[BaseModel]) -> str:
    """Render the Pydantic JSON schema compactly for prompt injection."""
    return json.dumps(schema.model_json_schema(), separators=(",", ":"))
