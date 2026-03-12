from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import require_role
from app.core.database import get_db
from app.models.lms import Lesson, LessonProgress, UserBadge
from app.models.user import Family, Profile

router = APIRouter()


# --- Schemas ---


class MemberSummary(BaseModel):
    id: UUID
    display_name: str | None = None
    avatar_url: str | None = None
    role: str
    lessons_completed: int = 0
    current_streak: int = 0
    last_active: datetime | None = None
    badges_count: int = 0

    model_config = {"from_attributes": True}


class FamilyOverviewOut(BaseModel):
    family_name: str
    plan_tier: str
    total_lessons_completed: int
    total_hours: float
    average_streak: float
    active_members: int
    members: list[MemberSummary]


class LeaderboardEntry(BaseModel):
    rank: int
    id: UUID
    display_name: str | None = None
    avatar_url: str | None = None
    lessons_completed: int = 0
    current_streak: int = 0


class LeaderboardOut(BaseModel):
    period: str
    entries: list[LeaderboardEntry]


class ActivityEntry(BaseModel):
    member_name: str | None = None
    member_avatar_url: str | None = None
    lesson_title: str
    completed_at: datetime


class ActivityOut(BaseModel):
    activities: list[ActivityEntry]


class MilestoneEntry(BaseModel):
    member_name: str | None = None
    achievement: str
    timestamp: datetime


class MilestonesOut(BaseModel):
    milestones: list[MilestoneEntry]


class RoleUpdateRequest(BaseModel):
    role: str


# --- Helpers ---


def _calculate_streak(completion_dates: list) -> int:
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


async def _get_member_streak(user_id: UUID, db: AsyncSession) -> int:
    result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == user_id,
            LessonProgress.status == "completed",
            LessonProgress.completed_at.isnot(None),
        )
    )
    records = result.scalars().all()
    dates = sorted(
        {r.completed_at.date() for r in records if r.completed_at},
        reverse=True,
    )
    return _calculate_streak(dates)


# --- Routes ---


