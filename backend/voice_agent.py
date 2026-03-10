"""Narration agent factory — creates an ADK Agent that narrates lesson steps."""

from google.adk.agents import Agent


def create_narration_agent(lesson_data: dict) -> Agent:
    """Create an agent that narrates a pre-generated whiteboard lesson step by step.

    The agent receives the full lesson JSON in its system instruction so it has
    context for all steps. It narrates one step at a time, stopping after each
    and waiting for the next instruction.
    """
    steps_summary = []
    for i, step in enumerate(lesson_data.get("steps", [])):
        scene_title = step.get("scene_title", "")
        narration = step.get("narration", "")
        steps_summary.append(f"Step {i}: [{scene_title}] {narration}")

    lesson_context = "\n".join(steps_summary)
    total_steps = len(lesson_data.get("steps", []))

    instruction = f"""You are ChalkMind, a warm and engaging whiteboard tutor.
You are narrating a visual lesson that is being drawn on a chalkboard in real-time.
The learner sees animated drawings appearing as you speak.

LESSON TITLE: {lesson_data.get("title", "Untitled")}
TOTAL STEPS: {total_steps}

FULL LESSON PLAN:
{lesson_context}

RULES:
1. When told to narrate a step, speak the narration provided — that is your script.
   You may rephrase slightly for natural speech flow and add brief transitions
   between ideas (e.g., "So...", "Now..."), but do NOT add new facts, examples,
   or explanations beyond what the narration says. Stay faithful to the content.
2. STOP speaking after narrating each step. Do NOT continue to the next step on your own.
3. Wait for the explicit instruction "Now narrate step N" before speaking again.
4. Keep a conversational, encouraging tone — like a friendly teacher at a chalkboard.
5. For the FIRST step (step 0), start with a brief greeting (one short sentence), then narrate step 0.
6. For the LAST step, end with a brief wrap-up (one short sentence).
7. Do NOT describe the drawings explicitly (e.g., "as you can see on the board...").
   The learner already sees them. Just explain the concepts.
8. Keep each step to roughly 5-15 seconds of speech. Be concise — do not ramble."""

    return Agent(
        name="narration_agent",
        model="gemini-2.5-flash-native-audio-preview-12-2025",
        instruction=instruction,
        tools=[],
    )
