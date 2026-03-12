from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.lms import LiveSession
from app.models.user import Profile

router = APIRouter()


# --- Schemas ---


class LiveSessionOut(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    host_name: str
    scheduled_at: datetime
    duration_minutes: int
    join_url: str | None = None
    recording_url: str | None = None
    thumbnail_url: str | None = None
    status: str

    model_config = {"from_attributes": True}


class LiveSessionListOut(BaseModel):
    upcoming: list[LiveSessionOut]
    past: list[LiveSessionOut]


# --- Routes ---


@router.get("", response_model=LiveSessionListOut)
async def list_live_sessions(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List upcoming and recent live sessions."""
    now = datetime.now(timezone.utc)

    # Upcoming sessions (scheduled or live, in the future)
    upcoming_result = await db.execute(
        select(LiveSession)
        .where(
            LiveSession.scheduled_at >= now,
            LiveSession.status.in_(["scheduled", "live"]),
        )
        .order_by(LiveSession.scheduled_at.asc())
        .limit(20)
    )
    upcoming = upcoming_result.scalars().all()

    # Past sessions (completed, most recent first)
    past_result = await db.execute(
        select(LiveSession)
        .where(LiveSession.status == "completed")
        .order_by(LiveSession.scheduled_at.desc())
        .limit(20)
    )
    past = past_result.scalars().all()

    return LiveSessionListOut(upcoming=upcoming, past=past)


@router.get("/{session_id}", response_model=LiveSessionOut)
async def get_live_session(
    session_id: UUID,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a specific live session with join URL or recording URL."""
    result = await db.execute(
        select(LiveSession).where(LiveSession.id == session_id)
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Live session not found",
        )

    return session
