from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.courses import router as courses_router
from app.api.v1.families import router as families_router
from app.api.v1.onboarding import router as onboarding_router
from app.api.v1.progress import router as progress_router
from app.api.v1.stripe import router as stripe_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(courses_router, prefix="/courses", tags=["courses"])
api_router.include_router(families_router, prefix="/families", tags=["families"])
api_router.include_router(onboarding_router, prefix="/onboarding", tags=["onboarding"])
api_router.include_router(progress_router, prefix="/progress", tags=["progress"])
api_router.include_router(stripe_router, prefix="/stripe", tags=["stripe"])
