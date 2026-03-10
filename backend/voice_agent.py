"""Narration agent factory — creates an ADK Agent that narrates lesson steps."""

import os

from google.adk.agents import Agent

QUIZ_TIMER_SECONDS = int(os.getenv("QUIZ_TIMER_SECONDS", "6"))


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

    # Build quiz context if available
    quiz_context = ""
    quizzes = lesson_data.get("quizzes", [])
    if quizzes:
        quiz_parts = []
        for quiz in quizzes:
            scene = quiz.get("scene", 0)
            scene_title = quiz.get("scene_title", f"Scene {scene + 1}")
            quiz_parts.append(f"\nQuiz after Scene {scene} — cumulative ({scene_title}):")
            for qi, q in enumerate(quiz.get("questions", [])):
                opts = " | ".join(f"{o['label']}: {o['text']}" for o in q.get("options", []))
                quiz_parts.append(f"  Q{qi+1}: {q['question']}")
                quiz_parts.append(f"    {opts}")
                quiz_parts.append(f"    Answer: {q['correct']}")
        quiz_context = "\n\nQUIZ QUESTIONS:\n" + "\n".join(quiz_parts)

    instruction = f"""You are ChalkMind, a warm and engaging whiteboard tutor.
You are narrating a visual lesson that is being drawn on a chalkboard in real-time.
The learner sees animated drawings appearing as you speak.

LESSON TITLE: {lesson_data.get("title", "Untitled")}
TOTAL STEPS: {total_steps}

FULL LESSON PLAN:
{lesson_context}
{quiz_context}

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
8. Keep each step to roughly 5-15 seconds of speech. Be concise — do not ramble.

QUIZ RULES (when prompted to do quiz activities):
9. When told to introduce a quiz: say a brief, encouraging intro (1-2 sentences) and STOP.
10. When told to read a question: read the question clearly, then read all 4 options
    (say the letter and the text), say "You have {QUIZ_TIMER_SECONDS} seconds", and STOP.
11. Do NOT reveal answers after individual questions. Wait for the batch reveal prompt.
12. When told to reveal all answers (batch): narrate all results in sequence.
    Be encouraging — celebrate correct answers, gently correct wrong ones.
    Keep each reveal to 1-2 sentences. End with the overall score and STOP.
13. Keep quiz narration concise and upbeat — maintain the friendly tutor tone."""

    return Agent(
        name="narration_agent",
        model="gemini-2.5-flash-native-audio-preview-12-2025",
        instruction=instruction,
        tools=[],
    )
