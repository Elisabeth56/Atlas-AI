"""Who is calling: verifies the Supabase access token and finds, or creates, the caller's workspace."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.errors import AppError
from app.models import DatahubConnection, Workspace, WorkspaceMember


@dataclass(frozen=True)
class Caller:
    user_id: str | None  # None only when AUTH_MODE is "off" (local development)
    workspace_id: str


async def current_caller(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Caller:
    """FastAPI dependency for every route that touches runs."""
    settings = get_settings()
    if settings.AUTH_MODE == "off":
        return Caller(user_id=None, workspace_id=settings.DEMO_WORKSPACE_ID)

    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError(401, "sign_in_required", "Sign in to use Atlas.")
    claims = await verify_token(authorization[7:])
    user_id = claims["sub"]
    return Caller(user_id=user_id, workspace_id=await _workspace_for(db, user_id))


async def verify_token(token: str) -> dict:
    """Checks signature, expiry and audience. Raises 401 on anything wrong."""
    settings = get_settings()
    try:
        if settings.SUPABASE_JWT_SECRET:  # legacy HS256 projects, and the test suite
            return jwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        # current Supabase projects sign with asymmetric keys published as a JWKS
        key = await asyncio.to_thread(_jwks().get_signing_key_from_jwt, token)
        return jwt.decode(token, key.key, algorithms=["ES256", "RS256"], audience="authenticated")
    except jwt.PyJWTError as e:
        raise AppError(401, "invalid_token", "Your session has expired. Sign in again.") from e


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{get_settings().SUPABASE_URL}/auth/v1/.well-known/jwks.json", cache_keys=True)


async def _workspace_for(db: AsyncSession, user_id: str) -> str:
    """The caller's first workspace; a new user (including an anonymous demo user) gets one on first call."""
    existing = await db.scalar(
        select(WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user_id)
        .order_by(WorkspaceMember.created_at)
        .limit(1)
    )
    if existing:
        return existing

    workspace = Workspace(name="My workspace")
    db.add(workspace)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user_id, role="owner"))
    db.add(DatahubConnection(workspace_id=workspace.id, mode="sample"))
    await db.commit()
    return workspace.id
