"""
FTA AI Coach — Voice tutor endpoints.

POST /coach/ask          — Answer a student question (text + audio)
POST /coach/intro        — Personalized lesson intro (text + audio)
POST /coach/feedback     — Post-quiz feedback (text + audio)
POST /coach/transcribe   — Transcribe audio via Whisper
GET  /coach/history/{id} — Get conversation history for a lesson
"""

import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.lms import Lesson, LessonProgress, QuizAttempt
from app.models.user import Profile

router = APIRouter()

HAIKU_MODEL = "claude-haiku-4-5-20251001"
TTS_MODEL = "tts-1"
TTS_VOICE = "nova"


# ── Schemas ──

class AskRequest(BaseModel):
    lesson_id: str
    section_id: Optional[str] = None
    section_content: Optional[str] = None
    question: str
    conversation_history: list[dict] = []
    audio: bool = True
    voice: str = TTS_VOICE

class IntroRequest(BaseModel):
    lesson_id: str
    lesson_title: str
    lesson_objectives: list[str] = []
    audio: bool = True
    voice: str = TTS_VOICE

class FeedbackRequest(BaseModel):
    lesson_id: str
    score: int
    total: int
    answers: list[dict] = []
    audio: bool = True
    voice: str = TTS_VOICE

class CoachResponse(BaseModel):
    text: str
    audio_url: Optional[str] = None


# ── AI Helpers ──

def _call_haiku(prompt: str, max_tokens: int = 400) -> str:
    if not settings.ANTHROPIC_API_KEY:
        return ""
    body = json.dumps({
        "model": HAIKU_MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, method="POST")
    req.add_header("x-api-key", settings.ANTHROPIC_API_KEY)
    req.add_header("anthropic-version", "2023-06-01")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            if data.get("content"):
                return data["content"][0]["text"]
    except Exception as e:
        print(f"[Coach] Haiku error: {e}")
    return ""


def _generate_tts(text: str, voice: str = TTS_VOICE) -> bytes | None:
    if not settings.OPENAI_API_KEY:
        return None
    body = json.dumps({"model": TTS_MODEL, "input": text, "voice": voice, "response_format": "mp3"}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=body, method="POST")
    req.add_header("Authorization", f"Bearer {settings.OPENAI_API_KEY}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read()
    except Exception as e:
        print(f"[Coach] TTS error: {e}")
    return None


def _upload_audio(audio_bytes: bytes, filename: str) -> str | None:
    if not audio_bytes or not settings.SUPABASE_URL:
        return None
    key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_ANON_KEY
    bucket = "coach-audio"
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{filename}"
    req = urllib.request.Request(url, data=audio_bytes, method="POST")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "audio/mpeg")
    req.add_header("x-upsert", "true")
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
        return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{filename}"
    except Exception:
        import base64
        return "data:audio/mpeg;base64," + base64.b64encode(audio_bytes).decode()


def _make_audio(text: str, voice: str, prefix: str, user_id: str, lesson_id: str) -> str | None:
    audio_bytes = _generate_tts(text, voice)
    if not audio_bytes:
        return None
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"{prefix}_{str(user_id)[:8]}_{lesson_id}_{ts}.mp3"
    return _upload_audio(audio_bytes, filename)


# ── Helper: get user context ──

async def _get_user_context(user: Profile, db: AsyncSession) -> dict:
    """Get student name, progress, recent quiz results for prompt context."""
    name = (user.display_name or user.email or "").split()[0] if user.display_name else ""
    age_group = user.age_group or "adult"

    # Count completed lessons
    result = await db.execute(
        select(func.count()).select_from(LessonProgress)
        .where(LessonProgress.user_id == user.id, LessonProgress.status == "completed")
    )
    completed_count = result.scalar() or 0

    # Recent quiz attempts
    result = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user.id)
        .order_by(QuizAttempt.attempted_at.desc())
        .limit(5)
    )
    recent_quizzes = result.scalars().all()

    quiz_summary = ""
    if recent_quizzes:
        last = recent_quizzes[0]
        quiz_summary = f"Last quiz score: {last.score}% ({'passed' if last.passed else 'failed'})"

    audience = "adult"
    if age_group in ("teen", "teens", "13-17"):
        audience = "teen"
    elif age_group in ("kid", "kids", "8-12"):
        audience = "kid"

    return {
        "name": name,
        "audience": audience,
        "completed_count": completed_count,
        "quiz_summary": quiz_summary,
    }


# ── Routes ──

