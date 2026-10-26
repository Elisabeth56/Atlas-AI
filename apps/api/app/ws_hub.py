"""
In-memory, room-based WebSocket connection manager.

Rooms are keyed by run_id so only browser tabs watching that specific
run receive its events. This is intentionally in-process (a dict of
sets) rather than backed by Redis pub/sub — the orchestrator and the API
server run in the same process for this monolith, so there's no
cross-process fan-out problem to solve yet. See README "Future
Improvements" for the Redis pub/sub upgrade path if the API server is
ever horizontally scaled.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket

from app.schemas import RunEvent

logger = logging.getLogger("atlas.ws_hub")


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, run_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms.setdefault(run_id, set()).add(ws)
        logger.info("ws connected run_id=%s connections=%d",
                     run_id, len(self._rooms[run_id]))

    async def disconnect(self, run_id: str, ws: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(run_id)
            if room is not None:
                room.discard(ws)
                if not room:
                    self._rooms.pop(run_id, None)

    async def broadcast(self, run_id: str, event: RunEvent) -> None:
        """
        Push an event to every socket watching `run_id`. Safe to call
        even if no one is connected yet (e.g. the frontend reconnects
        mid-run) — the REST GET endpoint remains the source of truth for
        state a client missed while disconnected.
        """
        async with self._lock:
            sockets = list(self._rooms.get(run_id, ()))

        if not sockets:
            return

        payload = event.model_dump_json(exclude_none=True)
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)

        if dead:
            async with self._lock:
                room = self._rooms.get(run_id)
                if room:
                    for ws in dead:
                        room.discard(ws)
                    if not room:
                        self._rooms.pop(run_id, None)

    def room_size(self, run_id: str) -> int:
        return len(self._rooms.get(run_id, ()))


# Module-level singleton — imported by routers/ws.py and the orchestrator.
manager = ConnectionManager()


async def broadcast(run_id: str, event: RunEvent) -> None:
    """Convenience wrapper matching the `ws_hub.broadcast(...)` call style
    referenced in the implementation plan."""
    await manager.broadcast(run_id, event)
