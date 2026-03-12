from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.lms import Course, DripSchedule, Lesson, LessonProgress, Module
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


class LessonWithProgressOut(BaseModel):
    id: UUID
    slug: str
    title: str
    content_type: str
    duration_minutes: int | None = None
    sort_order: int
    unlocked: bool
    status: str  # not_started, in_progress, completed
    progress_pct: int

    model_config = {"from_attributes": True}


class ModuleWithProgressOut(BaseModel):
    id: UUID
    slug: str
    title: str
    description: str | None = None
    sort_order: int
    lesson_count: int
    completed_count: int
    lessons: list[LessonWithProgressOut] = []

    model_config = {"from_attributes": True}


# --- Helpers ---


def _is_lesson_unlocked(
    lesson: Lesson,
    enrolled_at: datetime | None,
) -> bool:
    """Check if a lesson is unlocked based on drip schedule."""
    if lesson.drip_schedule is None:
        return True
    if enrolled_at is None:
        return False

    now = datetime.now(timezone.utc)
    # Check absolute availability date first
    if lesson.drip_schedule.available_from is not None:
        return now >= lesson.drip_schedule.available_from

    # Check days_after_enrollment
    days_since = (now - enrolled_at).days
    return days_since >= lesson.drip_schedule.days_after_enrollment


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


@router.get("/{slug}/modules", response_model=list[ModuleWithProgressOut])
async def list_modules(
    slug: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List modules with lessons for a course, including lesson counts and completion."""
    result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.modules)
            .selectinload(Module.lessons)
            .selectinload(Lesson.drip_schedule)
        )
        .where(Course.slug == slug, Course.published.is_(True))
    )
    course = result.scalar_one_or_none()

    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    # Get all lesson IDs to fetch progress in bulk
    all_lesson_ids = [
        lesson.id
        for module in course.modules
        for lesson in module.lessons
    ]

    progress_map: dict[UUID, LessonProgress] = {}
    if all_lesson_ids:
        progress_result = await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == current_user.id,
                LessonProgress.lesson_id.in_(all_lesson_ids),
            )
        )
        for p in progress_result.scalars().all():
            progress_map[p.lesson_id] = p

    enrolled_at = current_user.family.enrolled_at if current_user.family else None

    modules_out = []
    for module in sorted(course.modules, key=lambda m: m.sort_order):
        lessons_out = []
        completed_count = 0
        for lesson in sorted(module.lessons, key=lambda l: l.sort_order):
            prog = progress_map.get(lesson.id)
            lesson_status = prog.status if prog else "not_started"
            lesson_pct = prog.progress_pct if prog else 0
            if lesson_status == "completed":
                completed_count += 1

            unlocked = _is_lesson_unlocked(lesson, enrolled_at)

            lessons_out.append(
                LessonWithProgressOut(
                    id=lesson.id,
                    slug=lesson.slug,
                    title=lesson.title,
                    content_type=lesson.content_type,
                    duration_minutes=lesson.duration_minutes,
                    sort_order=lesson.sort_order,
                    unlocked=unlocked,
                    status=lesson_status,
                    progress_pct=lesson_pct,
                )
            )

        modules_out.append(
            ModuleWithProgressOut(
                id=module.id,
                slug=module.slug,
                title=module.title,
                description=module.description,
                sort_order=module.sort_order,
                lesson_count=len(module.lessons),
                completed_count=completed_count,
                lessons=lessons_out,
            )
        )

    return modules_out


@router.get("/{slug}/modules/{module_id}/lessons", response_model=list[LessonWithProgressOut])
async def list_module_lessons(
    slug: str,
    module_id: UUID,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List lessons in a module with progress and drip unlock status."""
    # Verify course exists
    course_result = await db.execute(
        select(Course).where(Course.slug == slug, Course.published.is_(True))
    )
    course = course_result.scalar_one_or_none()
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )

    # Fetch module with lessons and drip schedules
    result = await db.execute(
        select(Module)
        .options(selectinload(Module.lessons).selectinload(Lesson.drip_schedule))
        .where(Module.id == module_id, Module.course_id == course.id)
    )
    module = result.scalar_one_or_none()

    if module is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found",
        )

    lesson_ids = [lesson.id for lesson in module.lessons]
    progress_map: dict[UUID, LessonProgress] = {}
    if lesson_ids:
        progress_result = await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == current_user.id,
                LessonProgress.lesson_id.in_(lesson_ids),
            )
        )
        for p in progress_result.scalars().all():
            progress_map[p.lesson_id] = p

    enrolled_at = current_user.family.enrolled_at if current_user.family else None

    lessons_out = []
    for lesson in sorted(module.lessons, key=lambda l: l.sort_order):
        prog = progress_map.get(lesson.id)
        lesson_status = prog.status if prog else "not_started"
        lesson_pct = prog.progress_pct if prog else 0
        unlocked = _is_lesson_unlocked(lesson, enrolled_at)

        lessons_out.append(
            LessonWithProgressOut(
                id=lesson.id,
                slug=lesson.slug,
                title=lesson.title,
                content_type=lesson.content_type,
                duration_minutes=lesson.duration_minutes,
                sort_order=lesson.sort_order,
                unlocked=unlocked,
                status=lesson_status,
                progress_pct=lesson_pct,
            )
        )

    return lessons_out
