import secrets
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.user import Family, Profile

router = APIRouter()


# --- Schemas ---


class MemberOut(BaseModel):
    id: UUID
    role: str
    display_name: str | None = None
    avatar_url: str | None = None
    age_group: str | None = None
    track: str | None = None
    onboarding_complete: bool

    model_config = {"from_attributes": True}


class FamilyDetailOut(BaseModel):
    id: UUID
    name: str
    plan_tier: str
    enrolled_at: datetime
    expires_at: datetime | None = None
    members: list[MemberOut] = []

    model_config = {"from_attributes": True}


class InviteOut(BaseModel):
    code: str
    family_id: UUID
    expires_at: datetime | None = None


class AcceptInviteRequest(BaseModel):
    role: str = "child"
    display_name: str | None = None
    age_group: str | None = None


# --- In-memory invite store (replace with DB table in production) ---
# Maps code -> {family_id, created_by, created_at}
_invites: dict[str, dict] = {}


# --- Routes ---


@router.get("/me", response_model=FamilyDetailOut)
async def get_my_family(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get the current user's family info with all members."""
    if current_user.family_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not part of a family yet",
        )

    result = await db.execute(
        select(Family)
        .options(selectinload(Family.members))
        .where(Family.id == current_user.family_id)
    )
    family = result.scalar_one_or_none()

    if family is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Family not found",
        )

    return family


@router.post("/invites", response_model=InviteOut)
async def create_invite(
    current_user: Annotated[Profile, Depends(require_role("parent", "admin"))],
):
    """Create a family invite code. Only parents and admins can create invites."""
    if current_user.family_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be part of a family to create invites",
        )

    code = secrets.token_urlsafe(16)
    _invites[code] = {
        "family_id": current_user.family_id,
        "created_by": current_user.id,
        "created_at": datetime.utcnow(),
    }

    return InviteOut(
        code=code,
        family_id=current_user.family_id,
    )


@router.post("/invites/{code}/accept", response_model=MemberOut)
async def accept_invite(
    code: str,
    body: AcceptInviteRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Accept a family invite code and join the family."""
    invite = _invites.get(code)
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invite code",
        )

    if current_user.family_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already part of a family",
        )

    # Update the user's profile
    current_user.family_id = invite["family_id"]
    current_user.role = body.role
    if body.display_name:
        current_user.display_name = body.display_name
    if body.age_group:
        current_user.age_group = body.age_group

    db.add(current_user)
    await db.flush()

    # Remove used invite
    del _invites[code]

    return current_user
