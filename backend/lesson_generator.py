"""Generate whiteboard lessons using Gemini and the Drawing DSL."""

import json
import re
import uuid

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import google_search
from google.genai import types

RESEARCH_PROMPT = """You are an educational researcher preparing material for a visual whiteboard lesson.
The lesson will be drawn on a dark chalkboard (780x680px) with animated diagrams.

Given a topic, search the web to gather comprehensive, accurate, up-to-date information.

PART 1 — FACTUAL RESEARCH:
- Key concepts and clear definitions
- How things work (processes, mechanisms, cause-and-effect)
- Important facts, figures, and data points (specific numbers!)
- Real-world examples and applications
- Common misconceptions worth addressing
- Recent developments or discoveries

PART 2 — VISUAL STRUCTURE GUIDE:
After your research, add a section called "VISUAL LAYOUT SUGGESTIONS" that helps a diagram artist draw this topic. Include:
- The 3-4 key visual elements that MUST appear — describe COMPLETE objects, not simplified icons
  (e.g., "a FULL plant with roots underground, stem, and leaves above ground — NOT just a floating leaf"
   or "a COMPLETE atom with nucleus at center and electron shells around it — NOT just a dot")
- For each element, list its PARTS and how they connect (e.g., "plant: roots at bottom absorbing water → stem going up → branches → leaves at top catching sunlight")
- How elements relate spatially (e.g., "water flows UP from roots to leaves", "electrons orbit AROUND the nucleus")
- Natural reading order / flow direction (left-to-right? top-to-bottom? circular?)
- Which parts are BIG vs small (relative scale matters for understanding)
- Color associations (e.g., "chlorophyll = green", "arteries = red, veins = blue")
- What the OVERVIEW scene should show (the complete system) vs what DETAIL scenes should zoom into

Return a well-organized summary with specific details, numbers, and visual guidance.
The more concrete and spatially aware the information, the better the whiteboard lesson will be."""

