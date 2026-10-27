"""System prompts, one markdown file per agent, versioned in git."""
from __future__ import annotations

from functools import cache
from pathlib import Path

_DIR = Path(__file__).parent


@cache
def load(prompt_id: str) -> str:
    """Returns the system prompt stored in `<prompt_id>.md`."""
    return (_DIR / f"{prompt_id}.md").read_text(encoding="utf-8").strip()
