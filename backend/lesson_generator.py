"""Generate whiteboard lessons using Gemini and the Drawing DSL."""

import json
import os
import re

from google import genai
from google.genai import types

DSL_SYSTEM_PROMPT = """You are a visual teacher creating animated whiteboard lessons.
Given a topic, produce a rich, detailed lesson with beautiful hand-drawn-style diagrams.

IMPORTANT: Your lesson is MULTI-SCENE. Each scene gets a FRESH, BLANK canvas.
This means you can use the full canvas space in each scene without worrying about overlapping previous content.

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no backticks:
{
  "title": "Topic title",
  "scenes": [
    {
      "scene_title": "Short title for this scene (3-5 words)",
      "steps": [
        {
          "narration": "What the teacher says (1-2 sentences, conversational)",
          "draws": [
            // Each draw command animates onto the board sequentially
          ]
        }
      ]
    }
  ]
}

SCENE STRUCTURE (CRITICAL):
- Create EXACTLY 3-4 scenes for a complete lesson
- Each scene has 2-4 steps
- Each scene gets a FRESH BLANK canvas — previous scene content is NOT visible
- Scene 1: Introduction / big picture overview
- Scene 2: Main concept deep-dive / internal details
- Scene 3: Process or mechanism explanation
- Scene 4 (optional): Summary / key takeaways
- Think of scenes like "slides" or "chapters" — each one is self-contained visually

DRAW COMMAND TYPES (use ONLY these):

1. PATH — For any shape, curve, or organic form. Use smooth cubic bezier curves.
   {"type":"path","d":"M100 200 C120 180, 150 170, 160 190 ...","stroke":"#color","fill":"#color or none","strokeWidth":2}
   PATH QUALITY RULES:
   - ALWAYS use C (cubic bezier) commands for organic shapes, NOT straight lines
   - Control points must create SMOOTH curves — avoid sharp zigzags
   - Close organic shapes with Z command
   - For leaves: use 2 mirrored curves meeting at tip and base
   - For roots: use gentle S-curves, not jagged lines
   - Keep paths simple: 3-6 curve segments max per path

2. LINE — Straight line
   {"type":"line","x1":0,"y1":0,"x2":100,"y2":100,"stroke":"#color","strokeWidth":2,"dash":false}

3. ARROW — Line with arrowhead (for flows, processes, pointers)
   {"type":"arrow","x1":0,"y1":0,"x2":100,"y2":100,"stroke":"#color","strokeWidth":2,"dash":false}

4. CIRCLE — Circle or ellipse
   {"type":"circle","cx":100,"cy":100,"r":30,"stroke":"#color","fill":"#color or none","strokeWidth":2}

5. RECT — Rectangle
   {"type":"rect","x":0,"y":0,"w":100,"h":50,"stroke":"#color","fill":"#color or none","strokeWidth":1,"rx":4}

6. TEXT — Label text on the board (minimum fontSize: 20, use 22-26 for titles)
   {"type":"text","x":100,"y":100,"content":"Label","color":"#color","fontSize":22}

7. ANNOTATION — Text with background box (minimum fontSize: 18, keep content SHORT — max 5-6 words)
   {"type":"annotation","x":100,"y":100,"content":"Short note","color":"#color","fontSize":18}

8. BRACE — Curly brace spanning a region with label
   {"type":"brace","x":100,"y":50,"height":120,"side":"right","label":"Description","color":"#color"}

COLOR PALETTE (use these exact hex values for a warm whiteboard feel):
- White/chalk: #e8e4d9
- Green (plants, positive): #5cb85c
- Dark green: #3d8b3d
- Blue (water, cool): #5ba3e6
- Red/coral (warning, hot): #e07050
- Yellow/gold (energy, light): #f5c842
- Orange: #f0a050
- Brown (earth, wood): #8b7355
- Pink: #e88aaf
- Teal: #5ab8b8
- Purple: #9b7ed8
- Dim/gray: #706b60

CANVAS SIZE: 780 x 680 pixels. Each scene starts with a FRESH blank canvas.

SPATIAL RULES (CRITICAL — prevents overlapping):
- Divide canvas into quadrants: top-left, top-right, bottom-left, bottom-right
- NEVER place two text/annotation elements within 60px of each other vertically
- NEVER overlap filled shapes — leave at least 30px gap between shapes
- Labels MUST go OUTSIDE shapes with clear space — never place text on top of shapes
- Annotations MUST be placed in completely empty areas — never overlapping any drawing
- Each step should use DIFFERENT areas of the canvas — spread out content
- Before placing any element, mentally check: does this overlap anything already placed IN THIS SCENE?
- Text labels should be offset at least 20px away from the edge of any shape
- Keep at least 80px clear margin between major diagram groups
- Title/header: always at y:30-60, center of canvas

LAYOUT RULES:
- Use the FULL canvas in each scene — don't cram into one corner
- Build scenes that are spatially logical (roots at BOTTOM, sky at TOP, etc.)
- Leave space between elements for labels and arrows
- For organic/natural objects, use smooth bezier curves in PATH commands
- Use arrows to show flows, processes, cause-and-effect
- Add labels and annotations to explain what each part is

DRAWING QUALITY:
- For natural objects (plants, animals, organs), use MULTIPLE PATH commands with smooth cubic beziers
- Add detail: texture lines, small decorative elements, subtle curves
- Each step MUST have 4-8 draw commands — never fewer than 4
- Use fill colors with organic shapes — don't leave everything as outlines
- Layer elements naturally: background elements first, foreground on top
- Consistent stroke widths: 2 for main shapes, 1 for detail, 3 for emphasis
- Shapes should be PROPORTIONAL

TEACHING STYLE:
- Narration should be conversational, like a friendly teacher
- Build up the concept piece by piece within each scene
- Each scene focuses on ONE aspect — don't try to show everything at once
- End with a summary scene that ties everything together"""

