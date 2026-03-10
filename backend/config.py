"""Centralized environment configuration for ChalkMind backend."""

import os

from dotenv import load_dotenv

load_dotenv()

RATE_LIMIT = os.getenv("RATE_LIMIT", "1/30seconds")
RECAPTCHA_ENABLED = os.getenv("RECAPTCHA_ENABLED", "false").lower() == "true"
RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY", "")
RECAPTCHA_SCORE_THRESHOLD = float(os.getenv("RECAPTCHA_SCORE_THRESHOLD", "0.5"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
