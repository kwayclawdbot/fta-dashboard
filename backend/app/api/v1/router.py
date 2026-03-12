from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.courses import router as courses_router
from app.api.v1.families import router as families_router
from app.api.v1.live_sessions import router as live_sessions_router
from app.api.v1.onboarding import router as onboarding_router
from app.api.v1.progress import router as progress_router
from app.api.v1.quizzes import router as quizzes_router
from app.api.v1.family_dashboard import router as family_dashboard_router
from app.api.v1.stripe import router as stripe_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(courses_router, prefix="/courses", tags=["courses"])
api_router.include_router(families_router, prefix="/families", tags=["families"])
api_router.include_router(family_dashboard_router, prefix="/family-dashboard", tags=["family-dashboard"])
api_router.include_router(live_sessions_router, prefix="/live-sessions", tags=["live-sessions"])
api_router.include_router(onboarding_router, prefix="/onboarding", tags=["onboarding"])
api_router.include_router(progress_router, prefix="/progress", tags=["progress"])
api_router.include_router(quizzes_router, prefix="/quizzes", tags=["quizzes"])
api_router.include_router(stripe_router, prefix="/stripe", tags=["stripe"])
