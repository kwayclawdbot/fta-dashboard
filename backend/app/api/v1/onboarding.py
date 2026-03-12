from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import Profile

router = APIRouter()


# --- Schemas ---


class ProfileUpdateRequest(BaseModel):
    role: str | None = None
    track: str | None = None
    age_group: str | None = None
    display_name: str | None = None


class ProfileUpdateOut(BaseModel):
    id: UUID
    role: str
    display_name: str | None = None
    track: str | None = None
    age_group: str | None = None
    onboarding_complete: bool

    model_config = {"from_attributes": True}


class OnboardingStatusOut(BaseModel):
    onboarding_complete: bool
    missing: list[str]


# --- Routes ---


@router.put("/profile", response_model=ProfileUpdateOut)
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update current user's profile during onboarding."""
    if body.role is not None:
        current_user.role = body.role
    if body.track is not None:
        current_user.track = body.track
    if body.age_group is not None:
        current_user.age_group = body.age_group
    if body.display_name is not None:
        current_user.display_name = body.display_name

    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)

    return current_user


@router.put("/complete", response_model=ProfileUpdateOut)
async def complete_onboarding(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark onboarding as complete for the current user."""
    current_user.onboarding_complete = True
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)

    return current_user


@router.get("/status", response_model=OnboardingStatusOut)
async def get_onboarding_status(
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    """Get onboarding completion status and what's missing."""
    missing: list[str] = []

    if not current_user.display_name:
        missing.append("display_name")
    if not current_user.role or current_user.role == "parent":
        # role defaults to parent, check if it's been explicitly set
        pass
    if not current_user.track:
        missing.append("track")
    if not current_user.age_group:
        missing.append("age_group")
    if current_user.family_id is None:
        missing.append("family")

    return OnboardingStatusOut(
        onboarding_complete=current_user.onboarding_complete,
        missing=missing,
    )
