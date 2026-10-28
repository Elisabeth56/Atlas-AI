"""LLM access for every agent: free providers tried in order, output validated against the caller's schema.

All three providers speak the OpenAI chat-completions format, so one httpx client covers them.
A provider that is rate-limited, down or slow hands the call to the next one. Invalid JSON gets
one repair attempt with the validation error sent back, then the step fails.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.llm import prompts
from app.llm.provider import LLMError, LLMProvider, T

logger = logging.getLogger("atlas.llm")

# wait out a 429 on the same provider only when it asks for less than this
MAX_RETRY_AFTER_SECONDS = 10.0


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    base_url: str
    api_key: str
    model: str


@dataclass(frozen=True)
class CallRecord:
    """What one HTTP call cost and how it ended; `fallback` means an earlier provider failed this call."""

    provider: str
    model: str
    prompt_id: str
    latency_ms: int
    outcome: str  # ok | rate_limited | network_error | http_<status>
    fallback: bool
    tokens_in: int | None = None
    tokens_out: int | None = None


OnCall = Callable[[CallRecord], Awaitable[None]]


class ProviderUnavailable(Exception):
    """This provider can't serve the call right now; the next one should try."""


def providers_from_settings(settings: Settings) -> list[ProviderConfig]:
    """The configured providers in fallback order. A provider without a key is skipped."""
    candidates = [
        ("groq", "https://api.groq.com/openai/v1", settings.GROQ_API_KEY, settings.GROQ_MODEL),
        (
            "gemini",
            "https://generativelanguage.googleapis.com/v1beta/openai",
            settings.GEMINI_API_KEY,
            settings.GEMINI_MODEL,
        ),
    ]
    return [ProviderConfig(n, url, key, model) for n, url, key, model in candidates if key]


class ProviderChain(LLMProvider):
    def __init__(
        self,
        providers: list[ProviderConfig],
        *,
        timeout_seconds: float = 60.0,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        on_call: OnCall | None = None,
    ) -> None:
        if not providers:
            raise ValueError("ProviderChain needs at least one provider")
        self._providers = providers
        self._timeout = timeout_seconds
        self._transport = transport
        self._sleep = sleep
        self._on_call = on_call

    async def complete(self, *, prompt_id: str, user_prompt: str, schema: type[T]) -> T:
        messages = [
            {"role": "system", "content": f"{prompts.load(prompt_id)}\n\n{_json_instruction(schema)}"},
            {"role": "user", "content": user_prompt},
        ]
        failures: list[str] = []
        async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
            for provider in self._providers:
                try:
                    return await self._complete_with(client, provider, prompt_id, messages, schema, bool(failures))
                except ProviderUnavailable as exc:
                    failures.append(f"{provider.name}: {exc}")
        raise LLMError(f"every LLM provider failed ({'; '.join(failures)})")

    async def _complete_with(
        self,
        client: httpx.AsyncClient,
        provider: ProviderConfig,
        prompt_id: str,
        messages: list[dict],
        schema: type[T],
        fallback: bool,
    ) -> T:
        raw = await self._call(client, provider, prompt_id, messages, fallback)
        try:
            return schema.model_validate_json(raw)
        except ValidationError as exc:
            # one repair attempt: show the model exactly what was wrong
            repair = [
                *messages,
                {"role": "assistant", "content": raw},
                {
                    "role": "user",
                    "content": f"That JSON failed validation:\n{exc}\n"
                    "Return the corrected JSON object only.",
                },
            ]
            raw = await self._call(client, provider, prompt_id, repair, fallback)
            try:
                return schema.model_validate_json(raw)
            except ValidationError as exc2:
                raise LLMError(
                    f"{provider.name} returned invalid {schema.__name__} after a repair attempt: {exc2}"
                ) from exc2

    async def _call(
        self, client: httpx.AsyncClient, provider: ProviderConfig, prompt_id: str, messages: list[dict],
        fallback: bool,
    ) -> str:
        """One chat completion. Raises ProviderUnavailable on 429, 5xx, other errors or timeouts."""
        for attempt in range(2):
            started = time.monotonic()
            try:
                resp = await client.post(
                    f"{provider.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {provider.api_key}"},
                    json={
                        "model": provider.model,
                        "messages": messages,
                        "temperature": 0.2,
                        "response_format": {"type": "json_object"},
                    },
                )
            except httpx.TransportError as exc:
                await self._record(provider, prompt_id, started, fallback, outcome="network_error")
                raise ProviderUnavailable(type(exc).__name__) from exc

            if resp.status_code == 429:
                await self._record(provider, prompt_id, started, fallback, outcome="rate_limited")
                wait = _retry_after(resp)
                if attempt == 0 and wait is not None and wait <= MAX_RETRY_AFTER_SECONDS:
                    await self._sleep(wait)
                    continue
                raise ProviderUnavailable("rate limited")

            if resp.status_code != 200:
                await self._record(provider, prompt_id, started, fallback, outcome=f"http_{resp.status_code}")
                raise ProviderUnavailable(f"HTTP {resp.status_code}")

            body = resp.json()
            usage = body.get("usage") or {}
            await self._record(
                provider, prompt_id, started, fallback, outcome="ok",
                tokens_in=usage.get("prompt_tokens"), tokens_out=usage.get("completion_tokens"),
            )
            return body["choices"][0]["message"]["content"]
        raise ProviderUnavailable("rate limited")


    async def _record(
        self,
        provider: ProviderConfig,
        prompt_id: str,
        started: float,
        fallback: bool,
        *,
        outcome: str,
        tokens_in: int | None = None,
        tokens_out: int | None = None,
    ) -> None:
        record = CallRecord(
            provider=provider.name, model=provider.model, prompt_id=prompt_id,
            latency_ms=int((time.monotonic() - started) * 1000), outcome=outcome, fallback=fallback,
            tokens_in=tokens_in, tokens_out=tokens_out,
        )
        logger.info(
            "llm_call provider=%s model=%s prompt=%s tokens_in=%s tokens_out=%s latency_ms=%d outcome=%s",
            record.provider, record.model, prompt_id, tokens_in, tokens_out, record.latency_ms, outcome,
        )
        if self._on_call:
            await self._on_call(record)


def _retry_after(resp: httpx.Response) -> float | None:
    try:
        return float(resp.headers["retry-after"])
    except (KeyError, ValueError):
        return None


def _json_instruction(schema: type[BaseModel]) -> str:
    shape = json.dumps(schema.model_json_schema(), separators=(",", ":"))
    return (
        "Respond with a single JSON object and nothing else: no markdown fences, no commentary. "
        f"It must match this JSON schema:\n{shape}"
    )
