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

PART 2 — DIAGRAM CHECKLIST (CRITICAL):
Search for educational diagrams of this topic (e.g., "labeled diagram of [topic]") and create a
COMPLETE checklist of every visual element that a good educational diagram must include.

For EACH element in the diagram, specify:
- WHAT to draw (exact name and shape description)
- HOW BIG it should be relative to other elements (e.g., "Sun = largest element, Jupiter = 2nd largest, Earth = small")
- WHAT COLOR it should be (e.g., "Earth = blue/green, Mars = red, Sun = yellow")
- WHERE it goes relative to other elements (e.g., "Mercury closest to Sun on the left, then Venus, then Earth...")
- WHAT LABEL to put on it (exact text, e.g., "Mercury", not "inner planet")

Also specify:
- ALL ARROWS/FLOWS needed with labels (e.g., "arrow from ocean upward labeled 'Evaporation'", "arrow from cloud downward labeled 'Precipitation'", "arrow along ground labeled 'Runoff'")
- The COMPLETE CYCLE or PROCESS — list every stage in order so nothing is skipped
  (e.g., water cycle: evaporation → condensation → precipitation → runoff → collection → repeat)
- DISTINCTIVE FEATURES that make elements recognizable
  (e.g., "Saturn MUST have rings", "Earth should show continents", "battery has + and - terminals")
- MINIMUM VISIBLE SIZE guidance: no element should be too small to see. Key elements need to be prominent.

PART 3 — SCENE BREAKDOWN:
Suggest how to split into 3-4 scenes:
- Scene 1 (Overview): list EVERY element and label that must appear
- Scene 2 (Detail): which mechanism to zoom into, what to show
- Scene 3 (Process): step-by-step flow with all arrows
- Scene 4 (Summary): key facts and takeaways

Return a well-organized summary. The diagram checklist is the MOST IMPORTANT part —
it directly determines what gets drawn. Be exhaustive: missing items = incomplete diagram."""

DSL_SYSTEM_PROMPT = """You are a visual teacher creating animated whiteboard lessons.
Given a topic and research material, produce a rich, detailed lesson with beautiful diagrams.

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
- Each scene has 2-4 steps, each step has 4-12 draw commands
- Each scene gets a FRESH BLANK canvas — previous scene content is NOT visible
- Scene 1: Introduction — the COMPLETE system overview (big picture)
- Scene 2: Zoom into the main mechanism / internal details
- Scene 3: Process or step-by-step flow
- Scene 4 (optional): Summary / key takeaways

═══════════════════════════════════════════════════
DRAW COMMAND TYPES (use ONLY these 9 types):
═══════════════════════════════════════════════════

1. PATH — For curves and organic shapes. Use ONLY smooth cubic bezier (C) commands.
   {"type":"path","d":"M... C... Z","stroke":"#color","fill":"#color or none","strokeWidth":2}

2. LINE — {"type":"line","x1":0,"y1":0,"x2":100,"y2":100,"stroke":"#color","strokeWidth":2,"dash":false}

3. ARROW — {"type":"arrow","x1":0,"y1":0,"x2":100,"y2":100,"stroke":"#color","strokeWidth":2,"dash":false}

4. CIRCLE — {"type":"circle","cx":100,"cy":100,"r":30,"stroke":"#color","fill":"#color or none","strokeWidth":2}
   MINIMUM r=12 for visible elements. r<12 is nearly invisible on the canvas.

5. ELLIPSE — {"type":"ellipse","cx":300,"cy":300,"rx":80,"ry":40,"stroke":"#color","fill":"#color or none","strokeWidth":2}
   MINIMUM rx or ry = 12.

6. RECT — {"type":"rect","x":0,"y":0,"w":100,"h":50,"stroke":"#color","fill":"#color or none","strokeWidth":1,"rx":4}

7. TEXT — Center-anchored. {"type":"text","x":100,"y":100,"content":"Label","color":"#color","fontSize":22}
   - fontSize min 20, titles 24-28. Max 20 chars for labels, 30 for titles.
   - SAFE: x 100–680, y 60–640.

8. ANNOTATION — Text with background box. {"type":"annotation","x":100,"y":100,"content":"Short","color":"#color","fontSize":18}
   - fontSize min 18. Max 4 words / 20 chars. SAFE: x 120–660, y 60–620.

9. BRACE — {"type":"brace","x":100,"y":50,"height":120,"side":"right","label":"Desc","color":"#color"}

═══════════════════════════════════════════════════
CRITICAL DRAWING RULE — COMPOSE FROM PRIMITIVES:
═══════════════════════════════════════════════════

