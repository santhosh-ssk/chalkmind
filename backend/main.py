"""ChalkMind FastAPI backend — health check + static file serving."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

load_dotenv()

app = FastAPI(title="ChalkMind API")


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


# Serve frontend static files (must be last — catches all paths for SPA routing)
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
