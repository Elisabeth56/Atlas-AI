"""
WebSocket route — WS /api/requests/{id}/stream — matches
frontend/lib/api.ts `streamUrl()` and hooks/useRunStream.ts exactly.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import ws_hub
from app.database import session_scope
from app.models import Request

logger = logging.getLogger("atlas.routers.ws")

router = APIRouter(tags=["stream"])


@router.websocket("/api/requests/{request_id}/stream")
async def stream_run(websocket: WebSocket, request_id: str) -> None:
    async with session_scope() as db:
        request = await db.get(Request, request_id)

    if request is None:
        # Accept then close with a policy-violation code so the frontend's
        # `ws.onerror` fires with a clear signal, rather than leaving the
        # client hanging on a socket that never opens.
        await websocket.accept()
        await websocket.close(code=4404, reason="Request not found")
        return

    await ws_hub.manager.connect(request_id, websocket)
    try:
        while True:
            # This endpoint is server -> client only; we still need to
            # await something to detect disconnects, and reading also lets
            # a client send an optional ping/keepalive without erroring.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await ws_hub.manager.disconnect(request_id, websocket)