DSL_SYSTEM_PROMPT = """You are a visual teacher creating animated whiteboard lessons.
Given a topic and research material, produce a rich, detailed lesson with beautiful hand-drawn-style diagrams.

IMPORTANT: Your lesson is MULTI-SCENE. Each scene gets a FRESH, BLANK canvas.
Use the research material provided to ensure accuracy — include specific numbers, facts, and up-to-date information.

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no backticks, no text before or after the JSON:
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
- Scene 1: Introduction — draw the COMPLETE system/object (e.g., a full plant with roots+stem+leaves, a full atom, a full solar system). Show how parts connect. This is the "big picture" — don't simplify to just one part.
- Scene 2: Zoom into the main mechanism / internal details
- Scene 3: Process or mechanism explanation (step-by-step flow)
- Scene 4 (optional): Summary / key takeaways with chemical/math formulas
- Think of scenes like "slides" or "chapters" — each one is self-contained visually

DRAW COMMAND TYPES (use ONLY these):

1. PATH — For any shape, curve, or organic form. Use smooth cubic bezier curves.
   {"type":"path","d":"M100 200 C120 180, 150 170, 160 190 ...","stroke":"#color","fill":"#color or none","strokeWidth":2}
   PATH QUALITY RULES:
   - ALWAYS use C (cubic bezier) commands for organic shapes, NOT straight lines
   - Control points must create SMOOTH curves — avoid sharp zigzags
   - Close organic shapes with Z command
   - Keep paths simple: 3-6 curve segments max per path

2. LINE — Straight line
   {"type":"line","x1":0,"y1":0,"x2":100,"y2":100,"stroke":"#color","strokeWidth":2,"dash":false}

3. ARROW — Line with arrowhead (for flows, processes, pointers)
   {"type":"arrow","x1":0,"y1":0,"x2":100,"y2":100,"stroke":"#color","strokeWidth":2,"dash":false}

4. CIRCLE — Perfect circle (equal width and height)
   {"type":"circle","cx":100,"cy":100,"r":30,"stroke":"#color","fill":"#color or none","strokeWidth":2}

5. ELLIPSE — Oval shape (different width and height). Use for bodies, eyes, eggs, orbits, cells.
   {"type":"ellipse","cx":300,"cy":300,"rx":80,"ry":40,"stroke":"#color","fill":"#color or none","strokeWidth":2}
   - rx = horizontal radius, ry = vertical radius
   - Use for bird bodies (rx > ry), eggs (ry > rx), eye shapes, cell cross-sections
   - Prefer ELLIPSE over CIRCLE when the object is not perfectly round

6. RECT — Rectangle
   {"type":"rect","x":0,"y":0,"w":100,"h":50,"stroke":"#color","fill":"#color or none","strokeWidth":1,"rx":4}

7. TEXT — Label text on the board. Text is CENTER-ANCHORED at (x, y).
   {"type":"text","x":100,"y":100,"content":"Label","color":"#color","fontSize":22}
   TEXT RULES:
   - fontSize: minimum 20, use 24-28 for scene titles
   - Text is horizontally centered at x — so a 10-character label at fontSize 22 spans ~99px total (10 × 22 × 0.45)
   - SAFE ZONE: x must be between 100 and 680. y must be between 60 and 640.
   - Keep labels SHORT: max 20 characters for labels, max 30 for titles

8. ANNOTATION — Text with auto-sized background box. Box is centered at (x, y).
   {"type":"annotation","x":100,"y":100,"content":"Short note","color":"#color","fontSize":18}
   ANNOTATION RULES:
   - fontSize: minimum 18
   - Content must be SHORT: max 4 words, max 20 characters
   - Box width ≈ characterCount × fontSize × 0.45 + 16px. Box height ≈ fontSize + 16px.
   - SAFE ZONE: x must be between 120 and 660. y must be between 60 and 620.
   - Example: "CO₂ Absorbed" (12 chars) at fontSize 18 → box ~113px wide. At x=390, spans 334–446. SAFE.
   - Example: "Photosynthesis Process" (22 chars) at fontSize 18 → box ~194px wide. TOO LONG — shorten it!

9. BRACE — Curly brace spanning a region with label
   {"type":"brace","x":100,"y":50,"height":120,"side":"right","label":"Description","color":"#color"}

COLOR PALETTE — READABILITY FIRST (dark background #1a201a):
The canvas background is VERY DARK (#1a201a). Every color must have HIGH CONTRAST against it.
- White/chalk: #e8e4d9 — DEFAULT for text, labels, primary outlines
- Green: #5cb85c — plants, positive, biology
- Bright blue: #5ba3e6 — water, cool concepts, highlights
- Red/coral: #e07050 — warnings, heat, important callouts
- Yellow/gold: #f5c842 — energy, sunlight, emphasis (GREAT for titles)
- Orange: #f0a050 — secondary emphasis, warm processes
- Pink: #e88aaf — soft highlights, biological structures
- Teal: #5ab8b8 — alternative to blue, technology
- Purple: #9b7ed8 — special concepts, abstract ideas
- Dim/gray: #706b60 — ONLY for subtle grid lines or very minor detail, NEVER for text or labels

NEVER USE these colors for text or strokes (invisible on dark bg):
- Black or near-black (#000, #111, #222, #333)
- Dark brown (#8b7355) for text — OK for fills only
- Dark green (#3d8b3d) for text — OK for fills only

CANVAS: 780 × 680 pixels. SAFE DRAWING AREA: x 40–740, y 40–640 (40px margin on all sides).

═══════════════════════════════════════════════════
POSITIONING RULES (CRITICAL — prevents overflow and overlap):
═══════════════════════════════════════════════════

BOUNDARY RULES — NOTHING may be cut off or overflow:
- SAFE AREA: x 60–720, y 60–620. All elements must fit FULLY inside this box.
- ALL text x: between 100 and 680 (text is center-anchored, needs extra margin for width)
- ALL text y: between 60 and 640
- ALL annotations x: between 120 and 660
- ALL annotations y: between 60 and 620
- Circle: cx - r ≥ 60 AND cx + r ≤ 720 AND cy - r ≥ 60 AND cy + r ≤ 620
  Example: a sun with r=50 at top-right → cx=660, cy=120 (NOT cx=730 which would cut it off!)
- Rect: x ≥ 60, x + w ≤ 720, y ≥ 60, y + h ≤ 620
- Arrows/lines: all endpoints must be within 60–720 (x) and 60–620 (y)
- VERIFY: before writing any coordinate, mentally check "is this fully inside 60–720 x 60–620?"

SPACING RULES — prevents overlapping:
- Minimum 60px vertical gap between any two text/annotation elements
- Minimum 30px gap between filled shapes
- Labels go BELOW or BESIDE their shape, offset by at least 25px from shape edge
- Never stack text directly on top of a filled shape
- Each step uses a DIFFERENT region of the canvas

LOGICAL LAYOUT — diagrams must make real-world spatial sense:
- Scene title: centered at x:390, y:55, fontSize 24-28
- THINK ABOUT WHAT YOU'RE DRAWING and place elements where they belong in real life:

  PHOTOSYNTHESIS example layout (Scene 1 overview):
  - Sun: top-right corner (r=40, cx:640, cy:120) with yellow rays going down-left
  - Plant: CENTER of canvas, COMPLETE with:
    - Brown ground line at y:480 spanning the width
    - Roots BELOW ground (y:480-580) in brown
    - Stem going UP from ground (y:250-480) in brown/green
    - Leaves branching from stem (y:200-350) in green with fill
  - Water arrow: coming UP from roots (blue, labeled "H₂O")
  - CO₂ arrow: coming from left toward leaves (white, labeled "CO₂")
  - O₂ arrow: going out from leaves to right (teal, labeled "O₂")
  - Light rays: dashed yellow arrows from sun to leaves

  SOLAR SYSTEM example layout:
  - Sun: large circle (r=60) at LEFT (cx:120, cy:340)
  - Planets: progressively smaller circles going RIGHT, with orbit lines
  - Labels below each planet

  ATOM example layout:
  - Nucleus: center (cx:390, cy:340), filled circle
  - Electron shells: concentric circles around nucleus
  - Electrons: small dots on the shells

- Flow direction: consistent within a scene (left→right OR top→bottom OR circular)
- Related items GROUPED together, unrelated items SEPARATED (80px+ gap)
- Cause on LEFT → effect on RIGHT (or top → bottom for vertical processes)
- Use arrows to show direction/flow between elements
- Physical concepts respect reality: ground at BOTTOM, sky at TOP, heavy things below, light above
- Scale matters: important things are BIGGER, minor details are smaller

BUILDING A SCENE — plan first, then draw step-by-step:
- BEFORE writing any step, plan the FULL layout: "title at top, main diagram in center, labels around edges, annotations in empty space"
- Step 1: draw the MAIN structure (title + primary shapes with fills)
- Step 2: add LABELS, DETAIL lines, and connecting arrows
- Step 3+: add SUPPORTING annotations, secondary elements, decorative details
- CRITICAL: later steps ADD to what's already drawn — never place new elements on top of existing ones
- Each step should reference the research for accurate details and numbers

DRAWING QUALITY:
- For natural objects, use MULTIPLE PATH commands with smooth cubic beziers
- Add detail: texture lines, small decorative elements, subtle curves
- Each step MUST have 4-8 draw commands — never fewer than 4
- Use fill colors with organic shapes — don't leave everything as outlines
- Layer elements: background first, foreground on top
- Consistent stroke widths: 2 for main shapes, 1 for detail, 3 for emphasis
- Shapes should be PROPORTIONAL to their real-world relative sizes

TEACHING STYLE:
- Narration should be conversational, like a friendly teacher
- Build up the concept piece by piece within each scene
- Each scene focuses on ONE aspect — don't try to show everything at once
- Include specific numbers and facts from the research (e.g., "99.86% of the mass", "6CO₂ + 6H₂O")
- End with a summary scene that ties everything together"""