VALID_DRAW_TYPES = {"path", "line", "arrow", "circle", "rect", "text", "annotation", "brace"}


def strip_fences(text: str) -> str:
    """Remove markdown code fences if present."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def validate_and_flatten(data: dict) -> dict:
    """Validate lesson JSON and flatten scenes into steps with scene metadata.

    Input format (from Gemini):
    {
        "title": "...",
        "scenes": [
            { "scene_title": "...", "steps": [...] }
        ]
    }

    Output format (for frontend):
    {
        "title": "...",
        "scene_count": N,
        "steps": [
            { "narration": "...", "draws": [...], "scene": 0, "scene_title": "..." }
        ]
    }
    """
    if not isinstance(data, dict):
        raise ValueError("Lesson must be a JSON object")
    if not isinstance(data.get("title"), str) or not data["title"]:
        raise ValueError("Lesson must have a non-empty 'title' string")

    scenes = data.get("scenes")

    # Support both scene-based and flat format
    if isinstance(scenes, list) and len(scenes) > 0:
        flat_steps = []
        for si, scene in enumerate(scenes):
            if not isinstance(scene, dict):
                raise ValueError(f"Scene {si} must be an object")
            scene_title = scene.get("scene_title", f"Scene {si + 1}")
            scene_steps = scene.get("steps")
            if not isinstance(scene_steps, list) or len(scene_steps) == 0:
                raise ValueError(f"Scene {si} must have a non-empty 'steps' array")
            for sj, step in enumerate(scene_steps):
                if not isinstance(step, dict):
                    raise ValueError(f"Scene {si}, step {sj} must be an object")
                if not isinstance(step.get("narration"), str):
                    raise ValueError(f"Scene {si}, step {sj} must have a 'narration' string")
                if not isinstance(step.get("draws"), list):
                    raise ValueError(f"Scene {si}, step {sj} must have a 'draws' array")
                for dj, draw in enumerate(step["draws"]):
                    if not isinstance(draw, dict):
                        raise ValueError(f"Scene {si}, step {sj}, draw {dj} must be an object")
                    draw_type = draw.get("type")
                    if draw_type not in VALID_DRAW_TYPES:
                        raise ValueError(
                            f"Scene {si}, step {sj}, draw {dj} has invalid type '{draw_type}'. "
                            f"Must be one of: {', '.join(sorted(VALID_DRAW_TYPES))}"
                        )
                flat_steps.append({
                    "narration": step["narration"],
                    "draws": step["draws"],
                    "scene": si,
                    "scene_title": scene_title,
                })

        return {
            "title": data["title"],
            "scene_count": len(scenes),
            "steps": flat_steps,
        }

    # Fallback: flat steps format (legacy)
    steps = data.get("steps")
    if not isinstance(steps, list) or len(steps) == 0:
        raise ValueError("Lesson must have 'scenes' array or 'steps' array")

    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            raise ValueError(f"Step {i} must be an object")
        if not isinstance(step.get("narration"), str):
            raise ValueError(f"Step {i} must have a 'narration' string")
        if not isinstance(step.get("draws"), list):
            raise ValueError(f"Step {i} must have a 'draws' array")
        for j, draw in enumerate(step["draws"]):
            if not isinstance(draw, dict):
                raise ValueError(f"Step {i}, draw {j} must be an object")
            draw_type = draw.get("type")
            if draw_type not in VALID_DRAW_TYPES:
                raise ValueError(
                    f"Step {i}, draw {j} has invalid type '{draw_type}'. "
                    f"Must be one of: {', '.join(sorted(VALID_DRAW_TYPES))}"
                )
        step["scene"] = 0
        step["scene_title"] = data["title"]

    return {
        "title": data["title"],
        "scene_count": 1,
        "steps": steps,
    }


async def generate_lesson(topic: str) -> dict:
    """Generate a whiteboard lesson for the given topic using Gemini."""
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    response = await client.aio.models.generate_content(
        model="gemini-3-flash-preview",
        contents=f"Create a visual whiteboard lesson about: {topic}",
        config=types.GenerateContentConfig(
            system_instruction=DSL_SYSTEM_PROMPT,
            temperature=0.4,
        ),
    )

    text = ""
    if response.candidates and response.candidates[0].content:
        for part in response.candidates[0].content.parts:
            if part.text and not getattr(part, "thought", False):
                text += part.text

    text = strip_fences(text)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse Gemini response as JSON: {e}")

    return validate_and_flatten(data)
