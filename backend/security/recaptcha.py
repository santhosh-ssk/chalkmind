"""Google reCAPTCHA v3 verification."""

import httpx
from fastapi import HTTPException

from backend.config import RECAPTCHA_ENABLED, RECAPTCHA_SECRET_KEY, RECAPTCHA_SCORE_THRESHOLD

VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


async def verify_recaptcha(token: str) -> float:
    """Verify reCAPTCHA token and return score. Raises HTTPException(403) on failure."""
    if not RECAPTCHA_ENABLED:
        return 1.0

    if not token:
        raise HTTPException(status_code=403, detail="reCAPTCHA token is required.")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            VERIFY_URL,
            data={"secret": RECAPTCHA_SECRET_KEY, "response": token},
        )
        result = response.json()

    if not result.get("success", False):
        raise HTTPException(status_code=403, detail="reCAPTCHA verification failed.")

    score = result.get("score", 0.0)
    if score < RECAPTCHA_SCORE_THRESHOLD:
        raise HTTPException(status_code=403, detail="Request blocked by bot detection.")

    return score
