from uuid import UUID

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import Family

stripe.api_key = settings.STRIPE_SECRET_KEY

TIER_PRICE_MAP = {
    "challenge": settings.STRIPE_CHALLENGE_PRICE_ID,
    "academy": settings.STRIPE_ACADEMY_PRICE_ID,
}


async def create_checkout_session(
    tier: str,
    family_id: UUID,
    customer_email: str,
) -> str:
    """Create a Stripe Checkout session and return the checkout URL."""
    price_id = TIER_PRICE_MAP.get(tier)
    if not price_id:
        raise ValueError(f"Unknown tier: {tier}")

    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        customer_email=customer_email,
        metadata={
            "family_id": str(family_id),
            "tier": tier,
        },
        success_url=f"{settings.FRONTEND_URL}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/checkout/cancel",
    )

    return session.url


async def handle_checkout_completed(
    session: dict,
    db: AsyncSession,
) -> None:
    """Handle a completed checkout session — update family plan and Stripe fields."""
    family_id = session.get("metadata", {}).get("family_id")
    tier = session.get("metadata", {}).get("tier")
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")

    if not family_id or not tier:
        return

    result = await db.execute(
        select(Family).where(Family.id == UUID(family_id))
    )
    family = result.scalar_one_or_none()

    if family is None:
        return

    family.plan_tier = tier
    if customer_id:
        family.stripe_customer_id = customer_id
    if subscription_id:
        family.stripe_subscription_id = subscription_id

    db.add(family)
    await db.flush()


def create_portal_session(customer_id: str) -> str:
    """Create a Stripe customer portal session and return the portal URL."""
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.FRONTEND_URL}/dashboard",
    )
    return session.url
