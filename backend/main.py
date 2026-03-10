"""ChalkMind FastAPI backend — health check, lesson generation, + static file serving."""

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from backend.config import RECAPTCHA_ENABLED
from backend.lesson_generator import generate_lesson
from backend.middleware.cors import setup_cors
from backend.middleware.rate_limiter import limiter, rate_limit_exceeded_handler, GENERATE_LESSON_LIMIT
from backend.models.requests import LessonRequest
from backend.observability import create_trace, flush as flush_traces
from backend.security.recaptcha import verify_recaptcha
from backend.security.sanitizer import sanitize_input

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")

app = FastAPI(title="ChalkMind API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
setup_cors(app)


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/generate-lesson")
@limiter.limit(GENERATE_LESSON_LIMIT)
async def generate_lesson_endpoint(request: Request, body: LessonRequest):
    logger.info(">>> /api/generate-lesson called: topic=%s name=%s age=%s diff=%s recaptcha=%s",
                body.topic, body.name, body.age_group, body.difficulty, bool(body.recaptcha_token))
    try:
        # Layer 2: reCAPTCHA verification
        logger.info("  [1] Verifying reCAPTCHA (enabled=%s)...", RECAPTCHA_ENABLED)
        await verify_recaptcha(body.recaptcha_token)
        logger.info("  [1] reCAPTCHA OK")

        # Layer 4-5: Sanitize topic (profanity + injection check)
        logger.info("  [2] Sanitizing inputs...")
        sanitized_topic = sanitize_input(body.topic)
        sanitized_name = sanitize_input(body.name)
        logger.info("  [2] Sanitized: topic=%s name=%s", sanitized_topic, sanitized_name)

        # Create observability trace
        trace = create_trace("generate-lesson", metadata={
            "topic": sanitized_topic,
            "name": sanitized_name,
            "age_group": body.age_group,
            "difficulty": body.difficulty,
        })

        # Generate lesson with personalization
        logger.info("  [3] Starting lesson generation...")
        lesson = await generate_lesson(
            topic=sanitized_topic,
            name=sanitized_name,
            age_group=body.age_group,
            difficulty=body.difficulty,
            trace=trace,
        )
        logger.info("  [3] Lesson generated successfully, %d steps", len(lesson.get("steps", [])))
        flush_traces()
        return lesson
    except HTTPException as e:
        logger.warning("  HTTPException: %s %s", e.status_code, e.detail)
        raise
    except ValueError as e:
        logger.error("  ValueError: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("  Unexpected error: %s", e)
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


# Serve frontend static files (must be last — catches all paths for SPA routing)
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
