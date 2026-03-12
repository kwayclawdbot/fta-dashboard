import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Family(Base):
    __tablename__ = "families"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    plan_tier: Mapped[str] = mapped_column(
        sa.String(50), nullable=False, default="free"
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(sa.String(255))
    stripe_subscription_id: Mapped[str | None] = mapped_column(sa.String(255))
    enrolled_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    expires_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))

    # Relationships
    members: Mapped[list["Profile"]] = relationship(back_populates="family")


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    family_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("families.id", ondelete="SET NULL")
    )
    role: Mapped[str] = mapped_column(
        sa.String(50), nullable=False, default="parent"
    )
    display_name: Mapped[str | None] = mapped_column(sa.String(255))
    avatar_url: Mapped[str | None] = mapped_column(sa.Text)
    email: Mapped[str | None] = mapped_column(sa.String(320))
    age_group: Mapped[str | None] = mapped_column(sa.String(50))
    track: Mapped[str | None] = mapped_column(sa.String(100))
    onboarding_complete: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    # Relationships
    family: Mapped[Family | None] = relationship(back_populates="members")
