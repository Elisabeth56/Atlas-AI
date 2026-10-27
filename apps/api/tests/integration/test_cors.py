"""Only the configured web origins (and Vercel previews, by pattern) may call the API from a browser."""
from __future__ import annotations

import httpx
import pytest

from app import main


@pytest.fixture
def cors_app():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI()

    @app.get("/ping")
    def ping() -> dict[str, bool]:
        return {"ok": True}

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://atlas.example"],
        allow_origin_regex=r"https://atlas-ai-[a-z0-9-]+-team\.vercel\.app",
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )
    return app


async def _preflight(app, origin: str) -> httpx.Response:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        return await c.options("/ping", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})


async def test_listed_origin_and_preview_pattern_pass_others_dont(cors_app):
    assert (await _preflight(cors_app, "https://atlas.example")).status_code == 200
    assert (await _preflight(cors_app, "https://atlas-ai-git-feat-x-team.vercel.app")).status_code == 200
    assert (await _preflight(cors_app, "https://evil.example")).status_code == 400


def test_main_wires_the_regex_setting():
    cors = next(m for m in main.app.user_middleware if m.cls.__name__ == "CORSMiddleware")
    assert "allow_origin_regex" in cors.kwargs and cors.kwargs["allow_credentials"] is False
