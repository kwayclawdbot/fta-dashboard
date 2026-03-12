from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.lms import Quiz, QuizAttempt
from app.models.user import Profile

router = APIRouter()


# --- Schemas ---


class QuestionOut(BaseModel):
    question: str
    options: list[str]


class QuizOut(BaseModel):
    id: UUID
    lesson_id: UUID
    title: str
    questions: list[QuestionOut]
    passing_score: int


class AnswerSubmission(BaseModel):
    answers: list[int]  # list of selected option indices, one per question


class QuestionResult(BaseModel):
    question: str
    selected: int
    correct: int
    is_correct: bool


class QuizResultOut(BaseModel):
    quiz_id: UUID
    score: int
    passed: bool
    total_questions: int
    correct_count: int
    results: list[QuestionResult]


class AttemptOut(BaseModel):
    id: UUID
    quiz_id: UUID
    score: int
    passed: bool
    attempted_at: datetime

    model_config = {"from_attributes": True}


# --- Routes ---


@router.get("/{lesson_id}", response_model=QuizOut)
async def get_quiz(
    lesson_id: UUID,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get quiz for a lesson. Returns questions WITHOUT correct answers."""
    result = await db.execute(
        select(Quiz).where(Quiz.lesson_id == lesson_id)
    )
    quiz = result.scalar_one_or_none()

    if quiz is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No quiz found for this lesson",
        )

    # Strip correctIndex from questions before returning
    questions_out = []
    for q in quiz.questions:
        questions_out.append(
            QuestionOut(
                question=q["question"],
                options=q["options"],
            )
        )

    return QuizOut(
        id=quiz.id,
        lesson_id=quiz.lesson_id,
        title=quiz.title,
        questions=questions_out,
        passing_score=quiz.passing_score,
    )


@router.post("/{lesson_id}/submit", response_model=QuizResultOut)
async def submit_quiz(
    lesson_id: UUID,
    body: AnswerSubmission,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit quiz answers. Returns score, pass/fail, and correct answers."""
    result = await db.execute(
        select(Quiz).where(Quiz.lesson_id == lesson_id)
    )
    quiz = result.scalar_one_or_none()

    if quiz is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No quiz found for this lesson",
        )

    questions = quiz.questions
    if len(body.answers) != len(questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Expected {len(questions)} answers, got {len(body.answers)}",
        )

    # Grade
    correct_count = 0
    results = []
    for i, q in enumerate(questions):
        correct_idx = q["correctIndex"]
        is_correct = body.answers[i] == correct_idx
        if is_correct:
            correct_count += 1
        results.append(
            QuestionResult(
                question=q["question"],
                selected=body.answers[i],
                correct=correct_idx,
                is_correct=is_correct,
            )
        )

    total = len(questions)
    score = int((correct_count / total) * 100) if total > 0 else 0
    passed = score >= quiz.passing_score

    # Save attempt
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=current_user.id,
        score=score,
        passed=passed,
        answers={"answers": body.answers},
    )
    db.add(attempt)
    await db.flush()

    return QuizResultOut(
        quiz_id=quiz.id,
        score=score,
        passed=passed,
        total_questions=total,
        correct_count=correct_count,
        results=results,
    )