@router.get("/overview", response_model=FamilyOverviewOut)
async def get_family_overview(
    current_user: Annotated[Profile, Depends(require_role("parent", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Family overview stats for parents."""
    if current_user.family_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not part of a family",
        )

    # Get family
    family_result = await db.execute(
        select(Family).where(Family.id == current_user.family_id)
    )
    family = family_result.scalar_one_or_none()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")

    # Get members
    members_result = await db.execute(
        select(Profile).where(Profile.family_id == current_user.family_id)
    )
    members = members_result.scalars().all()

    member_summaries: list[MemberSummary] = []
    total_completed = 0
    total_minutes = 0
    streaks: list[int] = []
    active_count = 0

    for member in members:
        # Completed lessons count
        completed_result = await db.execute(
            select(func.count(LessonProgress.id)).where(
                LessonProgress.user_id == member.id,
                LessonProgress.status == "completed",
            )
        )
        completed = completed_result.scalar() or 0

        # Time spent
        time_result = await db.execute(
            select(func.coalesce(func.sum(LessonProgress.time_spent_minutes), 0)).where(
                LessonProgress.user_id == member.id,
            )
        )
        minutes = time_result.scalar() or 0

        # Streak
        streak = await _get_member_streak(member.id, db)

        # Badges count
        badges_result = await db.execute(
            select(func.count(UserBadge.id)).where(UserBadge.user_id == member.id)
        )
        badges_count = badges_result.scalar() or 0

        # Last active
        last_result = await db.execute(
            select(func.max(LessonProgress.completed_at)).where(
                LessonProgress.user_id == member.id,
            )
        )
        last_active = last_result.scalar()

        total_completed += completed
        total_minutes += minutes
        streaks.append(streak)

        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        if last_active and last_active > week_ago:
            active_count += 1

        member_summaries.append(
            MemberSummary(
                id=member.id,
                display_name=member.display_name,
                avatar_url=member.avatar_url,
                role=member.role,
                lessons_completed=completed,
                current_streak=streak,
                last_active=last_active,
                badges_count=badges_count,
            )
        )

    avg_streak = sum(streaks) / len(streaks) if streaks else 0.0

    return FamilyOverviewOut(
        family_name=family.name,
        plan_tier=family.plan_tier,
        total_lessons_completed=total_completed,
        total_hours=round(total_minutes / 60, 1),
        average_streak=round(avg_streak, 1),
        active_members=active_count,
        members=member_summaries,
    )


@router.get("/leaderboard", response_model=LeaderboardOut)
async def get_family_leaderboard(
    current_user: Annotated[Profile, Depends(require_role("parent", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    period: str = Query("all", regex="^(week|all)$"),
):
    """Ranked list of family members by lessons completed."""
    if current_user.family_id is None:
        raise HTTPException(status_code=404, detail="You are not part of a family")

    members_result = await db.execute(
        select(Profile).where(Profile.family_id == current_user.family_id)
    )
    members = members_result.scalars().all()

    entries: list[dict] = []

    for member in members:
        conditions = [
            LessonProgress.user_id == member.id,
            LessonProgress.status == "completed",
        ]
        if period == "week":
            week_ago = datetime.now(timezone.utc) - timedelta(days=7)
            conditions.append(LessonProgress.completed_at >= week_ago)

        count_result = await db.execute(
            select(func.count(LessonProgress.id)).where(*conditions)
        )
        completed = count_result.scalar() or 0

        streak = await _get_member_streak(member.id, db)

        entries.append({
            "id": member.id,
            "display_name": member.display_name,
            "avatar_url": member.avatar_url,
            "lessons_completed": completed,
            "current_streak": streak,
        })

    entries.sort(key=lambda e: e["lessons_completed"], reverse=True)

    ranked = [
        LeaderboardEntry(rank=i + 1, **e) for i, e in enumerate(entries)
    ]

    return LeaderboardOut(period=period, entries=ranked)


@router.get("/activity", response_model=ActivityOut)
async def get_family_activity(
    current_user: Annotated[Profile, Depends(require_role("parent", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Last 20 activities across all family members."""
    if current_user.family_id is None:
        raise HTTPException(status_code=404, detail="You are not part of a family")

    members_result = await db.execute(
        select(Profile.id, Profile.display_name, Profile.avatar_url).where(
            Profile.family_id == current_user.family_id
        )
    )
    members = {row[0]: (row[1], row[2]) for row in members_result.all()}
    member_ids = list(members.keys())

    if not member_ids:
        return ActivityOut(activities=[])

    progress_result = await db.execute(
        select(LessonProgress)
        .options(selectinload(LessonProgress.lesson))
        .where(
            LessonProgress.user_id.in_(member_ids),
            LessonProgress.status == "completed",
            LessonProgress.completed_at.isnot(None),
        )
        .order_by(LessonProgress.completed_at.desc())
        .limit(20)
    )
    records = progress_result.scalars().all()

    activities = []
    for r in records:
        name, avatar = members.get(r.user_id, (None, None))
        activities.append(
            ActivityEntry(
                member_name=name,
                member_avatar_url=avatar,
                lesson_title=r.lesson.title if r.lesson else "Unknown",
                completed_at=r.completed_at,
            )
        )

    return ActivityOut(activities=activities)


@router.get("/milestones", response_model=MilestonesOut)
async def get_family_milestones(
    current_user: Annotated[Profile, Depends(require_role("parent", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Recent milestone events across family members."""
    if current_user.family_id is None:
        raise HTTPException(status_code=404, detail="You are not part of a family")

    members_result = await db.execute(
        select(Profile.id, Profile.display_name).where(
            Profile.family_id == current_user.family_id
        )
    )
    members = {row[0]: row[1] for row in members_result.all()}
    member_ids = list(members.keys())

    if not member_ids:
        return MilestonesOut(milestones=[])

    # Get recent badges earned
    badges_result = await db.execute(
        select(UserBadge)
        .where(UserBadge.user_id.in_(member_ids))
        .order_by(UserBadge.earned_at.desc())
        .limit(20)
    )
    badges = badges_result.scalars().all()

    milestones = [
        MilestoneEntry(
            member_name=members.get(b.user_id),
            achievement=f"earned the {b.badge_name} badge",
            timestamp=b.earned_at,
        )
        for b in badges
    ]

    return MilestonesOut(milestones=milestones)
