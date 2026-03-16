"""Input sanitization: HTML stripping, profanity filtering, injection detection."""

import re

from better_profanity import profanity
from fastapi import HTTPException

from backend.security.blocklist import check_injection, check_sensitive_topic

# Initialize profanity filter once
profanity.load_censor_words()


def sanitize_input(text: str) -> str:
    """Sanitize user input text. Raises HTTPException(400) on violation."""
    # Reject any input containing HTML/script tags outright
    if re.search(r"<[^>]+>", text):
        raise HTTPException(
            status_code=400,
            detail="HTML and script tags are not allowed.",
        )

    # Remove control characters (keep newlines and tabs)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    text = text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Input cannot be empty.")

    # Profanity check
    if profanity.contains_profanity(text):
        raise HTTPException(
            status_code=400,
            detail="Please keep your input appropriate for an educational setting.",
        )

    # Prompt injection check
    if check_injection(text):
        raise HTTPException(
            status_code=400,
            detail="Your input contains disallowed patterns. Please rephrase your request.",
        )

    # Sensitive / dangerous topic check
    if check_sensitive_topic(text):
        raise HTTPException(
            status_code=400,
            detail="This topic isn't suitable for an educational lesson. Please choose a different topic.",
        )

    return text
