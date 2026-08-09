"""
LLM provider abstraction.

Every agent that needs a language model depends on this interface, never
on a concrete SDK. This is what lets us run on Groq today, swap to
Anthropic/OpenAI/local vLLM later, and unit-test agents against a fake
provider without any network calls.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    """Raised when a provider fails after exhausting retries, or returns
    output that cannot be validated against the requested schema."""


class LLMProvider(ABC):
    """
    Structured-completion contract. `complete()` always returns a
    validated instance of `schema` — providers are responsible for
    prompting the underlying model to emit JSON and for retrying /
    repairing malformed output before it ever reaches agent code.
    """

    @abstractmethod
    async def complete(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: type[T],
    ) -> T:
        """Run a completion and parse+validate the result as `schema`."""
        raise NotImplementedError
