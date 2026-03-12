from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lms import (
    Course,
    LessonProgress,
    Module,
    QuizAttempt,
    UserBadge,
)

# Badge definitions: key -> (name, description, check function name)
BADGE_DEFINITIONS = {
    "first_lesson": {
        "name": "First Lesson",
        "description": "Completed your first lesson",
    },
    "module_master": {
        "name": "Module Master",
        "description": "Completed all lessons in a module",
    },
    "week_warrior": {
        "name": "Week Warrior",
        "description": "Maintained a 7-day learning streak",
    },
    "quiz_ace": {
        "name": "Quiz Ace",
        "description": "Scored 100% on a quiz",
    },
    "course_complete": {
        "name": "Course Complete",
        "description": "Finished an entire course",
    },
}


async def check_badges(user_id: UUID, db: AsyncSession) -> list[dict]:
    """
    Check if a user has earned any new badges based on current progress.
    Inserts new UserBadge records and returns list of newly earned badges.
    """
    # Get existing badges
    existing_result = await db.execute(
        select(UserBadge.badge_key).where(UserBadge.user_id == user_id)
    )
    existing_keys = set(existing_result.scalars().all())

    newly_earned: list[dict] = []

    # Get all progress records
    progress_result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == user_id,
            LessonProgress.status == "completed",
        )
    )
    completed_records = progress_result.scalars().all()
    completed_count = len(completed_records)

    # --- First Lesson ---
    if "first_lesson" not in existing_keys and completed_count >= 1:
        badge = await _award_badge(user_id, "first_lesson", db)
        newly_earned.append(badge)

    # --- Module Master ---
    if "module_master" not in existing_keys and completed_count >= 1:
        completed_lesson_ids = {r.lesson_id for r in completed_records}
        # Check if any module has all its lessons completed
        modules_result = await db.execute(
            select(Module).options()
        )
        # We need to check module-by-module
        from sqlalchemy.orm import selectinload
        modules_result = await db.execute(
            select(Module).options(selectinload(Module.lessons))
        )
        for module in modules_result.scalars().all():
            module_lesson_ids = {l.id for l in module.lessons}
            if module_lesson_ids and module_lesson_ids.issubset(completed_lesson_ids):
                badge = await _award_badge(user_id, "module_master", db)
                newly_earned.append(badge)
                break

    # --- Week Warrior ---
    if "week_warrior" not in existing_keys and completed_count >= 7:
        completion_dates = sorted(
            {r.completed_at.date() for r in completed_records if r.completed_at},
            reverse=True,
        )
        streak = _calculate_streak(completion_dates)
        if streak >= 7:
            badge = await _award_badge(user_id, "week_warrior", db)
            newly_earned.append(badge)

    # --- Quiz Ace ---
    if "quiz_ace" not in existing_keys:
        perfect_result = await db.execute(
            select(QuizAttempt).where(
                QuizAttempt.user_id == user_id,
                QuizAttempt.score == 100,
            )
        )
        if perfect_result.scalar_one_or_none() is not None:
            badge = await _award_badge(user_id, "quiz_ace", db)
            newly_earned.append(badge)

    # --- Course Complete ---
    if "course_complete" not in existing_keys and completed_count >= 1:
        completed_lesson_ids = {r.lesson_id for r in completed_records}
        from sqlalchemy.orm import selectinload
        courses_result = await db.execute(
            select(Course).options(
                selectinload(Course.modules).selectinload(Module.lessons)
            )
        )
        for course in courses_result.scalars().all():
            all_lesson_ids = {
                l.id for m in course.modules for l in m.lessons
            }
            if all_lesson_ids and all_lesson_ids.issubset(completed_lesson_ids):
                badge = await _award_badge(user_id, "course_complete", db)
                newly_earned.append(badge)
                break

    return newly_earned


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


async def _award_badge(user_id: UUID, badge_key: str, db: AsyncSession) -> dict:
    """Insert a UserBadge record and return badge info."""
    defn = BADGE_DEFINITIONS[badge_key]
    badge = UserBadge(
        user_id=user_id,
        badge_key=badge_key,
        badge_name=defn["name"],
        badge_description=defn["description"],
    )
    db.add(badge)
    await db.flush()
    return {
        "badge_key": badge_key,
        "badge_name": defn["name"],
        "badge_description": defn["description"],
    }
