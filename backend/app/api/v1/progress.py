from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.lms import LessonProgress
from app.models.user import Profile

router = APIRouter()


# --- Schemas ---


class ProgressUpdateRequest(BaseModel):
    status: str  # not_started, in_progress, completed
    progress_pct: int = 0


class ProgressOut(BaseModel):
    id: UUID
    lesson_id: UUID
    status: str
    progress_pct: int
    completed_at: datetime | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class StatsOut(BaseModel):
    total_lessons_started: int
    completed: int
    in_progress: int
    completion_pct: int
    current_streak: int


# --- Routes ---


@router.put("/{lesson_id}", response_model=ProgressOut)
async def update_progress(
    lesson_id: UUID,
    body: ProgressUpdateRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update lesson progress for the current user."""
    if body.status not in ("not_started", "in_progress", "completed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be one of: not_started, in_progress, completed",
        )

    result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == current_user.id,
            LessonProgress.lesson_id == lesson_id,
        )
    )
    progress = result.scalar_one_or_none()

    if progress is None:
        progress = LessonProgress(
            user_id=current_user.id,
            lesson_id=lesson_id,
            status=body.status,
            progress_pct=body.progress_pct,
        )
        if body.status == "completed":
            progress.completed_at = datetime.utcnow()
            progress.progress_pct = 100
        db.add(progress)
    else:
        progress.status = body.status
        progress.progress_pct = body.progress_pct
        if body.status == "completed" and progress.completed_at is None:
            progress.completed_at = datetime.utcnow()
            progress.progress_pct = 100

    await db.flush()
    await db.refresh(progress)
    return progress


@router.get("/stats", response_model=StatsOut)
async def get_stats(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get user stats: total lessons started, completed, streak."""
    result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == current_user.id,
        )
    )
    records = result.scalars().all()

    total = len(records)
    completed = sum(1 for r in records if r.status == "completed")
    in_progress = sum(1 for r in records if r.status == "in_progress")
    pct = int((completed / total) * 100) if total > 0 else 0

    # Calculate streak: consecutive days with at least one completion
    completion_dates = sorted(
        {r.completed_at.date() for r in records if r.completed_at},
        reverse=True,
    )

    streak = 0
    if completion_dates:
        today = datetime.utcnow().date()
        expected = today
        for d in completion_dates:
            if d == expected:
                streak += 1
                expected = expected.__class__.fromordinal(expected.toordinal() - 1)
            elif d < expected:
                # Allow starting streak from yesterday if no activity today
                if streak == 0 and d == today.__class__.fromordinal(today.toordinal() - 1):
                    streak = 1
                    expected = d.__class__.fromordinal(d.toordinal() - 1)
                else:
                    break

    return StatsOut(
        total_lessons_started=total,
        completed=completed,
        in_progress=in_progress,
        completion_pct=pct,
        current_streak=streak,
    )