@router.post("/ask", response_model=CoachResponse)
async def ask_coach(
    body: AskRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ctx = await _get_user_context(current_user, db)

    section_ctx = ""
    if body.section_content:
        section_ctx = f"\nCurrent section content:\n---\n{body.section_content[:2000]}\n---"

    conv_ctx = ""
    if body.conversation_history:
        conv_ctx = "\nPrior Q&A:\n"
        for msg in body.conversation_history[-6:]:
            conv_ctx += f"  {msg.get('role','')}: {msg.get('content','')}\n"

    prompt = f"""You are the FTA AI Coach — a knowledgeable, patient trading tutor.
Student name: {ctx['name'] or 'Student'}
Audience: {ctx['audience']}
Lessons completed: {ctx['completed_count']}
{ctx['quiz_summary']}
{section_ctx}
{conv_ctx}

STUDENT ASKS: "{body.question}"

Answer in 2-4 sentences. Conversational. Use an analogy or example.
Don't repeat lesson content — add new perspective.
{"Simple words, fun comparisons — kid audience." if ctx['audience'] == 'kid' else ""}
{"Relatable, cool — teen audience." if ctx['audience'] == 'teen' else ""}
Plain text only (read aloud as audio). No markdown."""

    text = _call_haiku(prompt, 300)
    if not text:
        text = "Great question! Let me think about that... could you try rephrasing?"

    audio_url = _make_audio(text, body.voice, "ask", str(current_user.id), body.lesson_id) if body.audio else None

    # Save to ai_conversations/ai_messages via Supabase REST (avoid needing ORM models for these)
    _save_conversation(str(current_user.id), body.lesson_id, body.question, text, audio_url)

    return CoachResponse(text=text, audio_url=audio_url)


@router.post("/intro", response_model=CoachResponse)
async def coach_intro(
    body: IntroRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ctx = await _get_user_context(current_user, db)
    objectives = "\n".join(f"- {o}" for o in body.lesson_objectives) if body.lesson_objectives else "Not specified"

    prompt = f"""You are the FTA AI Coach. Generate a personalized 15-second intro greeting.
Student: {ctx['name'] or 'there'}
Audience: {ctx['audience']}
Lesson: "{body.lesson_title}"
Completed: {ctx['completed_count']} lessons
{ctx['quiz_summary']}
Objectives:\n{objectives}

3-5 sentences, max 100 words. Warm, motivating. Plain text only. No markdown."""

    text = _call_haiku(prompt, 200)
    if not text:
        text = f"Hey {ctx['name'] or 'there'}! Ready for today's lesson? Let's get into it."

    audio_url = _make_audio(text, body.voice, "intro", str(current_user.id), body.lesson_id) if body.audio else None
    return CoachResponse(text=text, audio_url=audio_url)


@router.post("/feedback", response_model=CoachResponse)
async def coach_feedback(
    body: FeedbackRequest,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ctx = await _get_user_context(current_user, db)
    pct = round(body.score / body.total * 100) if body.total > 0 else 0
    wrong = [a for a in body.answers if not a.get("is_correct", a.get("correct", True))]

    prompt = f"""You are the FTA AI Coach. Post-quiz feedback.
Student: {ctx['name'] or 'there'}
Audience: {ctx['audience']}
Score: {body.score}/{body.total} ({pct}%)
Wrong answers: {json.dumps(wrong[:5]) if wrong else "None — perfect!"}

3-5 sentences. Reference wrong answers. Encourage. Plain text only."""

    text = _call_haiku(prompt, 300)
    if not text:
        text = f"You scored {body.score}/{body.total}. {'Great job!' if pct >= 70 else 'Keep practicing!'}"

    audio_url = _make_audio(text, body.voice, "feedback", str(current_user.id), body.lesson_id) if body.audio else None
    return CoachResponse(text=text, audio_url=audio_url)


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: Annotated[Profile, Depends(get_current_user)] = None,
):
    if not settings.OPENAI_API_KEY:
        raise HTTPException(500, "OpenAI not configured")

    audio_data = await file.read()
    if not audio_data:
        return {"text": ""}

    boundary = "----Boundary" + os.urandom(8).hex()
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-1\r\n"
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{file.filename or 'audio.webm'}\"\r\n"
        f"Content-Type: {file.content_type or 'audio/webm'}\r\n\r\n"
    ).encode() + audio_data + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request("https://api.openai.com/v1/audio/transcriptions", data=body, method="POST")
    req.add_header("Authorization", f"Bearer {settings.OPENAI_API_KEY}")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return {"text": data.get("text", "")}
    except Exception as e:
        print(f"[Coach] Whisper error: {e}")
        return {"text": ""}


def _save_conversation(user_id: str, lesson_id: str, question: str, answer: str, audio_url: str | None):
    """Save Q&A to Supabase via REST (lightweight, no ORM needed)."""
    if not settings.SUPABASE_URL:
        return
    key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_ANON_KEY
    data = json.dumps({
        "user_id": user_id,
        "lesson_id": lesson_id,
        "question": question,
        "answer": answer,
        "audio_url": audio_url,
    }).encode()
    url = f"{settings.SUPABASE_URL}/rest/v1/coach_conversations"
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
    except Exception as e:
        print(f"[Coach] Save conversation error: {e}")
