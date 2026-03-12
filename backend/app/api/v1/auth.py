from datetime import datetime
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import Family, Profile

router = APIRouter()


# --- Schemas ---


class AuthCallbackRequest(BaseModel):
    access_token: str


class FamilyOut(BaseModel):
    id: UUID
    name: str
    plan_tier: str
    enrolled_at: datetime
    expires_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProfileOut(BaseModel):
    id: UUID
    family_id: UUID | None = None
    role: str
    display_name: str | None = None
    avatar_url: str | None = None
    email: str | None = None
    age_group: str | None = None
    track: str | None = None
    onboarding_complete: bool
    family: FamilyOut | None = None

    model_config = {"from_attributes": True}


# --- Routes ---


@router.post("/callback", response_model=ProfileOut)
async def auth_callback(
    body: AuthCallbackRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Receives a Supabase access token, verifies it against Supabase,
    and returns or creates the user profile.
    """
    # Verify token with Supabase
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {body.access_token}",
                "apikey": settings.SUPABASE_ANON_KEY,
            },
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase token",
        )

    supabase_user = resp.json()
    user_id = UUID(supabase_user["id"])
    email = supabase_user.get("email")

    # Find or create profile
    result = await db.execute(
        select(Profile)
        .options(selectinload(Profile.family))
        .where(Profile.id == user_id)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        profile = Profile(
            id=user_id,
            email=email,
            role="parent",
            onboarding_complete=False,
        )
        db.add(profile)
        await db.flush()
        await db.refresh(profile, attribute_names=["family"])

    return profile


@router.get("/me", response_model=ProfileOut)
async def get_me(
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    """Return the current authenticated user's profile with family info."""
    return current_user
