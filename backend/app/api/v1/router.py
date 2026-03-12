from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.courses import router as courses_router
from app.api.v1.families import router as families_router
from app.api.v1.progress import router as progress_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(courses_router, prefix="/courses", tags=["courses"])
api_router.include_router(families_router, prefix="/families", tags=["families"])
api_router.include_router(progress_router, prefix="/progress", tags=["progress"])
