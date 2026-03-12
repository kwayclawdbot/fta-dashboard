from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.lms import Lesson, LessonProgress, UserBadge
from app.models.user import Profile
from app.services.badge_service import check_badges

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


class BadgeOut(BaseModel):
    badge_key: str
    badge_name: str
    badge_description: str


class CompleteOut(BaseModel):
    progress: ProgressOut
    badges_earned: list[BadgeOut] = []


class ActivityItemOut(BaseModel):
    lesson_id: UUID
    lesson_title: str
    completed_at: datetime

    model_config = {"from_attributes": True}


class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_activity: datetime | None = None


class UserBadgeOut(BaseModel):
    badge_key: str
    badge_name: str
    badge_description: str
    earned_at: datetime

    model_config = {"from_attributes": True}


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
            progress.completed_at = datetime.now(timezone.utc)
            progress.progress_pct = 100
        db.add(progress)
    else:
        progress.status = body.status
        progress.progress_pct = body.progress_pct
        if body.status == "completed" and progress.completed_at is None:
            progress.completed_at = datetime.now(timezone.utc)
            progress.progress_pct = 100

    await db.flush()
    await db.refresh(progress)
    return progress


@router.post("/{lesson_id}/complete", response_model=CompleteOut)
async def complete_lesson(
    lesson_id: UUID,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark a lesson as completed. Returns updated progress and any new badges."""
    result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == current_user.id,
            LessonProgress.lesson_id == lesson_id,
        )
    )
    progress = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if progress is None:
        progress = LessonProgress(
            user_id=current_user.id,
            lesson_id=lesson_id,
            status="completed",
            progress_pct=100,
            completed_at=now,
        )
        db.add(progress)
    else:
        progress.status = "completed"
        progress.progress_pct = 100
        if progress.completed_at is None:
            progress.completed_at = now

    await db.flush()
    await db.refresh(progress)

    # Check for new badges
    new_badges = await check_badges(current_user.id, db)

    return CompleteOut(
        progress=ProgressOut(
            id=progress.id,
            lesson_id=progress.lesson_id,
            status=progress.status,
            progress_pct=progress.progress_pct,
            completed_at=progress.completed_at,
            updated_at=progress.updated_at,
        ),
        badges_earned=[
            BadgeOut(
                badge_key=b["badge_key"],
                badge_name=b["badge_name"],
                badge_description=b["badge_description"],
            )
            for b in new_badges
        ],
    )


@router.get("/activity", response_model=list[ActivityItemOut])
async def get_activity(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get last 20 completed lessons with timestamps."""
    result = await db.execute(
        select(LessonProgress)
        .options(selectinload(LessonProgress.lesson))
        .where(
            LessonProgress.user_id == current_user.id,
            LessonProgress.status == "completed",
            LessonProgress.completed_at.isnot(None),
        )
        .order_by(LessonProgress.completed_at.desc())
        .limit(20)
    )
    records = result.scalars().all()

    return [
        ActivityItemOut(
            lesson_id=r.lesson_id,
            lesson_title=r.lesson.title if r.lesson else "Unknown",
            completed_at=r.completed_at,
        )
        for r in records
    ]


@router.get("/streaks", response_model=StreakOut)
async def get_streaks(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Calculate current and longest streak."""
    result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == current_user.id,
            LessonProgress.status == "completed",
            LessonProgress.completed_at.isnot(None),
        )
    )
    records = result.scalars().all()

    completion_dates = sorted(
        {r.completed_at.date() for r in records if r.completed_at},
        reverse=True,
    )

    current_streak = _calculate_streak(completion_dates)

    # Calculate longest streak
    longest = 0
    if completion_dates:
        all_dates_asc = sorted(completion_dates)
        run = 1
        for i in range(1, len(all_dates_asc)):
            if (all_dates_asc[i].toordinal() - all_dates_asc[i - 1].toordinal()) == 1:
                run += 1
            else:
                longest = max(longest, run)
                run = 1
            longest = max(longest, run)

    last_activity = records[0].completed_at if records else None
    # Find latest
    for r in records:
        if r.completed_at and (last_activity is None or r.completed_at > last_activity):
            last_activity = r.completed_at

    return StreakOut(
        current_streak=current_streak,
        longest_streak=max(longest, current_streak),
        last_activity=last_activity,
    )


@router.get("/badges", response_model=list[UserBadgeOut])
async def get_badges(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get all badges earned by the user."""
    result = await db.execute(
        select(UserBadge)
        .where(UserBadge.user_id == current_user.id)
        .order_by(UserBadge.earned_at.desc())
    )
    return result.scalars().all()


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

    completion_dates = sorted(
        {r.completed_at.date() for r in records if r.completed_at},
        reverse=True,
    )

    streak = _calculate_streak(completion_dates)

    return StatsOut(
        total_lessons_started=total,
        completed=completed,
        in_progress=in_progress,
        completion_pct=pct,
        current_streak=streak,
    )


def _calculate_streak(completion_dates: list) -> int:
    """Calculate consecutive day streak from sorted (desc) date list."""
    if not completion_dates:
        return 0

    today = datetime.now(timezone.utc).date()
    streak = 0
    expected = today

    for d in completion_dates:
        if d == expected:
            streak += 1
            expected = expected.fromordinal(expected.toordinal() - 1)
        elif d < expected:
            if streak == 0 and d == today.fromordinal(today.toordinal() - 1):
                streak = 1
                expected = d.fromordinal(d.toordinal() - 1)
            else:
                break

    return streak
