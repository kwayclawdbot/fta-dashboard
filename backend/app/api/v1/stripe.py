from typing import Annotated
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_role
from app.core.config import settings
from app.core.database import get_db
from app.models.user import Profile
from app.services.stripe_service import (
    create_checkout_session,
    create_portal_session,
    handle_checkout_completed,
)

router = APIRouter()


# --- Schemas ---


class CheckoutRequest(BaseModel):
    tier: str  # "challenge" or "academy"
    family_id: UUID


class CheckoutOut(BaseModel):
    checkout_url: str


class PortalOut(BaseModel):
    portal_url: str


# --- Routes ---


@router.post("/checkout", response_model=CheckoutOut)
async def create_checkout(
    body: CheckoutRequest,
    current_user: Annotated[Profile, Depends(require_role("parent", "admin"))],
):
    """Create a Stripe checkout session. Parent/admin only."""
    if body.tier not in ("challenge", "academy"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tier must be 'challenge' or 'academy'",
        )

    if current_user.family_id is None or current_user.family_id != body.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create checkouts for your own family",
        )

    try:
        url = await create_checkout_session(
            tier=body.tier,
            family_id=body.family_id,
            customer_email=current_user.email or "",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe error: {e}",
        )

    return CheckoutOut(checkout_url=url)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload",
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature",
        )

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await handle_checkout_completed(session, db)

    return {"status": "ok"}


@router.get("/portal", response_model=PortalOut)
async def get_portal(
    current_user: Annotated[Profile, Depends(require_role("parent", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a Stripe customer portal session for managing subscription."""
    if current_user.family_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not part of a family",
        )

    if current_user.family is None or not current_user.family.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Stripe customer found for your family",
        )

    try:
        url = create_portal_session(current_user.family.stripe_customer_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe error: {e}",
        )

    return PortalOut(portal_url=url)