VALID_DRAW_TYPES = {"path", "line", "arrow", "circle", "ellipse", "rect", "text", "annotation", "brace"}

# ── ADK Agent definitions ──────────────────────────────────────
topic_researcher = Agent(
    name="topic_researcher",
    model="gemini-3.1-flash-lite-preview",
    instruction=RESEARCH_PROMPT,
    tools=[google_search],
)

lesson_generator_agent = Agent(
    name="lesson_generator",
    model="gemini-3-flash-preview",
    instruction=DSL_SYSTEM_PROMPT,
)

_session_service = InMemorySessionService()
_research_runner = Runner(
    app_name="chalkmind", agent=topic_researcher, session_service=_session_service
)
_lesson_runner = Runner(
    app_name="chalkmind", agent=lesson_generator_agent, session_service=_session_service
)


def strip_fences(text: str) -> str:
    """Remove markdown code fences and any trailing text outside the JSON object."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    text = text.strip()
    # Extract the outermost JSON object — agent may append commentary after the JSON
    start = text.find("{")
    if start == -1:
        return text
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        c = text[i]
        if escape:
            escape = False
            continue
        if c == "\\":
            escape = True
            continue
        if c == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return text


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
    """Generate a whiteboard lesson: research with web grounding, then generate structured lesson."""
    user_id = "system"

    # ── Step 1: Research with web grounding ──────────────────
    research_session_id = str(uuid.uuid4())
    await _session_service.create_session(
        app_name="chalkmind", user_id=user_id, session_id=research_session_id
    )

    research_text = ""
    async for event in _research_runner.run_async(
        user_id=user_id,
        session_id=research_session_id,
        new_message=types.Content(
            parts=[types.Part(text=f"Research this topic for an educational lesson: {topic}")]
        ),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text and not getattr(part, "thought", False):
                    research_text += part.text

    if not research_text.strip():
        raise ValueError("Research agent returned no results")

    # ── Step 2: Generate structured lesson ───────────────────
    lesson_session_id = str(uuid.uuid4())
    await _session_service.create_session(
        app_name="chalkmind", user_id=user_id, session_id=lesson_session_id
    )

    lesson_text = ""
    async for event in _lesson_runner.run_async(
        user_id=user_id,
        session_id=lesson_session_id,
        new_message=types.Content(
            parts=[types.Part(text=(
                f"Use this research to create an accurate, up-to-date lesson:\n\n"
                f"---RESEARCH---\n{research_text}\n---END RESEARCH---\n\n"
                f"Create a visual whiteboard lesson about: {topic}"
            ))]
        ),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text and not getattr(part, "thought", False):
                    lesson_text += part.text

    # ── Parse & validate ─────────────────────────────────────
    lesson_text = strip_fences(lesson_text)
    try:
        data = json.loads(lesson_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse lesson JSON: {e}")

    return validate_and_flatten(data)
