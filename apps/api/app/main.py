"""
FastAPI application entrypoint.
"""
from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import dispose_engine
from app.errors import install_error_handlers
from app.orchestrator import init_datahub_mcp_gateway, shutdown_datahub_mcp_gateway
from app.routers import runs as runs_router
from app.worker import run_forever

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("atlas.main")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "starting atlas backend | llm_demo=%s datahub_mode=%s",
        settings.llm_demo_mode,
        settings.datahub_mode,
    )
    # Connects the long-lived MCP subprocess + session once, if configured
    # for MCP access. No-op (and doesn't crash boot) otherwise — see
    # orchestrator.init_datahub_mcp_gateway.
    await init_datahub_mcp_gateway()
    stop = asyncio.Event()
    worker = asyncio.create_task(run_forever(stop)) if settings.WORKER_ENABLED else None
    yield
    stop.set()
    if worker:
        # a phase still running is abandoned here; its lease expires and the next boot resumes it
        try:
            await asyncio.wait_for(worker, timeout=5)
        except TimeoutError:
            worker.cancel()
    await shutdown_datahub_mcp_gateway()
    await dispose_engine()
    logger.info("atlas backend shut down")


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

install_error_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(runs_router.router)


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "llm_demo_mode": settings.llm_demo_mode,
        "datahub_mode": settings.datahub_mode,
    }
