import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user, require_role
from app.core.config import settings
from app.core.database import get_db
from app.models.user import Family, FamilyInvite, Profile

router = APIRouter()


# --- Schemas ---


class FamilyCreateRequest(BaseModel):
    name: str
    plan_tier: str = "free"


class FamilyOut(BaseModel):
    id: UUID
    name: str
    plan_tier: str
    enrolled_at: datetime
    expires_at: datetime | None = None

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    id: UUID
    role: str
    display_name: str | None = None
    avatar_url: str | None = None
    email: str | None = None
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


class InviteCreateRequest(BaseModel):
    role: str = "child"


class InviteOut(BaseModel):
    code: str
    url: str
    family_id: UUID
    role: str
    expires_at: datetime | None = None


class InviteDetailOut(BaseModel):
    code: str
    family_name: str
    role: str
    expired: bool


class AcceptInviteOut(BaseModel):
    id: UUID
    family_id: UUID
    role: str
    display_name: str | None = None

    model_config = {"from_attributes": True}


# --- Routes ---


@router.post("", response_model=FamilyOut, status_code=status.HTTP_201_CREATED)
async def create_family(
    body: FamilyCreateRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new family and assign the current user as a member."""
    if current_user.family_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already part of a family",
        )

    family = Family(
        name=body.name,
        plan_tier=body.plan_tier,
    )
    db.add(family)
    await db.flush()

    # Assign the user to the family
    current_user.family_id = family.id
    current_user.role = "parent"
    db.add(current_user)
    await db.flush()
    await db.refresh(family)

    return family


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


@router.get("/me/members", response_model=list[MemberOut])
async def list_family_members(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all members of the current user's family."""
    if current_user.family_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not part of a family yet",
        )

    result = await db.execute(
        select(Profile).where(Profile.family_id == current_user.family_id)
    )
    members = result.scalars().all()
    return members


@router.post("/invites", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
async def create_invite(
    body: InviteCreateRequest,
    current_user: Annotated[Profile, Depends(require_role("parent", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a family invite code. Only parents and admins can create invites."""
    if current_user.family_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be part of a family to create invites",
        )

    code = secrets.token_urlsafe(6)[:8]  # 8-char code
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    invite = FamilyInvite(
        family_id=current_user.family_id,
        code=code,
        role=body.role,
        created_by=current_user.id,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.flush()

    url = f"{settings.FRONTEND_URL}/invite/{code}"

    return InviteOut(
        code=code,
        url=url,
        family_id=current_user.family_id,
        role=body.role,
        expires_at=expires_at,
    )


@router.get("/invites/{code}", response_model=InviteDetailOut)
async def get_invite(
    code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get invite details by code. Public endpoint (no auth required)."""
    result = await db.execute(
        select(FamilyInvite)
        .options(selectinload(FamilyInvite.family))
        .where(FamilyInvite.code == code)
    )
    invite = result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    now = datetime.now(timezone.utc)
    expired = bool(
        invite.used_by is not None
        or (invite.expires_at is not None and invite.expires_at < now)
    )

    return InviteDetailOut(
        code=invite.code,
        family_name=invite.family.name,
        role=invite.role,
        expired=expired,
    )


@router.post("/invites/{code}/accept", response_model=AcceptInviteOut)
async def accept_invite(
    code: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Accept a family invite code and join the family."""
    result = await db.execute(
        select(FamilyInvite).where(FamilyInvite.code == code)
    )
    invite = result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    # Check if already used
    if invite.used_by is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invite has already been used",
        )

    # Check expiry
    now = datetime.now(timezone.utc)
    if invite.expires_at is not None and invite.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invite has expired",
        )

    if current_user.family_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already part of a family",
        )

    # Update the user's profile
    current_user.family_id = invite.family_id
    current_user.role = invite.role
    db.add(current_user)

    # Mark invite as used
    invite.used_by = current_user.id
    invite.used_at = now
    db.add(invite)

    await db.flush()

    return AcceptInviteOut(
        id=current_user.id,
        family_id=current_user.family_id,
        role=current_user.role,
        display_name=current_user.display_name,
    )


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: UUID,
    current_user: Annotated[Profile, Depends(require_role("parent", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Remove a member from the family. Parent/admin only."""
    if current_user.family_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not part of a family",
        )

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove yourself from the family",
        )

    result = await db.execute(
        select(Profile).where(
            Profile.id == user_id,
            Profile.family_id == current_user.family_id,
        )
    )
    member = result.scalar_one_or_none()

    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in your family",
        )

    member.family_id = None
    db.add(member)
    await db.flush()
