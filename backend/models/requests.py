"""Pydantic request models for ChalkMind API."""

from typing import Literal

from pydantic import BaseModel, Field


class LessonRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=200)
    name: str = Field(..., min_length=1, max_length=50)
    age_group: Literal["1-5", "6-10", "10-18", "18-40", "40-60", "60+"] = Field(default="18-40")
    difficulty: Literal["beginner", "intermediate", "advanced"] = Field(default="beginner")
    recaptcha_token: str = Field(default="")