DO NOT try to draw complex shapes with a single freehand path.
INSTEAD, compose recognizable objects by COMBINING simple primitives (circle, ellipse, rect, line).
Paths should ONLY be used for gentle curves that primitives cannot achieve.
All coordinates must be REAL NUMBERS — never use variables like X or Y.

SHAPE RECIPES — adapt these to your coordinates and sizes:

HEART at center (390,300):
  {"type":"circle","cx":372,"cy":300,"r":22,"stroke":"#e07050","fill":"#e07050","strokeWidth":2},
  {"type":"circle","cx":408,"cy":300,"r":22,"stroke":"#e07050","fill":"#e07050","strokeWidth":2},
  {"type":"path","d":"M352 305 C352 330, 390 355, 390 355 C390 355, 428 330, 428 305","stroke":"#e07050","fill":"#e07050","strokeWidth":2}

SUN at (620,130), r=35:
  {"type":"circle","cx":620,"cy":130,"r":35,"stroke":"#f5c842","fill":"#f5c842","strokeWidth":2},
  {"type":"line","x1":620,"y1":90,"x2":620,"y2":75,"stroke":"#f5c842","strokeWidth":2},
  {"type":"line","x1":620,"y1":170,"x2":620,"y2":185,"stroke":"#f5c842","strokeWidth":2},
  {"type":"line","x1":580,"y1":130,"x2":565,"y2":130,"stroke":"#f5c842","strokeWidth":2},
  {"type":"line","x1":660,"y1":130,"x2":675,"y2":130,"stroke":"#f5c842","strokeWidth":2},
  {"type":"line","x1":595,"y1":105,"x2":585,"y2":95,"stroke":"#f5c842","strokeWidth":2},
  {"type":"line","x1":645,"y1":105,"x2":655,"y2":95,"stroke":"#f5c842","strokeWidth":2}

TREE trunk at (300,500):
  {"type":"rect","x":290,"y":420,"w":20,"h":80,"stroke":"#8b6914","fill":"#8b6914","strokeWidth":1,"rx":2},
  {"type":"ellipse","cx":300,"cy":390,"rx":55,"ry":45,"stroke":"#5cb85c","fill":"#3d8b3d","strokeWidth":2}

LEAF at (400,300):
  {"type":"ellipse","cx":400,"cy":300,"rx":40,"ry":18,"stroke":"#5cb85c","fill":"#5cb85c","strokeWidth":2},
  {"type":"line","x1":365,"y1":300,"x2":435,"y2":300,"stroke":"#3d8b3d","strokeWidth":1}

HUMAN FIGURE head at (390,200):
  {"type":"circle","cx":390,"cy":200,"r":15,"stroke":"#e8e4d9","fill":"none","strokeWidth":2},
  {"type":"line","x1":390,"y1":215,"x2":390,"y2":255,"stroke":"#e8e4d9","strokeWidth":2},
  {"type":"line","x1":370,"y1":230,"x2":410,"y2":230,"stroke":"#e8e4d9","strokeWidth":2},
  {"type":"line","x1":390,"y1":255,"x2":375,"y2":280,"stroke":"#e8e4d9","strokeWidth":2},
  {"type":"line","x1":390,"y1":255,"x2":405,"y2":280,"stroke":"#e8e4d9","strokeWidth":2}

CELL at (390,350):
  {"type":"ellipse","cx":390,"cy":350,"rx":90,"ry":55,"stroke":"#e88aaf","fill":"none","strokeWidth":2},
  {"type":"circle","cx":390,"cy":350,"r":20,"stroke":"#e88aaf","fill":"#e88aaf","strokeWidth":1}

ATOM at (390,340):
  {"type":"circle","cx":390,"cy":340,"r":18,"stroke":"#e07050","fill":"#e07050","strokeWidth":2},
  {"type":"circle","cx":390,"cy":340,"r":40,"stroke":"#5ba3e6","fill":"none","strokeWidth":1},
  {"type":"circle","cx":390,"cy":340,"r":65,"stroke":"#5ba3e6","fill":"none","strokeWidth":1},
  {"type":"circle","cx":430,"cy":340,"r":4,"stroke":"#5ba3e6","fill":"#5ba3e6","strokeWidth":1}

ORGAN (vertical ellipse) at (390,350):
  {"type":"ellipse","cx":390,"cy":350,"rx":35,"ry":50,"stroke":"#e07050","fill":"#e07050","strokeWidth":2}

LUNG PAIR at (390,350):
  {"type":"ellipse","cx":350,"cy":350,"rx":30,"ry":55,"stroke":"#e88aaf","fill":"#e88aaf","strokeWidth":2},
  {"type":"ellipse","cx":430,"cy":350,"rx":30,"ry":55,"stroke":"#e88aaf","fill":"#e88aaf","strokeWidth":2},
  {"type":"line","x1":390,"y1":290,"x2":390,"y2":320,"stroke":"#e8e4d9","strokeWidth":2}

