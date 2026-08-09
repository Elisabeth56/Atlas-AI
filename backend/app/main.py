"""
FastAPI application entrypoint.
"""
from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import dispose_engine, init_models
from app.orchestrator import init_datahub_mcp_gateway, shutdown_datahub_mcp_gateway
from app.routers import requests as requests_router
from app.routers import ws as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("atlas.main")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "starting atlas backend | llm_demo=%s datahub_access_mode=%s workspace_mode=%s",
        settings.llm_demo_mode,
        settings.datahub_access_mode_effective,
        settings.DATAHUB_WORKSPACE_MODE,
    )
    await init_models()
    # Connects the long-lived MCP subprocess + session once, if configured
    # for MCP access. No-op (and doesn't crash boot) otherwise — see
    # orchestrator.init_datahub_mcp_gateway.
    await init_datahub_mcp_gateway()
    yield
    await shutdown_datahub_mcp_gateway()
    await dispose_engine()
    logger.info("atlas backend shut down")


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(requests_router.router)
app.include_router(ws_router.router)


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "llm_demo_mode": settings.llm_demo_mode,
        "datahub_access_mode": settings.datahub_access_mode_effective,
        "datahub_workspace_mode": settings.DATAHUB_WORKSPACE_MODE,
    }
