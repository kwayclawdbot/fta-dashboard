import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slug: Mapped[str] = mapped_column(sa.String(255), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text)
    thumbnail_url: Mapped[str | None] = mapped_column(sa.Text)
    tier_required: Mapped[str] = mapped_column(
        sa.String(50), nullable=False, default="free"
    )
    track: Mapped[str | None] = mapped_column(sa.String(100))
    age_group: Mapped[str | None] = mapped_column(sa.String(50))
    sort_order: Mapped[int] = mapped_column(sa.Integer, default=0)
    published: Mapped[bool] = mapped_column(sa.Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    # Relationships
    modules: Mapped[list["Module"]] = relationship(
        back_populates="course", order_by="Module.sort_order"
    )


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    title: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text)
    sort_order: Mapped[int] = mapped_column(sa.Integer, default=0)

    # Relationships
    course: Mapped[Course] = relationship(back_populates="modules")
    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="module", order_by="Lesson.sort_order"
    )


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("modules.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    title: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(
        sa.String(50), nullable=False, default="video"
    )
    content_url: Mapped[str | None] = mapped_column(sa.Text)
    content_body: Mapped[str | None] = mapped_column(sa.Text)
    duration_minutes: Mapped[int | None] = mapped_column(sa.Integer)
    sort_order: Mapped[int] = mapped_column(sa.Integer, default=0)
    has_quiz: Mapped[bool] = mapped_column(sa.Boolean, default=False)

    # Relationships
    module: Mapped[Module] = relationship(back_populates="lessons")
    drip_schedule: Mapped["DripSchedule | None"] = relationship(
        back_populates="lesson", uselist=False
    )


class DripSchedule(Base):
    __tablename__ = "drip_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("lessons.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    days_after_enrollment: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    available_from: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))

    # Relationships
    lesson: Mapped[Lesson] = relationship(back_populates="drip_schedule")


class LessonProgress(Base):
    __tablename__ = "lesson_progress"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        sa.String(50), nullable=False, default="not_started"
    )
    progress_pct: Mapped[int] = mapped_column(sa.Integer, default=0)
    time_spent_minutes: Mapped[int] = mapped_column(sa.Integer, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    # Relationships
    lesson: Mapped[Lesson] = relationship()

    __table_args__ = (
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson"),
    )


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    questions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    passing_score: Mapped[int] = mapped_column(sa.Integer, default=70)

    # Relationships
    attempts: Mapped[list["QuizAttempt"]] = relationship(back_populates="quiz")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    passed: Mapped[bool] = mapped_column(sa.Boolean, nullable=False)
    answers: Mapped[dict] = mapped_column(JSONB, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    # Relationships
    quiz: Mapped[Quiz] = relationship(back_populates="attempts")


class UserBadge(Base):
    __tablename__ = "user_badges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    badge_key: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    badge_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    badge_description: Mapped[str] = mapped_column(sa.Text, nullable=False)
    earned_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    __table_args__ = (
        sa.UniqueConstraint("user_id", "badge_key", name="uq_user_badge"),
    )


class LiveSession(Base):
    __tablename__ = "live_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text)
    host_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(sa.Integer, default=60)
    join_url: Mapped[str | None] = mapped_column(sa.Text)
    recording_url: Mapped[str | None] = mapped_column(sa.Text)
    thumbnail_url: Mapped[str | None] = mapped_column(sa.Text)
    status: Mapped[str] = mapped_column(
        sa.String(50), nullable=False, default="scheduled"
    )  # scheduled, live, completed, cancelled
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