GENERAL RULES for composing ANY object:
- Body/torso → ellipse (rx>ry for horizontal, ry>rx for vertical)
- Head/sphere → circle
- Container/box → rect with rx for rounded corners
- Tube/pipe → rect (narrow and long) or two parallel lines
- Wings/petals → ellipses angled by adjusting rx/ry ratio
- Connections → lines or arrows between elements
- Highlights → smaller filled circles or ellipses overlaid
- All coordinates must be computed real numbers, NEVER use variables

═══════════════════════════════════════════════════
COLOR PALETTE (dark background #1a201a):
═══════════════════════════════════════════════════
- White/chalk: #e8e4d9 — DEFAULT for text, outlines
- Green: #5cb85c — plants, biology, positive
- Bright blue: #5ba3e6 — water, cool, deoxygenated blood
- Red/coral: #e07050 — heat, warnings, oxygenated blood, hearts
- Yellow/gold: #f5c842 — energy, sunlight, titles (best contrast)
- Orange: #f0a050 — warm processes, secondary
- Pink: #e88aaf — biological structures, soft
- Teal: #5ab8b8 — technology, alternative blue
- Purple: #9b7ed8 — abstract, special
- Dark fill only: #8b6914 (brown), #3d8b3d (dark green) — for fills, NEVER for text/strokes

COLOR RULES:
- Max 3-4 colors per scene. Same color = same meaning across all scenes.
- NEVER use black, #000-#333, or any dark color for text/strokes (invisible on dark bg).

═══════════════════════════════════════════════════
CANVAS & POSITIONING:
═══════════════════════════════════════════════════
CANVAS: 780 × 680 pixels.

SAFE AREA: x 60–720, y 80–620. ALL elements must fit inside.
- Circle: cx±r must stay within 60–720 (x) and 80–620 (y)
- Rect: x≥60, x+w≤720, y≥80, y+h≤620
- Text: x 100–680, y 80–640
- Annotations: x 120–660, y 80–620
- VERIFY every coordinate before writing it.

LAYOUT GRID — plan each scene on this grid:
  Title zone:    y 80–100 (centered at x:390)
  Top row:       y 120–280
  Middle row:    y 280–440
  Bottom row:    y 440–600
  Left column:   x 80–350
  Center column: x 250–530
  Right column:  x 430–700

SPACING:
- 60px+ vertical gap between text elements
- 30px+ gap between filled shapes
- Labels 25-35px from their parent shape
- Related items grouped within 40px, unrelated separated by 100px+

LAYOUT RULES:
- Scene title: x:390, y:85, fontSize 24-28
- Flow direction: consistent (left→right OR top→bottom OR circular)
- Physical reality: ground at BOTTOM, sky at TOP, heavy below, light above
- SIZE = IMPORTANCE: main concept is the LARGEST element
- Later steps ADD to existing content — never overlap previous elements

BUILDING A SCENE:
- Step 1: Title + PRIMARY shape (the one big thing — filled, large, bright)
- Step 2: SECONDARY shapes, connecting arrows, flow indicators
- Step 3: LABELS and TEXT for elements from steps 1-2
- Step 4: ANNOTATIONS, decorative detail, supporting context

COMPLETENESS RULES (MANDATORY — violations make the lesson unusable):
- EVERY named element MUST have its own TEXT label with its FULL NAME
  BAD:  "M - V - E - M - J - S - U - N" or "Inner Planets" as a group label
  GOOD: separate text "Mercury", text "Venus", text "Earth" etc., each near its shape
  If there are 8 planets, there MUST be 8 individual text labels.
- EVERY drawn shape MUST be visually distinct — use FILL COLORS from the palette
  BAD:  8 circles all with fill="none" (they all look the same, cannot tell apart)
  GOOD: Earth fill="#5ba3e6", Mars fill="#e07050", Jupiter fill="#f0a050", etc.
- EVERY stage of a process MUST have its own arrow with a label
  (e.g., water cycle needs arrows for: Evaporation, Condensation, Precipitation, Runoff, Collection)
- DISTINCTIVE FEATURES must be shown (e.g., Saturn's rings, Earth's blue/green, lightning in clouds)
- If the research lists it, draw it. Missing elements = incomplete diagram.
- When too many elements to fit, split across steps (not scenes). Each step can have up to 12 draws.

TEACHING STYLE:
- Conversational narration, like a friendly teacher
- Each step explains ONE concept as it's drawn
- Include specific facts and numbers from the research
- End with a summary scene

═══════════════════════════════════════════════════
CHAIN OF THOUGHT — PLAN BEFORE DRAWING:
═══════════════════════════════════════════════════
Before generating JSON, mentally work through these steps for EACH scene:

1. WHAT are the 3-5 key visual elements needed? (e.g., "heart, 4 chambers, valves, blood flow arrows")
2. WHERE does each element go on the grid? (e.g., "heart center at 390,350; labels in margins")
3. WHAT PRIMITIVES compose each element? (e.g., "heart = 2 circles + 1 path; chambers = 2 lines dividing it")
4. WHAT COLORS? (e.g., "red for left side, blue for right side, white for labels")
5. WHAT ORDER to draw? (e.g., "step1: heart outline; step2: chamber dividers + labels; step3: blood flow arrows")

═══════════════════════════════════════════════════
FEW-SHOT EXAMPLE — Water Cycle (1 scene excerpt):
═══════════════════════════════════════════════════
{
  "scene_title": "The Water Cycle",
  "steps": [
    {
      "narration": "Water is constantly moving through our environment in a beautiful cycle. Let me show you how it works.",
      "draws": [
        {"type":"text","x":390,"y":85,"content":"The Water Cycle","color":"#f5c842","fontSize":26},
        {"type":"circle","cx":620,"cy":140,"r":35,"stroke":"#f5c842","fill":"#f5c842","strokeWidth":2},
        {"type":"line","x1":620,"y1":105,"x2":620,"y2":80,"stroke":"#f5c842","strokeWidth":2},
        {"type":"line","x1":655,"y1":140,"x2":675,"y2":140,"stroke":"#f5c842","strokeWidth":2},
        {"type":"line","x1":645,"y1":115,"x2":660,"y2":100,"stroke":"#f5c842","strokeWidth":2},
        {"type":"rect","x":80,"y":500,"w":600,"h":100,"stroke":"#5ba3e6","fill":"#5ba3e6","strokeWidth":1,"rx":4},
        {"type":"text","x":380,"y":555,"content":"Ocean / Lake","color":"#e8e4d9","fontSize":22}
      ]
    },
    {
      "narration": "The sun heats the water, causing it to evaporate — rising as invisible water vapor into the atmosphere.",
      "draws": [
        {"type":"arrow","x1":250,"y1":490,"x2":250,"y2":300,"stroke":"#5ba3e6","strokeWidth":2,"dash":true},
        {"type":"arrow","x1":350,"y1":490,"x2":350,"y2":320,"stroke":"#5ba3e6","strokeWidth":2,"dash":true},
        {"type":"text","x":300,"y":400,"content":"Evaporation","color":"#5ba3e6","fontSize":22},
        {"type":"ellipse","cx":350,"cy":240,"rx":100,"ry":40,"stroke":"#e8e4d9","fill":"none","strokeWidth":2},
        {"type":"ellipse","cx":300,"cy":230,"rx":80,"ry":35,"stroke":"#e8e4d9","fill":"none","strokeWidth":1},
        {"type":"text","x":330,"y":195,"content":"Cloud","color":"#e8e4d9","fontSize":20}
      ]
    },
    {
      "narration": "When clouds cool down, water droplets form and fall back as rain — this is precipitation, completing the cycle!",
      "draws": [
        {"type":"arrow","x1":480,"y1":280,"x2":520,"y2":490,"stroke":"#5ba3e6","strokeWidth":2,"dash":false},
        {"type":"text","x":540,"y":400,"content":"Precipitation","color":"#5ba3e6","fontSize":22},
        {"type":"line","x1":450,"y1":300,"x2":455,"y2":340,"stroke":"#5ba3e6","strokeWidth":1},
        {"type":"line","x1":470,"y1":310,"x2":475,"y2":350,"stroke":"#5ba3e6","strokeWidth":1},
        {"type":"line","x1":490,"y1":290,"x2":495,"y2":330,"stroke":"#5ba3e6","strokeWidth":1},
        {"type":"annotation","x":390,"y":140,"content":"Heat drives cycle","color":"#f5c842","fontSize":18}
      ]
    }
  ]
}

Notice how the example uses:
- CIRCLE for sun (not a wobbly path), RECT for water body, ELLIPSE for clouds
- Simple lines for sun rays, dashed arrows for evaporation, solid arrows for rain
- Each step adds one concept: scene → evaporation → precipitation
- All coordinates within safe bounds, labels near their elements"""

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
                    # Clamp font sizes to minimums
                    if draw_type == "text" and draw.get("fontSize", 20) < 20:
                        draw["fontSize"] = 20
                    if draw_type == "annotation" and draw.get("fontSize", 18) < 18:
                        draw["fontSize"] = 18
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
