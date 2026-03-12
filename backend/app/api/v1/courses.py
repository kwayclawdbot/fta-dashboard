from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.lms import Course, LessonProgress, Module
from app.models.user import Profile

router = APIRouter()

# Tier hierarchy for filtering
TIER_LEVELS = {"free": 0, "challenge": 1, "academy": 2, "vip": 3}


# --- Schemas ---


class LessonOut(BaseModel):
    id: UUID
    slug: str
    title: str
    content_type: str
    duration_minutes: int | None = None
    sort_order: int

    model_config = {"from_attributes": True}


class ModuleOut(BaseModel):
    id: UUID
    slug: str
    title: str
    description: str | None = None
    sort_order: int
    lessons: list[LessonOut] = []

    model_config = {"from_attributes": True}


class CourseListOut(BaseModel):
    id: UUID
    slug: str
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    tier_required: str
    track: str | None = None
    age_group: str | None = None
    sort_order: int

    model_config = {"from_attributes": True}


class CourseDetailOut(CourseListOut):
    modules: list[ModuleOut] = []


class LessonProgressOut(BaseModel):
    lesson_id: UUID
    status: str
    progress_pct: int
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class CourseProgressOut(BaseModel):
    course_slug: str
    total_lessons: int
    completed: int
    progress_pct: int
    lessons: list[LessonProgressOut]


# --- Routes ---


@router.get("", response_model=list[CourseListOut])
async def list_courses(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all published courses the user's family tier can access."""
    user_tier = "free"
    if current_user.family:
        user_tier = current_user.family.plan_tier or "free"

    user_level = TIER_LEVELS.get(user_tier, 0)

    result = await db.execute(
        select(Course)
        .where(Course.published.is_(True))
        .order_by(Course.sort_order)
    )
    courses = result.scalars().all()

    # Filter to courses the user's tier can access
    accessible = [
        c for c in courses if TIER_LEVELS.get(c.tier_required, 0) <= user_level
    ]
    return accessible


@router.get("/{slug}", response_model=CourseDetailOut)
async def get_course(
    slug: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get course detail with modules and lessons."""
    result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.modules).selectinload(Module.lessons)
        )
        .where(Course.slug == slug, Course.published.is_(True))
    )
    course = result.scalar_one_or_none()

    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    # Check tier access
    user_tier = "free"
    if current_user.family:
        user_tier = current_user.family.plan_tier or "free"

    if TIER_LEVELS.get(course.tier_required, 0) > TIER_LEVELS.get(user_tier, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Upgrade to '{course.tier_required}' tier to access this course",
        )

    return course


@router.get("/{slug}/progress", response_model=CourseProgressOut)
async def get_course_progress(
    slug: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get user's progress in a specific course."""
    result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.modules).selectinload(Module.lessons)
        )
        .where(Course.slug == slug)
    )
    course = result.scalar_one_or_none()

    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    # Collect all lesson IDs in this course
    lesson_ids = []
    for module in course.modules:
        for lesson in module.lessons:
            lesson_ids.append(lesson.id)

    total_lessons = len(lesson_ids)

    # Fetch progress records
    progress_result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == current_user.id,
            LessonProgress.lesson_id.in_(lesson_ids),
        )
    )
    progress_records = progress_result.scalars().all()

    completed = sum(1 for p in progress_records if p.status == "completed")
    pct = int((completed / total_lessons) * 100) if total_lessons > 0 else 0

    return CourseProgressOut(
        course_slug=slug,
        total_lessons=total_lessons,
        completed=completed,
        progress_pct=pct,
        lessons=[
            LessonProgressOut(
                lesson_id=p.lesson_id,
                status=p.status,
                progress_pct=p.progress_pct,
                completed_at=p.completed_at,
            )
            for p in progress_records
        ],
    )
