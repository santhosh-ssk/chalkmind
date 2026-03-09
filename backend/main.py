"""ChalkMind FastAPI backend — health check, lesson generation, + static file serving."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.lesson_generator import generate_lesson

load_dotenv()

app = FastAPI(title="ChalkMind API")


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


class LessonRequest(BaseModel):
    topic: str


@app.post("/api/generate-lesson")
async def generate_lesson_endpoint(request: LessonRequest):
    try:
        lesson = await generate_lesson(request.topic)
        return lesson
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


# Serve frontend static files (must be last — catches all paths for SPA routing)
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
